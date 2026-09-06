import Svg, { Path, Rect } from 'react-native-svg';

import { Palette } from '@/constants/palette';

interface PatternDividerProps {
  color?: string;
  background?: string;
  height?: number;
}

export function PatternDivider({
  color = Palette.gold,
  background = Palette.parchment,
  height = 18,
}: PatternDividerProps) {
  return (
    <Svg width="100%" height={height} viewBox="0 0 200 18" preserveAspectRatio="none">
      <Rect width={200} height={18} fill={background} />
      <Path
        d="M0 9 L10 0 L20 9 L30 0 L40 9 L50 0 L60 9 L70 0 L80 9 L90 0 L100 9 L110 0 L120 9 L130 0 L140 9 L150 0 L160 9 L170 0 L180 9 L190 0 L200 9 L200 18 L190 9 L180 18 L170 9 L160 18 L150 9 L140 18 L130 9 L120 18 L110 9 L100 18 L90 9 L80 18 L70 9 L60 18 L50 9 L40 18 L30 9 L20 18 L10 9 L0 18 Z"
        fill={color}
        opacity={0.22}
      />
      <Path
        d="M0 9 L100 9 M100 9 L200 9"
        stroke={color}
        strokeWidth={0.5}
        opacity={0.25}
      />
    </Svg>
  );
}
