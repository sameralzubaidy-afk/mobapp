/**
 * File: p2p-kids-marketplace/src/components/molecules/DifferentSellerModal.tsx
 *
 * SELLER-GROUP-003: Shared Different-Seller Cart Conflict Modal
 *
 * SINGLE SOURCE OF COPY for the "different seller" cart-conflict dialog.
 * Used by both ItemDetailScreen and CartScreen to prevent seller-name leaks.
 *
 * The copy is generic and seller-agnostic:
 *   "Your trade basket already has items from a different seller."
 *
 * NEVER interpolates seller name, ID, or any PII into the message.
 */

import React from 'react';
import { Alert, AlertButton } from 'react-native';

export interface DifferentSellerModalOptions {
  /** Called when user chooses "Save & Start New Trade Basket" */
  onSaveAndStartNew: () => void;
  /** Called when user chooses "Replace Trade Basket" */
  onReplaceCart: () => void;
  /** Optional: called when user cancels */
  onCancel?: () => void;
}

/**
 * Show the different-seller cart conflict modal with generic, seller-agnostic copy.
 *
 * @example
 * showDifferentSellerModal({
 *   onSaveAndStartNew: async () => { ... },
 *   onReplaceCart: async () => { ... },
 *   onCancel: () => { ... },
 * });
 */
export function showDifferentSellerModal(options: DifferentSellerModalOptions): void {
  const { onSaveAndStartNew, onReplaceCart, onCancel } = options;

  const buttons: AlertButton[] = [
    {
      text: 'Save & Start New Trade Basket',
      onPress: onSaveAndStartNew,
    },
    {
      text: 'Replace Trade Basket',
      style: 'destructive',
      onPress: onReplaceCart,
    },
    { text: 'Cancel', style: 'cancel', onPress: onCancel },
  ];

  Alert.alert(
    'Different Seller',
    'Your trade basket already has items from a different seller. Adding this item will clear your current trade basket. What would you like to do?',
    buttons,
  );
}

/**
 * React component variant (for use inside JSX render).
 * Renders nothing — just calls showDifferentSellerModal via useEffect or callback.
 * Prefer the imperative `showDifferentSellerModal()` function.
 */
export default function DifferentSellerModal(_props: DifferentSellerModalOptions): null {
  return null;
}
