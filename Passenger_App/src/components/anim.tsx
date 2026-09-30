import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';

/**
 * Shared animation primitives (React Native Animated API only — no new deps).
 * Professional, fast, purposeful: entrance, pulse, live-dot, drifting plane.
 */

/** Fade + slide-up entrance. Stagger via `delay` (index * 90ms convention). */
export function Enter({
  children,
  delay = 0,
  fromY = 18,
  duration = 480,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  fromY?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(fromY)).current;

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [opacity, translateY, delay, duration]);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

/** Subtle infinite pulse (scale 1 → 1.07). For current-stage markers, boarding alerts. */
export function Pulse({
  children,
  min = 1,
  max = 1.07,
  duration = 1100,
  style,
}: {
  children: React.ReactNode;
  min?: number;
  max?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const scale = useRef(new Animated.Value(min)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: max, duration: duration / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scale, { toValue: min, duration: duration / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scale, min, max, duration]);

  return <Animated.View style={[{ transform: [{ scale }] }, style]}>{children}</Animated.View>;
}

/** Small live-status dot: opacity + scale loop. */
export function LiveDot({ color, size = 9 }: { color: string; size?: number }) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(v, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);

  const opacity = v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.45, 1] });
  const scale = v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.35, 1] });

  return (
    <Animated.View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity, transform: [{ scale }] }}
    />
  );
}

/**
 * One-shot reveal (opacity + scale settle). Used for the QR block so the
 * code animates in once, then stays perfectly stable and scannable.
 */
export function RevealOnce({
  children,
  delay = 150,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 450, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, delay, damping: 18, stiffness: 160, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [opacity, scale, delay]);

  return (
    <Animated.View style={[{ opacity, transform: [{ scale }] }, style]}>
      {children}
    </Animated.View>
  );
}

/** Slow horizontal drift (onboarding plane). Loops seamlessly. */
export function DriftingPlane({ children, distance = 240, duration = 7000 }: { children: React.ReactNode; distance?: number; duration?: number }) {
  const x = useRef(new Animated.Value(-40)).current;
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const drift = Animated.loop(
      Animated.timing(x, { toValue: distance, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    );
    const float = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: -8, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 8, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    drift.start();
    float.start();
    return () => {
      drift.stop();
      float.stop();
    };
  }, [x, bob, distance, duration]);

  return <Animated.View style={{ transform: [{ translateX: x }, { translateY: bob }] }}>{children}</Animated.View>;
}

/** Animated horizontal progress fill. Animates smoothly when `value` changes. */
export function AnimatedProgress({ value, color, height = 8 }: { value: number; color: string; height?: number }) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(v, {
      toValue: Math.max(0, Math.min(1, value)),
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [v, value]);

  const width = v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Animated.View style={{ height, borderRadius: 99, backgroundColor: 'rgba(7,23,57,0.10)', overflow: 'hidden', marginTop: 8 }}>
      <Animated.View style={{ height, borderRadius: 99, backgroundColor: color, width }} />
    </Animated.View>
  );
}

/** Continuously moving plane along a horizontal route (home flight path). */
export function RoutePlane({ duration = 4200 }: { duration?: number }) {
  const p = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(p, { toValue: 1, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(p, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [p, duration]);

  return (
    <Animated.View
      style={{
        transform: [
          {
            translateX: p.interpolate({ inputRange: [0, 1], outputRange: [-34, 34] }),
          },
          {
            translateY: p.interpolate({ inputRange: [0, 0.5, 1], outputRange: [3, -3, 3] }),
          },
        ],
      }}
    >
      <Animated.Text style={{ fontSize: 18 }}>✈</Animated.Text>
    </Animated.View>
  );
}
