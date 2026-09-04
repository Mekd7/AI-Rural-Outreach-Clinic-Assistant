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

function buildExportText(entries: HandoverEntry[], metrics: { total: number; urgent: number; followUps: number }, dateLabel: string): string {
  const lines: string[] = [
    '========================================',
    '  POST-CLINIC HEW HANDOVER REPORT',
    `  Date: ${dateLabel}`,
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

// ---------- Date helpers ----------

interface ClinicDate {
  dateStr: string; // YYYY-MM-DD
  patientCount: number;
  urgentCount: number;
}

function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function isToday(dateStr: string): boolean {
  return dateStr === getTodayDateString();
}

// ---------- Component ----------

export default function HandoverScreen() {
  // Phase: null = date list, string = selected date's detail view
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [clinicDates, setClinicDates] = useState<ClinicDate[]>([]);
  const [datesLoading, setDatesLoading] = useState(true);

  const [entries, setEntries] = useState<HandoverEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // ── Load distinct clinic dates ──
  const loadDates = useCallback(async () => {
    setDatesLoading(true);
    try {
      const rows = await db.getAllAsync<{ date_str: string; cnt: number; urgent_cnt: number }>(
        `SELECT strftime('%Y-%m-%d', created_at) as date_str,
                COUNT(*) as cnt,
                SUM(CASE WHEN triage_level = 'RED' THEN 1 ELSE 0 END) as urgent_cnt
         FROM patients
         GROUP BY date_str
         ORDER BY date_str DESC`,
      );
      if (isMounted.current) {
        setClinicDates(
          (rows ?? []).map((r) => ({
            dateStr: r.date_str,
            patientCount: r.cnt,
            urgentCount: r.urgent_cnt,
          })),
        );
      }
    } catch (err) {
      console.error('Failed to load clinic dates:', err);
    } finally {
      if (isMounted.current) setDatesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDates();
  }, [loadDates]);

  // ── Load patients for a specific date ──
  const loadDateData = useCallback(async (dateStr: string) => {
    setLoading(true);
    setActiveTab('all');
    try {
      const patients = await db.getAllAsync<Patient>(
        `SELECT * FROM patients WHERE strftime('%Y-%m-%d', created_at) = ? ORDER BY created_at DESC`,
        [dateStr],
      );

      const consultations = await db.getAllAsync<Consultation>(
        `SELECT * FROM consultations WHERE strftime('%Y-%m-%d', created_at) = ? ORDER BY created_at DESC`,
        [dateStr],
      );

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

  const toggleExpanded = useCallback((patientId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(patientId)) next.delete(patientId);
      else next.add(patientId);
      return next;
    });
  }, []);

  const handleSelectDate = useCallback((dateStr: string) => {
    setSelectedDate(dateStr);
    setExpandedIds(new Set());
    loadDateData(dateStr);
  }, [loadDateData]);

  const handleBackToDates = useCallback(() => {
    setSelectedDate(null);
    setEntries([]);
    setExpandedIds(new Set());
    loadDates();
  }, [loadDates]);

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
    const dateLabel = selectedDate ? formatDateLabel(selectedDate) : '';
    const text = buildExportText(entries, metrics, dateLabel);
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
    const gender = p.gender === 'M' ? 'Male' : 'Female';
    const isExpanded = expandedIds.has(p.id);
    const c = item.consultation;

    return (
      <View style={[styles.actionCard, item.isUrgentReferral && styles.actionCardUrgent]}>
        {/* Patient header row – tappable to expand/collapse */}
        <Pressable onPress={() => toggleExpanded(p.id)} style={styles.actionCardHeader}>
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
          <Text style={styles.expandChevron}>{isExpanded ? '▲' : '▼'}</Text>
        </Pressable>

        {/* HEW Instructions – always visible */}
        <View style={styles.instructionsSection}>
          <Text style={styles.instructionsTitle}>HEW Actions Required</Text>
          {item.hewInstructions.map((inst, i) => (
            <View key={i} style={styles.instructionRow}>
              <View style={[styles.instructionDot, { backgroundColor: item.isUrgentReferral ? '#ef4444' : '#0284c7' }]} />
              <Text style={styles.instructionText}>{inst}</Text>
            </View>
          ))}
        </View>

        {/* ── Expanded detail section ── */}
        {isExpanded && (
          <View style={styles.expandedSection}>
            {/* Vitals summary */}
            <View style={styles.detailBlock}>
              <Text style={styles.detailBlockTitle}>Vitals</Text>
              <Text style={styles.detailBlockText}>
                BP: {p.systolic_bp}/{p.diastolic_bp} mmHg · HR: {p.heart_rate} bpm · Temp: {p.temperature}°C
                {p.is_pregnant ? ' · Pregnant' : null}
              </Text>
            </View>

            {/* Subjective / Chief complaint */}
            {c && c.subjective_notes.trim().length > 0 && (
              <View style={styles.detailBlock}>
                <Text style={styles.detailBlockTitle}>Chief Complaint / History</Text>
                <Text style={styles.detailBlockText}>{c.subjective_notes.trim()}</Text>
              </View>
            )}

            {/* Objective findings */}
            {c && c.objective_notes.trim().length > 0 && (
              <View style={styles.detailBlock}>
                <Text style={styles.detailBlockTitle}>Objective Findings</Text>
                <Text style={styles.detailBlockText}>{c.objective_notes.trim()}</Text>
              </View>
            )}

            {/* Assessment & Plan */}
            {c && c.assessment_plan.trim().length > 0 && (
              <View style={styles.detailBlock}>
                <Text style={styles.detailBlockTitle}>Assessment & Plan</Text>
                <Text style={styles.detailBlockText}>{c.assessment_plan.trim()}</Text>
              </View>
            )}

            {/* Prescribed medications */}
            {item.prescriptionsList.length > 0 && (
              <View style={styles.detailBlock}>
                <Text style={[styles.detailBlockTitle, { color: '#047857' }]}>Prescribed Medications</Text>
                {item.prescriptionsList.map((rx, i) => (
                  <View key={i} style={styles.rxPill}>
                    <Text style={styles.rxPillText}>{rx}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Referral flag */}
            {!!c?.referral_needed && (
              <View style={styles.referralBanner}>
                <Text style={styles.referralBannerText}>Referral Needed</Text>
              </View>
            )}

            {/* No consultation recorded */}
            {!c && (
              <View style={styles.detailBlock}>
                <Text style={[styles.detailBlockText, { color: '#94a3b8', fontStyle: 'italic' }]}>
                  No consultation recorded for this patient.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Tap hint */}
        {!isExpanded && (
          <Pressable onPress={() => toggleExpanded(p.id)}>
            <Text style={styles.tapHint}>Tap to view full details</Text>
          </Pressable>
        )}
      </View>
    );
  };

  // ---------- Render: date card ----------
  const renderDateCard = ({ item }: { item: ClinicDate }) => {
    const today = isToday(item.dateStr);
    return (
      <Pressable
        style={[styles.dateCard, today && styles.dateCardToday]}
        onPress={() => handleSelectDate(item.dateStr)}
      >
        <View style={styles.dateCardLeft}>
          <Text style={[styles.dateCardLabel, today && styles.dateCardLabelToday]}>
            {formatDateLabel(item.dateStr)}
          </Text>
          {today && <Text style={styles.todayBadge}>Today</Text>}
        </View>
        <View style={styles.dateCardRight}>
          <View style={styles.dateCardStat}>
            <Text style={styles.dateCardStatValue}>{item.patientCount}</Text>
            <Text style={styles.dateCardStatLabel}>patients</Text>
          </View>
          {item.urgentCount > 0 && (
            <View style={[styles.dateCardStat, styles.dateCardStatUrgent]}>
              <Text style={styles.dateCardStatValueUrgent}>{item.urgentCount}</Text>
              <Text style={styles.dateCardStatLabelUrgent}>urgent</Text>
            </View>
          )}
          <Text style={styles.dateCardChevron}>›</Text>
        </View>
      </Pressable>
    );
  };

  // ---------- Main render ----------

  // Phase 1: Date list
  if (selectedDate === null) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <View style={styles.headerTitleBlock}>
            <Text style={styles.headerTitle}>HEW Handover Reports</Text>
            <Text style={styles.headerDate}>Select a clinic day to view</Text>
          </View>
        </View>

        <View style={styles.listContainer}>
          {datesLoading ? (
            <View style={styles.centered}>
              <Text style={styles.loadingText}>Loading clinic dates…</Text>
            </View>
          ) : clinicDates.length === 0 ? (
            <View style={styles.centered}>
              <Text style={styles.emptyTitle}>No clinic days recorded</Text>
              <Text style={styles.emptySubtext}>Patient records will appear here after registration.</Text>
            </View>
          ) : (
            <FlatList
              data={clinicDates}
              keyExtractor={(item) => item.dateStr}
              renderItem={renderDateCard}
              contentContainerStyle={styles.dateListContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </SafeAreaView>
    );
  }

  // Phase 2: Selected date detail view
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleBackToDates} style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle}>Post-Clinic HEW Handover Report</Text>
          <Text style={styles.headerDate}>{formatDateShort(selectedDate)}</Text>
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
              {activeTab === 'all' ? 'No patients on this date' : `No ${activeTab === 'urgent' ? 'urgent referrals' : 'medication follow-ups'}`}
            </Text>
            <Text style={styles.emptySubtext}>Patient records for this clinic day will appear here.</Text>
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

  // Date list
  dateListContent: {
    padding: 16,
  },
  dateCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  dateCardToday: {
    borderWidth: 2,
    borderColor: '#0284c7',
  },
  dateCardLeft: {
    flex: 1,
    marginRight: 12,
  },
  dateCardLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  dateCardLabelToday: {
    color: '#0284c7',
  },
  todayBadge: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
    backgroundColor: '#0284c7',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  dateCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateCardStat: {
    alignItems: 'center',
    backgroundColor: '#f0f4f8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dateCardStatUrgent: {
    backgroundColor: '#fef2f2',
  },
  dateCardStatValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0284c7',
  },
  dateCardStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
  },
  dateCardStatValueUrgent: {
    fontSize: 18,
    fontWeight: '800',
    color: '#dc2626',
  },
  dateCardStatLabelUrgent: {
    fontSize: 10,
    fontWeight: '600',
    color: '#dc2626',
  },
  dateCardChevron: {
    fontSize: 24,
    color: '#94a3b8',
    fontWeight: '300',
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
  expandChevron: {
    fontSize: 12,
    color: '#94a3b8',
    marginLeft: 8,
  },
  tapHint: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
  },

  // Expanded detail section
  expandedSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
  },
  detailBlock: {
    marginBottom: 12,
  },
  detailBlockTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  detailBlockText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#334155',
  },
  referralBanner: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  referralBannerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#dc2626',
    textAlign: 'center',
  },

  // Prescriptions
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
