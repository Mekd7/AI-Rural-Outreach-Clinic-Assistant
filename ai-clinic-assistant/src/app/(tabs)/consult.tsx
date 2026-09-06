import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { db } from '@/db/client';
import type { Patient } from '@/types';
import { TRIAGE_COLORS } from '@/constants/triage';
import { Palette } from '@/constants/palette';

interface ConsultationRow {
  id: string;
  patient_id: string;
  subjective_notes: string;
  created_at: string;
}

interface ConsultListItem {
  consultation: ConsultationRow;
  patient: Patient | null;
}

export default function ConsultScreen() {
  const [items, setItems] = useState<ConsultListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadConsultations = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await db.getAllAsync<ConsultationRow>(
        'SELECT * FROM consultations ORDER BY created_at DESC',
      );
      console.log('Consultations fetched:', rows?.length ?? 0);
      const results: ConsultListItem[] = [];
      for (const row of rows ?? []) {
        const patient = await db.getFirstAsync<Patient>(
          'SELECT * FROM patients WHERE id = ?',
          [row.patient_id],
        );
        results.push({ consultation: row, patient: patient ?? null });
      }
      setItems(results);
    } catch (err) {
      console.error('Failed to load consultations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadConsultations();
    }, [loadConsultations]),
  );

  const deleteConsultation = (id: string) => {
    Alert.alert(
      'Delete Consultation',
      'Are you sure you want to delete this consultation record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await db.runAsync('DELETE FROM consultations WHERE id = ?', [id]);
              loadConsultations();
            } catch (err) {
              console.error('Failed to delete consultation:', err);
              Alert.alert('Error', 'Unable to delete consultation.');
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: ConsultListItem }) => {
    const { consultation, patient } = item;
    const triageColors = patient
      ? TRIAGE_COLORS[patient.triage_level]
      : TRIAGE_COLORS.GREEN;

    return (
      <Pressable
        style={styles.card}
        onPress={() =>
          router.push(`/consultation/view/${consultation.id}` as any)
        }>
        <View style={styles.cardHeader}>
          <Text style={styles.patientName}>
            {patient?.full_name ?? 'Unknown Patient'}
          </Text>
          {patient && (
            <View style={[styles.badge, { borderColor: triageColors.border }]}>
              <Text style={[styles.badgeText, { color: triageColors.text }]}>
                {patient.triage_level}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.notes} numberOfLines={2}>
          {consultation.subjective_notes || 'No notes recorded'}
        </Text>
        <Text style={styles.date}>
          {new Date(consultation.created_at).toLocaleDateString()}
        </Text>
        <Pressable
          style={styles.kebab}
          hitSlop={8}
          onPress={() =>
            Alert.alert(
              patient?.full_name ?? 'Consultation',
              'Choose an action',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Edit', onPress: () => router.push(`/consultation/edit/${consultation.id}` as any) },
                { text: 'Delete', style: 'destructive', onPress: () => deleteConsultation(consultation.id) },
              ],
            )
          }>
          <Text style={styles.kebabIcon}>⋮</Text>
        </Pressable>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Consultations</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Loading…</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No Consultations Yet</Text>
          <Text style={styles.emptyText}>
            Completed consultations will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.consultation.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
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
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerTitle: {
    color: Palette.cream,
    fontSize: 22,
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Palette.ink,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: Palette.muted,
    textAlign: 'center',
  },
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: Palette.cream,
    borderRadius: 14,
    padding: 16,
    shadowColor: Palette.ink,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  patientName: {
    fontSize: 16,
    fontWeight: '700',
    color: Palette.ink,
    flex: 1,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  notes: {
    fontSize: 14,
    color: Palette.muted,
    marginBottom: 6,
  },
  date: {
    fontSize: 12,
    color: Palette.faint,
  },
  kebab: {
    position: 'absolute',
    right: 0,
    top: 0,
    padding: 8,
  },
  kebabIcon: {
    fontSize: 20,
    color: Palette.muted,
    fontWeight: '700',
  },
});
