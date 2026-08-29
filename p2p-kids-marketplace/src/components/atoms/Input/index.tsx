import React from 'react';
import { TextInput } from 'react-native';
// Dev Task 44 item 3: shared Input renders the iOS keyboard-done accessory for
// every field (the <KeyboardDoneAccessory /> bar is mounted once at the app
// root). Harmless on Android (InputAccessoryView renders nothing there).
import { KEYBOARD_DONE_ACCESSORY_ID } from '@/components/shared/KeyboardDoneAccessory';

export default function Input(props: any) {
  return <TextInput {...props} inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID} />;
}
