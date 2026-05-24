// File: p2p-kids-marketplace/src/screens/feedback/SuccessScreen.tsx
// FLOW-26 Screen 5/6: Action Success Screen

import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { CheckCircle } from 'phosphor-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';

type SuccessScreenParams = {
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaAction?: 'goBack' | 'navigate';
  ctaScreen?: string;
};

type SuccessScreenRouteProp = RouteProp<{ Success: SuccessScreenParams }, 'Success'>;

const SuccessScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<SuccessScreenRouteProp>();
  
  const {
    title = 'Success!',
    subtitle,
    ctaLabel = 'Continue',
    ctaAction = 'goBack',
    ctaScreen,
  } = route.params || {};

  const handleCTA = () => {
    if (ctaAction === 'navigate' && ctaScreen) {
      navigation.navigate(ctaScreen as never);
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.container} testID="success-screen">
      <View style={styles.content}>
        <CheckCircle size={72} color="#5DBB8E" weight="fill" testID="success-icon" />
        
        <Text style={styles.title} testID="success-title">
          {title}
        </Text>
        
        {subtitle && (
          <Text style={styles.subtitle} testID="success-subtitle">
            {subtitle}
          </Text>
        )}
        
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={handleCTA}
          testID="success-cta-button"
          accessibilityLabel={ctaLabel}
          accessibilityRole="button"
        >
          <Text style={styles.ctaBtnText}>{ctaLabel}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 22,
  },
  ctaBtn: {
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
    height: 52,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  ctaBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default SuccessScreen;
