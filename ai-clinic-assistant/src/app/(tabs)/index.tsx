import { router, useFocusEffect, useNavigation } from 'expo-router';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db, getPatients } from '@/db/client';
import type { Patient } from '@/types';
import { TRIAGE_LEVELS, TRIAGE_FILTER_LABELS, TRIAGE_COLORS, type TriageLevel } from '@/constants/triage';
import { PatientCard } from '@/components/PatientCard';
import { Header, Palette } from '@/constants/palette';

export default function HomeScreen() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<TriageLevel | 'ALL'>('ALL');
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const loadPatients = useCallback(async () => {
      if (!isMounted.current) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await getPatients();
        if (isMounted.current) {
          setPatients(data);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load patients';
        if (message.includes('Database not initialized')) {
          setTimeout(() => {
            if (isMounted.current) {
              loadPatients();
            }
          }, 500);
          return;
        }
        if (isMounted.current) {
          setError(message);
          Alert.alert('Error', message);
        }
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
        }
      }
    }, []);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const navigation = useNavigation();

  useFocusEffect(
    useCallback(() => {
      loadPatients();
    }, [loadPatients])
  );

  // Backup listener for tab switches that may not trigger useFocusEffect
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadPatients();
    });
    return unsubscribe;
  }, [navigation, loadPatients]);

  const deletePatient = useCallback(async (id: string) => {
    Alert.alert(
      'Delete Patient',
      'Are you sure? This will also delete all consultations for this patient.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await db.runAsync('DELETE FROM consultations WHERE patient_id = ?', [id]);
              await db.runAsync('DELETE FROM patients WHERE id = ?', [id]);
              loadPatients();
            } catch (err) {
              console.error('Failed to delete patient:', err);
              Alert.alert('Error', 'Unable to delete patient.');
            }
          },
        },
      ],
    );
  }, [loadPatients]);

  const handlePatientPress = useCallback(async (patientId: string) => {
    try {
      const existing = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM consultations WHERE patient_id = ? ORDER BY created_at DESC LIMIT 1',
        [patientId],
      );
      if (existing) {
        router.push(`/consultation/view/${existing.id}` as any);
      } else {
        router.push(`/consultation/${patientId}` as any);
      }
    } catch {
      // Fallback to new consultation on error
      router.push(`/consultation/${patientId}` as any);
    }
  }, []);

  const filteredPatients = useMemo(() => {
    let result = patients;

    // Apply triage filter
    if (activeFilter !== 'ALL') {
      result = result.filter((p) => p.triage_level === activeFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.full_name.toLowerCase().includes(query) ||
          p.kebele.toLowerCase().includes(query)
      );
    }

    return result;
  }, [patients, searchQuery, activeFilter]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.headerTitle}>Clinic Assistant</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>Offline</Text>
          </View>
        </View>
        <View style={styles.headerBottomRow}>
          <Pressable style={styles.handoverButton} onPress={() => router.push('/handover' as any)}>
            <Text style={styles.handoverButtonText}>HEW Handover</Text>
          </Pressable>
          <Pressable style={styles.newPatientButton} onPress={() => router.push('/(tabs)/register' as any)}>
            <Text style={styles.newPatientButtonText}>+ New Patient</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or kebele…"
                placeholderTextColor={Palette.faint}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.filterContainer}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.filterTabsWrapper}
                    >
                      {(['ALL', ...TRIAGE_LEVELS] as const).map((filter) => (
                        <Pressable
                          key={filter}
                          style={[
                            styles.filterTab,
                            activeFilter === filter ? styles.filterTabActive : null,
                            filter !== 'ALL' && activeFilter !== filter && { borderColor: TRIAGE_COLORS[filter].border },
                          ]}
                          onPress={() => setActiveFilter(filter)}
                        >
                          <Text
                            style={[
                              styles.filterTabText,
                              activeFilter === filter ? styles.filterTabTextActive : null,
                              filter !== 'ALL' && activeFilter !== filter ? { color: TRIAGE_COLORS[filter].text } : null,
                            ]}
                          >
                            {filter === 'ALL' ? 'All' : TRIAGE_FILTER_LABELS[filter]}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>

                  <View style={styles.listContainer}>
                    {isLoading ? (
                      <View style={styles.loadingContainer}>
                        <Text style={styles.subtitle}>Loading patients…</Text>
                      </View>
                    ) : error ? (
                      <View style={styles.loadingContainer}>
                        <Text style={[styles.subtitle, styles.error]}>{error}</Text>
                      </View>
                    ) : filteredPatients.length === 0 ? (
                      <View style={styles.emptyState}>
                        <Text style={styles.emptyStateText}>
                          {searchQuery || activeFilter !== 'ALL'
                            ? 'No patients match your filters.'
                            : 'No patients registered yet.'}
                        </Text>
                        <Text style={styles.emptyStateSubtext}>
                          {searchQuery || activeFilter !== 'ALL'
                            ? 'Try adjusting your search or filter.'
                            : 'Tap + New Patient to add one.'}
                        </Text>
                      </View>
                    ) : (
                      <FlatList
                                              data={filteredPatients}
                                              keyExtractor={(item) => item.id}
                                              renderItem={({ item }) => (
                                                                                              <PatientCard
                                                                                                patient={item}
                                                                                                onPress={() => handlePatientPress(item.id)}
                                                                                                onEdit={() => router.push(`/patient/edit/${item.id}` as any)}
                                                                                                onDelete={() => deletePatient(item.id)}
                                                                                              />
                                                                                            )}
                                              contentContainerStyle={styles.listContent}
                                              showsVerticalScrollIndicator={false}
                                            />
                    )}
                  </View>
                </SafeAreaView>
              );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Palette.parchment,
  },
  header: {
    backgroundColor: Palette.burgundy,
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 16,
    shadowColor: Palette.ink,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 251, 244, 0.15)',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    color: Palette.cream,
    fontSize: 22,
    fontWeight: '700',
  },
  statusBadge: {
    backgroundColor: Header.chip,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    color: Palette.cream,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  handoverButton: {
    flex: 1,
    backgroundColor: Header.chip,
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Header.chipBorder,
    alignItems: 'center',
  },
  handoverButtonText: {
    color: Palette.cream,
    fontSize: 13,
    fontWeight: '700',
  },
  newPatientButton: {
    flex: 1,
    backgroundColor: Palette.cream,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  newPatientButtonText: {
    color: Palette.burgundy,
    fontSize: 13,
    fontWeight: '700',
  },
  searchContainer: {
    backgroundColor: Palette.cream,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.line,
  },
  searchInput: {
      backgroundColor: Palette.parchment,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: Palette.ink,
      borderWidth: 1,
      borderColor: Palette.line,
    },
    filterContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: Palette.cream,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Palette.line,
      },
      filterTabsWrapper: {
        flexDirection: 'row',
        gap: 8,
      },
      filterTab: {
        borderRadius: 999,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: Palette.line,
        backgroundColor: Palette.parchment,
        minWidth: 90,
        alignItems: 'center',
      },
      filterTabActive: {
        backgroundColor: Palette.burgundy,
        borderColor: Palette.burgundy,
      },
      filterTabText: {
        fontSize: 13,
        fontWeight: '600',
        color: Palette.muted,
      },
      filterTabTextActive: {
        color: Palette.cream,
      },
    container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: Palette.ink,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Palette.muted,
    marginBottom: 24,
  },
  error: {
    color: Palette.danger,
  },
  emptyState: {
    alignItems: 'center',
    gap: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: Palette.muted,
    fontWeight: '600',
  },
  emptyStateSubtext: {
      fontSize: 14,
      color: Palette.faint,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 48,
    },
    listContainer: {
      flex: 1,
      backgroundColor: Palette.parchment,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 24,
    },
    ctaButton: {
    backgroundColor: Palette.teal,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 28,
  },
  ctaText: {
    color: Palette.cream,
    fontSize: 18,
    fontWeight: '700',
  },
});