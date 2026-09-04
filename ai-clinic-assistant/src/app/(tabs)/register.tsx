import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db } from '@/db/client';
import type { Gender, Patient } from '@/types';
import { calculateTriage } from '@/utils/triage';

type FormState = {
  full_name: string;
  age: string;
  gender: Gender;
  kebele: string;
  systolic_bp: string;
  diastolic_bp: string;
  heart_rate: string;
  temperature: string;
  is_pregnant: boolean;
};

const initialForm: FormState = {
  full_name: '',
  age: '',
  gender: 'M',
  kebele: '',
  systolic_bp: '',
  diastolic_bp: '',
  heart_rate: '',
  temperature: '',
  is_pregnant: false,
};

const badgeColors = {
  RED: { background: '#fee2e2', border: '#ef4444', text: '#b91c1c' },
  YELLOW: { background: '#fef3c7', border: '#f59e0b', text: '#b45309' },
  GREEN: { background: '#dcfce7', border: '#10b981', text: '#047857' },
} as const;

function RegisterScreen() {
  const [form, setForm] = useState<FormState>(initialForm);

  const triage = useMemo(() => {
    return calculateTriage({
      age: form.age ? Number(form.age) : undefined,
      gender: form.gender,
      is_pregnant: form.is_pregnant,
      systolic_bp: form.systolic_bp ? Number(form.systolic_bp) : undefined,
      diastolic_bp: form.diastolic_bp ? Number(form.diastolic_bp) : undefined,
      heart_rate: form.heart_rate ? Number(form.heart_rate) : undefined,
      temperature: form.temperature ? Number(form.temperature) : undefined,
    });
  }, [form]);

  const badgeStyle = badgeColors[triage];

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const savePatient = async () => {
    const fullName = form.full_name.trim();
    const kebele = form.kebele.trim();
    const age = Number(form.age);
    const systolicBp = Number(form.systolic_bp);
    const diastolicBp = Number(form.diastolic_bp);
    const heartRate = Number(form.heart_rate);
    const temperature = Number(form.temperature);

    if (!fullName || !kebele || !form.age || !form.systolic_bp || !form.diastolic_bp || !form.heart_rate || !form.temperature) {
      Alert.alert('Missing fields', 'Please complete all patient and vital details before saving.');
      return;
    }

    if ([age, systolicBp, diastolicBp, heartRate, temperature].some((value) => Number.isNaN(value) || value <= 0)) {
      Alert.alert('Invalid values', 'Please enter valid numeric values for the patient details and vitals.');
      return;
    }

    const patient: Patient = {
      id: `patient_${Date.now()}`,
      full_name: fullName,
      age,
      gender: form.gender,
      kebele,
      is_pregnant: form.is_pregnant,
      systolic_bp: systolicBp,
      diastolic_bp: diastolicBp,
      heart_rate: heartRate,
      temperature,
      triage_level: triage,
      synced: false,
      created_at: new Date().toISOString(),
    };

    try {
      await db.runAsync(
        `INSERT INTO patients (id, full_name, age, gender, kebele, is_pregnant, systolic_bp, diastolic_bp, heart_rate, temperature, triage_level, synced, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          patient.id,
          patient.full_name,
          patient.age,
          patient.gender,
          patient.kebele,
          patient.is_pregnant ? 1 : 0,
          patient.systolic_bp,
          patient.diastolic_bp,
          patient.heart_rate,
          patient.temperature,
          patient.triage_level,
          patient.synced ? 1 : 0,
          patient.created_at,
        ],
      );

      Alert.alert('Patient saved', `${patient.full_name} was saved successfully.`, [
        {
          text: 'OK',
          onPress: () => router.navigate('/' as any),
        },
      ]);
    } catch (error) {
      console.error('Failed to save patient:', error);
      Alert.alert('Save failed', 'Unable to save the patient to local storage.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.navigate('/' as any)} style={styles.backButton} accessibilityLabel="Go back">
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>New Patient</Text>
          <Text style={styles.headerSubtitle}>Registration &amp; Vitals Entry</Text>
        </View>

        <View style={styles.headerIcons}>
          <Text style={styles.headerIcon}>◔</Text>
          <Text style={styles.headerIcon}>⚡</Text>
          <Text style={styles.headerIcon}>◌</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={styles.formCard}>
          <Text style={styles.sectionLabel}>PATIENT DEMOGRAPHICS</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={form.full_name}
              onChangeText={(value) => updateField('full_name', value)}
              placeholder="e.g. Tigest Haile"
              placeholderTextColor="#6b7280"
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>

          <View style={styles.twoColumnRow}>
            <View style={styles.fieldGroupHalf}>
              <Text style={styles.label}>Age (years)</Text>
              <TextInput
                style={styles.input}
                value={form.age}
                onChangeText={(value) => updateField('age', value.replace(/[^0-9]/g, ''))}
                placeholder="e.g. 34"
                keyboardType="number-pad"
                placeholderTextColor="#6b7280"
              />
            </View>

            <View style={styles.fieldGroupHalf}>
              <Text style={styles.label}>Gender</Text>
              <View style={styles.genderRow}>
                <Pressable
                  style={[styles.genderOption, form.gender === 'M' && styles.genderOptionSelected]}
                  onPress={() => updateField('gender', 'M')}>
                  <Text style={[styles.genderText, form.gender === 'M' && styles.genderTextSelected]}>Male</Text>
                </Pressable>
                <Pressable
                  style={[styles.genderOption, form.gender === 'F' && styles.genderOptionSelected]}
                  onPress={() => updateField('gender', 'F')}>
                  <Text style={[styles.genderText, form.gender === 'F' && styles.genderTextSelected]}>Female</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Kebele / Village</Text>
            <TextInput
              style={styles.input}
              value={form.kebele}
              onChangeText={(value) => updateField('kebele', value)}
              placeholder="Select Kebele..."
              placeholderTextColor="#6b7280"
            />
          </View>

          <View style={styles.triagePanel}>
            <Text style={styles.sectionLabel}>TRIAGE PREVIEW</Text>
            <View style={styles.triageBadgeContainer}>
              <View
                style={[
                  styles.triageBadge,
                  {
                    backgroundColor: badgeStyle.background,
                    borderColor: badgeStyle.border,
                  },
                ]}>
                <Text style={[styles.triageBadgeText, { color: badgeStyle.text }]}>{triage}</Text>
              </View>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.sectionLabel}>CLINICAL VITALS</Text>
            <View style={styles.twoColumnRowVitals}>
              <View style={styles.fieldGroupHalf}>
                <Text style={styles.label}>Systolic</Text>
                <TextInput
                  style={styles.input}
                  value={form.systolic_bp}
                  onChangeText={(value) => updateField('systolic_bp', value.replace(/[^0-9]/g, ''))}
                  placeholder="120"
                  keyboardType="number-pad"
                  placeholderTextColor="#6b7280"
                />
              </View>

              <View style={styles.fieldGroupHalf}>
                <Text style={styles.label}>Diastolic</Text>
                <TextInput
                  style={styles.input}
                  value={form.diastolic_bp}
                  onChangeText={(value) => updateField('diastolic_bp', value.replace(/[^0-9]/g, ''))}
                  placeholder="80"
                  keyboardType="number-pad"
                  placeholderTextColor="#6b7280"
                />
              </View>
            </View>

            <View style={styles.twoColumnRowVitals}>
              <View style={styles.fieldGroupHalf}>
                <Text style={styles.label}>Heart Rate (bpm)</Text>
                <TextInput
                  style={styles.input}
                  value={form.heart_rate}
                  onChangeText={(value) => updateField('heart_rate', value.replace(/[^0-9]/g, ''))}
                  placeholder="e.g. 78"
                  keyboardType="number-pad"
                  placeholderTextColor="#6b7280"
                />
              </View>

              <View style={styles.fieldGroupHalf}>
                <Text style={styles.label}>Temperature (°C)</Text>
                <TextInput
                  style={styles.input}
                  value={form.temperature}
                  onChangeText={(value) => updateField('temperature', value.replace(/[^0-9.]/g, ''))}
                  placeholder="e.g. 37.2"
                  keyboardType="decimal-pad"
                  placeholderTextColor="#6b7280"
                />
              </View>
            </View>

            <View style={styles.pregnancyRow}>
              <Text style={styles.pregnancyLabel}>Pregnancy</Text>
              <Switch
                value={form.is_pregnant}
                onValueChange={(value) => updateField('is_pregnant', value)}
                trackColor={{ false: '#d1d5db', true: '#38bdf8' }}
                thumbColor={form.is_pregnant ? '#ffffff' : '#f3f4f6'}
              />
            </View>
          </View>
        </View>

        <Pressable style={styles.submitButton} onPress={savePatient}>
          <Text style={styles.submitButtonText}>Save Patient &amp; Begin Consultation</Text>
        </Pressable>
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ebf3f7',
  },
  header: {
    backgroundColor: '#0ea5e9',
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    color: '#ffffff',
    fontSize: 34,
    lineHeight: 34,
    fontWeight: '300',
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#dcf3ff',
    fontSize: 14,
    marginTop: 2,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    color: '#ffffff',
    fontSize: 18,
    opacity: 0.9,
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#ebf3f7',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 24,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  sectionLabel: {
    color: '#0ea5e9',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldGroupHalf: {
    flex: 1,
    marginRight: 8,
  },
  label: {
    color: '#374151',
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d9e2',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#111827',
  },
  twoColumnRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  twoColumnRowVitals: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  genderRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#d1d9e2',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
  },
  genderOption: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  genderOptionSelected: {
    backgroundColor: '#dbeafe',
  },
  genderText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  genderTextSelected: {
    color: '#0f172a',
  },
  triagePanel: {
    marginTop: 2,
    marginBottom: 14,
  },
  triageBadgeContainer: {
    alignItems: 'flex-start',
  },
  triageBadge: {
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  triageBadgeText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  pregnancyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  pregnancyLabel: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#0ea5e9',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default RegisterScreen;
