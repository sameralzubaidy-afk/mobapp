import React from 'react';
import { View, Image, StyleSheet, Text, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Avatar component that displays user profile images
 * 
 * Prefers cdnUrl (via Cloudflare worker) for cached images,
 * falls back to publicUrl (direct Supabase) if cdnUrl unavailable
 * 
 * @param imageUrl - CDN URL (preferred) or public Supabase URL (fallback)
 * @param name - User's name for initials fallback
 * @param size - Avatar size in pixels (default: 48)
 * @param verificationStatus - The verification status of the user ('approved', 'pending', etc.)
 * @param style - Custom style for the avatar container
 */
export default function Avatar({ 
  imageUrl,
  name,
  size = 48,
  verificationStatus,
  style
}: { 
  imageUrl?: string;
  name?: string;
  size?: number;
  verificationStatus?: 'approved' | 'pending' | 'rejected' | 'none' | null;
  style?: ViewStyle;
}) {
  const renderAvatar = () => {
    if (!imageUrl) {
      if (name) {
        const initials = name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .substring(0, 2);

        return (
          <View style={[
            styles.placeholder, 
            { width: size, height: size, borderRadius: size / 2 }
          ]}>
            <Text style={[styles.initials, { fontSize: size * 0.4 }]}>
              {initials}
            </Text>
          </View>
        );
      }

      return (
        <View style={[
          styles.placeholder, 
          { width: size, height: size, borderRadius: size / 2, backgroundColor: '#E5E7EB' }
        ]}>
          <Ionicons name="person" size={size * 0.6} color="#9CA3AF" />
        </View>
      );
    }

    return (
      <Image
        source={{ uri: imageUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onError={() => {
          console.warn(`[Avatar] Failed to load image: ${imageUrl}`);
        }}
      />
    );
  };

  const renderBadge = () => {
    if (!verificationStatus || verificationStatus === 'none' || verificationStatus === 'rejected') {
      return null;
    }

    const badgeSize = Math.max(16, size * 0.3); // Scale badge with avatar size
    const badgeColor = verificationStatus === 'approved' ? '#3B82F6' : '#F59E0B'; // Blue for approved, Orange for pending
    
    return (
      <View style={[
        styles.badgeContainer, 
        { 
          width: badgeSize, 
          height: badgeSize, 
          borderRadius: badgeSize / 2,
          bottom: Math.max(0, size * 0.03),
          right: Math.max(0, size * 0.03),
          zIndex: 99,
          elevation: 10, // Higher elevation for Android to ensure it's on top
          backgroundColor: '#FFFFFF', // Required for filling the transparent checkmark cutout
        }
      ]}>
        <Ionicons 
          name="checkmark-circle" 
          size={badgeSize} 
          color={badgeColor} 
        />
      </View>
    );
  };

  return (
    <View style={[{ width: size, height: size, overflow: 'visible', zIndex: 1 }, style]}>
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
        {renderAvatar()}
      </View>
      {renderBadge()}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  badgeContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeBackground: {
    position: 'absolute',
    width: '80%',
    height: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 100,
  },
});
