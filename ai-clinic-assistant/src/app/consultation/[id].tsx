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
import { Header, Palette } from '@/constants/palette';
import { db } from '@/db/client';
import type { Patient } from '@/types';
import {
  queryEthiopianGuidelines,
  searchEthiopianGuidelines,
  type AIQueryResult,
  type LocalGuidelineMatch,
} from '@/services/ai';

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
  const [localMatches, setLocalMatches] = useState<LocalGuidelineMatch[]>([]);

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

  // Live local search triggered on every keystroke
  const handleGuidelineQueryChange = (text: string) => {
    setGuidelineQuery(text);
    if (!text.trim()) {
      setLocalMatches([]);
      setGuidelineResult(null);
      return;
    }
    const matches = searchEthiopianGuidelines(text);
    setLocalMatches(matches);
    setGuidelineResult(null);
  };

  // AI fallback — only triggered by pressing Search button
  const searchGuidelinesAI = async () => {
    if (!guidelineQuery.trim()) return;
    if (localMatches.length > 0) return; // local results are sufficient
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

  // Classify a protocol line as drug/medication or non-drug
  const isDrugLine = (line: string): boolean => {
    const l = line.toLowerCase();
    const drugPatterns = [
      /\d+\s*mg/,  /\d+\s*mcg/, /\d+\s*ml/, /\d+\s*g\/kg/, /\d+\s*mg\/kg/,
      /\b(po|iv|im|sc|pr|topical|sublingual|inhaled)\b/i,
      /\b(bid|tid|qid|q\d+h|once daily|twice daily|stat|prn)\b/i,
      /\b(tab|tablet|capsule|injection|syrup|suspension|drops|ointment|cream|suppository|inhaler|nebulize)s?\b/i,
      /\b(furosemide|amoxicillin|metformin|enalapril|amlodipine|chloroquine|artemether|lumefantrine|quinine|artesunate|doxycycline|metronidazole|ciprofloxacin|ceftriaxone|diazepam|phenobarbital|paracetamol|ibuprofen|morphine|tramadol|omeprazole|ors|zinc|salbutamol|prednisolone|hydrocortisone|insulin|digoxin|spironolactone|penicillin|erythromycin|gentamicin|cloxacillin|cotrimoxazole|albendazole|mebendazole|primaquine|tetracycline|azithromycin|acyclovir|nystatin|clotrimazole|permethrin|benzyl benzoate|silver sulfadiazine|atropine|adrenaline|epinephrine|dopamine|aminophylline|magnesium sulfate|oxytocin|misoprostol)\b/i,
    ];
    return drugPatterns.some((p) => p.test(l));
  };

  const insertLocalProtocolIntoPlan = (match: LocalGuidelineMatch) => {
    const lines = match.moh_protocol.split('\n');
    const planLines: string[] = [];
    const rxLines: string[] = [];

    for (const line of lines) {
      if (isDrugLine(line)) {
        rxLines.push(line);
      } else {
        planLines.push(line);
      }
    }

    // Build Assessment & Plan text
    const planParts: string[] = [
      `[${match.condition}]`,
      `Clinical Features: ${match.clinical_features}`,
    ];
    if (planLines.length > 0) {
      planParts.push(planLines.join('\n'));
    }
    if (match.urgent_referral_flags) {
      planParts.push(`REFERRAL FLAGS: ${match.urgent_referral_flags}`);
    }
    const planText = planParts.join('\n\n');

    setAssessmentPlan((prev) => {
      const prevTrimmed = prev.trim();
      if (!prevTrimmed) return planText;
      return prevTrimmed + '\n\n' + planText;
    });

    // Build Prescriptions text
    if (rxLines.length > 0) {
      const rxText = `[${match.condition}]\n` + rxLines.join('\n');
      setPrescriptions((prev) => {
        const prevTrimmed = prev.trim();
        if (!prevTrimmed) return rxText;
        return prevTrimmed + '\n\n' + rxText;
      });
    }

    setGuidelineModalVisible(false);
    setLocalMatches([]);
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
    setLocalMatches([]);
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
                  isRecording && { backgroundColor: Palette.burgundy },
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
            <View style={[styles.soapBadge, { backgroundColor: Palette.burgundyLight }]}>
              <Text style={[styles.soapBadgeText, { color: Palette.burgundy }]}>S</Text>
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
            placeholderTextColor={Palette.faint}
            multiline
            textAlignVertical="top"
          />
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
            placeholderTextColor={Palette.faint}
            multiline
            textAlignVertical="top"
          />
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
          <TextInput
            style={styles.soapInput}
            value={assessmentPlan}
            onChangeText={setAssessmentPlan}
            placeholder="Enter diagnosis and management plan…"
            placeholderTextColor={Palette.faint}
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
            <View style={[styles.soapBadge, { backgroundColor: Palette.successLight }]}>
              <Text style={[styles.soapBadgeText, { color: Palette.success }]}>P</Text>
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
            placeholderTextColor={Palette.faint}
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
              onChangeText={handleGuidelineQueryChange}
              placeholder="Type a condition e.g. Malaria, Pneumonia…"
              placeholderTextColor={Palette.faint}
              onSubmitEditing={searchGuidelinesAI}
              returnKeyType="search"
              autoFocus
            />
            <Pressable style={styles.modalSearchButton} onPress={searchGuidelinesAI}>
              {guidelineLoading ? (
                <ActivityIndicator color={Header.text} />
              ) : (
                <Text style={styles.modalSearchButtonText}>{localMatches.length > 0 ? 'AI' : 'Search'}</Text>
              )}
            </Pressable>
          </View>

          {guidelineLoading && (
            <View style={styles.offlineBanner}>
              <ActivityIndicator size="small" color={Palette.burgundy} />
              <Text style={[styles.offlineBannerText, { color: Palette.burgundy, marginLeft: 8 }]}>Searching AI guidelines…</Text>
            </View>
          )}

          {guidelineResult?.success === false && guidelineResult.errorType === 'network' && (
            <View style={styles.offlineBanner}>
              <Text style={styles.offlineBannerText}>Guideline search requires active network</Text>
            </View>
          )}

          <ScrollView
            style={styles.modalResultsScroll}
            contentContainerStyle={styles.modalResultsContent}
            keyboardShouldPersistTaps="handled">

            {/* Local guideline matches (instant, offline) */}
            {localMatches.length > 0 && (
              <>
                <View style={styles.localMatchesHeader}>
                  <Text style={styles.localMatchesTitle}>MoH Standard Treatment Guidelines</Text>
                  <View style={styles.mohBadge}>
                    <Text style={styles.mohBadgeText}>Ethiopian MoH STG</Text>
                  </View>
                </View>

                {localMatches.map((match) => (
                  <View key={match.id} style={styles.localMatchCard}>
                    <Text style={styles.localMatchCondition}>{match.condition}</Text>
                    <Text style={styles.localMatchCategory}>{match.category}</Text>

                    <View style={styles.localMatchSourceRow}>
                      <View style={styles.mohBadgeSmall}>
                        <Text style={styles.mohBadgeSmallText}>Ethiopian MoH Standard Treatment Guidelines</Text>
                      </View>
                    </View>

                    <Text style={styles.localMatchSectionLabel}>Clinical Features &amp; Symptoms</Text>
                    <Text style={styles.clinicalFeaturesText}>{match.clinical_features}</Text>

                    <Text style={styles.localMatchSectionLabel}>MoH Protocol</Text>
                    {match.moh_protocol.split('\n').map((line, i) => (
                      <Text key={i} style={styles.localMatchProtocolLine}>
                        {line}
                      </Text>
                    ))}

                    {match.urgent_referral_flags ? (
                      <View style={styles.referralFlagBox}>
                        <Text style={styles.referralFlagTitle}>⚠ Urgent Referral Flags</Text>
                        <Text style={styles.referralFlagText}>{match.urgent_referral_flags}</Text>
                      </View>
                    ) : null}

                    <Pressable
                      style={styles.copyToPlanButton}
                      onPress={() => insertLocalProtocolIntoPlan(match)}>
                      <Text style={styles.copyToPlanButtonText}>Copy to Plan &amp; Prescriptions</Text>
                    </Pressable>
                  </View>
                ))}
              </>
            )}

            {/* AI fallback results */}
            {guidelineResult?.success === false && guidelineResult.errorType !== 'network' && localMatches.length === 0 && (
              <View style={styles.modalErrorCard}>
                <Text style={styles.modalErrorTitle}>Unable to retrieve guidelines</Text>
                <Text style={styles.modalErrorText}>{guidelineResult.error}</Text>
              </View>
            )}

            {guidelineResult?.success && localMatches.length === 0 && (
              <>
                <View style={styles.modalResultCard}>
                  <Text style={styles.modalResultLabel}>AI-Generated Guidance</Text>
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

  // Header
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

  // Patient Card
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
    backgroundColor: Palette.white,
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
    color: Palette.ink,
  },
  soapSubtitle: {
    fontSize: 12,
    color: Palette.muted,
    marginTop: 1,
  },
  soapInput: {
    backgroundColor: Palette.cream,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: Palette.ink,
    minHeight: 100,
    borderWidth: 1,
    borderColor: Palette.line,
  },

  // Dictation
  sectionHeaderLabel: {
    color: Palette.burgundy,
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
    backgroundColor: Palette.line,
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Palette.burgundyLight,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    borderWidth: 3,
    borderColor: Palette.burgundy,
  },
  micButtonActive: {
    backgroundColor: Palette.burgundy,
    borderColor: Palette.burgundyDark,
  },
  micIcon: {
    fontSize: 32,
  },
  micLabel: {
    textAlign: 'center',
    marginTop: 10,
    fontSize: 14,
    color: Palette.muted,
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

  // AI Button
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    borderWidth: 1,
    borderColor: Palette.line,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Palette.cream,
  },
  aiButtonIcon: {
    fontSize: 16,
  },
  aiButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Palette.inkSoft,
  },

  // Bottom Actions
  bottomActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: Palette.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.line,
  },
  referralButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: Palette.burgundy,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  referralButtonText: {
    color: Palette.burgundy,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  completeButton: {
    flex: 1,
    backgroundColor: Palette.burgundy,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  completeCheckmark: {
    color: Header.text,
    fontSize: 18,
    fontWeight: '700',
  },
  completeButtonText: {
    color: Header.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Guideline Modal
  modalContainer: {
    flex: 1,
    backgroundColor: Palette.cream,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: Palette.burgundy,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseIcon: {
    color: Header.text,
    fontSize: 22,
    fontWeight: '600',
  },
  modalTitle: {
    color: Header.text,
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
    backgroundColor: Palette.white,
    borderBottomWidth: 1,
    borderBottomColor: Palette.line,
  },
  modalSearchInput: {
    flex: 1,
    backgroundColor: Palette.cream,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Palette.ink,
    borderWidth: 1,
    borderColor: Palette.line,
  },
  modalSearchButton: {
    backgroundColor: Palette.burgundy,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalSearchButtonText: {
    color: Header.text,
    fontSize: 14,
    fontWeight: '600',
  },
  offlineBanner: {
    backgroundColor: Palette.dangerLight,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Palette.dangerLight,
  },
  offlineBannerText: {
    color: Palette.danger,
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
    backgroundColor: Palette.white,
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
    color: Palette.burgundy,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  modalBullet: {
    fontSize: 14,
    lineHeight: 22,
    color: Palette.inkSoft,
    marginBottom: 8,
  },
  modalInsertButton: {
    backgroundColor: Palette.burgundy,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  modalInsertButtonText: {
    color: Header.text,
    fontSize: 15,
    fontWeight: '700',
  },
  // Local Guideline Matches
  localMatchesHeader: {
    marginBottom: 12,
  },
  localMatchesTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Palette.ink,
    marginBottom: 6,
  },
  mohBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Palette.successLight,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Palette.success,
  },
  mohBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Palette.success,
    letterSpacing: 0.3,
  },
  localMatchCard: {
    backgroundColor: Palette.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: Palette.success,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  localMatchCondition: {
    fontSize: 17,
    fontWeight: '800',
    color: Palette.ink,
    marginBottom: 2,
  },
  localMatchCategory: {
    fontSize: 12,
    color: Palette.muted,
    marginBottom: 8,
  },
  localMatchSourceRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  mohBadgeSmall: {
    backgroundColor: Palette.successLight,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Palette.success,
  },
  mohBadgeSmallText: {
    fontSize: 10,
    fontWeight: '600',
    color: Palette.success,
  },
  clinicalFeaturesText: {
    fontSize: 13,
    lineHeight: 20,
    color: Palette.muted,
    backgroundColor: Palette.cream,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Palette.line,
  },
  localMatchSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Palette.burgundy,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  localMatchProtocolLine: {
    fontSize: 13,
    lineHeight: 20,
    color: Palette.inkSoft,
    marginBottom: 2,
  },
  referralFlagBox: {
    backgroundColor: Palette.dangerLight,
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: Palette.dangerLight,
  },
  referralFlagTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Palette.danger,
    marginBottom: 4,
  },
  referralFlagText: {
    fontSize: 12,
    lineHeight: 18,
    color: Palette.danger,
  },
  copyToPlanButton: {
    backgroundColor: Palette.success,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  copyToPlanButtonText: {
    color: Header.text,
    fontSize: 14,
    fontWeight: '700',
  },

  modalErrorCard: {
    backgroundColor: Palette.dangerLight,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Palette.dangerLight,
  },
  modalErrorTitle: {
    color: Palette.danger,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  modalErrorText: {
    color: Palette.danger,
    fontSize: 14,
    lineHeight: 20,
  },
});