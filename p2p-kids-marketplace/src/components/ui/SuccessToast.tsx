/**
 * File: p2p-kids-marketplace/src/components/ui/SuccessToast.tsx
 * Design System: Success Toast (Auto-Dismissing Snackbar)
 *
 * An auto-dismissing green toast that slides in from the top, used for
 * non-blocking success confirmations. Uses the app brand green (#5DBB8E)
 * and Phosphor icon consistent with the design system.
 *
 * Usage:
 *   const [showToast, setShowToast] = useState(false);
 *   const [toastSubtitle, setToastSubtitle] = useState<string | undefined>();
 *
 *   // After successful action:
 *   setToastSubtitle(undefined);
 *   setShowToast(true);
 *
 *   // In JSX (render at screen level, above everything else):
 *   <SuccessToast
 *     visible={showToast}
 *     message="Added to Trade Basket"
 *     subtitle={toastSubtitle}
 *     onDismiss={() => setShowToast(false)}
 *   />
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, View, Platform } from 'react-native';
import { ShoppingCart } from 'phosphor-react-native';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { borderRadius } from '@/theme/shadows';

interface SuccessToastProps {
  /** Show/hide the toast */
  visible: boolean;
  /** Primary message — appears in bold white text */
  message: string;
  /** Optional subtitle — smaller light text below the message */
  subtitle?: string;
  /** Auto-dismiss duration in milliseconds (default: 2500) */
  duration?: number;
  /** Called after the dismiss animation completes */
  onDismiss: () => void;
}

export const SuccessToast: React.FC<SuccessToastProps> = ({
  visible,
  message,
  subtitle,
  duration = 2500,
  onDismiss,
}) => {
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);

  useEffect(() => {
    if (!visible || isAnimating.current) return;

    isAnimating.current = true;

    // Reset to hidden state
    translateY.setValue(-120);
    opacity.setValue(0);

    // Slide in
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 15,
        stiffness: 150,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss after duration
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -120,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        isAnimating.current = false;
        onDismiss();
      });
    }, duration);

    return () => {
      clearTimeout(timer);
      isAnimating.current = false;
    };
    // We intentionally only react to visible → true transitions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
      testID="success-toast"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.iconWrapper}>
        <ShoppingCart size={18} color="#FFFFFF" weight="fill" />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.message}>{message}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 50,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.large,
    zIndex: 9999,
    elevation: 8,
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm + 2,
  },
  textContainer: {
    flex: 1,
  },
  message: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    marginTop: 2,
  },
});
