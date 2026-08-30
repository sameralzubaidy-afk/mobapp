import React from 'react';
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type AlertButton,
  type AlertOptions,
} from 'react-native';
import { colors } from '@/theme';

/**
 * Alert button extended with accessibility + branding metadata the native
 * AlertButton type doesn't carry:
 * - `testID`: stable identifier exposed to the accessibility tree (native
 *   system alerts expose no identifiers — this is what QA automation needs).
 * - `primary`: renders the button with the app's primary brand green (#5DBB8E).
 */
export type BrandedAlertButton = AlertButton & {
  testID?: string;
  primary?: boolean;
};

type AlertPayload = {
  title: string;
  message?: string;
  buttons: BrandedAlertButton[];
  options?: AlertOptions;
};

type GlobalAlertContextValue = {
  /** Queue a branded modal alert (same shape as Alert.alert + testID/primary per button). */
  showAlert: (payload: AlertPayload) => void;
};

const GlobalAlertContext = React.createContext<GlobalAlertContextValue>({
  showAlert: () => {},
});

/**
 * Trigger the app's branded alert modal from any screen inside the provider
 * tree. Use this instead of the native Alert.alert() so dialogs match the
 * design system (primary green #5DBB8E / error #E85D75 / neutral tones) and
 * expose testIDs to the accessibility tree.
 */
export function useGlobalAlert(): GlobalAlertContextValue {
  return React.useContext(GlobalAlertContext);
}

type GlobalAlertProviderProps = {
  children: React.ReactNode;
};

function normalizeButtons(buttons?: BrandedAlertButton[]): BrandedAlertButton[] {
  if (!buttons || buttons.length === 0) {
    return [{ text: 'OK' }];
  }

  return buttons.map((button) => ({
    ...button,
    text: button.text || 'OK',
  }));
}

export default function GlobalAlertProvider({ children }: GlobalAlertProviderProps) {
  const [queue, setQueue] = React.useState<AlertPayload[]>([]);

  const current = queue[0] || null;

  const showAlert = React.useCallback((payload: AlertPayload) => {
    setQueue((prev) => [...prev, { ...payload, buttons: normalizeButtons(payload.buttons) }]);
  }, []);

  const dismissCurrent = React.useCallback(() => {
    setQueue((prev) => prev.slice(1));
  }, []);

  const handleButtonPress = React.useCallback(
    (button: AlertButton) => {
      dismissCurrent();

      if (button.onPress) {
        setTimeout(() => {
          button.onPress?.();
        }, 0);
      }
    },
    [dismissCurrent]
  );

  const handleDismissRequest = React.useCallback(() => {
    if (!current) {
      return;
    }

    if (current.options?.cancelable === false) {
      return;
    }

    const cancelButton = current.buttons.find((button) => button.style === 'cancel');

    if (cancelButton) {
      handleButtonPress(cancelButton);
      return;
    }

    dismissCurrent();
    current.options?.onDismiss?.();
  }, [current, dismissCurrent, handleButtonPress]);

  // Legacy fallback: route every remaining Alert.alert(...) call through the
  // same branded queue so nothing in the app renders a native system alert.
  // New code should call useGlobalAlert().showAlert(...) directly for explicit
  // per-button testIDs.
  React.useEffect(() => {
    const originalAlert = Alert.alert;

    const themedAlert: typeof Alert.alert = (title, message, buttons, options) => {
      // normalizeButtons guarantees a non-undefined BrandedAlertButton[], which
      // satisfies the optional `buttons` prop without a `| undefined` union.
      showAlert({
        title: title || '',
        message,
        buttons: normalizeButtons(buttons as BrandedAlertButton[] | undefined),
        options,
      });
    };

    (Alert as any).alert = themedAlert;

    return () => {
      (Alert as any).alert = originalAlert;
    };
  }, [showAlert]);

  const buttonCount = current?.buttons.length || 0;
  const useHorizontalActions = buttonCount > 0 && buttonCount <= 2;

  const contextValue = React.useMemo<GlobalAlertContextValue>(
    () => ({ showAlert }),
    [showAlert]
  );

  return (
    <GlobalAlertContext.Provider value={contextValue}>
      {children}

      <Modal
        visible={Boolean(current)}
        transparent
        animationType="fade"
        onRequestClose={handleDismissRequest}
        accessibilityViewIsModal
      >
        <View style={styles.backdrop}>
          <View style={styles.card} accessibilityRole="alert">
            {current?.title ? (
              <Text style={styles.title} accessibilityRole="header">
                {current.title}
              </Text>
            ) : null}
            {current?.message ? <Text style={styles.message}>{current.message}</Text> : null}

            <View
              style={[styles.actions, useHorizontalActions ? styles.actionsRow : styles.actionsCol]}
            >
              {current?.buttons.map((button, index) => {
                const isDestructive = button.style === 'destructive';
                const isCancel = button.style === 'cancel';
                const isSinglePrimary = !isDestructive && !isCancel && buttonCount === 1;
                const isPrimary = button.primary === true || isSinglePrimary;

                return (
                  <TouchableOpacity
                    key={`${button.text || 'button'}-${index}`}
                    style={[
                      styles.button,
                      useHorizontalActions ? styles.buttonRowItem : styles.buttonColItem,
                      isPrimary && styles.buttonPrimary,
                      isCancel && styles.buttonCancel,
                      isDestructive && styles.buttonDanger,
                    ]}
                    onPress={() => handleButtonPress(button)}
                    testID={button.testID || `global-alert-button-${index}`}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={button.text}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        isPrimary && styles.buttonTextPrimary,
                        isCancel && styles.buttonTextCancel,
                        isDestructive && styles.buttonTextDanger,
                      ]}
                    >
                      {button.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </GlobalAlertContext.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 26, 26, 0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.neutral.white,
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  message: {
    marginTop: 8,
    marginBottom: 20,
    fontSize: 18,
    lineHeight: 24,
    color: colors.neutral[700],
  },
  actions: {
    width: '100%',
    gap: 10,
  },
  actionsRow: {
    flexDirection: 'row',
  },
  actionsCol: {
    flexDirection: 'column',
  },
  button: {
    minHeight: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[100],
  },
  buttonRowItem: {
    flex: 1,
  },
  buttonColItem: {
    width: '100%',
  },
  buttonPrimary: {
    backgroundColor: colors.primary[500],
  },
  buttonCancel: {
    backgroundColor: colors.neutral.white,
    borderWidth: 1,
    borderColor: colors.neutral[700],
  },
  buttonDanger: {
    backgroundColor: colors.error[500],
  },
  buttonText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.neutral[900],
  },
  buttonTextPrimary: {
    color: colors.neutral.white,
  },
  buttonTextCancel: {
    color: colors.neutral[700],
    fontWeight: '500',
  },
  buttonTextDanger: {
    color: colors.neutral.white,
  },
});
