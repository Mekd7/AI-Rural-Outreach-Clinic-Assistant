import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TriageBadge } from '@/components/TriageBadge';
import { TRIAGE_COLORS } from '@/constants/triage';
import { db } from '@/db/client';
import { queryEthiopianGuidelines, type AIQueryResult } from '@/services/ai';
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
  
  // Guideline query modal state (must be before any early returns)
  const [showGuidelineModal, setShowGuidelineModal] = useState(false);
  const [guidelineQuery, setGuidelineQuery] = useState('');
  const [guidelineLoading, setGuidelineLoading] = useState(false);
  const [guidelineResult, setGuidelineResult] = useState<AIQueryResult | null>(null);

  const isMounted = useRef(true);

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

  const prescriptionsText = useMemo(() => {
    if (!consultation?.prescriptions.trim() || consultation.prescriptions.trim() === '[]') {
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

  const handleGuidelineQuery = async () => {
    if (!guidelineQuery.trim()) {
      Alert.alert('Empty query', 'Please enter a clinical question before asking.');
      return;
    }

    setGuidelineLoading(true);
    setGuidelineResult(null);

    const result = await queryEthiopianGuidelines(guidelineQuery.trim());
    setGuidelineResult(result);
    setGuidelineLoading(false);
  };

  const closeGuidelineModal = () => {
    setShowGuidelineModal(false);
    setGuidelineQuery('');
    setGuidelineResult(null);
    Keyboard.dismiss();
  };

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
            <View style={[styles.soapBadge, { backgroundColor: '#dbeafe' }]}>
              <Text style={[styles.soapBadgeText, { color: '#1d4ed8' }]}>S</Text>
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
            <View style={[styles.soapBadge, { backgroundColor: '#e0e7ff' }]}>
              <Text style={[styles.soapBadgeText, { color: '#4338ca' }]}>O</Text>
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
            <View style={[styles.soapBadge, { backgroundColor: '#fef3c7' }]}>
              <Text style={[styles.soapBadgeText, { color: '#b45309' }]}>A</Text>
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
            <View style={[styles.soapBadge, { backgroundColor: '#dcfce7' }]}>
              <Text style={[styles.soapBadgeText, { color: '#047857' }]}>P</Text>
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

        {/* Query Guidelines Button */}
        <View style={styles.guidelineButtonContainer}>
          <Pressable style={styles.guidelineButton} onPress={() => setShowGuidelineModal(true)}>
            <Text style={styles.guidelineButtonText}>Query Ethiopian Guidelines</Text>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Guideline Query Modal */}
      <Modal
        visible={showGuidelineModal}
        animationType="slide"
        transparent={false}
        onRequestClose={closeGuidelineModal}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Query Ethiopian Guidelines</Text>
            <Pressable style={styles.modalCloseButton} onPress={closeGuidelineModal}>
              <Text style={styles.modalCloseText}>✕</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modalSection}>
              <Text style={styles.modalSubtitle}>
                Clinical Decision Support Tool
              </Text>
              <Text style={styles.modalDisclaimer}>
                This feature provides guideline lookup assistance only. It is NOT an official Ethiopian medical
                directive and should NOT replace clinical judgment. Always verify against applicable FMOH/WHO-Ethiopia
                guidelines before clinical application.
              </Text>
            </View>

            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Your Clinical Question</Text>
              <TextInput
                style={[styles.modalInput, { minHeight: 120 }]}
                value={guidelineQuery}
                onChangeText={setGuidelineQuery}
                placeholder="e.g., What is the recommended initial assessment for a patient presenting with suspected malaria?"
                placeholderTextColor="#94a3b8"
                multiline
                textAlignVertical="top"
                editable={!guidelineLoading}
              />
            </View>

            {guidelineLoading && (
              <View style={styles.modalLoading}>
                <Text style={styles.modalLoadingText}>Querying guidelines…</Text>
              </View>
            )}

            {guidelineResult && !guidelineLoading && (
              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Response</Text>
                <View
                  style={[
                    styles.modalResponse,
                    guidelineResult.success ? styles.modalResponseSuccess : styles.modalResponseError,
                  ]}>
                  <Text style={styles.modalResponseText}>
                    {guidelineResult.success ? guidelineResult.response : guidelineResult.error}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.modalActions}>
              <Pressable style={[styles.modalActionButton, styles.modalCancelButton]} onPress={closeGuidelineModal}>
                <Text style={styles.modalActionText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalActionButton,
                  styles.modalAskButton,
                  guidelineLoading && styles.modalAskButtonDisabled,
                ]}
                onPress={handleGuidelineQuery}
                disabled={guidelineLoading || !guidelineQuery.trim()}>
                <Text style={styles.modalActionText}>
                  {guidelineLoading ? 'Asking…' : 'Ask'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ebf3f7',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 16,
    color: '#475569',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    marginBottom: 16,
  },
  backButtonAlt: {
    backgroundColor: '#0ea5e9',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButtonAltText: {
    color: '#ffffff',
    fontWeight: '600',
  },

  header: {
    backgroundColor: '#0284c7',
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
    color: '#ffffff',
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '300',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 8,
  },
  headerSpacer: {
    flex: 1,
  },

  patientCard: {
    backgroundColor: '#0369a1',
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
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#ef4444',
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
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  patientMeta: {
    color: '#bae6fd',
    fontSize: 13,
  },
  recordDate: {
    color: '#7dd3fc',
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
    backgroundColor: '#ffffff',
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
    color: '#0f172a',
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
    color: '#0f172a',
  },
  soapSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  notesText: {
    fontSize: 15,
    color: '#1e293b',
    lineHeight: 22,
  },

  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  vitalItem: {
    width: '47%',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 12,
  },
  vitalLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 4,
  },
  vitalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
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
    backgroundColor: '#e0f2fe',
  },
  deleteButton: {
    backgroundColor: '#fee2e2',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },

  guidelineButtonContainer: {
    width: '100%',
    marginTop: 8,
  },
  guidelineButton: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#0ea5e9',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guidelineButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0284c7',
  },

  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  modalCloseText: {
    fontSize: 20,
    color: '#64748b',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalSubtitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0ea5e9',
    marginBottom: 8,
  },
  modalDisclaimer: {
    fontSize: 12,
    color: '#ef4444',
    lineHeight: 18,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#d1d9e2',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  modalLoading: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  modalLoadingText: {
    fontSize: 15,
    color: '#64748b',
  },
  modalResponse: {
    borderRadius: 12,
    padding: 14,
  },
  modalResponseSuccess: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  modalResponseError: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  modalResponseText: {
    fontSize: 14,
    color: '#1e293b',
    lineHeight: 21,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalActionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#d1d9e2',
  },
  modalAskButton: {
    backgroundColor: '#0ea5e9',
  },
  modalAskButtonDisabled: {
    backgroundColor: '#7dd3fc',
  },
  modalActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});
