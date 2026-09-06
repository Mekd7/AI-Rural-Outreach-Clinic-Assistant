import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  Polygon,
  Rect,
  Stop,
} from 'react-native-svg';

import { Palette } from '@/constants/palette';

const VB_W = 400;
const VB_H = 250;

const SKIN = '#8C5A3C';
const SKIN_DARK = '#6E4530';
const NETELA = '#FBF6EC';
const OUTLINE = '#3A2A1E';

// ---------- Small figure helpers ----------

interface PersonProps {
  x: number;
  y: number;
  scale?: number;
  cloth?: string;
  accent?: string;
  headwrap?: string;
  facing?: 'left' | 'right';
  child?: boolean;
  elder?: boolean;
  infant?: boolean;
}

function Person({
  x,
  y,
  scale = 1,
  cloth = NETELA,
  accent = Palette.burgundy,
  headwrap,
  facing = 'right',
  child = false,
  elder = false,
  infant = false,
}: PersonProps) {
  const s = child ? scale * 0.62 : scale;
  const flip = facing === 'left' ? -1 : 1;
  return (
    <G transform={`translate(${x} ${y}) scale(${flip * s} ${s})`}>
      {/* body */}
      <Path
        d="M -7 0 L 7 0 L 9 26 L -9 26 Z"
        fill={cloth}
        stroke={OUTLINE}
        strokeWidth={1}
        strokeLinejoin="round"
      />
      {/* shawl / accent band */}
      <Path d="M -7 0 L 7 0 L 6 9 L -6 9 Z" fill={accent} opacity={0.85} />
      {/* head */}
      <Circle cx={0} cy={-6} r={5.5} fill={SKIN} stroke={OUTLINE} strokeWidth={1} />
      {headwrap ? (
        <Path d="M -6 -7 Q 0 -14 6 -7 Q 0 -9 -6 -7 Z" fill={headwrap} stroke={OUTLINE} strokeWidth={0.8} />
      ) : null}
      {/* infant carried on back/front */}
      {infant ? (
        <G>
          <Ellipse cx={8} cy={8} rx={4.5} ry={6} fill={Palette.gold} stroke={OUTLINE} strokeWidth={0.8} />
          <Circle cx={8} cy={1.5} r={3} fill={SKIN} stroke={OUTLINE} strokeWidth={0.8} />
        </G>
      ) : null}
      {/* walking stick for elder */}
      {elder ? <Line x1={10} y1={4} x2={13} y2={27} stroke={Palette.earthDark} strokeWidth={1.4} /> : null}
      {/* legs */}
      <Line x1={-3} y1={26} x2={-3} y2={30} stroke={SKIN_DARK} strokeWidth={2} />
      <Line x1={3} y1={26} x2={3} y2={30} stroke={SKIN_DARK} strokeWidth={2} />
    </G>
  );
}

