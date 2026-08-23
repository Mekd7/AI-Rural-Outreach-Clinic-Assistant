import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Patient } from '@/types';
import { TriageBadge } from './TriageBadge';
import { TRIAGE_COLORS } from '@/constants/triage';

interface PatientCardProps {
  patient: Patient;
  onPress?: () => void;
}

export function PatientCard({ patient, onPress }: PatientCardProps) {
  const triageColors = TRIAGE_COLORS[patient.triage_level];

  const formatVitals = () => {
    const parts = [];
    parts.push(`${patient.systolic_bp}/${patient.diastolic_bp} mmHg`);
    parts.push(`${patient.heart_rate} bpm`);
    parts.push(`${patient.temperature}°C`);
    return parts.join('  •  ');
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
      accessibilityLabel={`Patient ${patient.full_name}, ${patient.triage_level} priority`}
    >
      <View style={styles.cardHeader}>
        <View style={styles.nameRow}>
          <Text style={styles.patientName} numberOfLines={1}>{patient.full_name}</Text>
          <TriageBadge level={patient.triage_level} size="small" />
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            {patient.age}y  •  {patient.gender === 'M' ? 'Male' : 'Female'}
          </Text>
          <Text style={styles.metaText}>{patient.kebele}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.vitalsRow}>
        <Text style={styles.vitalsLabel}>Vitals</Text>
        <Text style={[styles.vitalsValue, { color: triageColors.text }]}>{formatVitals()}</Text>
      </View>

      {patient.is_pregnant && (
        <View style={[styles.pregnancyBadge, { backgroundColor: triageColors.background }]}>
          <Text style={[styles.pregnancyText, { color: triageColors.text }]}>Pregnant</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
  },
  cardPressed: {
    backgroundColor: '#f8fafc',
  },
  cardHeader: {
    flexDirection: 'column',
    gap: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  patientName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e2e8f0',
    marginVertical: 10,
  },
  vitalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vitalsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  vitalsValue: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  pregnancyBadge: {
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  pregnancyText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});