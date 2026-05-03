/**
 * File: p2p-kids-marketplace/src/components/atoms/ListingImage/index.tsx
 *
 * A unified atomic component for rendering listing images throughout the app.
 * This ensures consistent CDN transformation, placeholder handling, and aspect ratios.
 */

import React from 'react';
import { View, Image, Text, StyleSheet, ImageProps, ViewStyle, ImageStyle } from 'react-native';
import { transformToCdnUrl } from '../../../utils/imageUrl';

interface ListingImageProps extends Omit<ImageProps, 'source'> {
  url?: string | null;
  aspectRatio?: number;
  containerStyle?: ViewStyle;
  imageStyle?: ImageStyle;
  placeholderText?: string;
  size?: 'small' | 'medium' | 'large' | 'cover';
}

export const ListingImage: React.FC<ListingImageProps> = ({
  url,
  aspectRatio,
  containerStyle,
  imageStyle,
  placeholderText = 'No Image',
  size = 'cover',
  ...props
}) => {
  const cdnUrl = url ? transformToCdnUrl(url) : null;
  const ratioStyle = typeof aspectRatio === 'number' ? { aspectRatio } : null;

  return (
    <View style={[styles.container, ratioStyle, containerStyle]}>
      {cdnUrl ? (
        <Image
          source={{ uri: cdnUrl }}
          style={[styles.image, imageStyle]}
          resizeMode={props.resizeMode || 'cover'}
          {...props}
        />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>{placeholderText}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
  },
});
