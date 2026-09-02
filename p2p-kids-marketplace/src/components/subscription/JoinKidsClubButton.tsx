/**
 * File: p2p-kids-marketplace/src/components/subscription/JoinKidsClubButton.tsx
 * R7 — Web-First Subscription Purchase (Option A)
 *
 * The ONLY membership CTA in the app. It contains NO purchase logic and NO
 * price UI — it opens the "Join Kids Club" web page in the external browser.
 * Brand CTA style matches the app's green (#5DBB8E) per the User-Facing Copy
 * Standards (branded modals/buttons only — never native system blue).
 */

import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { openJoinKidsClubWeb } from '../../utils/subscriptionWeb';

interface JoinKidsClubButtonProps {
  label?: string;
  emailHint?: string | null;
  testID?: string;
}

export function JoinKidsClubButton({
  label = 'Join on the web',
  emailHint,
  testID = 'join-kids-club-button',
}: JoinKidsClubButtonProps) {
  const [opening, setOpening] = useState(false);

  const handlePress = async () => {
    if (opening) {
      return;
    }
    setOpening(true);
    try {
      await openJoinKidsClubWeb({ email: emailHint });
    } finally {
      setOpening(false);
    }
  };

  return (
    <View>
      <Pressable
        testID={testID}
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={handlePress}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        disabled={opening}
      >
        {opening ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.buttonText}>{label}</Text>
        )}
      </Pressable>
      <Text style={styles.hint}>Manage your membership at passitup.com</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#5DBB8E',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  hint: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 12,
    color: '#999999',
  },
});
