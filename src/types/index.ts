export type Gender = 'M' | 'F';

export type TriageLevel = 'RED' | 'YELLOW' | 'GREEN';

export interface Patient {
  id: string;
  full_name: string;
  age: number;
  gender: Gender;
  kebele: string;
  is_pregnant: boolean;
  systolic_bp: number;
  diastolic_bp: number;
  heart_rate: number;
  temperature: number;
  triage_level: TriageLevel;
  synced: boolean;
  created_at: string;
}

export interface Consultation {
  id: string;
  patient_id: string;
  subjective_notes: string;
  objective_notes: string;
  assessment_plan: string;
  prescriptions: string;
  referral_needed: boolean;
  synced: boolean;
  created_at: string;
}
