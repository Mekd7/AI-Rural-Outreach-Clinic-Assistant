import { useEffect, useState, useCallback } from 'react';
import { SafeAreaView, StyleSheet, Text, View, ActivityIndicator, Alert, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';

import { getPatientById, saveConsultation, type ConsultationInput } from '@/db/client';
import type { Patient } from '@/types';
import { TriageBadge } from '@/components/TriageBadge';
import { TextArea } from '@/components/TextArea';
import { VoiceMicButton } from '@/components/VoiceMicButton';

export default function ConsultationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Consultation form state
  const [subjectiveNotes, setSubjectiveNotes] = useState('');
  const [objectiveNotes, setObjectiveNotes] = useState('');
  const [assessmentPlan, setAssessmentPlan] = useState('');
  const [prescriptions, setPrescriptions] = useState('');

  const handleSubjectiveTranscription = useCallback((transcribedText: string) => {
    setSubjectiveNotes((prev) => {
      const trimmed = transcribedText.trim();
      if (!prev.trim()) return trimmed;
      return prev + (prev.endsWith(' ') ? '' : ' ') + trimmed;
    });
  }, []);

  // Save consultation state
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (saving || !patient) return;

    // Validate required fields
    if (!subjectiveNotes.trim()) {
      Alert.alert('Validation Error', 'Subjective Notes are required.');
      return;
    }
    if (!assessmentPlan.trim()) {
      Alert.alert('Validation Error', 'Assessment & Plan is required.');
      return;
    }

    setSaving(true);

    try {
      const consultationInput: ConsultationInput = {
        patient_id: patient.id,
        subjective_notes: subjectiveNotes.trim(),
        objective_notes: objectiveNotes.trim(),
        assessment_plan: assessmentPlan.trim(),
        prescriptions: prescriptions.trim(),
        referral_needed: false,
      };

      await saveConsultation(consultationInput);
      
      // Navigate back to home after successful save
      router.back();
    } catch (err) {
      console.error('Failed to save consultation:', err);
      Alert.alert('Save Failed', 'Unable to save consultation. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [saving, patient, subjectiveNotes, objectiveNotes, assessmentPlan, prescriptions]);

  useEffect(() => {
    const loadPatient = async () => {
      if (!id) {
        setError('No patient ID provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await getPatientById(id);
        if (data) {
          setPatient(data);
        } else {
          setError('Patient not found');
        }
      } catch (err) {
        console.error('Failed to load patient:', err);
        setError('Unable to load patient from local storage.');
      } finally {
        setLoading(false);
      }
    };

    loadPatient();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0284c7" />
          <Text style={styles.loadingText}>Loading patient...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Back to Queue</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!patient) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Patient not found</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Back to Queue</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const vitalsParts: string[] = [];
  if (patient.systolic_bp && patient.diastolic_bp) {
    vitalsParts.push(`BP ${patient.systolic_bp}/${patient.diastolic_bp}`);
  }
  if (patient.heart_rate) {
    vitalsParts.push(`HR ${patient.heart_rate} bpm`);
  }
  if (patient.temperature) {
    vitalsParts.push(`Temp ${patient.temperature}°C`);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.patientName}>{patient.full_name}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.metaItem}>
                  {patient.age} yr • {patient.gender === 'M' ? 'Male' : 'Female'}
                </Text>
                <Text style={styles.metaDivider}>•</Text>
                <Text style={styles.metaItem}>{patient.kebele}</Text>
              </View>
            </View>
            <TriageBadge level={patient.triage_level} size="large" />
          </View>

          {vitalsParts.length > 0 && (
            <View style={styles.vitalsContainer}>
              <Text style={styles.vitalsLabel}>Vitals</Text>
              <View style={styles.vitalsRow}>
                {vitalsParts.map((vital, index) => (
                  <Text key={index} style={styles.vitalItem}>
                    {vital}
                  </Text>
                ))}
              </View>
            </View>
          )}

          <View style={styles.registeredRow}>
            <Text style={styles.registeredText}>
              Registered {formatRelativeTime(patient.created_at)}
            </Text>
          </View>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Consultation Notes</Text>

          <TextArea
            label="Subjective Notes"
            placeholder="Patient complaints, symptoms, history..."
            value={subjectiveNotes}
            onChangeText={setSubjectiveNotes}
            numberOfLines={4}
            trailing={
              <VoiceMicButton
                onTranscription={handleSubjectiveTranscription}
              />
            }
          />

          <TextArea
            label="Objective Notes"
            placeholder="Examination findings, observations..."
            value={objectiveNotes}
            onChangeText={setObjectiveNotes}
            numberOfLines={4}
          />

          <TextArea
            label="Assessment & Plan"
            placeholder="Diagnosis, treatment plan, follow-up..."
            value={assessmentPlan}
            onChangeText={setAssessmentPlan}
            numberOfLines={4}
          />

          <TextArea
            label="Prescriptions"
            placeholder="Medications, dosages, instructions..."
            value={prescriptions}
            onChangeText={setPrescriptions}
            numberOfLines={3}
          />
        </View>

        <View style={styles.saveButtonContainer}>
          <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
            <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Consultation'}</Text>
          </Pressable>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ebf3f7',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100,
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
  backButton: {
    backgroundColor: '#0ea5e9',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 12,
  },
  patientName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  metaItem: {
    fontSize: 14,
    color: '#64748b',
  },
  metaDivider: {
    fontSize: 14,
    color: '#94a3b8',
  },
  vitalsContainer: {
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  vitalsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  vitalsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  vitalItem: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
  registeredRow: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  registeredText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  placeholderSection: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderStyle: 'dashed',
  },
  placeholderText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
  },
  formSection: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  saveButtonContainer: {
    marginTop: 8,
    paddingTop: 16,
  },
  saveButton: {
    backgroundColor: '#0284c7',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284c7',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  keyboardAvoiding: {
    flex: 1,
  },
});