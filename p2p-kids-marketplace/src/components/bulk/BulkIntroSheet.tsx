/**
 * File: p2p-kids-marketplace/src/components/bulk/BulkIntroSheet.tsx
 * MODULE-04 V3.1 UX overhaul (Decision 9) — first-time intro
 *
 * Shown the first time a seller opens the bulk listing screen. Persisted via
 * AsyncStorage so it never repeats. Dismissible with a "Got it" button.
 */
import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SEEN_KEY = '@kids_marketplace:bulk_intro_seen_v1';

interface BulkIntroSheetProps {
  /**
   * Force visibility regardless of AsyncStorage flag (used for "Show me how"
   * help button). Defaults to undefined (auto-detect via storage).
   */
  forceVisible?: boolean;
  onDismiss?: () => void;
}

export function BulkIntroSheet({ forceVisible, onDismiss }: BulkIntroSheetProps) {
  const [visible, setVisible] = useState<boolean>(Boolean(forceVisible));
  const [resolved, setResolved] = useState<boolean>(forceVisible !== undefined);

  useEffect(() => {
    if (forceVisible !== undefined) {
      setVisible(forceVisible);
      setResolved(true);
      return;
    }
    let mounted = true;
    AsyncStorage.getItem(SEEN_KEY)
      .then((value) => {
        if (!mounted) return;
        setVisible(value !== '1');
        setResolved(true);
      })
      .catch(() => {
        if (!mounted) return;
        setVisible(true);
        setResolved(true);
      });
    return () => {
      mounted = false;
    };
  }, [forceVisible]);

  const dismiss = async () => {
    setVisible(false);
    try {
      await AsyncStorage.setItem(SEEN_KEY, '1');
    } catch {
      // ignore — non-fatal, user just sees intro again next time
    }
    onDismiss?.();
  };

  if (!resolved) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={dismiss}
      testID="bulk-intro-sheet"
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>List several items at once</Text>
          <Text style={styles.subtitle}>It only takes 4 quick steps:</Text>

          <Step n="1" title="Pick your photos" body="Choose up to 30 photos from your library. We start each photo as its own item." />
          <Step n="2" title="Group similar photos" body="Long-press to multi-select photos that show the same item, then tap Merge." />
          <Step n="3" title="Review with AI help" body="We auto-fill title, condition, and brand for each item. You just confirm or edit." />
          <Step n="4" title="Publish all at once" body="Skip any item, or fix missing fields, then publish the rest." />

          <TouchableOpacity
            style={styles.dismiss}
            onPress={dismiss}
            accessibilityLabel="Dismiss bulk listing intro"
            testID="bulk-intro-dismiss"
          >
            <Text style={styles.dismissText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepBadgeText}>{n}</Text>
      </View>
      <View style={styles.stepText}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepBody}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    marginTop: 4,
    color: '#4B5563',
    fontSize: 13,
    marginBottom: 12,
  },
  stepRow: {
    flexDirection: 'row',
    marginVertical: 6,
    alignItems: 'flex-start',
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  stepBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  stepText: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  stepBody: {
    fontSize: 13,
    color: '#4B5563',
    marginTop: 1,
  },
  dismiss: {
    marginTop: 14,
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dismissText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
