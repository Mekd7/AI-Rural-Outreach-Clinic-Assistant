import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TriageBadge } from '@/components/TriageBadge';
import { TRIAGE_COLORS } from '@/constants/triage';
import { Header, Palette } from '@/constants/palette';
import { db } from '@/db/client';
import type { Patient } from '@/types';

interface Consultation {
  id: string;
  patient_id: string;
  subjective_notes: string;
  objective_notes: string;
  assessment_plan: string;
  prescriptions: string;
  referral_needed: number;
  created_at: string;
}

export default function ConsultationViewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  
  const isMounted = useRef(true);

  const prescriptionsText = useMemo(() => {
    if (!consultation?.prescriptions?.trim() || consultation.prescriptions.trim() === '[]') {
      return null;
    }
    try {
      const parsed = JSON.parse(consultation.prescriptions);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.join('\n');
      }
      return null;
    } catch {
      return consultation.prescriptions.trim() || null;
    }
  }, [consultation?.prescriptions]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const row = await db.getFirstAsync<Consultation>(
          'SELECT * FROM consultations WHERE id = ?',
          [id],
        );
        if (row && isMounted.current) {
          setConsultation(row);
          const p = await db.getFirstAsync<Patient>(
            'SELECT * FROM patients WHERE id = ?',
            [row.patient_id],
          );
          if (isMounted.current) {
            setPatient(p ?? null);
          }
        }
      } catch (err) {
        console.error('Failed to load consultation:', err);
        if (isMounted.current) {
          Alert.alert('Error', 'Unable to load consultation details.');
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!consultation || !patient) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Consultation not found.</Text>
          <Pressable style={styles.backButtonAlt} onPress={() => router.back()}>
            <Text style={styles.backButtonAltText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const triageColors = TRIAGE_COLORS[patient.triage_level];

  const patientMeta = [
    `${patient.age}y`,
    patient.gender === 'M' ? 'Male' : 'Female',
    patient.kebele,
    patient.is_pregnant ? 'Pregnant' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

  const deleteConsultation = () => {
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
              router.replace('/(tabs)/consult' as any);
            } catch (err) {
              console.error('Failed to delete consultation:', err);
              Alert.alert('Error', 'Unable to delete consultation.');
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Consultation Record</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Patient Card */}
      <View style={styles.patientCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{patient.full_name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.patientInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.patientName}>{patient.full_name}</Text>
            <TriageBadge level={patient.triage_level} size="small" />
          </View>
          <Text style={styles.patientMeta}>{patientMeta}</Text>
          <Text style={styles.recordDate}>Recorded: {formatDate(consultation.created_at)}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Vitals */}
        <View style={styles.soapCard}>
          <Text style={styles.sectionTitle}>Vitals</Text>
          <View style={styles.vitalsGrid}>
            <View style={[styles.vitalItem, { backgroundColor: triageColors.background }]}>
              <Text style={styles.vitalLabel}>Blood Pressure</Text>
              <Text style={[styles.vitalValue, { color: triageColors.text }]}>
                {patient.systolic_bp}/{patient.diastolic_bp} mmHg
              </Text>
            </View>
            <View style={styles.vitalItem}>
              <Text style={styles.vitalLabel}>Temperature</Text>
              <Text style={styles.vitalValue}>{patient.temperature}°C</Text>
            </View>
            <View style={styles.vitalItem}>
              <Text style={styles.vitalLabel}>Heart Rate</Text>
              <Text style={styles.vitalValue}>{patient.heart_rate} bpm</Text>
            </View>
            <View style={styles.vitalItem}>
              <Text style={styles.vitalLabel}>SpO₂</Text>
              <Text style={styles.vitalValue}>—</Text>
            </View>
          </View>
        </View>

        {/* Subjective */}
        <View style={styles.soapCard}>
          <View style={styles.soapHeader}>
            <View style={[styles.soapBadge, { backgroundColor: Palette.burgundyLight }]}>
              <Text style={[styles.soapBadgeText, { color: Palette.burgundy }]}>S</Text>
            </View>
            <View>
              <Text style={styles.soapTitle}>Subjective</Text>
              <Text style={styles.soapSubtitle}>Patient-reported symptoms</Text>
            </View>
          </View>
          <Text style={styles.notesText}>
            {consultation.subjective_notes.trim() || 'No subjective notes recorded.'}
          </Text>
        </View>

        {/* Objective */}
        <View style={styles.soapCard}>
          <View style={styles.soapHeader}>
            <View style={[styles.soapBadge, { backgroundColor: Palette.goldLight }]}>
              <Text style={[styles.soapBadgeText, { color: Palette.earth }]}>O</Text>
            </View>
            <View>
              <Text style={styles.soapTitle}>Objective</Text>
              <Text style={styles.soapSubtitle}>Vitals &amp; physical exam</Text>
            </View>
          </View>
          <Text style={styles.notesText}>
            {consultation.objective_notes.trim() || 'No objective notes recorded.'}
          </Text>
        </View>

        {/* Assessment & Plan */}
        <View style={styles.soapCard}>
          <View style={styles.soapHeader}>
            <View style={[styles.soapBadge, { backgroundColor: Palette.goldLight }]}>
              <Text style={[styles.soapBadgeText, { color: Palette.earth }]}>A</Text>
            </View>
            <View>
              <Text style={styles.soapTitle}>Assessment &amp; Plan</Text>
              <Text style={styles.soapSubtitle}>Diagnosis and management</Text>
            </View>
          </View>
          <Text style={styles.notesText}>
            {consultation.assessment_plan.trim() || 'No assessment or plan recorded.'}
          </Text>
        </View>

        {/* Prescriptions */}
        <View style={styles.soapCard}>
          <View style={styles.soapHeader}>
            <View style={[styles.soapBadge, { backgroundColor: Palette.successLight }]}>
              <Text style={[styles.soapBadgeText, { color: Palette.success }]}>P</Text>
            </View>
            <View>
              <Text style={styles.soapTitle}>Prescriptions</Text>
              <Text style={styles.soapSubtitle}>Medications and dosage</Text>
            </View>
          </View>
          <Text style={styles.notesText}>
            {prescriptionsText ?? 'No prescriptions recorded.'}
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.actionButton, styles.editButton]}
            onPress={() => router.push(`/consultation/edit/${id}` as any)}>
            <Text style={styles.actionText}>Edit Consultation</Text>
          </Pressable>
          <Pressable
            style={[styles.actionButton, styles.deleteButton]}
            onPress={deleteConsultation}>
            <Text style={styles.actionText}>Delete Consultation</Text>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Palette.parchment,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 16,
    color: Palette.muted,
  },
  errorText: {
    fontSize: 16,
    color: Palette.danger,
    marginBottom: 16,
  },
  backButtonAlt: {
    backgroundColor: Palette.burgundy,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButtonAltText: {
    color: Header.text,
    fontWeight: '600',
  },

  header: {
    backgroundColor: Palette.burgundy,
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    color: Header.text,
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '300',
  },
  headerTitle: {
    color: Header.text,
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 8,
  },
  headerSpacer: {
    flex: 1,
  },

  patientCard: {
    backgroundColor: Palette.burgundyDark,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: Palette.burgundy,
    fontSize: 18,
    fontWeight: '700',
  },
  patientInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  patientName: {
    color: Header.text,
    fontSize: 17,
    fontWeight: '700',
  },
  patientMeta: {
    color: Header.subtle,
    fontSize: 13,
  },
  recordDate: {
    color: Header.subtle,
    fontSize: 11,
    marginTop: 4,
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },

  soapCard: {
    backgroundColor: Palette.white,
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Palette.ink,
    marginBottom: 12,
  },
  soapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  soapBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soapBadgeText: {
    fontSize: 16,
    fontWeight: '800',
  },
  soapTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Palette.ink,
  },
  soapSubtitle: {
    fontSize: 12,
    color: Palette.muted,
    marginTop: 1,
  },
  notesText: {
    fontSize: 15,
    color: Palette.ink,
    lineHeight: 22,
  },

  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  vitalItem: {
    width: '47%',
    backgroundColor: Palette.cream,
    borderRadius: 12,
    padding: 12,
  },
  vitalLabel: {
    fontSize: 12,
    color: Palette.muted,
    fontWeight: '500',
    marginBottom: 4,
  },
  vitalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Palette.ink,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    backgroundColor: Palette.burgundyLight,
  },
  deleteButton: {
    backgroundColor: Palette.dangerLight,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
    color: Palette.ink,
  },
});
