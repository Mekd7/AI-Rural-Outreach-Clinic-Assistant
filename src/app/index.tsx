import { useCallback, useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, View, ActivityIndicator, ScrollView, TextInput } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { db, getPatients } from '@/db/client';
import type { Patient, TriageLevel } from '@/types';
import { TriageBadge } from '@/components/TriageBadge';
import { PatientCard } from '@/components/PatientCard';

export default function HomeScreen() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [triageFilter, setTriageFilter] = useState<TriageLevel | 'ALL'>('ALL');

  const loadPatients = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPatients();
      setPatients(data);
    } catch (err) {
      console.error('Failed to load patients:', err);
      setError('Unable to load patients from local storage.');
      Alert.alert('Load Failed', 'Unable to load patients from local storage.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  useFocusEffect(
    useCallback(() => {
      loadPatients();
    }, [loadPatients])
  );

  // Derive filtered list from loaded patients
  const filteredPatients = useMemo(() => {
    let result = patients;

    // Apply triage filter
    if (triageFilter !== 'ALL') {
      result = result.filter((p) => p.triage_level === triageFilter);
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
  }, [patients, searchQuery, triageFilter]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0284c7" />
          <Text style={styles.loadingText}>Loading patients...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={loadPatients}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const triageTabs: Array<{ key: TriageLevel | 'ALL'; label: string }> = [
    { key: 'ALL', label: 'All' },
    { key: 'RED', label: 'Red (Emergency)' },
    { key: 'YELLOW', label: 'Yellow (Urgent)' },
    { key: 'GREEN', label: 'Green (Stable)' },
  ];

  return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <View style={styles.headerTopRow}>
              <View style={styles.headerLeft}>
                <Text style={styles.title}>Clinic Queue</Text>
                <View style={styles.statusPill}>
                  <Text style={styles.statusPillText}>Offline - Saved Locally</Text>
                </View>
              </View>
              <Pressable style={styles.newPatientButton} onPress={() => router.push('/register')}>
                <Text style={styles.newPatientButtonText}>+ New Patient</Text>
              </Pressable>
            </View>
            <Text style={styles.subtitle}>{filteredPatients.length} patient{filteredPatients.length !== 1 ? 's' : ''} registered</Text>
          </View>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or kebele..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.filterTabsContainer}>
            {triageTabs.map((tab) => (
              <Pressable
                key={tab.key}
                style={[
                  styles.filterTab,
                  triageFilter === tab.key && styles.filterTabActive,
                  tab.key !== 'ALL' && styles.filterTabColored,
                ]}
                onPress={() => setTriageFilter(tab.key)}>
                {tab.key !== 'ALL' && (
                  <TriageBadge level={tab.key} size="small" />
                )}
                <Text
                  style={[
                    styles.filterTabText,
                    triageFilter === tab.key && styles.filterTabTextActive,
                  ]}>
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

        {filteredPatients.length === 0 && patients.length > 0 ? (
          <View style={styles.noResultsContainer}>
            <Text style={styles.noResultsTitle}>No patients found</Text>
            <Text style={styles.noResultsSubtitle}>
              No patients match "{searchQuery}". Try a different name or kebele.
            </Text>
          </View>
        ) : patients.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No Patients Yet</Text>
            <Text style={styles.emptySubtitle}>Register your first patient to begin.</Text>
            <Pressable style={styles.ctaButton} onPress={() => router.push('/register')}>
              <Text style={styles.ctaText}>Register New Patient</Text>
            </Pressable>
          </View>
        ) : (
                  <View style={styles.listContainer}>
                    {filteredPatients.map((patient) => (
                      <PatientCard key={patient.id} patient={patient} />
                    ))}
                  </View>
                )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ebf3f7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#475569',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#0ea5e9',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100,
  },
  header: {
      marginBottom: 24,
    },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    headerLeft: {
      flex: 1,
      gap: 8,
    },
    title: {
      fontSize: 30,
      fontWeight: '700',
      color: '#0f172a',
      marginBottom: 4,
    },
    statusPill: {
      backgroundColor: '#fef3c7',
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 4,
      alignSelf: 'flex-start',
    },
    statusPillText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#b45309',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    newPatientButton: {
      backgroundColor: '#0284c7',
      borderRadius: 12,
      paddingHorizontal: 20,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      shadowColor: '#0284c7',
      shadowOpacity: 0.3,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    newPatientButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '700',
    },
    subtitle: {
          fontSize: 16,
          color: '#475569',
        },
        searchContainer: {
          marginBottom: 16,
        },
        searchInput: {
          backgroundColor: '#ffffff',
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 14,
          fontSize: 16,
          color: '#0f172a',
          borderWidth: 1,
          borderColor: '#e2e8f0',
          shadowColor: '#000',
          shadowOpacity: 0.03,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 1,
        },
        noResultsContainer: {
          alignItems: 'center',
          gap: 8,
          paddingVertical: 48,
          paddingHorizontal: 24,
        },
        noResultsTitle: {
          fontSize: 18,
          fontWeight: '600',
          color: '#0f172a',
        },
        noResultsSubtitle: {
              fontSize: 14,
              color: '#64748b',
              textAlign: 'center',
            },
            filterTabsContainer: {
              flexDirection: 'row',
              gap: 8,
              marginBottom: 16,
              flexWrap: 'wrap',
            },
            filterTab: {
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: '#ffffff',
              borderWidth: 1,
              borderColor: '#e2e8f0',
            },
            filterTabActive: {
              backgroundColor: '#0284c7',
              borderColor: '#0284c7',
            },
            filterTabColored: {
              backgroundColor: '#f8fafc',
            },
            filterTabText: {
              fontSize: 13,
              fontWeight: '600',
              color: '#475569',
            },
            filterTabTextActive: {
              color: '#ffffff',
            },
            emptyContainer: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#475569',
    textAlign: 'center',
  },
  ctaButton: {
    backgroundColor: '#0ea5e9',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 28,
  },
  ctaText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  listContainer: {
      gap: 12,
    },
  });
