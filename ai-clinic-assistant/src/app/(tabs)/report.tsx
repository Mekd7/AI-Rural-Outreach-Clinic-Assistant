import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import {
  getPatients,
  getTriageCounts,
  getGenderCounts,
  getAgeCounts,
  getKebeleCounts,
  getTotalConsultations,
  type TriageCounts,
} from '@/db/client';

/* ──────────── helpers ──────────── */

function todayFormatted(): string {
  const d = new Date();
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function pct(value: number, total: number): number {
  return total === 0 ? 0 : Math.round((value / total) * 100);
}

/* ──────────── component ──────────── */

export default function ReportScreen() {
  const [loading, setLoading] = useState(true);
  const [totalPatients, setTotalPatients] = useState(0);
  const [totalConsultations, setTotalConsultations] = useState(0);
  const [triage, setTriage] = useState<TriageCounts>({ RED: 0, YELLOW: 0, GREEN: 0 });
  const [gender, setGender] = useState<{ M: number; F: number }>({ M: 0, F: 0 });
  const [age, setAge] = useState<{ pediatric: number; adult: number }>({ pediatric: 0, adult: 0 });
  const [kebeles, setKebeles] = useState<{ kebele: string; count: number }[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [patients, consultCount, triageCounts, genderCounts, ageCounts, kebeleCounts] =
        await Promise.all([
          getPatients(),
          getTotalConsultations(),
          getTriageCounts(),
          getGenderCounts(),
          getAgeCounts(),
          getKebeleCounts(),
        ]);
      setTotalPatients(patients.length);
      setTotalConsultations(consultCount);
      setTriage(triageCounts);
      setGender(genderCounts);
      setAge(ageCounts);
      setKebeles(kebeleCounts);
    } catch (e) {
      console.error('Report load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const triageTotal = triage.RED + triage.YELLOW + triage.GREEN;
  const genderTotal = gender.M + gender.F;
  const ageTotal = age.pediatric + age.adult;

  /* ── export ── */
  const handleExport = async () => {
    const lines: string[] = [
      '=== Outreach Clinic Analytics & Reports ===',
      todayFormatted(),
      '',
      `Total Patients Registered: ${totalPatients}`,
      `Consultations Completed: ${totalConsultations}`,
      `Emergency Referrals (Red): ${triage.RED}`,
      '',
      '--- Triage Distribution ---',
      `RED:    ${triage.RED}  (${pct(triage.RED, triageTotal)}%)`,
      `YELLOW: ${triage.YELLOW}  (${pct(triage.YELLOW, triageTotal)}%)`,
      `GREEN:  ${triage.GREEN}  (${pct(triage.GREEN, triageTotal)}%)`,
      '',
      '--- Demographics ---',
      `Male: ${gender.M}  |  Female: ${gender.F}`,
      `Pediatric (<5 yrs): ${age.pediatric}  |  Adult (>=5 yrs): ${age.adult}`,
      '',
      '--- Village / Kebele Reach ---',
      ...kebeles.map((k) => `${k.kebele}: ${k.count} patients`),
    ];

    try {
      await Share.share({ message: lines.join('\n'), title: 'Clinic Report' });
    } catch {
      Alert.alert('Export failed', 'Unable to share the report.');
    }
  };

  /* ──────────── render ──────────── */

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Outreach Clinic Analytics & Reports</Text>
          <Text style={styles.headerDate}>{todayFormatted()}</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0284c7" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Outreach Clinic Analytics & Reports</Text>
        <Text style={styles.headerDate}>{todayFormatted()}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── KPI Cards ── */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { backgroundColor: '#eff6ff' }]}>
            <Text style={[styles.kpiValue, { color: '#1d4ed8' }]}>{totalPatients}</Text>
            <Text style={styles.kpiLabel}>Total Patients{'\n'}Registered</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: '#f0fdf4' }]}>
            <Text style={[styles.kpiValue, { color: '#15803d' }]}>{totalConsultations}</Text>
            <Text style={styles.kpiLabel}>Consultations{'\n'}Completed</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: '#fef2f2' }]}>
            <Text style={[styles.kpiValue, { color: '#dc2626' }]}>{triage.RED}</Text>
            <Text style={styles.kpiLabel}>Emergency{'\n'}Referrals (Red)</Text>
          </View>
        </View>

        {/* ── Triage Distribution ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Triage Distribution</Text>
          <View style={styles.card}>
            <TriageBar label="Red (Emergency)" count={triage.RED} total={triageTotal} color="#dc2626" />
            <TriageBar label="Yellow (Urgent)" count={triage.YELLOW} total={triageTotal} color="#f59e0b" />
            <TriageBar label="Green (Non-Urgent)" count={triage.GREEN} total={triageTotal} color="#16a34a" />
          </View>
        </View>

        {/* ── Demographics ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Demographics</Text>
          <View style={styles.demoRow}>
            {/* Gender */}
            <View style={[styles.demoCard, { flex: 1 }]}>
              <Text style={styles.demoCardTitle}>Gender</Text>
              <View style={styles.demoItemRow}>
                <View style={[styles.demoDot, { backgroundColor: '#3b82f6' }]} />
                <Text style={styles.demoItemText}>Male</Text>
                <Text style={styles.demoItemValue}>{gender.M} ({pct(gender.M, genderTotal)}%)</Text>
              </View>
              <View style={styles.demoItemRow}>
                <View style={[styles.demoDot, { backgroundColor: '#ec4899' }]} />
                <Text style={styles.demoItemText}>Female</Text>
                <Text style={styles.demoItemValue}>{gender.F} ({pct(gender.F, genderTotal)}%)</Text>
              </View>
              {genderTotal > 0 && (
                <View style={styles.miniBarContainer}>
                  <View style={[styles.miniBarSegment, { flex: gender.M || 0.01, backgroundColor: '#3b82f6' }]} />
                  <View style={[styles.miniBarSegment, { flex: gender.F || 0.01, backgroundColor: '#ec4899' }]} />
                </View>
              )}
            </View>
            {/* Age */}
            <View style={[styles.demoCard, { flex: 1 }]}>
              <Text style={styles.demoCardTitle}>Age Groups</Text>
              <View style={styles.demoItemRow}>
                <View style={[styles.demoDot, { backgroundColor: '#f97316' }]} />
                <Text style={styles.demoItemText}>Pediatric {'<'}5</Text>
                <Text style={styles.demoItemValue}>{age.pediatric} ({pct(age.pediatric, ageTotal)}%)</Text>
              </View>
              <View style={styles.demoItemRow}>
                <View style={[styles.demoDot, { backgroundColor: '#6366f1' }]} />
                <Text style={styles.demoItemText}>Adult {'\u2265'}5</Text>
                <Text style={styles.demoItemValue}>{age.adult} ({pct(age.adult, ageTotal)}%)</Text>
              </View>
              {ageTotal > 0 && (
                <View style={styles.miniBarContainer}>
                  <View style={[styles.miniBarSegment, { flex: age.pediatric || 0.01, backgroundColor: '#f97316' }]} />
                  <View style={[styles.miniBarSegment, { flex: age.adult || 0.01, backgroundColor: '#6366f1' }]} />
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ── Kebele / Village Reach ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Village / Kebele Reach</Text>
          <View style={styles.card}>
            {kebeles.length === 0 ? (
              <Text style={styles.emptyText}>No patient data recorded yet.</Text>
            ) : (
              kebeles.map((k, i) => (
                <View key={k.kebele} style={[styles.kebeleRow, i < kebeles.length - 1 && styles.kebeleRowBorder]}>
                  <Text style={styles.kebeleName}>{k.kebele}</Text>
                  <View style={styles.kebeleRight}>
                    <View style={styles.kebeleBarBg}>
                      <View
                        style={[
                          styles.kebeleBarFill,
                          { width: `${pct(k.count, totalPatients)}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.kebeleCount}>{k.count}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        {/* ── Export Button ── */}
        <Pressable style={styles.exportButton} onPress={handleExport}>
          <Text style={styles.exportButtonText}>Export Full Clinic Report</Text>
        </Pressable>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ──────────── Triage Bar Sub-component ──────────── */

function TriageBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const percentage = pct(count, total);
  return (
    <View style={styles.triageBarWrapper}>
      <View style={styles.triageBarLabelRow}>
        <Text style={styles.triageBarLabel}>{label}</Text>
        <Text style={styles.triageBarValue}>
          {count} ({percentage}%)
        </Text>
      </View>
      <View style={styles.triageBarBg}>
        <View style={[styles.triageBarFill, { width: `${percentage}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

/* ──────────── styles ──────────── */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  header: {
    backgroundColor: '#0284c7',
    paddingTop: 14,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  headerDate: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: 4,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    padding: 16,
  },

  /* KPI Cards */
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: '800',
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 15,
  },

  /* Section */
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  /* Triage Bars */
  triageBarWrapper: {
    marginBottom: 14,
  },
  triageBarLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  triageBarLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  triageBarValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  triageBarBg: {
    height: 10,
    backgroundColor: '#e2e8f0',
    borderRadius: 5,
    overflow: 'hidden',
  },
  triageBarFill: {
    height: 10,
    borderRadius: 5,
  },

  /* Demographics */
  demoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  demoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  demoCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
  },
  demoItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  demoDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  demoItemText: {
    flex: 1,
    fontSize: 12,
    color: '#475569',
  },
  demoItemValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  miniBarContainer: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 8,
  },
  miniBarSegment: {
    height: 8,
  },

  /* Kebele */
  kebeleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  kebeleRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  kebeleName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  kebeleRight: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kebeleBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  kebeleBarFill: {
    height: 8,
    backgroundColor: '#0284c7',
    borderRadius: 4,
  },
  kebeleCount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    minWidth: 28,
    textAlign: 'right',
  },

  /* Export */
  exportButton: {
    backgroundColor: '#0284c7',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#0284c7',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  exportButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },

  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 12,
  },
});
