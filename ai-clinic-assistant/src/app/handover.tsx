import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TriageBadge } from '@/components/TriageBadge';
import { TRIAGE_COLORS } from '@/constants/triage';
import { db } from '@/db/client';
import type { Consultation, Patient } from '@/types';

// ---------- Types ----------

type FilterTab = 'all' | 'urgent' | 'medication';

interface HandoverEntry {
  patient: Patient;
  consultation: Consultation | null;
  prescriptionsList: string[];
  hewInstructions: string[];
  isUrgentReferral: boolean;
  hasMedicationFollowUp: boolean;
}

// ---------- Helpers ----------

function getTodayDateString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parsePrescriptions(raw: string): string[] {
  if (!raw || raw === '[]') return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((p: any) => typeof p === 'string' && p.trim());
    return [];
  } catch {
    return raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  }
}

function generateHEWInstructions(patient: Patient, consultation: Consultation | null): string[] {
  const instructions: string[] = [];

  // Triage-based instructions
  if (patient.triage_level === 'RED') {
    instructions.push('Ensure transport to hospital for urgent referral');
    instructions.push('Monitor patient closely until transfer is arranged');
  }

  if (patient.triage_level === 'YELLOW') {
    instructions.push('Schedule follow-up visit within 48 hours');
  }

  // BP-based instructions
  if (patient.systolic_bp >= 140 || patient.diastolic_bp >= 90) {
    instructions.push('Check blood pressure in 3 days');
  }

  // Temperature-based
  if (patient.temperature >= 38.0) {
    instructions.push('Monitor temperature daily until normalized');
  }

  // Pregnancy
  if (patient.is_pregnant) {
    instructions.push('Monitor maternal vitals, schedule next ANC visit');
  }

  // Referral-based
  if (consultation?.referral_needed) {
    instructions.push('Confirm referral transport and follow up on hospital outcome');
  }

  // Prescription-based
  const rxList = parsePrescriptions(consultation?.prescriptions ?? '');
  if (rxList.length > 0) {
    instructions.push('Ensure medication adherence and monitor for side effects');
  }

  // Nutritional (young children)
  if (patient.age < 5) {
    instructions.push('Monitor RUTF weight weekly if malnourished');
    instructions.push('Ensure immunization schedule is up-to-date');
  }

  if (instructions.length === 0) {
    instructions.push('Routine follow-up at next clinic day');
  }

  return instructions;
}

function buildExportText(entries: HandoverEntry[], metrics: { total: number; urgent: number; followUps: number }): string {
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const lines: string[] = [
    '========================================',
    '  POST-CLINIC HEW HANDOVER REPORT',
    `  Date: ${today}`,
    '========================================',
    '',
    `Total Patients Seen:   ${metrics.total}`,
    `Urgent Referrals:      ${metrics.urgent}`,
    `Follow-ups Required:   ${metrics.followUps}`,
    '',
    '----------------------------------------',
  ];

  for (const entry of entries) {
    const p = entry.patient;
    const gender = p.gender === 'M' ? 'Male' : 'Female';
    lines.push('');
    lines.push(`Patient: ${p.full_name}`);
    lines.push(`  ${p.age}y / ${gender} / ${p.kebele}`);
    lines.push(`  Triage: ${p.triage_level}${entry.isUrgentReferral ? ' (URGENT REFERRAL)' : ''}`);

    if (entry.prescriptionsList.length > 0) {
      lines.push('  Medications:');
      for (const rx of entry.prescriptionsList) {
        lines.push(`    - ${rx}`);
      }
    }

    lines.push('  HEW Actions:');
    for (const inst of entry.hewInstructions) {
      lines.push(`    * ${inst}`);
    }
    lines.push('----------------------------------------');
  }

  lines.push('');
  lines.push('This is a decision support summary only.');
  lines.push('Verify against official records before action.');
  return lines.join('\n');
}

// ---------- Component ----------

