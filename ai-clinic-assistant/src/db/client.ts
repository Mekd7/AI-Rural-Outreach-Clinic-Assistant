import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Patient, Consultation } from '@/types';

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

export async function getPatients(): Promise<Patient[]> {
  try {
    const rows = await db.getAllAsync<Patient>(
      'SELECT * FROM patients ORDER BY created_at DESC'
    );
    return rows ?? [];
  } catch (error) {
    console.error('Failed to fetch patients:', error);
    throw error;
  }
}

export async function getConsultations(): Promise<Consultation[]> {
  try {
    const rows = await db.getAllAsync<Consultation>(
      'SELECT * FROM consultations ORDER BY created_at DESC'
    );
    return rows ?? [];
  } catch (error) {
    console.error('Failed to fetch consultations:', error);
    throw error;
  }
}

export interface TriageCounts {
  RED: number;
  YELLOW: number;
  GREEN: number;
}

export async function getTriageCounts(): Promise<TriageCounts> {
  try {
    const rows = await db.getAllAsync<{ triage_level: string; cnt: number }>(
      "SELECT triage_level, COUNT(*) as cnt FROM patients GROUP BY triage_level"
    );
    const counts: TriageCounts = { RED: 0, YELLOW: 0, GREEN: 0 };
    for (const r of rows) {
      if (r.triage_level === 'RED' || r.triage_level === 'YELLOW' || r.triage_level === 'GREEN') {
        counts[r.triage_level] = r.cnt;
      }
    }
    return counts;
  } catch (error) {
    console.error('Failed to fetch triage counts:', error);
    throw error;
  }
}

export async function getGenderCounts(): Promise<{ M: number; F: number }> {
  try {
    const rows = await db.getAllAsync<{ gender: string; cnt: number }>(
      "SELECT gender, COUNT(*) as cnt FROM patients GROUP BY gender"
    );
    const counts = { M: 0, F: 0 };
    for (const r of rows) {
      if (r.gender === 'M' || r.gender === 'F') {
        counts[r.gender] = r.cnt;
      }
    }
    return counts;
  } catch (error) {
    console.error('Failed to fetch gender counts:', error);
    throw error;
  }
}

export async function getAgeCounts(): Promise<{ pediatric: number; adult: number }> {
  try {
    const rows = await db.getAllAsync<{ age_group: string; cnt: number }>(
      "SELECT CASE WHEN age < 5 THEN 'pediatric' ELSE 'adult' END as age_group, COUNT(*) as cnt FROM patients GROUP BY age_group"
    );
    const counts = { pediatric: 0, adult: 0 };
    for (const r of rows) {
      if (r.age_group === 'pediatric') counts.pediatric = r.cnt;
      else if (r.age_group === 'adult') counts.adult = r.cnt;
    }
    return counts;
  } catch (error) {
    console.error('Failed to fetch age counts:', error);
    throw error;
  }
}

export async function getKebeleCounts(): Promise<{ kebele: string; count: number }[]> {
  try {
    const rows = await db.getAllAsync<{ kebele: string; cnt: number }>(
      "SELECT kebele, COUNT(*) as cnt FROM patients GROUP BY kebele ORDER BY cnt DESC"
    );
    return (rows ?? []).map(r => ({ kebele: r.kebele, count: r.cnt }));
  } catch (error) {
    console.error('Failed to fetch kebele counts:', error);
    throw error;
  }
}

export async function getTotalConsultations(): Promise<number> {
  try {
    const row = await db.getFirstAsync<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM consultations"
    );
    return row?.cnt ?? 0;
  } catch (error) {
    console.error('Failed to fetch consultation count:', error);
    throw error;
  }
}
