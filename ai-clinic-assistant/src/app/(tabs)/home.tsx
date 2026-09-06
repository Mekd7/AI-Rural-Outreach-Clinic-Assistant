import React, { useCallback } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  type SharedValue,
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';

import { Palette } from '@/constants/palette';

const steps = [
  ['01', 'Community Visit', 'Healthcare workers travel to remote communities, meeting patients where they live.'],
  ['02', 'AI-Guided Assessment', 'The assistant guides clinical evaluation with intelligent triage and decision support.'],
  ['03', 'Offline Records', 'Patient data is captured and stored locally\u2014no internet connection required.'],
  ['04', 'Clinical Handover', 'Structured reports ensure the next provider continues care seamlessly.'],
  ['05', 'Continuous Care', 'Every visit builds on the last, closing the gap between outreach and facility care.'],
] as const;

const heroSource = require('../../../assets/images/ai-clinic-hero.png');

/* ── Scroll-triggered reveal wrapper ── */
function ScrollReveal({
  children,
  scrollY,
  style,
}: {
  children: React.ReactNode;
  scrollY: SharedValue<number>;
  style?: any;
}) {
  const sectionY = useSharedValue(10000);
  const { height: screenHeight } = useWindowDimensions();

  const handleLayout = useCallback(
    (e: any) => {
      sectionY.value = e.nativeEvent.layout.y;
    },
    [sectionY],
  );

  const animatedStyle = useAnimatedStyle(() => {
    const viewportBottom = scrollY.value + screenHeight;
    const progress = viewportBottom - sectionY.value - 60;
    const opacity = interpolate(progress, [0, 150], [0, 1], Extrapolation.CLAMP);
    const translateY = interpolate(progress, [0, 150], [36, 0], Extrapolation.CLAMP);
    return { opacity, transform: [{ translateY }] };
  });

  return (
    <Animated.View onLayout={handleLayout} style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

/* ── Landing page ── */
export default function LandingHome() {
  const { width: screenWidth } = useWindowDimensions();
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  let heroHeight = screenWidth * 0.75;
  try {
    const hero = Image.resolveAssetSource(heroSource);
    if (hero.width > 0) {
      heroHeight = screenWidth * (hero.height / hero.width);
    }
  } catch {
    // use fallback aspect if asset resolution fails
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.page}>

          {/* Header */}
          <Animated.View entering={FadeIn.duration(700)} style={styles.nav}>
            <View style={styles.brand}>
              <Text style={styles.brandMark}>{'\u2723'}</Text>
              <Text style={styles.brandTitle}>
                AI Clinic{'\n'}
                <Text style={styles.brandAccent}>Assistant</Text>
              </Text>
            </View>
          </Animated.View>

          {/* Hero image with gradient blend */}
          <View style={styles.hero}>
            <Image
              source={heroSource}
              style={[styles.heroImage, { height: heroHeight }]}
              resizeMode="contain"
            />
            <LinearGradient
              colors={['transparent', 'rgba(245,237,224,0.55)', Palette.parchment]}
              locations={[0.35, 0.68, 1]}
              style={styles.heroGradient}
            />
          </View>

          {/* Hero copy */}
          <Animated.View
            entering={FadeInDown.delay(300).duration(700)}
            style={styles.heroCopy}
          >
            <Text style={styles.heroTitle}>
              Smarter care{'\n'}for the hardest{'\n'}to reach.
            </Text>
            <Text style={styles.heroBody}>
              An AI-powered clinical assistant built for rural outreach teams.
              Register patients, guide assessments, and hand over
              care{'\u2014'}all without an internet connection.
            </Text>
          </Animated.View>

          {/* Story 1 */}
          <ScrollReveal scrollY={scrollY} style={styles.story}>
            <View style={styles.storyIcon}>
              <Text style={styles.storyIconText}>{'\u271A'}</Text>
            </View>
            <View style={styles.storyContent}>
              <Text style={styles.storyHeading}>
                Where clinics can{'\u2019'}t go,{'\n'}this assistant can.
              </Text>
              <Text style={styles.storyBody}>
                Millions of people live hours from the nearest health facility.
                Outreach visits are often their only contact with the healthcare
                system. AI Clinic Assistant makes every visit count by guiding
                health workers through structured, evidence-informed assessments
                right at the point of care.
              </Text>
            </View>
          </ScrollReveal>

          {/* Story 2 */}
          <ScrollReveal scrollY={scrollY} style={styles.story}>
            <View style={styles.storyIcon}>
              <Text style={styles.storyIconText}>{'\u221E'}</Text>
            </View>
            <View style={styles.storyContent}>
              <Text style={styles.storyHeading}>
                Care that outlasts{'\n'}the visit.
              </Text>
              <Text style={styles.storyBody}>
                Patient records, triage decisions, and clinical notes are
                captured offline and organized into structured handover reports.
                When a Health Extension Worker or physician sees the patient
                next, they have everything they need to continue{'\u2014'}not
                restart{'\u2014'}care.
              </Text>
            </View>
          </ScrollReveal>

          {/* Journey */}
          <ScrollReveal scrollY={scrollY}>
            <View style={styles.journey}>
              <View style={styles.sectionHeading}>
                <Text style={styles.sectionDecor}>{'\u2726'}</Text>
                <Text style={styles.sectionTitle}>HOW CARE STAYS CONNECTED</Text>
                <Text style={styles.sectionDecor}>{'\u2726'}</Text>
              </View>

              <View style={styles.steps}>
                {steps.map(([number, title, text]) => (
                  <View style={styles.step} key={number}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>{number}</Text>
                    </View>
                    <View style={styles.stepContent}>
                      <Text style={styles.stepTitle}>{title}</Text>
                      <Text style={styles.stepText}>{text}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </ScrollReveal>

          {/* Closing */}
          <ScrollReveal scrollY={scrollY} style={styles.closing}>
            <Text style={styles.closingTitle}>
              They may be far from healthcare,{'\n'}but they are not forgotten.
            </Text>
            
          </ScrollReveal>

        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Palette.ink,
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'stretch',
  },
  page: {
    width: '100%',
    maxWidth: 1080,
    alignSelf: 'center',
    backgroundColor: Palette.parchment,
    overflow: 'hidden',
  },

  /* Nav */
  nav: {
    position: 'absolute',
    zIndex: 5,
    top: 0,
    left: 0,
    right: 0,
    minHeight: 105,
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  brandMark: {
    width: 42,
    height: 42,
    textAlign: 'center',
    textAlignVertical: 'center',
    color: Palette.burgundy,
    fontSize: 36,
    lineHeight: 42,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Palette.ink,
    lineHeight: 26,
  },
  brandAccent: {
    color: Palette.burgundy,
  },

  /* Hero */
  hero: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: Palette.parchmentDeep,
  },
  heroImage: {
    width: '100%',
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '45%',
  },
  heroCopy: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 36,
    backgroundColor: Palette.parchment,
  },
  heroTitle: {
    fontFamily: 'serif',
    fontSize: 38,
    fontWeight: '700',
    color: Palette.burgundy,
    lineHeight: 44,
    marginBottom: 16,
  },
  heroBody: {
    fontSize: 16,
    lineHeight: 24,
    color: Palette.inkSoft,
    maxWidth: 510,
  },

  /* Story */
  story: {
    paddingHorizontal: 24,
    paddingVertical: 42,
    borderTopWidth: 1,
    borderTopColor: Palette.line,
    gap: 20,
  },
  storyIcon: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: Palette.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyIconText: {
    fontSize: 32,
    color: Palette.burgundy,
  },
  storyContent: {
    flex: 1,
  },
  storyHeading: {
    fontFamily: 'serif',
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 30,
    color: Palette.burgundy,
    marginBottom: 18,
  },
  storyBody: {
    fontSize: 16,
    lineHeight: 25.6,
    color: Palette.ink,
    maxWidth: 700,
  },

  /* Journey */
  journey: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 58,
    borderTopWidth: 1,
    borderTopColor: Palette.line,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    marginBottom: 30,
  },
  sectionDecor: {
    fontSize: 18,
    color: Palette.gold,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.9,
    color: Palette.burgundy,
  },
  steps: {
    gap: 12,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 15,
    paddingVertical: 12,
  },
  stepNumber: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: Palette.burgundy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: Palette.cream,
    fontSize: 17,
    fontWeight: '700',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Palette.ink,
    marginBottom: 8,
  },
  stepText: {
    fontSize: 13,
    lineHeight: 18.85,
    color: Palette.muted,
  },

  /* Closing */
  closing: {
    paddingHorizontal: 24,
    paddingVertical: 70,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Palette.line,
    backgroundColor: Palette.parchmentDeep,
  },
  closingTitle: {
    fontFamily: 'serif',
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 34,
    color: Palette.burgundy,
    textAlign: 'center',
    marginBottom: 12,
  },
});
