import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { db } from '@/db/client';

export interface SyncResult {
  patients: number;
  consultations: number;
  skipped: boolean;
  error?: string;
}

/**
 * Best-effort network check.
 * Tries a lightweight HEAD request to the Supabase URL;
 * returns false on any failure so the app stays offline-first.
 */
async function isOnline(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await fetch(process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://example.com', {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

/**
 * Syncs all unsynced patients to Supabase.
 * Returns the number of records synced.
 */
async function syncPatients(): Promise<number> {
  const patients = await db.getAllAsync<any>(
    'SELECT * FROM patients WHERE synced = 0'
  );
  if (patients.length === 0) return 0;

  const payload = patients.map((p) => ({
    id: p.id,
    full_name: p.full_name,
    age: p.age,
    gender: p.gender,
    kebele: p.kebele,
    is_pregnant: Boolean(p.is_pregnant),
    systolic_bp: p.systolic_bp,
    diastolic_bp: p.diastolic_bp,
    heart_rate: p.heart_rate,
    temperature: p.temperature,
    triage_level: p.triage_level,
    created_at: p.created_at,
  }));

  const { error } = await getSupabase().from('patients').upsert(payload);
  if (error) throw error;

  for (const p of patients) {
    await db.runAsync('UPDATE patients SET synced = 1 WHERE id = ?', p.id);
  }
  return patients.length;
}

/**
 * Syncs all unsynced consultations to Supabase.
 * Returns the number of records synced.
 */
async function syncConsultations(): Promise<number> {
  const consultations = await db.getAllAsync<any>(
    'SELECT * FROM consultations WHERE synced = 0'
  );
  if (consultations.length === 0) return 0;

  const payload = consultations.map((c) => ({
    id: c.id,
    patient_id: c.patient_id,
    subjective_notes: c.subjective_notes,
    objective_notes: c.objective_notes,
    assessment_plan: c.assessment_plan,
    prescriptions: c.prescriptions,
    referral_needed: Boolean(c.referral_needed),
    created_at: c.created_at,
  }));

  const { error } = await getSupabase().from('consultations').upsert(payload);
  if (error) throw error;

  for (const c of consultations) {
    await db.runAsync('UPDATE consultations SET synced = 1 WHERE id = ?', c.id);
  }
  return consultations.length;
}

/**
 * Top-level sync entry point. Offline-first:
 * - Skips silently if Supabase is not configured
 * - Skips gracefully if the device is offline
 * - Syncs both patients and consultations
 */
export async function syncAll(): Promise<SyncResult> {
  if (!isSupabaseConfigured()) {
    return { patients: 0, consultations: 0, skipped: true, error: 'Supabase not configured.' };
  }

  const online = await isOnline();
  if (!online) {
    return { patients: 0, consultations: 0, skipped: true, error: 'No network connection.' };
  }

  try {
    // Sync patients first (consultations have a FK to patients)
    const patients = await syncPatients();
    const consultations = await syncConsultations();
    return { patients, consultations, skipped: false };
  } catch (err: any) {
    // Supabase RLS or permission error — surface a clear message
    if (err?.code === '42501') {
      return {
        patients: 0,
        consultations: 0,
        skipped: true,
        error: 'Supabase Row Level Security (RLS) is blocking writes. Add an INSERT/UPDATE policy for the anon role in the Supabase dashboard.',
      };
    }
    // Re-throw unexpected errors
    throw err;
  }
}

// Keep backward-compatible named export
export const syncUnsyncedPatients = syncAll;
