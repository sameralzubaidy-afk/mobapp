// filepath: p2p-kids-marketplace/src/components/badges/BadgeCelebrationModal.tsx
// TASK: NOTIF-V2-004 - Badge Celebration Modal
// Purpose: Display celebration animation when user earns a badge
// Note: Using React Native Animated API for celebration effects (canvas-confetti not compatible with RN)

import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { UserBadge } from '@/types/badge';

interface BadgeCelebrationModalProps {
  visible: boolean;
  badge: UserBadge | null;
  onClose: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Simple confetti particle component using Animated
const ConfettiParticle: React.FC<{ index: number }> = ({ index }) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Randomize particle behavior
    const startX = (Math.random() - 0.5) * SCREEN_WIDTH;
    const endX = startX + (Math.random() - 0.5) * 200;
    const duration = 2000 + Math.random() * 1000;

    // Animate particle falling and fading
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: endX,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(rotate, {
        toValue: 360 * (Math.random() > 0.5 ? 1 : -1),
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: duration * 0.8,
        delay: duration * 0.2,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const colors = ['#4CAF50', '#FF9800', '#2196F3', '#FFC107', '#E91E63'];
  const color = colors[index % colors.length];

  return (
    <Animated.View
      style={[
        styles.confettiParticle,
        {
          backgroundColor: color,
          left: SCREEN_WIDTH / 2 + (Math.random() - 0.5) * 200,
          transform: [
            { translateY },
            { translateX },
            {
              rotate: rotate.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }),
            },
          ],
          opacity,
        },
      ]}
    />
  );
};

const BadgeCelebrationModal: React.FC<BadgeCelebrationModalProps> = ({
  visible,
  badge,
  onClose,
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && badge) {
      // Reset animation
      scaleAnim.setValue(0);
      fadeAnim.setValue(0);

      // Badge scale-in animation
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 5,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, badge]);

  if (!badge || !badge.badge) {
    return null;
  }

  const badgeIcon = badge.badge.icon_url || '🏆';
  const isEmoji = !badge.badge.icon_url;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID="badge-celebration-modal"
    >
      <Pressable style={styles.overlay} onPress={onClose} testID="celebration-overlay">
        {/* Confetti Particles */}
        {visible &&
          Array.from({ length: 30 }).map((_, i) => <ConfettiParticle key={i} index={i} />)}

        <Animated.View
          style={[
            styles.container,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Pressable onPress={() => {}} testID="celebration-content">
            {/* Badge Icon */}
            <View style={styles.badgeContainer} testID="badge-icon-container">
              {isEmoji ? (
                <Text style={styles.badgeEmoji} testID="badge-emoji">
                  {badgeIcon}
                </Text>
              ) : (
                <Image source={{ uri: badgeIcon }} style={styles.badgeImage} testID="badge-image" />
              )}
            </View>

            {/* Title */}
            <Text style={styles.title} testID="celebration-title">
              🎉 New Badge Earned! 🎉
            </Text>

            {/* Badge Name */}
            <Text style={styles.badgeName} testID="badge-name">
              {badge.badge.name}
            </Text>

            {/* Badge Description */}
            <Text style={styles.description} testID="badge-description">
              {badge.badge.description}
            </Text>

            {/* Close Button */}
            <Pressable
              style={styles.button}
              onPress={onClose}
              testID="celebration-close-button"
              accessible
              accessibilityRole="button"
              accessibilityLabel="Awesome!"
            >
              <Text style={styles.buttonText}>Awesome!</Text>
            </Pressable>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    maxWidth: SCREEN_WIDTH - 60,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 10,
  },
  confettiParticle: {
    position: 'absolute',
    top: -20,
    width: 10,
    height: 10,
    borderRadius: 5,
    zIndex: 1,
  },
  badgeContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 4,
    borderColor: '#4CAF50',
  },
  badgeEmoji: {
    fontSize: 64,
  },
  badgeImage: {
    width: 80,
    height: 80,
    resizeMode: 'contain',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  badgeName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#4CAF50',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  button: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 25,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default BadgeCelebrationModal;
