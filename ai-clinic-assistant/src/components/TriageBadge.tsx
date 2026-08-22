import { StyleSheet, Text, View } from 'react-native';
import type { TriageLevel } from '@/types';
import { TRIAGE_COLORS } from '@/constants/triage';

interface TriageBadgeProps {
  level: TriageLevel;
  size?: 'small' | 'medium';
}

export function TriageBadge({ level, size = 'medium' }: TriageBadgeProps) {
  const colors = TRIAGE_COLORS[level];

  return (
    <View style={[styles.badge, size === 'small' && styles.badgeSmall, { borderColor: colors.border }]}>
      <Text style={[styles.text, size === 'small' && styles.textSmall, { color: colors.text }]}>
        {level}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  textSmall: {
    fontSize: 10,
  },
});