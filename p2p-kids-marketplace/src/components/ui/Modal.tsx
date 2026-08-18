// File: p2p-kids-marketplace/src/components/ui/Modal.tsx
// Design System: Modal Component (Alert & Bottom Sheet)
// Reference: Prompts/re-desing/design-system.md Section 6.4

import React from 'react';
import {
  Modal as RNModal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ModalProps as RNModalProps,
  ViewStyle,
} from 'react-native';
import { theme } from '@/theme';
import { Button } from './Button';

export type ModalType = 'alert' | 'bottomSheet';

interface ModalProps extends Omit<RNModalProps, 'children'> {
  type?: ModalType;
  title?: string;
  message?: string;
  children?: React.ReactNode;
  primaryButtonText?: string;
  secondaryButtonText?: string;
  onPrimaryPress?: () => void;
  onSecondaryPress?: () => void;
  onClose?: () => void;
  showCloseButton?: boolean;
  containerStyle?: ViewStyle;
  /** Optional accessibility identifier for the primary action button. */
  primaryButtonTestID?: string;
  /** Optional accessibility identifier for the secondary action button. */
  secondaryButtonTestID?: string;
}

export const Modal: React.FC<ModalProps> = ({
  type = 'alert',
  title,
  message,
  children,
  primaryButtonText,
  secondaryButtonText,
  onPrimaryPress,
  onSecondaryPress,
  onClose,
  showCloseButton = true,
  containerStyle,
  primaryButtonTestID,
  secondaryButtonTestID,
  ...props
}) => {
  const isBottomSheet = type === 'bottomSheet';

  return (
    <RNModal
      transparent
      animationType={isBottomSheet ? 'slide' : 'fade'}
      onRequestClose={onClose}
      {...props}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={styles.backdropTouchable}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            styles.container,
            isBottomSheet ? styles.bottomSheetContainer : styles.alertContainer,
            containerStyle,
          ]}
        >
          {isBottomSheet && <View style={styles.handle} />}

          {showCloseButton && !isBottomSheet && (
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          )}

          {title && <Text style={styles.title}>{title}</Text>}
          {message && <Text style={styles.message}>{message}</Text>}

          {children && <View style={styles.content}>{children}</View>}

          {(primaryButtonText || secondaryButtonText) && (
            <View style={styles.buttonContainer}>
              {primaryButtonText && (
                <Button
                  variant="primary"
                  size="medium"
                  onPress={onPrimaryPress}
                  style={styles.button}
                  testID={primaryButtonTestID}
                  // The primary action of a branded alert must ALWAYS render
                  // enabled/green (colors.primary[500]). Never pass `disabled`
                  // or `loading` here — a disabled primary button renders the
                  // gray neutral[300] style (Phase 17 QA: A05 'Signup Failed'
                  // dialog OK button observed gray in a stale bundle).
                  disabled={false}
                >
                  {primaryButtonText}
                </Button>
              )}
              {secondaryButtonText && (
                <Button
                  variant="text"
                  size="medium"
                  onPress={onSecondaryPress}
                  style={styles.button}
                  testID={secondaryButtonTestID}
                >
                  {secondaryButtonText}
                </Button>
              )}
            </View>
          )}
        </View>
      </View>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: theme.backgroundColors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },

  backdropTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  container: {
    backgroundColor: theme.backgroundColors.card,
    ...theme.shadows.level2,
  },

  alertContainer: {
    width: '90%',
    maxWidth: 400,
    borderRadius: theme.borderRadius.large,
    padding: theme.spacing.lg,
  },

  bottomSheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: theme.borderRadius.extraLarge,
    borderTopRightRadius: theme.borderRadius.extraLarge,
    padding: theme.spacing.lg,
    maxHeight: '90%',
  },

  handle: {
    width: 32,
    height: 4,
    backgroundColor: theme.colors.neutral[300],
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: theme.spacing.md,
  },

  closeButton: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },

  closeButtonText: {
    fontSize: 32,
    color: theme.colors.neutral[500],
    lineHeight: 32,
  },

  title: {
    ...theme.typography.h2,
    color: theme.textColors.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },

  message: {
    ...theme.typography.body,
    color: theme.textColors.secondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },

  content: {
    marginBottom: theme.spacing.lg,
  },

  buttonContainer: {
    gap: theme.spacing.sm,
  },

  button: {
    width: '100%',
  },
});
