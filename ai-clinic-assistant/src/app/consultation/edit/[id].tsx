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
import {
  queryEthiopianGuidelines,
  searchEthiopianGuidelines,
  type AIQueryResult,
  type LocalGuidelineMatch,
} from '@/services/ai';
import type { Patient } from '@/types';

interface Consultation {
  id: string;
  patient_id: string;
  subjective_notes: string;
  objective_notes: string;
  assessment_plan: string;
  prescriptions: string;
  referral_needed: number;
  synced: number;
  created_at: string;
}

export default function EditConsultationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);

  const [subjective, setSubjective] = useState('');
  const [objective, setObjective] = useState('');
  const [assessmentPlan, setAssessmentPlan] = useState('');
  const [prescriptions, setPrescriptions] = useState('');

  // Guideline search state
  const [guidelineModalVisible, setGuidelineModalVisible] = useState(false);
  const [guidelineQuery, setGuidelineQuery] = useState('');
  const [guidelineLoading, setGuidelineLoading] = useState(false);
  const [guidelineResult, setGuidelineResult] = useState<AIQueryResult | null>(null);
  const [localMatches, setLocalMatches] = useState<LocalGuidelineMatch[]>([]);

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
          setSubjective(row.subjective_notes);
          setObjective(row.objective_notes);
          setAssessmentPlan(row.assessment_plan);
          setPrescriptions(
            (() => {
              const value = row.prescriptions.trim();
              if (!value || value === '[]') return '';
              try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? parsed.join('\n') : value;
              } catch {
                return value;
              }
            })()
          );

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

  const searchGuidelinesAI = async () => {
    if (!guidelineQuery.trim()) return;
    if (localMatches.length > 0) return;
    setGuidelineLoading(true);
    setGuidelineResult(null);
    try {
      const result = await queryEthiopianGuidelines(guidelineQuery);
      setGuidelineResult(result);
    } catch (err) {
      console.error('Guideline search failed:', err);
      setGuidelineResult({ success: false, error: 'An unexpected error occurred.', errorType: 'unknown' });
    } finally {
      setGuidelineLoading(false);
    }
  };

  const isDrugLine = (line: string): boolean => {
    const l = line.toLowerCase();
    const drugPatterns = [
      /\d+\s*mg/, /\d+\s*mcg/, /\d+\s*ml/, /\d+\s*g\/kg/, /\d+\s*mg\/kg/,
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
      if (isDrugLine(line)) rxLines.push(line);
      else planLines.push(line);
    }
    const planParts: string[] = [
      `[${match.condition}]`,
      `Clinical Features: ${match.clinical_features}`,
    ];
    if (planLines.length > 0) planParts.push(planLines.join('\n'));
    if (match.urgent_referral_flags) planParts.push(`REFERRAL FLAGS: ${match.urgent_referral_flags}`);
    const planText = planParts.join('\n\n');

    setAssessmentPlan((prev) => {
      const t = prev.trim();
      return t ? t + '\n\n' + planText : planText;
    });
    if (rxLines.length > 0) {
      const rxText = `[${match.condition}]\n` + rxLines.join('\n');
      setPrescriptions((prev) => {
        const t = prev.trim();
        return t ? t + '\n\n' + rxText : rxText;
      });
    }
    setGuidelineModalVisible(false);
    setLocalMatches([]);
    setGuidelineResult(null);
    setGuidelineQuery('');
  };

  const insertGuidelinesIntoPlan = () => {
    if (!guidelineResult?.response) return;
    const newText = guidelineResult.response.trim();
    setAssessmentPlan((prev) => {
      const t = prev.trim();
      return t ? t + '\n\n' + newText : newText;
    });
    setGuidelineModalVisible(false);
    setGuidelineResult(null);
    setGuidelineQuery('');
  };

  const renderGuidelineBullets = (text?: string) => {
    if (!text) return [];
    return text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0).map((l) => l.replace(/^[\s]*[-•*][\s]*/, ''));
  };

  const closeGuidelineModal = () => {
    setGuidelineModalVisible(false);
    setLocalMatches([]);
    setGuidelineResult(null);
    setGuidelineQuery('');
  };

  const saveConsultation = async () => {
    if (!consultation || !patient) return;

    if (!subjective.trim() && !objective.trim() && !assessmentPlan.trim()) {
      Alert.alert('Missing notes', 'Please enter at least one SOAP field before saving.');
      return;
    }

    try {
      const result = await db.runAsync(
        `UPDATE consultations
         SET subjective_notes = ?, objective_notes = ?, assessment_plan = ?, prescriptions = ?, synced = ?
         WHERE id = ?`,
        [
          subjective.trim(),
          objective.trim(),
          assessmentPlan.trim(),
          JSON.stringify(
            prescriptions.trim()
              ? prescriptions.split('\n').map((p) => p.trim()).filter(Boolean)
              : []
          ),
          0,
          id,
        ],
      );
      console.log('Consultation updated:', id, 'changes:', result.changes);

      Alert.alert('Saved', 'Consultation updated successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      console.error('Failed to update consultation:', err?.message ?? err);
      Alert.alert('Error', `Unable to update consultation: ${err?.message ?? 'Unknown error'}`);
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Edit Consultation</Text>
        <View style={styles.headerSpacer} />
      </View>

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

        {/* Query MoH Guidelines */}
        <View style={styles.guidelineButtonContainer}>
          <Pressable style={styles.guidelineButton} onPress={() => setGuidelineModalVisible(true)}>
            <Text style={styles.guidelineButtonText}>Query MoH Guidelines</Text>
          </Pressable>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Guideline Search Modal */}
      <Modal
        visible={guidelineModalVisible}
        animationType="slide"
        transparent={false}
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
              placeholderTextColor="#94a3b8"
              onSubmitEditing={searchGuidelinesAI}
              returnKeyType="search"
              autoFocus
            />
            <Pressable style={styles.modalSearchButton} onPress={searchGuidelinesAI}>
              {guidelineLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.modalSearchButtonText}>{localMatches.length > 0 ? 'AI' : 'Search'}</Text>
              )}
            </Pressable>
          </View>

          {guidelineLoading && (
            <View style={styles.offlineBanner}>
              <ActivityIndicator size="small" color="#0284c7" />
              <Text style={[styles.offlineBannerText, { color: '#0284c7', marginLeft: 8 }]}>Searching AI guidelines…</Text>
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
                      <Text key={i} style={styles.localMatchProtocolLine}>{line}</Text>
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

            {/* Empty state */}
            {localMatches.length === 0 && !guidelineResult && !guidelineLoading && guidelineQuery.trim().length === 0 && (
              <View style={{ alignItems: 'center', paddingTop: 40 }}>
                <Text style={{ fontSize: 15, color: '#94a3b8' }}>Start typing to search MoH guidelines</Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <View style={styles.bottomActions}>
        <Pressable style={styles.saveButton} onPress={saveConsultation}>
          <Text style={styles.saveButtonText}>Update Consultation</Text>
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

  bottomActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#0ea5e9',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
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
  localMatchesHeader: {
    marginBottom: 12,
  },
  localMatchesTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  mohBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#dcfce7',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  mohBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
    letterSpacing: 0.3,
  },
  localMatchCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#16a34a',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  localMatchCondition: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 2,
  },
  localMatchCategory: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
  },
  localMatchSourceRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  mohBadgeSmall: {
    backgroundColor: '#f0fdf4',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  mohBadgeSmallText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#15803d',
  },
  clinicalFeaturesText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#475569',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  localMatchSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  localMatchProtocolLine: {
    fontSize: 13,
    lineHeight: 20,
    color: '#334155',
    marginBottom: 2,
  },
  referralFlagBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  referralFlagTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b91c1c',
    marginBottom: 4,
  },
  referralFlagText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#7f1d1d',
  },
  copyToPlanButton: {
    backgroundColor: '#16a34a',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  copyToPlanButtonText: {
    color: '#ffffff',
    fontSize: 14,
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
