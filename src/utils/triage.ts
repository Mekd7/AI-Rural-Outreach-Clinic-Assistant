import type { Patient, TriageLevel } from '@/types';

export function calculateTriage(patient: Partial<Patient>): TriageLevel {
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
