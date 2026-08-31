/**
 * Unit Tests: GlobalAlertProvider
 *
 * Verifies the app's branded alert modal mechanism that Task 2 relies on:
 * - showAlert() renders a themed modal (not a native system alert)
 * - per-button testIDs are exposed to the accessibility tree
 * - primary buttons use the app's brand green (#5DBB8E)
 * - button onPress fires and the dialog dismisses
 * - the legacy Alert.alert() override routes remaining native calls through
 *   the same branded modal (so no screen renders an OS-default alert)
 */

import React from 'react';
import { Alert, Pressable, Text } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import GlobalAlertProvider, {
  useGlobalAlert,
  forceDismissAllGlobalAlerts,
  type BrandedAlertButton,
} from '@/providers/GlobalAlertProvider';
import { colors } from '@/theme';

type ShowAlertFn = (payload: {
  title: string;
  message?: string;
  buttons: BrandedAlertButton[];
}) => void;

/** Renders a single "trigger" pressable so tests fire showAlert via an interaction. */
function Harness({ trigger }: { trigger: (show: ShowAlertFn) => void }) {
  const { showAlert } = useGlobalAlert();
  return (
    <Pressable testID="alert-trigger" onPress={() => trigger(showAlert)}>
      <Text>Trigger</Text>
    </Pressable>
  );
}

describe('GlobalAlertProvider', () => {
  const renderWithProvider = (trigger: (show: ShowAlertFn) => void) =>
    render(
      <GlobalAlertProvider>
        <Harness trigger={trigger} />
      </GlobalAlertProvider>
    );

  it('renders a branded modal with title, message, and per-button testIDs', () => {
    const { getByTestId, getByText } = renderWithProvider((show) =>
      show({
        title: 'Invalid Referral Code',
        message:
          'The referral code you entered is invalid. Would you like to fix it or continue without a code?',
        buttons: [
          { text: 'Fix it', style: 'cancel', testID: 'referral-invalid-fix-it-button' },
          {
            text: 'Continue anyway',
            primary: true,
            testID: 'referral-invalid-continue-anyway-button',
          },
        ],
      })
    );

    fireEvent.press(getByTestId('alert-trigger'));

    expect(getByText('Invalid Referral Code')).toBeTruthy();
    expect(
      getByText(
        'The referral code you entered is invalid. Would you like to fix it or continue without a code?'
      )
    ).toBeTruthy();
    expect(getByTestId('referral-invalid-fix-it-button')).toBeTruthy();
    expect(getByTestId('referral-invalid-continue-anyway-button')).toBeTruthy();
  });

  it('exposes each alert button to the accessibility tree as a labeled button (mirrors ui/Button)', () => {
    const { getByTestId, getByRole } = renderWithProvider((show) =>
      show({
        title: 'Invalid Referral Code',
        message:
          'The referral code you entered is invalid. Would you like to fix it or continue without a code?',
        buttons: [
          { text: 'Fix it', style: 'cancel', testID: 'referral-invalid-fix-it-button' },
          {
            text: 'Continue anyway',
            primary: true,
            testID: 'referral-invalid-continue-anyway-button',
          },
        ],
      })
    );

    fireEvent.press(getByTestId('alert-trigger'));

    // Queryable by accessibility role + label, the same way the iOS
    // accessibility tree exposes native Button elements.
    expect(getByRole('button', { name: 'Fix it' })).toBeTruthy();
    expect(getByRole('button', { name: 'Continue anyway' })).toBeTruthy();

    // Companion props on the touchable so the identifier surfaces on iOS
    // (a bare testID alone is not exposed to the native tree).
    const fixIt = getByTestId('referral-invalid-fix-it-button');
    expect(fixIt.props.accessible).toBe(true);
    expect(fixIt.props.accessibilityRole).toBe('button');
    expect(fixIt.props.accessibilityLabel).toBe('Fix it');

    const continueAnyway = getByTestId('referral-invalid-continue-anyway-button');
    expect(continueAnyway.props.accessible).toBe(true);
    expect(continueAnyway.props.accessibilityRole).toBe('button');
    expect(continueAnyway.props.accessibilityLabel).toBe('Continue anyway');
  });

  it('styles the primary action with the app brand green (#5DBB8E)', () => {
    const { getByTestId } = renderWithProvider((show) =>
      show({
        title: 'Sorry',
        message: 'Sorry, you must be 18 years old to register.',
        buttons: [{ text: 'OK', primary: true, testID: 'age-gate-dialog-ok-button' }],
      })
    );

    fireEvent.press(getByTestId('alert-trigger'));

    expect(getByTestId('age-gate-dialog-ok-button')).toHaveStyle({
      backgroundColor: colors.primary[500],
    });
  });

  it('runs the button onPress callback and dismisses the dialog', async () => {
    const onPress = jest.fn();
    const { getByTestId, queryByText } = renderWithProvider((show) =>
      show({
        title: 'Success!',
        message: "Your phone number has been verified. Let's complete your profile!",
        buttons: [
          {
            text: 'Continue',
            primary: true,
            testID: 'otp-success-dialog-ok-button',
            onPress,
          },
        ],
      })
    );

    fireEvent.press(getByTestId('alert-trigger'));
    expect(getByTestId('otp-success-dialog-ok-button')).toBeTruthy();

    fireEvent.press(getByTestId('otp-success-dialog-ok-button'));

    await waitFor(() => expect(onPress).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(queryByText('Success!')).toBeNull());
  });

  it('routes legacy Alert.alert calls through the branded modal', () => {
    const { getByTestId, getByText } = renderWithProvider(() => undefined);

    act(() => {
      Alert.alert('Legacy Title', 'Legacy message', [{ text: 'OK', testID: 'legacy-ok-button' }]);
    });

    expect(getByText('Legacy Title')).toBeTruthy();
    expect(getByTestId('legacy-ok-button')).toBeTruthy();
  });

  // Dev Task 77 item 1: the module-scoped escape hatch the QA dev-clear-overlays
  // deep link calls. A stuck alert (e.g. "Offer Declined") that survives a persona
  // switch and blinds the AX tree must be clearable in one call, not by relaunch.
  it('forceDismissAllGlobalAlerts() clears every queued alert without firing onPress', () => {
    const onPress = jest.fn();
    const { getByTestId, queryByText } = renderWithProvider((show) =>
      show({
        title: 'Offer Declined',
        message: 'The buyer has been notified that their offer was declined.',
        buttons: [{ text: 'OK', onPress, testID: 'offer-declined-ok-button' }],
      })
    );

    // Queue TWO alerts (the second one sits behind the first in the queue).
    fireEvent.press(getByTestId('alert-trigger'));
    fireEvent.press(getByTestId('alert-trigger'));
    expect(queryByText('Offer Declined')).toBeTruthy();

    act(() => {
      expect(forceDismissAllGlobalAlerts()).toBe(true);
    });

    expect(queryByText('Offer Declined')).toBeNull();
    // No button onPress fired — a silent force-clear, never a "tap".
    expect(onPress).not.toHaveBeenCalled();
  });
});
