import React from 'react';
import { Image } from 'react-native';

/**
 * Avatar component that displays user profile images
 * 
 * Prefers cdnUrl (via Cloudflare worker) for cached images,
 * falls back to publicUrl (direct Supabase) if cdnUrl unavailable
 * 
 * @param uri - CDN URL (preferred) or public Supabase URL (fallback)
 * @param size - Avatar size in pixels (default: 48)
 */
export default function Avatar({ uri, size = 48 }: { uri?: string; size?: number }) {
  // Handle missing URI gracefully
  if (!uri) {
    return (
      <Image
        source={require('./placeholder.png')}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      onError={() => {
        console.warn(`[Avatar] Failed to load image: ${uri}`);
      }}
    />
  );
}
