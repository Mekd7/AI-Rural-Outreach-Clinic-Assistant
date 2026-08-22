export type TriageLevel = 'RED' | 'YELLOW' | 'GREEN';

export const TRIAGE_LABELS: Record<TriageLevel, string> = {
  RED: 'Emergency',
  YELLOW: 'Urgent',
  GREEN: 'Stable',
};

export const TRIAGE_FILTER_LABELS: Record<TriageLevel, string> = {
  RED: 'Red (Emergency)',
  YELLOW: 'Yellow (Urgent)',
  GREEN: 'Green (Stable)',
};

export const TRIAGE_COLORS: Record<TriageLevel, { background: string; border: string; text: string }> = {
  RED: { background: '#fee2e2', border: '#ef4444', text: '#b91c1c' },
  YELLOW: { background: '#fef3c7', border: '#f59e0b', text: '#b45309' },
  GREEN: { background: '#dcfce7', border: '#10b981', text: '#047857' },
};

export const TRIAGE_LEVELS: TriageLevel[] = ['RED', 'YELLOW', 'GREEN'];

export function getTriageColor(level: TriageLevel) {
  return TRIAGE_COLORS[level];
}

export function getTriageLabel(level: TriageLevel) {
  return TRIAGE_LABELS[level];
}

export function getTriageFilterLabel(level: TriageLevel) {
  return TRIAGE_FILTER_LABELS[level];
}