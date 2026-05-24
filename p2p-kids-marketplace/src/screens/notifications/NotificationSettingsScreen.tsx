// File: p2p-kids-marketplace/src/screens/notifications/NotificationSettingsScreen.tsx
// MODULE-15.1 FLOW-17: Notification Settings — Whisk Design System

import React, { useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  ArrowLeft,
  ShoppingCart,
  Lightning,
  Medal,
  Warning,
  CreditCard,
  Bell,
} from 'phosphor-react-native';
import ScreenLayout from '@/components/ScreenLayout';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChannelPrefs {
  push: boolean;
  inApp: boolean;
  email: boolean;
}

type CategoryId = 'subscription' | 'trades' | 'sp_events' | 'badges' | 'safety';

interface Category {
  id: CategoryId;
  label: string;
  Icon: React.ComponentType<any>;
  iconColor: string;
  iconBg: string;
}

// ─── Category config ───────────────────────────────────────────────────────────
const CATEGORIES: Category[] = [
  {
    id: 'subscription',
    label: 'Subscription & Membership',
    Icon: CreditCard,
    iconColor: '#4A7FBB',
    iconBg: '#E8F0FE',
  },
  {
    id: 'trades',
    label: 'Trade Updates',
    Icon: ShoppingCart,
    iconColor: '#5DBB8E',
    iconBg: '#E8F5F0',
  },
  {
    id: 'sp_events',
    label: 'Swap Points Events',
    Icon: Lightning,
    iconColor: '#F59E0B',
    iconBg: '#FEF3C7',
  },
  {
    id: 'badges',
    label: 'Badges & Achievements',
    Icon: Medal,
    iconColor: '#F59E0B',
    iconBg: '#FEF3C7',
  },
  {
    id: 'safety',
    label: 'Safety Alerts',
    Icon: Warning,
    iconColor: '#E85D75',
    iconBg: '#FEE2E2',
  },
];

// ─── Channel rows shown under each category ───────────────────────────────────
const CHANNELS: { key: keyof ChannelPrefs; label: string; description: string }[] = [
  { key: 'push',  label: 'Push Notifications',    description: 'Receive alerts on your device' },
  { key: 'inApp', label: 'In-App Notifications',  description: 'Show badges inside the app' },
  { key: 'email', label: 'Email Notifications',   description: 'Send updates to your email' },
];

// ─── Platform card shadow ──────────────────────────────────────────────────────
const CARD_SHADOW = Platform.select({
  ios: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  android: { elevation: 2 },
  default: {},
});

// ─── Default prefs ────────────────────────────────────────────────────────────
const DEFAULT_PREFS: Record<CategoryId, ChannelPrefs> = {
  subscription: { push: true,  inApp: true,  email: true  },
  trades:        { push: true,  inApp: true,  email: false },
  sp_events:     { push: true,  inApp: true,  email: false },
  badges:        { push: true,  inApp: true,  email: false },
  safety:        { push: true,  inApp: false, email: false },
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function NotificationSettingsScreen() {
  const navigation = useNavigation();
  const [prefs, setPrefs] = useState<Record<CategoryId, ChannelPrefs>>(DEFAULT_PREFS);

  const handleToggle = (categoryId: CategoryId, channel: keyof ChannelPrefs, value: boolean) => {
    setPrefs((prev) => ({
      ...prev,
      [categoryId]: { ...prev[categoryId], [channel]: value },
    }));
    // TODO: Persist preference to backend
  };

  return (
    <ScreenLayout variant="detail" title="Notification Settings">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Subtitle ───────────────────────────────────────────────────────── */}
        <Text style={styles.subtitle}>
          Choose how you want to be notified for different types of activity in the marketplace.
        </Text>

        {/* ── Per-category cards ─────────────────────────────────────────────── */}
        {CATEGORIES.map((cat) => {
          const { id, label, Icon, iconColor, iconBg } = cat;
          const catPrefs = prefs[id];

          return (
            <View
              key={id}
              testID={`category-section-${id}`}
              style={[styles.card, CARD_SHADOW]}
            >
              {/* Category header row */}
              <View style={styles.categoryHeader}>
                <View style={[styles.categoryIconWrap, { backgroundColor: iconBg }]}>
                  <Icon size={20} color={iconColor} weight="fill" />
                </View>
                <Text style={styles.categoryLabel}>{label}</Text>
              </View>

              {/* Channel toggle rows */}
              {CHANNELS.map(({ key, label: channelLabel, description }, idx) => {
                const isLast = idx === CHANNELS.length - 1;
                return (
                  <View
                    key={key}
                    testID={`setting-row-${id}-${key}`}
                    style={[styles.channelRow, !isLast && styles.channelDivider]}
                  >
                    <View style={styles.channelText}>
                      <Text style={styles.channelLabel}>{channelLabel}</Text>
                      <Text style={styles.channelDescription}>{description}</Text>
                    </View>
                    <Switch
                      testID={`switch-${id}-${key}`}
                      value={catPrefs[key]}
                      onValueChange={(val) => handleToggle(id, key, val)}
                      trackColor={{ false: '#E0E0E0', true: '#5DBB8E' }}
                      thumbColor="#FFFFFF"
                      ios_backgroundColor="#E0E0E0"
                    />
                  </View>
                );
              })}
            </View>
          );
        })}

        {/* ── Safety always-on note ─────────────────────────────────────────── */}
        <View style={styles.safetyNote}>
          <Bell size={16} color="#E85D75" weight="fill" />
          <Text style={styles.safetyNoteText}>
            Critical safety alerts (product recalls) are always delivered regardless of your preferences.
          </Text>
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F4F4F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 40,
  },

  // ── Scroll ──────────────────────────────────────────────────────────────────
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 16,
  },

  // ── Subtitle ────────────────────────────────────────────────────────────────
  subtitle: {
    fontSize: 14,
    color: '#6B6B6B',
    lineHeight: 20,
    marginBottom: 4,
  },

  // ── Per-category card ────────────────────────────────────────────────────────
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },

  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F6F6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  categoryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },

  // ── Channel toggle row ───────────────────────────────────────────────────────
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 60,
  },
  channelDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  channelText: {
    flex: 1,
    marginRight: 12,
  },
  channelLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  channelDescription: {
    fontSize: 12,
    color: '#6B6B6B',
    lineHeight: 16,
  },

  // ── Safety note ──────────────────────────────────────────────────────────────
  safetyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
  },
  safetyNoteText: {
    flex: 1,
    fontSize: 13,
    color: '#1A1A1A',
    lineHeight: 18,
  },
});
