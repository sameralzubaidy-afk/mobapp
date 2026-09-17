import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { CircleNotch } from 'phosphor-react-native';

interface LoadingSpinnerProps {
  text?: string;
  color?: string;
  size?: number;
  fullScreen?: boolean;
  testID?: string;
  /**
   * FIX-Task-47 item 12 (2026-09-16): copy revealed only if the load is STILL
   * running after `slowHintAfterMs`.
   *
   * The Kids Club+ surfaces were measured at 20–50s to first paint on Android. A
   * bare spinner for that long reads as "the app is frozen", so the wait is made
   * legible instead of ambiguous. Optional — screens that load quickly pass nothing
   * and are completely unchanged.
   */
  slowHint?: string;
  /** Delay before `slowHint` appears. Defaults to 3s. */
  slowHintAfterMs?: number;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  text,
  color = '#5DBB8E',
  size = 40,
  fullScreen = false,
  testID,
  slowHint,
  slowHintAfterMs = 3000,
}) => {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const [showSlowHint, setShowSlowHint] = useState(false);

  // FIX-Task-47 item 12: arm the slow-load hint only for the current mount, and
  // clear the timer on unmount so a fast load never flips it on afterwards.
  useEffect(() => {
    if (!slowHint) return undefined;

    const timer = setTimeout(() => setShowSlowHint(true), slowHintAfterMs);
    return () => clearTimeout(timer);
  }, [slowHint, slowHintAfterMs]);

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const SpinnerIcon = CircleNotch as unknown as React.ComponentType<{
    size?: number;
    color?: string;
    weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
  }>;

  return (
    <View testID={testID} style={[styles.container, fullScreen && styles.fullScreen]}>
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        {SpinnerIcon ? (
          <SpinnerIcon size={size} color={color} weight="bold" />
        ) : (
          <ActivityIndicator size="large" color={color} />
        )}
      </Animated.View>
      {text ? <Text style={styles.text}>{text}</Text> : null}
      {slowHint && showSlowHint ? (
        <Text style={styles.slowHintText} testID="loading-slow-hint">
          {slowHint}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
  },
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  text: {
    fontSize: 15,
    color: '#6B6B6B',
    marginTop: 8,
  },
  // FIX-Task-47 item 12: deliberately quieter than `text` — it is a reassurance
  // line, not a second heading.
  slowHintText: {
    fontSize: 13,
    color: '#999999',
    marginTop: 4,
    textAlign: 'center',
  },
});