function Hut({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${scale})`}>
      <Rect x={-14} y={0} width={28} height={16} rx={2} fill="#C79B6A" stroke={OUTLINE} strokeWidth={1} />
      <Polygon points="-18,0 18,0 0,-18" fill="#9A6B3E" stroke={OUTLINE} strokeWidth={1} strokeLinejoin="round" />
      <Path d="M -12 -2 L 12 -2" stroke="#7A5230" strokeWidth={0.8} />
      <Path d="M -8 -8 L 8 -8" stroke="#7A5230" strokeWidth={0.8} />
      <Rect x={-4} y={6} width={8} height={10} fill={Palette.earthDark} />
    </G>
  );
}

// ---------- Layers ----------

function BaseLayer() {
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#F7EBD8" />
          <Stop offset="1" stopColor="#EFDFC6" />
        </LinearGradient>
        <LinearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#D9B98F" />
          <Stop offset="1" stopColor="#B98A5C" />
        </LinearGradient>
      </Defs>

      {/* sky */}
      <Rect x={0} y={0} width={VB_W} height={VB_H} fill="url(#sky)" />

      {/* sun */}
      <Circle cx={62} cy={42} r={16} fill={Palette.gold} opacity={0.9} />
      <Circle cx={62} cy={42} r={24} fill={Palette.gold} opacity={0.14} />

      {/* far hills (teal) */}
      <Path
        d="M 0 128 C 40 70 90 60 130 112 C 160 150 190 68 245 74 C 285 78 300 118 340 100 C 370 86 385 92 400 96 L 400 190 L 0 190 Z"
        fill="#6B9A93"
      />
      <Path
        d="M 0 128 C 40 70 90 60 130 112 C 160 150 190 68 245 74 C 285 78 300 118 340 100 C 370 86 385 92 400 96"
        fill="none"
        stroke={OUTLINE}
        strokeWidth={1.2}
        opacity={0.6}
      />

      {/* health facility on far right hill */}
      <G transform="translate(342 84)">
        <Rect x={-14} y={0} width={28} height={16} fill={NETELA} stroke={OUTLINE} strokeWidth={1} />
        <Polygon points="-16,0 16,0 0,-11" fill="#9A6B3E" stroke={OUTLINE} strokeWidth={1} strokeLinejoin="round" />
        <Rect x={-2.2} y={-9} width={4.4} height={4.4} fill={Palette.burgundy} />
        <Rect x={-3.6} y={-7.6} width={7.2} height={1.6} fill={Palette.burgundy} />
        <Rect x={-3} y={8} width={6} height={8} fill={Palette.earthDark} />
        {/* path down */}
        <Path d="M 0 16 C -6 30 -18 40 -34 56" stroke="#D8C39E" strokeWidth={2.4} fill="none" strokeDasharray="3 2" />
      </G>

      {/* mid hills (olive) */}
      <Path
        d="M 0 160 C 50 120 110 132 160 150 C 220 172 250 120 310 138 C 350 150 380 140 400 148 L 400 200 L 0 200 Z"
        fill="#7E9A5A"
      />
      <Path
        d="M 0 160 C 50 120 110 132 160 150 C 220 172 250 120 310 138 C 350 150 380 140 400 148"
        fill="none"
        stroke={OUTLINE}
        strokeWidth={1.2}
        opacity={0.6}
      />

      {/* ground */}
      <Path d="M 0 178 C 80 168 140 184 200 176 C 260 168 330 186 400 174 L 400 250 L 0 250 Z" fill="url(#ground)" />
      <Path
        d="M 0 178 C 80 168 140 184 200 176 C 260 168 330 186 400 174"
        fill="none"
        stroke={OUTLINE}
        strokeWidth={1.2}
        opacity={0.5}
      />
      {/* ground texture */}
      <Path d="M 30 215 Q 60 210 90 216" stroke="#A97A4E" strokeWidth={1} fill="none" opacity={0.6} />
      <Path d="M 240 238 Q 280 232 320 238" stroke="#A97A4E" strokeWidth={1} fill="none" opacity={0.6} />

      {/* huts (left) */}
      <Hut x={40} y={206} />
      <Hut x={78} y={214} scale={0.85} />
      <Hut x={14} y={222} scale={0.9} />

      {/* tree trunk (static) */}
      <Path d="M 96 200 L 100 160 L 106 160 L 110 200 Z" fill={Palette.earth} stroke={OUTLINE} strokeWidth={1} />
      <Path d="M 90 202 Q 103 196 116 202" fill="#8F6A45" opacity={0.5} />

      {/* canopy / treatment station (center) */}
      <G transform="translate(200 158)">
        {/* poles */}
        <Line x1={-30} y1={0} x2={-30} y2={54} stroke={Palette.earthDark} strokeWidth={2} />
        <Line x1={30} y1={0} x2={30} y2={54} stroke={Palette.earthDark} strokeWidth={2} />
        {/* canopy stripes */}
        <Path d="M -36 0 L 36 0 L 32 -10 L -32 -10 Z" fill={NETELA} stroke={OUTLINE} strokeWidth={1} />
        <Path d="M -24 -10 L -16 -10 L -18 0 L -27 0 Z" fill={Palette.burgundy} />
        <Path d="M -8 -10 L 0 -10 L 0 0 L -9 0 Z" fill={Palette.gold} />
        <Path d="M 8 -10 L 16 -10 L 18 0 L 9 0 Z" fill={Palette.burgundy} />
        <Path d="M 24 -10 L 32 -10 L 36 0 L 27 0 Z" fill={Palette.gold} />
        {/* table */}
        <Rect x={-20} y={30} width={40} height={5} fill={Palette.earth} stroke={OUTLINE} strokeWidth={1} />
        <Line x1={-16} y1={35} x2={-16} y2={52} stroke={Palette.earthDark} strokeWidth={2} />
        <Line x1={16} y1={35} x2={16} y2={52} stroke={Palette.earthDark} strokeWidth={2} />
        {/* supplies */}
        <Rect x={-14} y={22} width={10} height={8} fill={NETELA} stroke={OUTLINE} strokeWidth={0.8} />
        <Rect x={-10.4} y={24} width={2.8} height={4} fill={Palette.burgundy} />
        <Rect x={-11} y={25.4} width={4} height={1.2} fill={Palette.burgundy} />
        <Rect x={2} y={24} width={8} height={6} fill={Palette.teal} stroke={OUTLINE} strokeWidth={0.8} />
      </G>

      {/* clinician at table */}
      <Person x={176} y={183} cloth={NETELA} accent={Palette.teal} facing="right" />
      {/* patient seated-ish at table */}
      <Person x={224} y={186} cloth="#E9C9A0" accent={Palette.burgundy} headwrap={Palette.burgundy} facing="left" />

      {/* community – foreground */}
      <Person x={132} y={200} cloth={NETELA} accent={Palette.gold} headwrap={Palette.burgundy} infant facing="right" />
      <Person x={150} y={214} cloth={Palette.goldLight} accent={Palette.teal} child facing="right" />
      <Person x={64} y={232} cloth={NETELA} accent={Palette.burgundy} headwrap={NETELA} elder facing="right" scale={0.95} />
      <Person x={110} y={228} cloth="#D8C3A5" accent={Palette.olive} child facing="right" />
      <Person x={122} y={232} cloth={Palette.burgundyLight} accent={Palette.burgundy} child facing="left" />
      <Person x={262} y={212} cloth={NETELA} accent={Palette.gold} headwrap={Palette.gold} facing="left" />
      <Person x={280} y={222} cloth="#E9C9A0" accent={Palette.teal} child facing="left" />
    </Svg>
  );
}

function CloudsLayer() {
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid slice">
      <G fill={NETELA} stroke={OUTLINE} strokeWidth={1} opacity={0.95}>
        <Path d="M 118 52 Q 124 38 140 42 Q 148 30 162 40 Q 176 38 176 52 Z" />
        <Path d="M 262 36 Q 270 24 284 30 Q 292 20 304 30 Q 316 30 314 40 Z" />
      </G>
    </Svg>
  );
}

function TreeCanopyLayer() {
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid slice">
      <G stroke={OUTLINE} strokeWidth={1}>
        <Circle cx={103} cy={148} r={22} fill="#6F8C4A" />
        <Circle cx={86} cy={158} r={16} fill="#7E9A5A" />
        <Circle cx={121} cy={158} r={16} fill="#7E9A5A" />
        <Circle cx={103} cy={134} r={14} fill="#8AA663" />
        <Circle cx={92} cy={143} r={6} fill="#9BB672" stroke="none" />
      </G>
    </Svg>
  );
}

function VehicleLayer() {
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid slice">
      <G transform="translate(340 196)">
        {/* body */}
        <Path
          d="M -40 0 L -34 -18 L 12 -18 L 28 -6 L 40 -4 L 40 8 L -40 8 Z"
          fill={NETELA}
          stroke={OUTLINE}
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
        {/* windows */}
        <Path d="M -30 -15 L -8 -15 L -8 -5 L -34 -5 Z" fill="#B7D3D0" stroke={OUTLINE} strokeWidth={0.8} />
        <Path d="M -4 -15 L 10 -15 L 22 -5 L -4 -5 Z" fill="#B7D3D0" stroke={OUTLINE} strokeWidth={0.8} />
        {/* stripe */}
        <Rect x={-40} y={-2} width={80} height={3} fill={Palette.burgundy} />
        {/* cross */}
        <Rect x={-22} y={-13.5} width={3} height={8} fill={Palette.burgundy} />
        <Rect x={-24.5} y={-11} width={8} height={3} fill={Palette.burgundy} />
        {/* wheels */}
        <Circle cx={-24} cy={10} r={7} fill={OUTLINE} />
        <Circle cx={-24} cy={10} r={3} fill="#D9C9A9" />
        <Circle cx={22} cy={10} r={7} fill={OUTLINE} />
        <Circle cx={22} cy={10} r={3} fill="#D9C9A9" />
      </G>
      {/* arriving clinicians beside vehicle */}
      <Person x={300} y={192} cloth={NETELA} accent={Palette.teal} facing="left" />
      <G transform="translate(288 208)">
        <Rect x={-6} y={0} width={12} height={9} rx={1.5} fill={NETELA} stroke={OUTLINE} strokeWidth={0.8} />
        <Rect x={-1.2} y={2} width={2.4} height={5} fill={Palette.burgundy} />
        <Rect x={-3.5} y={3.3} width={7} height={2.4} fill={Palette.burgundy} />
      </G>
    </Svg>
  );
}

// ---------- Scene ----------

export function CommunityScene() {
  const [reduceMotion, setReduceMotion] = useState(false);

  const cloudDrift = useSharedValue(0);
  const treeSway = useSharedValue(0);
  const vehicleX = useSharedValue(60);
  const canopyFlutter = useSharedValue(0);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduceMotion(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      cloudDrift.value = 0;
      treeSway.value = 0;
      vehicleX.value = 0;
      canopyFlutter.value = 0;
      return;
    }
    cloudDrift.value = withRepeat(
      withTiming(1, { duration: 22000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    treeSway.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
        withTiming(-1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
    vehicleX.value = withDelay(400, withTiming(0, { duration: 1800, easing: Easing.out(Easing.cubic) }));
    canopyFlutter.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [reduceMotion, cloudDrift, treeSway, vehicleX, canopyFlutter]);

  const cloudStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: cloudDrift.value * 10 }],
  }));

  const treeStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${treeSway.value * 1.2}deg` }],
  }));

  const vehicleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: vehicleX.value }],
  }));

  return (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFill}>
        <BaseLayer />
      </View>
      <Animated.View style={[StyleSheet.absoluteFill, cloudStyle]} pointerEvents="none">
        <CloudsLayer />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.treePivot, treeStyle]} pointerEvents="none">
        <TreeCanopyLayer />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, vehicleStyle]} pointerEvents="none">
        <VehicleLayer />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: VB_W / VB_H,
    overflow: 'hidden',
    backgroundColor: '#F2E6D3',
  },
  treePivot: {
    transformOrigin: '26% 80%',
  },
});
