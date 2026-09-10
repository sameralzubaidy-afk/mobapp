/**
 * File: p2p-kids-marketplace/src/components/trade/SafeMeetupCard.tsx
 * TFV2-020: Trade Smart, Trade Safe — safety tips card
 *
 * Redesigned to match the Whisk Design System with a clean, readable layout:
 * - ShieldCheck header icon
 * - 4 bullet-style tips with bold title + description
 * - Green CTA button to dismiss
 *
 * Icons: ShieldCheck, MapPin, NavigationArrow, Prohibit, SunDim
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ShieldCheck, MapPin, NavigationArrow, Prohibit, SunDim } from 'phosphor-react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const STORAGE_PREFIX = 'safe_meetup_collapsed_';

const TIPS = [
  {
    icon: MapPin,
    title: 'Meet where others can see you',
    description: 'Police station lots, storefronts, or busy malls',
  },
  {
    icon: NavigationArrow,
    title: 'Drop a pin before you leave',
    description: 'Share your live location with someone you trust',
  },
  {
    icon: Prohibit,
    title: 'Cancel anytime — no explanation needed',
    description: 'If something feels off, trust that instinct',
  },
  {
    icon: SunDim,
    title: 'Daytime only',
    description: 'Avoid evenings and low-traffic hours',
  },
];

interface Props {
  tradeId: string;
  onDismiss?: () => void;
  /**
   * FIX-Task-15 item 7 (2026-09-10): publishes the EXPANDED state (note: NOT the
   * internal `collapsed` flag) so a host screen — the Trade Timeline — can reserve
   * the expanded card's height and keep its CTA clear of the floating tab bar.
   * Publishing `expanded` (rather than `collapsed`) keeps the host's state name
   * and this callback pointing the same way; the first cut shipped `collapsed`
   * into a state called `safeMeetupExpanded`, which inverted the reserved space
   * (QA verify round, both platforms). Expansion is still never persisted — only
   * the collapsed state is written to storage.
   */
  onExpandedChange?: (expanded: boolean) => void;
}

export function SafeMeetupCard({ tradeId, onDismiss, onExpandedChange }: Props) {
  // FIX-Task-7 item 5b (2026-09-08): tips COLLAPSED BY DEFAULT so the primary
  // trade actions (Report a Problem / I Got It) sit higher and are reachable
  // sooner on the timeline. The header pill is always visible and acts as the
  // "Tips" expander — tap to reveal the 4 tips + the safety CTA. (Previously the
  // card started fully expanded and pushed the primary actions down.)
  const [collapsed, setCollapsed] = React.useState(true);
  const storageKey = `${STORAGE_PREFIX}${tradeId}`;

  // Load persisted collapsed state
  React.useEffect(() => {
    AsyncStorage.getItem(storageKey).then((val) => {
      if (val === 'true') setCollapsed(true);
    });
  }, [storageKey]);

  // FIX-Task-15 item 7 (2026-09-10): report the state on mount and on every
  // toggle, so the host's reserved space always matches what is rendered. The
  // host passes its state setter, so re-running this cannot loop. Published as
  // `expanded` — see the prop comment for the inversion this fixed.
  React.useEffect(() => {
    onExpandedChange?.(!collapsed);
  }, [collapsed, onExpandedChange]);

  const dismiss = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsed(true);
    AsyncStorage.setItem(storageKey, 'true');
    onDismiss?.();
  };

  const expand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsed(false);
  };

  if (collapsed) {
    return (
      <TouchableOpacity
        style={styles.collapsedCard}
        onPress={expand}
        activeOpacity={0.7}
        testID="safe-meetup-toggle"
        accessible
        accessibilityRole="button"
        accessibilityLabel="View safety tips"
      >
        <ShieldCheck size={20} color="#5DBB8E" weight="fill" />
        <Text style={styles.collapsedText}>Trade Smart, Trade Safe</Text>
        <View style={styles.tipsPill}>
          <Text style={styles.tipsPillText}>Tips</Text>
        </View>
        <Text style={styles.chevron}>{'\u203A'}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.card} testID="safe-meetup-card">
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIconWrap}>
          <ShieldCheck size={28} color="#FFFFFF" weight="fill" />
        </View>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Trade Smart, Trade Safe</Text>
          <Text style={styles.headerSub}>Smart traders meet where people are around</Text>
        </View>
      </View>

      {/* Tips */}
      <View style={styles.tipsContainer} testID="safe-meetup-tips">
        {TIPS.map((tip, i) => {
          const IconComponent = tip.icon;
          return (
            <View key={i} style={styles.tipRow}>
              <View style={styles.tipIconWrap}>
                <IconComponent size={18} color="#5DBB8E" weight="fill" />
              </View>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>{tip.title}</Text>
                <Text style={styles.tipDesc}>{tip.description}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* CTA Button */}
      <TouchableOpacity
        style={styles.ctaButton}
        onPress={dismiss}
        testID="safe-meetup-cta"
        accessible
        accessibilityRole="button"
        accessibilityLabel="Safe meetup cta"
        activeOpacity={0.8}
      >
        <ShieldCheck size={18} color="#FFFFFF" weight="fill" style={{ marginRight: 8 }} />
        <Text style={styles.ctaButtonText}>Got it — Let's Trade Safely</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    marginBottom: 12,
    padding: 20,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  collapsedCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  collapsedText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  chevron: {
    fontSize: 20,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  // FIX-Task-7 item 5b: "Tips" chip on the collapsed pill makes the expander
  // affordance explicit (tips + safety CTA open on tap).
  tipsPill: {
    backgroundColor: '#E9F7F0',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tipsPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2D6A4F',
    fontFamily: 'Inter-SemiBold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  headerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#5DBB8E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  headerSub: {
    fontSize: 13,
    color: '#6B6B6B',
    lineHeight: 18,
  },
  tipsContainer: {
    gap: 16,
    marginBottom: 20,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  tipIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    lineHeight: 20,
  },
  tipDesc: {
    fontSize: 13,
    color: '#6B6B6B',
    lineHeight: 18,
    marginTop: 2,
  },
  ctaButton: {
    backgroundColor: '#5DBB8E',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
