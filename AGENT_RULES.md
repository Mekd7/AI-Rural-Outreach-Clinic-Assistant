---

### File 2: Create `AGENT_RULES.md` (or `.cursorrules` in project root)

Copy and paste this into `AGENT_RULES.md` or `.cursorrules` at the **root of your repository**. Cursor, Windsurf, and Claude Code automatically read this file to govern how code is generated.

# AI Agent Execution Rules

You are an expert React Native & TypeScript Mobile Systems Engineer building the "AI Rural Outreach Clinic Assistant".

## 🚨 MANDATORY DEV RULES (NEVER VIOLATE)

1. **NO WEB-ONLY PACKAGES:**
   - DO NOT import `window`, `localStorage`, `document`, or Web-only libraries.
   - Use ONLY Expo-compatible modules (`expo-sqlite`, `expo-speech`, `expo-router`, `@supabase/supabase-js`).

2. **STRICT TYPE SAFETY:**
   - NEVER use `any`. Always create or import types from `@/types`.
   - All component props must be explicitly typed.

3. **OFFLINE-FIRST ARCHITECTURE:**
   - ALL database read/write operations must go through Expo SQLite in `@/db/client.ts`.
   - UI components MUST NOT call Supabase directly. All cloud syncing happens through `@/services/supabase.ts`.

4. **STATE MANAGEMENT:**
   - Use standard React Hooks (`useState`, `useEffect`, `useContext`).
   - Do NOT introduce Redux or heavy state managers unless explicitly instructed.

5. **ERROR HANDLING:**
   - Wrap all Database and Async calls in `try / catch` blocks.
   - Display errors to the user using React Native `Alert.alert()` or custom UI banner components. Never let the app crash silently.

6. **STYLING & UI:**
   - Use React Native `StyleSheet.create` or standard Expo vector icons (`@expo/vector-icons`).
   - Ensure touch targets (buttons) have a minimum height of `48px` for mobile accessibility.
   - Colors: Primary `#0284c7` (Sky blue), Red `#ef4444` (Emergency), Yellow `#f59e0b` (Warning), Green `#10b981` (Stable).

---

## 📝 CODE PATTERN EXAMPLES

### Correct Local SQLite Insert Pattern

```typescript
import { db } from '@/db/client';
import { Patient } from '@/types';

export async function savePatient(patient: Patient): Promise<boolean> {
  try {
    await db.execAsync(`
      INSERT INTO patients (id, full_name, age, gender, kebele, is_pregnant, systolic_bp, diastolic_bp, heart_rate, temperature, triage_level, synced, created_at)
      VALUES ('${patient.id}', '${patient.full_name}', ${patient.age}, '${patient.gender}', '${patient.kebele}', ${patient.is_pregnant ? 1 : 0}, ${patient.systolic_bp}, ${patient.diastolic_bp}, ${patient.heart_rate}, ${patient.temperature}, '${patient.triage_level}', 0, '${patient.created_at}');
    `);
    return true;
  } catch (error) {
    console.error('Failed to insert patient locally:', error);
    return false;
  }
}
```

### Correct Sync Pattern

```typescript
import { db } from '@/db/client';
import { supabase } from '@/services/supabase';

export async function syncUnsyncedPatients(): Promise<void> {
  try {
    const unsynced = await db.getAllAsync('SELECT * FROM patients WHERE synced = 0');
    if (!unsynced || unsynced.length === 0) return;

    const { error } = await supabase.from('patients').upsert(unsynced);
    if (!error) {
      await db.execAsync('UPDATE patients SET synced = 1 WHERE synced = 0');
    }
  } catch (err) {
    // Silent fail if offline
    console.log('Sync skipped: Offline or Network Error');
  }
}
```
---
