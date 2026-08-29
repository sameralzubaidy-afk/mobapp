/**
 * File: p2p-kids-marketplace/src/components/home/ComposerBar.tsx
 *
 * Home-screen "What are you selling today?" composer bar.
 *
 * Behavior (exact spec):
 *  - Tapping anywhere on the bar focuses the inline text field (does NOT navigate).
 *  - Tapping the "+" button (or submitting via keyboard return) navigates to the
 *    existing New Item screen (ItemCreate) with whatever text was typed passed
 *    forward and pre-filling the Title field. This ALWAYS routes to the
 *    single-item flow — Bulk Upload stays reachable only via the FAB's Sell sheet.
 *  - Tapping the inline camera icon opens New Item straight to the camera
 *    (initialPhotoSource='camera') with the typed title still pre-filled.
 *  - Tapping "+" with no text behaves identically but leaves Title empty
 *    (no regression from current New Item entry behavior).
 *
 * Analytics:
 *  - composer_bar_tapped on input focus (primary tap interaction)
 *  - composer_bar_submit with { has_text: true|false }
 *
 * Design system: input/pill token styling, primary-accent "+" button.
 */
import React, { useRef, useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Camera, Plus } from 'phosphor-react-native';

import { trackEvent } from '@/services/analytics';
import { COMPOSER_EVENTS } from '@/constants/analytics-events';
import { colors, borderRadius, componentSize, spacing } from '@/theme';
import { KEYBOARD_DONE_ACCESSORY_ID } from '@/components/shared/KeyboardDoneAccessory';

export default function ComposerBar() {
  const navigation = useNavigation<any>();
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  const focusInput = () => {
    inputRef.current?.focus();
  };

  /**
   * Navigate to the New Item screen with the typed text as the pre-filled Title.
   * `openCamera` adds initialPhotoSource='camera' so the photos step auto-launches
   * the camera instead of showing the photo-source modal.
   */
  const submit = (opts: { openCamera?: boolean } = {}) => {
    const hasText = text.trim().length > 0;
    trackEvent(COMPOSER_EVENTS.SUBMITTED, { has_text: hasText });

    navigation.navigate('ItemCreate', {
      prefilledTitle: text,
      ...(opts.openCamera ? { initialPhotoSource: 'camera' } : {}),
    });

    // Clear so the next visit starts fresh
    setText('');
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={styles.bar}
        activeOpacity={1}
        onPress={focusInput}
        accessibilityRole="button"
        accessibilityLabel="What are you selling today?"
        testID="composer-bar"
        accessible
      >
        {/* Camera shortcut — opens New Item straight to the camera */}
        <TouchableOpacity
          style={styles.cameraBtn}
          onPress={() => submit({ openCamera: true })}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="List an item with your camera"
          testID="composer-camera-button"
          accessible
        >
          <Camera size={20} color={colors.neutral[700]} weight="regular" />
        </TouchableOpacity>

        {/* P18 fix: fire composer_bar_tapped on input focus. The bar's onPress
            is shadowed by the camera button's hitSlop, the TextInput's native
            focus, and the "+" button's hitSlop — so the bar onPress (and thus
            the old event wiring) was unreachable by normal taps. onFocus fires
            for the primary "tap into the composer" interaction. */}
        <TextInput inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
          ref={inputRef}
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="What are you selling today?"
          placeholderTextColor={colors.neutral[500]}
          returnKeyType="go"
          onSubmitEditing={() => submit()}
          onFocus={() => trackEvent(COMPOSER_EVENTS.BAR_TAPPED)}
          testID="composer-input"
        />

        {/* Trailing "+" — submits with typed text as Title */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => submit()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Create listing"
          testID="composer-add-button"
          accessible
        >
          <Plus size={22} color={colors.neutral.white} weight="bold" />
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: componentSize.inputHeight,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.neutral[100],
    gap: spacing.sm,
  },
  cameraBtn: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.circle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: colors.neutral[900],
    paddingVertical: 0,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
