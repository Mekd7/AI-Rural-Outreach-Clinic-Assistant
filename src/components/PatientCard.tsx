import { StyleSheet, Text, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import type { Patient } from '@/types';
import { TriageBadge } from '@/components/TriageBadge';

interface PatientCardProps {
  patient: Patient;
}

export function PatientCard({ patient }: PatientCardProps) {
  const handlePress = () => {
    router.push(`/consultation/${patient.id}` as any);
  };
  const vitalsParts: string[] = [];
  if (patient.systolic_bp && patient.diastolic_bp) {
    vitalsParts.push(`BP ${patient.systolic_bp}/${patient.diastolic_bp}`);
  }
  if (patient.heart_rate) {
    vitalsParts.push(`HR ${patient.heart_rate}`);
  }
  if (patient.temperature) {
    vitalsParts.push(`Temp ${patient.temperature}°C`);
  }

  return (
    <Pressable style={styles.card} onPress={handlePress} android_ripple={{ color: '#0284c733' }}>
      <View style={styles.headerRow}>
        <View style={styles.nameSection}>
          <Text style={styles.patientName}>{patient.full_name}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaItem}>
              {patient.age} yr • {patient.gender === 'M' ? 'Male' : 'Female'}
            </Text>
            <Text style={styles.metaDivider}>•</Text>
            <Text style={styles.metaItem}>{patient.kebele}</Text>
          </View>
        </View>
        <TriageBadge level={patient.triage_level} size="medium" />
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

      <View style={styles.footerRow}>
        <Text style={styles.timestamp}>
          Registered {formatRelativeTime(patient.created_at)}
        </Text>
      </View>
    </Pressable>
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
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  nameSection: {
    flex: 1,
    paddingRight: 12,
  },
  patientName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  metaItem: {
    fontSize: 13,
    color: '#64748b',
  },
  metaDivider: {
    fontSize: 13,
    color: '#94a3b8',
  },
  vitalsContainer: {
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  vitalsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  vitalsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  vitalItem: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  timestamp: {
    fontSize: 11,
    color: '#94a3b8',
  },
});