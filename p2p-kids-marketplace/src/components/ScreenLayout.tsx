/**
 * File: p2p-kids-marketplace/src/components/ScreenLayout.tsx
 * MODULE-15.1-UI-REDESIGN: Common authenticated-screen wrapper
 *
 * Drop-in replacement for <SafeAreaView> in every authenticated screen.
 * Renders AppHeader above children with consistent safe-area handling.
 *
 * Usage:
 *   // Home screen (greeting header + logout button)
 *   <ScreenLayout variant="main" showLogout>
 *     {content}
 *   </ScreenLayout>
 *
 *   // Standard detail screen
 *   <ScreenLayout variant="detail" title="Settings">
 *     {content}
 *   </ScreenLayout>
 *
 *   // Checkout / payment screen (no bell)
 *   <ScreenLayout variant="detail" title="Checkout" showBell={false}>
 *     {content}
 *   </ScreenLayout>
 */

import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppHeader, { AppHeaderProps } from './AppHeader';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ScreenLayoutProps extends AppHeaderProps {
  children: React.ReactNode;
  /** Additional styles merged onto the SafeAreaView container */
  style?: ViewStyle;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ScreenLayout({
  variant,
  title,
  showBell,
  showLogout,
  onBack,
  children,
  style,
}: ScreenLayoutProps) {
  return (
    <SafeAreaView
      style={[styles.container, style]}
      edges={['top', 'left', 'right']}
    >
      <AppHeader
        variant={variant}
        title={title}
        showBell={showBell}
        showLogout={showLogout}
        onBack={onBack}
      />
      {children}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});
