# Product Requirements & Implementation Spec

## Project Name: AI Rural Outreach Clinic Assistant

**Path:** `docs/PRD.md`

**Version:** 1.1.0 (AI-Agent Ready)

**Stack:** React Native (Expo) + Expo SQLite + Supabase + Gemini 1.5 API

---

**Table of Contents**
- [1. System Architecture & Component Mapping](#1-system-architecture--component-mapping)
- [2. Directory Structure Conventions](#2-directory-structure-conventions)
- [3. Data Schema & Types Implementation Spec](#3-data-schema--types-implementation-spec)
- [4. Triage Algorithm Rule Set](#4-triage-algorithm-rule-set)
- [5. Implementation Rules for Offline-First Data Flow](#5-implementation-rules-for-offline-first-data-flow)

---

## 1. System Architecture & Component Mapping

┌────────────────────────────────────────────────────────────────────────┐
│ APP ARCHITECTURE & DATA FLOW                                           │
│                                                                        │
│ ┌───────────────────────┐        ┌────────────────────────────┐        │
│ │ UI Layer (Expo)       │ ─────► │ State / Hooks Layer        │        │
│ │ (app/, components/)   │        │ (usePatients, useSync)     │        │
│ └───────────────────────┘        └─────────────┬──────────────┘        │
│                                                │                       │
│                                                ▼                       │
│                                  ┌────────────────────────────┐        │
│                                  │ Local Database Layer       │        │
│                                  │ (db/client.ts - SQLite)    │        │
│                                  └─────────────┬──────────────┘        │
│                                                │                       │
│                                                ▼ (Sync Task)           │
│                                  ┌────────────────────────────┐        │
│                                  │ Cloud Backend              │        │
│                                  │ (services/supabase.ts)     │        │
│                                  └────────────────────────────┘        │
└────────────────────────────────────────────────────────────────────────┘

---

## 2. Directory Structure Conventions

AI Agents MUST generate files according to this strict layout:


├── app/                      # Expo Router screens (File-based routing)
│   ├── index.tsx             # Home / Today's Patient Queue
│   ├── register.tsx          # New Patient Registration Form
│   ├── consultation/[id].tsx # Consultation & Voice Note Recording Screen
│   ├── handover.tsx          # HEW Handover Report View
│   └── _layout.tsx           # Main Root Navigation & Context Providers
├── src/
│   ├── components/           # Reusable UI components (Buttons, Cards, Badges)
│   │   ├── TriageBadge.tsx   # Color-coded priority badge
│   │   ├── PatientCard.tsx   # Queue card item
│   │   └── VoiceMicButton.tsx    # Mic toggle button
│   ├── db/                   # Database files
│   │   ├── schema.ts         # SQLite Table Schemas & TS Types
│   │   └── client.ts         # Expo SQLite connection instance
│   ├── services/             # External integration services
│   │   ├── supabase.ts       # Supabase client & sync methods
│   │   ├── ai.ts             # Gemini API integration (RAG & Notes)
│   │   └── voice.ts          # Native Speech-to-Text wrapper
│   ├── utils/                # Pure utility functions
│   │   └── triage.ts         # Deterministic Triage Logic Algorithm
│   └── types/                # Global TypeScript definitions
│       └── index.ts          # Shared Interfaces (Patient, Consultation)
├── docs/
│   └── PRD.md                # This specification
└── AGENT_RULES.md            # Rules for AI IDE coding agents


---

## 3. Data Schema & Types Implementation Spec

### 3.1 Patient Table (SQLite)

```typescript
export interface Patient {
  id: string; // UUID v4
  full_name: string;
  age: number;
  gender: 'M' | 'F';
  kebele: string;
  is_pregnant: boolean; // 0 or 1 in SQLite integer storage
  systolic_bp: number;
  diastolic_bp: number;
  heart_rate: number;
  temperature: number;
  triage_level: 'RED' | 'YELLOW' | 'GREEN';
  synced: boolean; // 0 = false, 1 = true
  created_at: string; // ISO String
}
```

### 3.2 Consultation Table (SQLite)

```typescript
export interface Consultation {
  id: string; // UUID v4
  patient_id: string; // FK -> Patient.id
  subjective_notes: string; // Voice dictation raw / formatted
  objective_notes: string;
  assessment_plan: string;
  prescriptions: string; // JSON string array
  referral_needed: boolean;
  synced: boolean;
  created_at: string;
}
```

---

## 4. Triage Algorithm Rule Set (`src/utils/triage.ts`)

AI Agents MUST implement triage deterministically using these exact logical thresholds:

```typescript
export function calculateTriage(patient: Partial<Patient>): 'RED' | 'YELLOW' | 'GREEN' {
  const { systolic_bp, diastolic_bp, temperature, age, is_pregnant } = patient;

  // RED CRITERIA (Emergency)
  if (
    (systolic_bp && systolic_bp >= 160) ||
    (systolic_bp && systolic_bp <= 85) ||
    (temperature && temperature >= 39.0) ||
    (temperature && temperature <= 35.0) ||
    (age && age < 1 && temperature && temperature >= 38.0)
  ) {
    return 'RED';
  }

  // YELLOW CRITERIA (Urgent)
  if (
    (systolic_bp && systolic_bp >= 140) ||
    (diastolic_bp && diastolic_bp >= 90) ||
    is_pregnant ||
    (temperature && temperature >= 38.0)
  ) {
    return 'YELLOW';
  }

  // GREEN CRITERIA (Routine)
  return 'GREEN';
}
```

---

## 5. Implementation Rules for Offline-First Data Flow

1. **ALWAYS Write to Local SQLite First:** Never invoke Supabase directly from UI components.
2. **Data Insertion Pattern:** UI Form Submitted ➔ Calculate Triage ➔ Insert into SQLite (`synced = 0`) ➔ Trigger Background Sync.
3. **Background Sync Pattern:**
   * Query SQLite for rows where `synced = 0`.
   * Upsert rows to Supabase via REST SDK.
   * On success, update local SQLite rows set `synced = 1`.
   * Wrap sync operations in `try/catch` blocks—if network fails, suppress error silently and retain `synced = 0`.