import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, Text, StyleSheet } from 'react-native';
import { CircleNotch } from 'phosphor-react-native';

interface LoadingSpinnerProps {
  text?: string;
  color?: string;
  size?: number;
  fullScreen?: boolean;
  testID?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  text,
  color = '#5DBB8E',
  size = 40,
  fullScreen = false,
  testID,
}) => {
  const spinAnim = useRef(new Animated.Value(0)).current;

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

  return (
    <View testID={testID} style={[styles.container, fullScreen && styles.fullScreen]}>
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <CircleNotch size={size} color={color} weight="bold" />
      </Animated.View>
      {text ? <Text style={styles.text}>{text}</Text> : null}
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
});
