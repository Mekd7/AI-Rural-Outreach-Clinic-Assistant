import { supabase } from '@/lib/supabase';
import { db } from '@/db/client';

export async function syncUnsyncedPatients(): Promise<number> {
  const patients = await db.getAllAsync<any>(
    'SELECT * FROM patients WHERE synced = 0'
  );

  if (patients.length === 0) {
    return 0;
  }

  const patientsForSupabase = patients.map((patient) => ({
    id: patient.id,
    full_name: patient.full_name,
    age: patient.age,
    gender: patient.gender,
    kebele: patient.kebele,
    is_pregnant: Boolean(patient.is_pregnant),
    systolic_bp: patient.systolic_bp,
    diastolic_bp: patient.diastolic_bp,
    heart_rate: patient.heart_rate,
    temperature: patient.temperature,
    triage_level: patient.triage_level,
    created_at: patient.created_at,
  }));

  const { error } = await supabase
    .from('patients')
    .upsert(patientsForSupabase);

  if (error) {
    console.error('Failed to sync patients:', error);
    throw error;
  }

  for (const patient of patients) {
    await db.runAsync(
      'UPDATE patients SET synced = 1 WHERE id = ?',
      patient.id
    );
  }

  return patients.length;
}