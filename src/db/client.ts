import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_NAME = 'clinic.db';

let database: SQLiteDatabase | null = null;

const CREATE_PATIENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY NOT NULL,
    full_name TEXT NOT NULL,
    age INTEGER NOT NULL,
    gender TEXT NOT NULL CHECK (gender IN ('M', 'F')),
    kebele TEXT NOT NULL,
    is_pregnant INTEGER NOT NULL DEFAULT 0,
    systolic_bp INTEGER NOT NULL,
    diastolic_bp INTEGER NOT NULL,
    heart_rate INTEGER NOT NULL,
    temperature REAL NOT NULL,
    triage_level TEXT NOT NULL CHECK (triage_level IN ('RED', 'YELLOW', 'GREEN')),
    synced INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
`;

const CREATE_CONSULTATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS consultations (
    id TEXT PRIMARY KEY NOT NULL,
    patient_id TEXT NOT NULL,
    subjective_notes TEXT NOT NULL DEFAULT '',
    objective_notes TEXT NOT NULL DEFAULT '',
    assessment_plan TEXT NOT NULL DEFAULT '',
    prescriptions TEXT NOT NULL DEFAULT '[]',
    referral_needed INTEGER NOT NULL DEFAULT 0,
    synced INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
  );
`;

function requireDatabase(): SQLiteDatabase {
  if (!database) {
    throw new Error('Database not initialized. Call initDatabase() on app startup.');
  }

  return database;
}

export async function initDatabase(): Promise<void> {
  if (database) {
    return;
  }

  try {
    database = await SQLite.openDatabaseAsync(DATABASE_NAME);

    await database.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
    `);
    await database.execAsync(CREATE_PATIENTS_TABLE);
    await database.execAsync(CREATE_CONSULTATIONS_TABLE);
  } catch (error) {
    database = null;
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

export const db: SQLiteDatabase = new Proxy({} as SQLiteDatabase, {
  get(_target, prop: keyof SQLiteDatabase) {
    const value = requireDatabase()[prop];
    return typeof value === 'function' ? value.bind(requireDatabase()) : value;
  },
});

import type { Patient } from '@/types';

export async function getPatients(): Promise<Patient[]> {
  const database = requireDatabase();
  return database.getAllAsync<Patient>(
    `SELECT id, full_name, age, gender, kebele, is_pregnant, systolic_bp, diastolic_bp, heart_rate, temperature, triage_level, synced, created_at
     FROM patients
     ORDER BY created_at DESC;`
  );
}

export async function getPatientById(id: string): Promise<Patient | null> {
  const database = requireDatabase();
  const result = await database.getFirstAsync<Patient>(
    `SELECT id, full_name, age, gender, kebele, is_pregnant, systolic_bp, diastolic_bp, heart_rate, temperature, triage_level, synced, created_at
     FROM patients
     WHERE id = ?;`,
    [id]
  );
  return result ?? null;
}

export interface ConsultationInput {
  patient_id: string;
  subjective_notes: string;
  objective_notes: string;
  assessment_plan: string;
  prescriptions: string; // JSON string
  referral_needed?: boolean;
}

export async function saveConsultation(input: ConsultationInput): Promise<string> {
  const database = requireDatabase();
  const id = `consultation_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const created_at = new Date().toISOString();
  const synced = 0;
  const referral_needed = input.referral_needed ? 1 : 0;

  await database.runAsync(
    `INSERT INTO consultations (id, patient_id, subjective_notes, objective_notes, assessment_plan, prescriptions, referral_needed, synced, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [id, input.patient_id, input.subjective_notes, input.objective_notes, input.assessment_plan, input.prescriptions, referral_needed, synced, created_at]
  );

  return id;
}
