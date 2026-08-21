import { StyleSheet, Text, View } from 'react-native';
import type { TriageLevel } from '@/types';

interface TriageBadgeProps {
  level: TriageLevel;
  size?: 'small' | 'medium' | 'large';
}

const TRIAGE_COLORS: Record<TriageLevel, { bg: string; border: string; text: string }> = {
  RED: { bg: '#fee2e2', border: '#ef4444', text: '#b91c1c' },
  YELLOW: { bg: '#fef3c7', border: '#f59e0b', text: '#b45309' },
  GREEN: { bg: '#dcfce7', border: '#10b981', text: '#047857' },
};

const SIZE_STYLES = {
  small: { paddingHorizontal: 8, paddingVertical: 2, fontSize: 10, borderRadius: 999 },
  medium: { paddingHorizontal: 12, paddingVertical: 4, fontSize: 12, borderRadius: 999 },
  large: { paddingHorizontal: 16, paddingVertical: 6, fontSize: 14, borderRadius: 999 },
};

export function TriageBadge({ level, size = 'medium' }: TriageBadgeProps) {
  const colors = TRIAGE_COLORS[level];
  const sizeStyle = SIZE_STYLES[size];

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: colors.bg, borderColor: colors.border },
        sizeStyle,
      ]}>
      <Text
        style={[
          styles.badgeText,
          { color: colors.text },
          sizeStyle,
        ]}>
        {level}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
  },
  badgeText: {
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});