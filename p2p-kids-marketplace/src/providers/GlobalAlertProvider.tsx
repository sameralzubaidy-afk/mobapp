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

type AlertPayload = {
  title: string;
  message?: string;
  buttons: AlertButton[];
  options?: AlertOptions;
};

type GlobalAlertProviderProps = {
  children: React.ReactNode;
};

function normalizeButtons(buttons?: AlertButton[]): AlertButton[] {
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

  React.useEffect(() => {
    const originalAlert = Alert.alert;

    const themedAlert: typeof Alert.alert = (title, message, buttons, options) => {
      setQueue((prev) => [
        ...prev,
        {
          title: title || '',
          message,
          buttons: normalizeButtons(buttons),
          options,
        },
      ]);
    };

    (Alert as any).alert = themedAlert;

    return () => {
      (Alert as any).alert = originalAlert;
    };
  }, []);

  const buttonCount = current?.buttons.length || 0;
  const useHorizontalActions = buttonCount > 0 && buttonCount <= 2;

  return (
    <>
      {children}

      <Modal
        visible={Boolean(current)}
        transparent
        animationType="fade"
        onRequestClose={handleDismissRequest}
      >
        <View style={styles.backdrop}>
          <View style={styles.card}>
            {current?.title ? <Text style={styles.title}>{current.title}</Text> : null}
            {current?.message ? <Text style={styles.message}>{current.message}</Text> : null}

            <View
              style={[styles.actions, useHorizontalActions ? styles.actionsRow : styles.actionsCol]}
            >
              {current?.buttons.map((button, index) => {
                const isDestructive = button.style === 'destructive';
                const isCancel = button.style === 'cancel';
                const isSinglePrimary = !isDestructive && !isCancel && buttonCount === 1;

                return (
                  <TouchableOpacity
                    key={`${button.text || 'button'}-${index}`}
                    style={[
                      styles.button,
                      useHorizontalActions ? styles.buttonRowItem : styles.buttonColItem,
                      isSinglePrimary && styles.buttonPrimary,
                      isCancel && styles.buttonCancel,
                      isDestructive && styles.buttonDanger,
                    ]}
                    onPress={() => handleButtonPress(button)}
                    testID={`global-alert-button-${index}`}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        isSinglePrimary && styles.buttonTextPrimary,
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
    </>
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
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  message: {
    marginTop: 8,
    marginBottom: 20,
    fontSize: 18,
    lineHeight: 24,
    color: '#6B6B6B',
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
    backgroundColor: '#F0F0F0',
  },
  buttonRowItem: {
    flex: 1,
  },
  buttonColItem: {
    width: '100%',
  },
  buttonPrimary: {
    backgroundColor: '#5DBB8E',
  },
  buttonCancel: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#6B6B6B',
  },
  buttonDanger: {
    backgroundColor: '#E85D75',
  },
  buttonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  buttonTextPrimary: {
    color: '#FFFFFF',
  },
  buttonTextCancel: {
    color: '#6B6B6B',
    fontWeight: '500',
  },
  buttonTextDanger: {
    color: '#FFFFFF',
  },
});
