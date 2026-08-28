// File: p2p-kids-marketplace/src/components/shared/KeyboardDoneAccessory.tsx
// iOS "Done" keyboard accessory — a stable, tappable dismiss control rendered
// above the software keyboard. QA uses `keyboard-done-button` to collapse the
// hardware-keyboard-hide keystroke (Cmd+K) into one tap per text-entry screen
// (Dev Task 25, item 2).
//
// Usage:
//   - Give every TextInput on the screen `inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}`.
//   - Render <KeyboardDoneAccessory /> once per screen (inside ScreenLayout).
//
// iOS-only (InputAccessoryView renders nothing on Android — harmless there).

import React from 'react';
import {
  InputAccessoryView,
  TouchableOpacity,
  Text,
  StyleSheet,
  Keyboard,
} from 'react-native';

/** Shared `inputAccessoryViewID` for all text inputs that should get the Done bar. */
export const KEYBOARD_DONE_ACCESSORY_ID = 'qa-keyboard-done-accessory';

/** Stable QA locator for the Done button (surfaces in the iOS AX tree per BP-53). */
export const KEYBOARD_DONE_BUTTON_TEST_ID = 'keyboard-done-button';

export function KeyboardDoneAccessory() {
  return (
    <InputAccessoryView nativeID={KEYBOARD_DONE_ACCESSORY_ID}>
      <TouchableOpacity
        style={styles.doneButton}
        onPress={() => Keyboard.dismiss()}
        testID={KEYBOARD_DONE_BUTTON_TEST_ID}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Done"
        hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}
      >
        <Text style={styles.doneText}>Done</Text>
      </TouchableOpacity>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  doneButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#F5F5F5',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0E0E0',
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#5DBB8E',
  },
});