export default function HandoverScreen() {
  const [entries, setEntries] = useState<HandoverEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const loadTodayData = useCallback(async () => {
    setLoading(true);
    try {
      const today = getTodayDateString();

      // Get today's patients
      const patients = await db.getAllAsync<Patient>(
        `SELECT * FROM patients WHERE strftime('%Y-%m-%d', created_at) = ? ORDER BY created_at DESC`,
        [today],
      );

      // Get today's consultations
      const consultations = await db.getAllAsync<Consultation>(
        `SELECT * FROM consultations WHERE strftime('%Y-%m-%d', created_at) = ? ORDER BY created_at DESC`,
        [today],
      );

      // Map consultations by patient_id (latest per patient)
      const consultByPatient = new Map<string, Consultation>();
      for (const c of consultations) {
        if (!consultByPatient.has(c.patient_id)) {
          consultByPatient.set(c.patient_id, c);
        }
      }

      const built: HandoverEntry[] = patients.map((p) => {
        const consult = consultByPatient.get(p.id) ?? null;
        const rxList = parsePrescriptions(consult?.prescriptions ?? '');
        const instructions = generateHEWInstructions(p, consult);
        const isUrgent = p.triage_level === 'RED' || Boolean(consult?.referral_needed);
        const hasMedFollowUp = rxList.length > 0;
        return {
          patient: p,
          consultation: consult,
          prescriptionsList: rxList,
          hewInstructions: instructions,
          isUrgentReferral: isUrgent,
          hasMedicationFollowUp: hasMedFollowUp,
        };
      });

      if (isMounted.current) {
        setEntries(built);
      }
    } catch (err) {
      console.error('Handover data load failed:', err);
      if (isMounted.current) {
        Alert.alert('Error', 'Unable to load handover data.');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadTodayData();
  }, [loadTodayData]);

  // ---------- Metrics ----------
  const metrics = useMemo(() => {
    const total = entries.length;
    const urgent = entries.filter((e) => e.isUrgentReferral).length;
    const followUps = entries.filter((e) => e.hasMedicationFollowUp || e.patient.triage_level === 'YELLOW').length;
    return { total, urgent, followUps };
  }, [entries]);

  // ---------- Filtered list ----------
  const filteredEntries = useMemo(() => {
    switch (activeTab) {
      case 'urgent':
        return entries.filter((e) => e.isUrgentReferral);
      case 'medication':
        return entries.filter((e) => e.hasMedicationFollowUp);
      default:
        return entries;
    }
  }, [entries, activeTab]);

  // ---------- Export ----------
  const handleExport = async () => {
    const text = buildExportText(entries, metrics);
    try {
      await Share.share({
        message: text,
        title: 'HEW Handover Report',
      });
    } catch (err) {
      console.error('Export failed:', err);
      Alert.alert('Error', 'Unable to share the report.');
    }
  };

  // ---------- Render helpers ----------
  const FILTER_TABS: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All Handovers' },
    { key: 'urgent', label: 'Urgent Referrals Only' },
    { key: 'medication', label: 'Medication Follow-ups' },
  ];

  const renderMetricCard = (label: string, value: number, color: string, bgColor: string) => (
    <View key={label} style={[styles.metricCard, { borderLeftColor: color }]}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );

  const renderActionCard = ({ item }: { item: HandoverEntry }) => {
    const p = item.patient;
    const triageColors = TRIAGE_COLORS[p.triage_level];
    const gender = p.gender === 'M' ? 'Male' : 'Female';

    return (
      <View style={[styles.actionCard, item.isUrgentReferral && styles.actionCardUrgent]}>
        {/* Patient header row */}
        <View style={styles.actionCardHeader}>
          <View style={styles.actionCardAvatar}>
            <Text style={styles.actionCardAvatarText}>{p.full_name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.actionCardPatientInfo}>
            <View style={styles.actionCardNameRow}>
              <Text style={styles.actionCardName}>{p.full_name}</Text>
              <TriageBadge level={p.triage_level} size="small" />
            </View>
            <Text style={styles.actionCardMeta}>{p.age}y · {gender} · {p.kebele}</Text>
          </View>
        </View>

        {/* Prescribed medications */}
        {item.prescriptionsList.length > 0 && (
          <View style={styles.rxSection}>
            <Text style={styles.rxSectionTitle}>Prescribed Medications</Text>
            {item.prescriptionsList.map((rx, i) => (
              <View key={i} style={styles.rxPill}>
                <Text style={styles.rxPillText}>{rx}</Text>
              </View>
            ))}
          </View>
        )}

        {/* HEW Instructions */}
        <View style={styles.instructionsSection}>
          <Text style={styles.instructionsTitle}>HEW Actions Required</Text>
          {item.hewInstructions.map((inst, i) => (
            <View key={i} style={styles.instructionRow}>
              <View style={[styles.instructionDot, { backgroundColor: item.isUrgentReferral ? '#ef4444' : '#0284c7' }]} />
              <Text style={styles.instructionText}>{inst}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // ---------- Main render ----------
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle}>Post-Clinic HEW Handover Report</Text>
          <Text style={styles.headerDate}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </View>
      </View>

      {/* Metric Cards */}
      <View style={styles.metricsRow}>
        {renderMetricCard('Total Patients\nSeen', metrics.total, '#0284c7', '#dbeafe')}
        {renderMetricCard('Urgent\nReferrals', metrics.urgent, '#dc2626', '#fee2e2')}
        {renderMetricCard('Follow-ups\nRequired', metrics.followUps, '#d97706', '#fef3c7')}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabsWrapper}>
          {FILTER_TABS.map((tab) => (
            <Pressable
              key={tab.key}
              style={[styles.filterTab, activeTab === tab.key && styles.filterTabActive]}
              onPress={() => setActiveTab(tab.key)}>
              <Text style={[styles.filterTabText, activeTab === tab.key && styles.filterTabTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Action Cards List */}
      <View style={styles.listContainer}>
        {loading ? (
          <View style={styles.centered}>
            <Text style={styles.loadingText}>Loading handover data…</Text>
          </View>
        ) : filteredEntries.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyTitle}>
              {activeTab === 'all' ? 'No patients seen today' : `No ${activeTab === 'urgent' ? 'urgent referrals' : 'medication follow-ups'} today`}
            </Text>
            <Text style={styles.emptySubtext}>Patient records from today's clinic will appear here.</Text>
          </View>
        ) : (
          <FlatList
            data={filteredEntries}
            keyExtractor={(item) => item.patient.id}
            renderItem={renderActionCard}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={<View style={{ height: 100 }} />}
          />
        )}
      </View>

      {/* Export Button */}
      <View style={styles.bottomActions}>
        <Pressable style={styles.exportButton} onPress={handleExport}>
          <Text style={styles.exportButtonText}>Export / Print Summary</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ebf3f7',
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
  headerTitleBlock: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  headerDate: {
    color: '#bae6fd',
    fontSize: 12,
    marginTop: 2,
  },

  // Metric Cards
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 4,
    lineHeight: 15,
  },

  // Filter Tabs
  filterContainer: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  filterTabsWrapper: {
    flexDirection: 'row',
    gap: 8,
  },
  filterTab: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  filterTabActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterTabTextActive: {
    color: '#ffffff',
  },

  // List
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 15,
    color: '#475569',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },

  // Action Card
  actionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  actionCardUrgent: {
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  actionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionCardAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionCardAvatarText: {
    color: '#0284c7',
    fontSize: 16,
    fontWeight: '700',
  },
  actionCardPatientInfo: {
    flex: 1,
  },
  actionCardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  actionCardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  actionCardMeta: {
    fontSize: 12,
    color: '#64748b',
  },

  // Prescriptions
  rxSection: {
    marginBottom: 12,
  },
  rxSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  rxPill: {
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  rxPillText: {
    fontSize: 13,
    color: '#166534',
    fontWeight: '500',
  },

  // HEW Instructions
  instructionsSection: {},
  instructionsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  instructionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  instructionText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: '#334155',
  },

  // Bottom
  bottomActions: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
  },
  exportButton: {
    backgroundColor: '#0284c7',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  exportButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
