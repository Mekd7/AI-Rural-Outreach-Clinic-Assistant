import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import type { Patient } from '@/types';
import { queryEthiopianGuidelines, type AIQueryResult } from '@/services/ai';

// expo-speech-recognition requires a custom dev build (native module).
// Load it dynamically so the screen still works in Expo Go without it.
let SpeechModule: any = null;
try {
  SpeechModule = require('expo-speech-recognition').ExpoSpeechRecognitionModule;
} catch {
  // Native module unavailable (Expo Go) — dictation will be disabled.
}

export default function ConsultationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);

  // SOAP fields
  const [subjective, setSubjective] = useState('');
  const [objective, setObjective] = useState('');
  const [assessmentPlan, setAssessmentPlan] = useState('');
  const [prescriptions, setPrescriptions] = useState('');

  // Voice dictation state
  const [isRecording, setIsRecording] = useState(false);
  const [activeField, setActiveField] = useState<'subjective' | null>('subjective');
  const isMounted = useRef(true);

  // Guideline search modal state
  const [guidelineModalVisible, setGuidelineModalVisible] = useState(false);
  const [guidelineQuery, setGuidelineQuery] = useState('');
  const [guidelineLoading, setGuidelineLoading] = useState(false);
  const [guidelineResult, setGuidelineResult] = useState<AIQueryResult | null>(null);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Fetch patient
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const row = await db.getFirstAsync<Patient>(
          'SELECT * FROM patients WHERE id = ?',
          [id],
        );
        if (isMounted.current) {
          setPatient(row ?? null);
        }
      } catch (err) {
        console.error('Failed to load patient:', err);
        if (isMounted.current) {
          Alert.alert('Error', 'Unable to load patient details.');
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    })();
  }, [id]);

  // Speech recognition via dynamic module (only available in dev builds)
  useEffect(() => {
    if (!SpeechModule) return;
    const { addSpeechRecognitionListener } = require('expo-speech-recognition');

    const resultSub = addSpeechRecognitionListener?.('result', (event: any) => {
      if (activeField === 'subjective' && event.results?.[0]?.transcript) {
        const transcript = event.results[0].transcript;
        if (event.isFinal) {
          setSubjective((prev) => prev + (prev ? ' ' : '') + transcript);
        }
      }
    });

    const endSub = addSpeechRecognitionListener?.('end', () => {
      setIsRecording(false);
    });

    const errorSub = addSpeechRecognitionListener?.('error', (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
    });

    return () => {
      resultSub?.remove?.();
      endSub?.remove?.();
      errorSub?.remove?.();
    };
  }, [activeField]);

  const startDictation = async () => {
    if (!SpeechModule) {
      Alert.alert(
        'Not available',
        'Voice dictation requires a custom development build. It is not supported in Expo Go.',
      );
      return;
    }
    const result = await SpeechModule.requestPermissionsAsync();
    if (!result.granted) {
      Alert.alert('Permission required', 'Microphone permission is needed for voice dictation.');
      return;
    }
    setIsRecording(true);
    SpeechModule.start({
      lang: 'en-US',
      interimResults: true,
      continuous: true,
    });
  };

  const stopDictation = () => {
    SpeechModule?.stop();
    setIsRecording(false);
  };

  const searchGuidelines = async () => {
    if (!guidelineQuery.trim()) return;
    setGuidelineLoading(true);
    setGuidelineResult(null);
    try {
      const result = await queryEthiopianGuidelines(guidelineQuery);
      setGuidelineResult(result);
    } catch (err) {
      console.error('Guideline search failed:', err);
      setGuidelineResult({
        success: false,
        error: 'An unexpected error occurred while searching guidelines.',
        errorType: 'unknown',
      });
    } finally {
      setGuidelineLoading(false);
    }
  };

  const insertGuidelinesIntoPlan = () => {
    if (!guidelineResult?.response) return;
    const newText = guidelineResult.response.trim();
    setAssessmentPlan((prev) => {
      const prevTrimmed = prev.trim();
      if (!prevTrimmed) return newText;
      const separator = prevTrimmed.endsWith('\n') ? '\n' : '\n\n';
      return prevTrimmed + separator + newText;
    });
    setGuidelineModalVisible(false);
    setGuidelineResult(null);
    setGuidelineQuery('');
  };

  const renderGuidelineBullets = (text?: string) => {
    if (!text) return [];
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => line.replace(/^[\s]*[-•*][\s]*/, ''));
  };

  const closeGuidelineModal = () => {
    setGuidelineModalVisible(false);
    setGuidelineResult(null);
    setGuidelineQuery('');
  };

  const saveConsultation = async () => {
    if (!patient) return;

    if (!subjective.trim() && !objective.trim() && !assessmentPlan.trim()) {
      Alert.alert('Missing notes', 'Please enter at least one SOAP field before saving.');
      return;
    }

    try {
      const consultationId = `consult_${Date.now()}`;
      const now = new Date().toISOString();
      const result = await db.runAsync(
        `INSERT INTO consultations (id, patient_id, subjective_notes, objective_notes, assessment_plan, prescriptions, referral_needed, synced, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          consultationId,
          patient.id,
          subjective.trim(),
          objective.trim(),
          assessmentPlan.trim(),
          JSON.stringify(
            prescriptions.trim()
              ? prescriptions.split('\n').map((p) => p.trim()).filter(Boolean)
              : []
          ),
          0,
          0,
          now,
        ],
      );
      console.log('Consultation saved:', consultationId, 'changes:', result.changes);

      Alert.alert('Saved', 'Consultation saved successfully.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/consult' as any) },
      ]);
    } catch (err: any) {
      console.error('Failed to save consultation:', err?.message ?? err);
      Alert.alert('Error', `Unable to save consultation: ${err?.message ?? 'Unknown error'}`);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!patient) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Patient not found.</Text>
          <Pressable style={styles.backButtonAlt} onPress={() => router.back()}>
            <Text style={styles.backButtonAltText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const triageColors = TRIAGE_COLORS[patient.triage_level];
  const triageLabel =
    patient.triage_level === 'RED'
      ? 'EMERGENCY'
      : patient.triage_level === 'YELLOW'
        ? 'URGENT'
        : 'STABLE';

  const patientMeta = [
    `${patient.age}y`,
    patient.gender === 'M' ? 'Male' : 'Female',
    patient.kebele,
    patient.is_pregnant ? 'Pregnant' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Consultation</Text>
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
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {/* Voice Dictation */}
        <View style={styles.soapCard}>
          <Text style={styles.sectionHeaderLabel}>VOICE DICTATION</Text>
          <View style={styles.dictationDots}>
            {Array.from({ length: 30 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  isRecording && { backgroundColor: '#0ea5e9' },
                ]}
              />
            ))}
          </View>
          <Pressable
            style={[styles.micButton, isRecording && styles.micButtonActive]}
            onPressIn={startDictation}
            onPressOut={stopDictation}>
            <Text style={styles.micIcon}>🎙</Text>
          </Pressable>
          <Text style={styles.micLabel}>
            {isRecording ? 'Listening…' : 'Hold to Dictate Notes'}
          </Text>
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
          <TextInput
            style={styles.soapInput}
            value={subjective}
            onChangeText={setSubjective}
            placeholder="Enter patient's reported symptoms…"
            placeholderTextColor="#94a3b8"
            multiline
            textAlignVertical="top"
          />
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

          {/* Vitals Grid */}
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

          <TextInput
            style={styles.soapInput}
            value={objective}
            onChangeText={setObjective}
            placeholder="Additional physical exam findings…"
            placeholderTextColor="#94a3b8"
            multiline
            textAlignVertical="top"
          />
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
          <TextInput
            style={styles.soapInput}
            value={assessmentPlan}
            onChangeText={setAssessmentPlan}
            placeholder="Enter diagnosis and management plan…"
            placeholderTextColor="#94a3b8"
            multiline
            textAlignVertical="top"
          />
          <Pressable style={styles.aiButton} onPress={() => setGuidelineModalVisible(true)}>
            <Text style={styles.aiButtonIcon}>📊</Text>
            <Text style={styles.aiButtonText}>Query MoH Clinical Guidelines (AI)</Text>
          </Pressable>
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
          <TextInput
            style={styles.soapInput}
            value={prescriptions}
            onChangeText={setPrescriptions}
            placeholder="Enter prescriptions…"
            placeholderTextColor="#94a3b8"
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* Spacer for bottom buttons */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Guideline Search Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={guidelineModalVisible}
        onRequestClose={closeGuidelineModal}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={closeGuidelineModal} style={styles.modalCloseButton}>
              <Text style={styles.modalCloseIcon}>✕</Text>
            </Pressable>
            <Text style={styles.modalTitle}>Clinical Guidelines</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <View style={styles.modalSearchRow}>
            <TextInput
              style={styles.modalSearchInput}
              value={guidelineQuery}
              onChangeText={setGuidelineQuery}
              placeholder="e.g. Acute Malaria"
              placeholderTextColor="#94a3b8"
              onSubmitEditing={searchGuidelines}
              returnKeyType="search"
            />
            <Pressable style={styles.modalSearchButton} onPress={searchGuidelines}>
              {guidelineLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.modalSearchButtonText}>Search</Text>
              )}
            </Pressable>
          </View>

          {guidelineResult?.success === false && guidelineResult.errorType === 'network' && (
            <View style={styles.offlineBanner}>
              <Text style={styles.offlineBannerText}>Guideline search requires active network</Text>
            </View>
          )}

          <ScrollView
            style={styles.modalResultsScroll}
            contentContainerStyle={styles.modalResultsContent}
            keyboardShouldPersistTaps="handled">
            {guidelineResult?.success === false && guidelineResult.errorType !== 'network' && (
              <View style={styles.modalErrorCard}>
                <Text style={styles.modalErrorTitle}>Unable to retrieve guidelines</Text>
                <Text style={styles.modalErrorText}>{guidelineResult.error}</Text>
              </View>
            )}

            {guidelineResult?.success && (
              <>
                <View style={styles.modalResultCard}>
                  <Text style={styles.modalResultLabel}>Treatment guidelines</Text>
                  {renderGuidelineBullets(guidelineResult.response).map((bullet, index) => (
                    <Text key={index} style={styles.modalBullet}>
                      • {bullet}
                    </Text>
                  ))}
                </View>

                <Pressable style={styles.modalInsertButton} onPress={insertGuidelinesIntoPlan}>
                  <Text style={styles.modalInsertButtonText}>Copy / Insert into Plan</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Bottom Action Buttons */}
      <View style={styles.bottomActions}>
        <Pressable style={styles.referralButton} onPress={() => Alert.alert('Coming soon', 'Referral slip generation is not yet implemented.')}>
          <Text style={styles.referralButtonText}>Generate Referral{'\n'}Slip</Text>
        </Pressable>
        <Pressable style={styles.completeButton} onPress={saveConsultation}>
          <Text style={styles.completeCheckmark}>✓</Text>
          <Text style={styles.completeButtonText}>Complete{'\n'}Consultation</Text>
        </Pressable>
      </View>
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

  // Header
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

  // Patient Card
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

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },

  // SOAP Card
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
  soapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
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
  soapInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#1e293b',
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  // Dictation
  sectionHeaderLabel: {
    color: '#0284c7',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textAlign: 'center',
    marginBottom: 12,
  },
  dictationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 16,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    borderWidth: 3,
    borderColor: '#0ea5e9',
  },
  micButtonActive: {
    backgroundColor: '#0ea5e9',
    borderColor: '#0369a1',
  },
  micIcon: {
    fontSize: 32,
  },
  micLabel: {
    textAlign: 'center',
    marginTop: 10,
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },

  // Vitals Grid
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
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

  // AI Button
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8fafc',
  },
  aiButtonIcon: {
    fontSize: 16,
  },
  aiButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },

  // Bottom Actions
  bottomActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
  },
  referralButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#0ea5e9',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  referralButtonText: {
    color: '#0284c7',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  completeButton: {
    flex: 1,
    backgroundColor: '#0ea5e9',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  completeCheckmark: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  completeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Guideline Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#0284c7',
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseIcon: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '600',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  modalHeaderSpacer: {
    width: 36,
  },
  modalSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalSearchInput: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalSearchButton: {
    backgroundColor: '#0284c7',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalSearchButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  offlineBanner: {
    backgroundColor: '#fee2e2',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#fecaca',
  },
  offlineBannerText: {
    color: '#991b1b',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalResultsScroll: {
    flex: 1,
  },
  modalResultsContent: {
    padding: 16,
  },
  modalResultCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  modalResultLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0ea5e9',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  modalBullet: {
    fontSize: 14,
    lineHeight: 22,
    color: '#334155',
    marginBottom: 8,
  },
  modalInsertButton: {
    backgroundColor: '#0ea5e9',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  modalInsertButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  modalErrorCard: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  modalErrorTitle: {
    color: '#b91c1c',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  modalErrorText: {
    color: '#7f1d1d',
    fontSize: 14,
    lineHeight: 20,
  },
});