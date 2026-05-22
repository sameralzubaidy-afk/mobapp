/**
 * File: p2p-kids-marketplace/src/components/RadiusSlider.tsx
 * MODULE-03 NODE-007: Distance Radius Filter
 *
 * Reusable radius slider component for item search
 * - Displays adjustable radius in miles
 * - Respects admin-configured min/max bounds
 * - Shows current radius value
 * - Debounced onChange handler
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  PanResponder,
  Pressable,
} from 'react-native';

interface RadiusSliderProps {
  value: number;
  minRadius: number;
  maxRadius: number;
  onValueChange: (newRadius: number) => void;
  onSlidingComplete?: (newRadius: number) => void;
  disabled?: boolean;
  loading?: boolean;
}

export default function RadiusSlider({
  value,
  minRadius,
  maxRadius,
  onValueChange,
  onSlidingComplete,
  disabled = false,
  loading = false,
}: RadiusSliderProps) {
  const [localValue, setLocalValue] = useState(value);
  const [trackWidth, setTrackWidth] = useState(0);
  const trackRef = useRef<View>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handlePanResponderMove = (event: any) => {
    if (trackWidth === 0) return; // Wait for track to be measured
    const x = event.nativeEvent.locationX;
    const percentage = Math.max(0, Math.min(1, x / trackWidth));
    const newValue = Math.round(minRadius + percentage * (maxRadius - minRadius));
    setLocalValue(newValue);
  };

  const handlePanResponderEnd = () => {
    onSlidingComplete?.(localValue);
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled && !loading,
    onMoveShouldSetPanResponder: () => !disabled && !loading,
    onPanResponderMove: handlePanResponderMove,
    onPanResponderRelease: handlePanResponderEnd,
  });

  const percentage = (localValue - minRadius) / (maxRadius - minRadius);
  const thumbPosition = trackWidth > 0 ? percentage * trackWidth : 0;

  const handleDecrement = () => {
    const newValue = Math.max(minRadius, localValue - 1);
    setLocalValue(newValue);
    // Only call onSlidingComplete to save and reload items
    onSlidingComplete?.(newValue);
  };

  const handleIncrement = () => {
    const newValue = Math.min(maxRadius, localValue + 1);
    setLocalValue(newValue);
    // Only call onSlidingComplete to save and reload items
    onSlidingComplete?.(newValue);
  };

  return (
    <View style={[styles.container, disabled && styles.disabled]}>
      {/* Header: Title and Current Value */}
      <View style={styles.header}>
        <Text style={styles.title}>Search Radius</Text>
        <View style={styles.valueContainer}>
          {loading ? (
            <ActivityIndicator size="small" color="#3b82f6" />
          ) : (
            <Text style={styles.value}>{Math.round(localValue)} miles</Text>
          )}
        </View>
      </View>

      {/* Slider + Arrow Buttons Row */}
      <View style={styles.sliderRow}>
        {/* Minus Button */}
        <Pressable
          onPress={handleDecrement}
          disabled={disabled || loading || localValue <= minRadius}
          style={({ pressed }) => [
            styles.arrowButton,
            (disabled || loading || localValue <= minRadius) && styles.arrowButtonDisabled,
            pressed && styles.arrowButtonPressed,
          ]}
        >
          <Text style={styles.arrowButtonText}>−</Text>
        </Pressable>

        {/* Slider Track */}
        <View
          ref={trackRef}
          style={[styles.sliderTrack, { flex: 1 }]}
          onLayout={(event) => {
            setTrackWidth(event.nativeEvent.layout.width);
          }}
          {...panResponder.panHandlers}
        >
          {/* Filled portion */}
          <View style={[styles.filledTrack, { width: `${percentage * 100}%` }]} />

          {/* Thumb/Handle */}
          <View
            style={[
              styles.thumb,
              { left: thumbPosition - 10 }, // Center the thumb (10 is thumb radius)
            ]}
          />
        </View>

        {/* Plus Button */}
        <Pressable
          onPress={handleIncrement}
          disabled={disabled || loading || localValue >= maxRadius}
          style={({ pressed }) => [
            styles.arrowButton,
            (disabled || loading || localValue >= maxRadius) && styles.arrowButtonDisabled,
            pressed && styles.arrowButtonPressed,
          ]}
        >
          <Text style={styles.arrowButtonText}>+</Text>
        </Pressable>
      </View>

      {/* Min/Max Labels */}
      <View style={styles.rangeLabels}>
        <Text style={styles.label}>{minRadius} mi</Text>
        <Text style={styles.label}>{maxRadius} mi</Text>
      </View>

      {/* Info Text */}
      {localValue > 15 && (
        <Text style={styles.infoText}>
          📍 Showing items from {Math.round(localValue)} miles away
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
  },
  disabled: {
    opacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  valueContainer: {
    minWidth: 60,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
    color: '#5DBB8E',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 12,
    gap: 8,
  },
  arrowButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D9D9D9',
  },
  arrowButtonPressed: {
    backgroundColor: '#E5E5E5',
  },
  arrowButtonDisabled: {
    opacity: 0.4,
  },
  arrowButtonText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#5DBB8E',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderTrack: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    justifyContent: 'center',
  },
  filledTrack: {
    height: '100%',
    backgroundColor: '#5DBB8E',
    borderRadius: 4,
  },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#5DBB8E',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    position: 'absolute',
    top: -6,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
  },
  rangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  infoText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    fontStyle: 'normal',
  },
});
