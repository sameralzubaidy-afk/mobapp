// File: p2p-kids-marketplace/src/screens/notifications/__tests__/NotificationSettingsScreen.test.tsx
// MODULE-15.1 FLOW-17: Unit tests for Notification Settings — Whisk Design System (per-category × per-channel)

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import NotificationSettingsScreen from '../NotificationSettingsScreen';

// Mock navigation
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
  }),
}));

describe('NotificationSettingsScreen - MODULE-15.1 FLOW-17', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Header ───────────────────────────────────────────────────────────────────
  describe('Header Elements (FLOW-17)', () => {
    it('renders back button', () => {
      const { getByTestId } = render(<NotificationSettingsScreen />);
      expect(getByTestId('back-button')).toBeTruthy();
    });

    it('navigates back when back button is pressed', () => {
      const { getByTestId } = render(<NotificationSettingsScreen />);
      fireEvent.press(getByTestId('back-button'));
      expect(mockGoBack).toHaveBeenCalledTimes(1);
    });

    it('renders screen title', () => {
      const { getByTestId, getByText } = render(<NotificationSettingsScreen />);
      expect(getByTestId('screen-title')).toBeTruthy();
      expect(getByText('Notification Settings')).toBeTruthy();
    });
  });

  // ─── Category sections ────────────────────────────────────────────────────────
  describe('Category Sections (FLOW-17)', () => {
    it('renders all 5 category sections', () => {
      const { getByTestId } = render(<NotificationSettingsScreen />);
      expect(getByTestId('category-section-subscription')).toBeTruthy();
      expect(getByTestId('category-section-trades')).toBeTruthy();
      expect(getByTestId('category-section-sp_events')).toBeTruthy();
      expect(getByTestId('category-section-badges')).toBeTruthy();
      expect(getByTestId('category-section-safety')).toBeTruthy();
    });

    it('renders all category labels', () => {
      const { getByText } = render(<NotificationSettingsScreen />);
      expect(getByText('Subscription & Membership')).toBeTruthy();
      expect(getByText('Trade Updates')).toBeTruthy();
      expect(getByText('Swap Points Events')).toBeTruthy();
      expect(getByText('Badges & Achievements')).toBeTruthy();
      expect(getByText('Safety Alerts')).toBeTruthy();
    });

    it('renders subtitle description text', () => {
      const { getByText } = render(<NotificationSettingsScreen />);
      expect(
        getByText(
          'Choose how you want to be notified for different types of activity in the marketplace.'
        )
      ).toBeTruthy();
    });
  });

  // ─── Channel rows ─────────────────────────────────────────────────────────────
  describe('Channel Toggle Rows (FLOW-17)', () => {
    const categories = ['subscription', 'trades', 'sp_events', 'badges', 'safety'];
    const channels = ['push', 'inApp', 'email'];

    it.each(categories.flatMap((cat) => channels.map((ch) => [cat, ch])))(
      'renders row %s-%s',
      (cat, ch) => {
        const { getByTestId } = render(<NotificationSettingsScreen />);
        expect(getByTestId(`setting-row-${cat}-${ch}`)).toBeTruthy();
      }
    );

    it('renders channel label texts', () => {
      const { getAllByText } = render(<NotificationSettingsScreen />);
      // Each label appears once per channel row (5 categories × each channel label)
      expect(getAllByText('Push Notifications').length).toBe(5);
      expect(getAllByText('In-App Notifications').length).toBe(5);
      expect(getAllByText('Email Notifications').length).toBe(5);
    });

    it('renders channel description texts', () => {
      const { getAllByText } = render(<NotificationSettingsScreen />);
      expect(getAllByText('Receive alerts on your device').length).toBe(5);
      expect(getAllByText('Show badges inside the app').length).toBe(5);
      expect(getAllByText('Send updates to your email').length).toBe(5);
    });
  });

  // ─── Switches ─────────────────────────────────────────────────────────────────
  describe('Switches — Whisk green #5DBB8E (FLOW-17)', () => {
    it('renders all switches with correct testIDs', () => {
      const { getByTestId } = render(<NotificationSettingsScreen />);
      const ids = ['subscription', 'trades', 'sp_events', 'badges', 'safety'];
      const channels = ['push', 'inApp', 'email'];
      ids.forEach((id) =>
        channels.forEach((ch) => expect(getByTestId(`switch-${id}-${ch}`)).toBeTruthy())
      );
    });

    it('subscription push switch defaults to true', () => {
      const { getByTestId } = render(<NotificationSettingsScreen />);
      expect(getByTestId('switch-subscription-push').props.value).toBe(true);
    });

    it('subscription email switch defaults to true', () => {
      const { getByTestId } = render(<NotificationSettingsScreen />);
      expect(getByTestId('switch-subscription-email').props.value).toBe(true);
    });

    it('trades email switch defaults to false', () => {
      const { getByTestId } = render(<NotificationSettingsScreen />);
      expect(getByTestId('switch-trades-email').props.value).toBe(false);
    });

    it('trades push switch defaults to true', () => {
      const { getByTestId } = render(<NotificationSettingsScreen />);
      expect(getByTestId('switch-trades-push').props.value).toBe(true);
    });

    it('sp_events email switch defaults to false', () => {
      const { getByTestId } = render(<NotificationSettingsScreen />);
      expect(getByTestId('switch-sp_events-email').props.value).toBe(false);
    });

    it('safety inApp switch defaults to false', () => {
      const { getByTestId } = render(<NotificationSettingsScreen />);
      expect(getByTestId('switch-safety-inApp').props.value).toBe(false);
    });

    it('safety push switch defaults to true', () => {
      const { getByTestId } = render(<NotificationSettingsScreen />);
      expect(getByTestId('switch-safety-push').props.value).toBe(true);
    });

    it('toggles trades-push switch off', () => {
      const { getByTestId } = render(<NotificationSettingsScreen />);
      const sw = getByTestId('switch-trades-push');
      expect(sw.props.value).toBe(true);
      fireEvent(sw, 'valueChange', false);
    });

    it('toggles trades-email switch on', () => {
      const { getByTestId } = render(<NotificationSettingsScreen />);
      const sw = getByTestId('switch-trades-email');
      expect(sw.props.value).toBe(false);
      fireEvent(sw, 'valueChange', true);
    });

    it('toggles sp_events-inApp switch', () => {
      const { getByTestId } = render(<NotificationSettingsScreen />);
      fireEvent(getByTestId('switch-sp_events-inApp'), 'valueChange', false);
    });

    it('toggles badges-push switch', () => {
      const { getByTestId } = render(<NotificationSettingsScreen />);
      fireEvent(getByTestId('switch-badges-push'), 'valueChange', false);
    });

    it('toggles safety-push switch', () => {
      const { getByTestId } = render(<NotificationSettingsScreen />);
      fireEvent(getByTestId('switch-safety-push'), 'valueChange', false);
    });
  });

  // ─── Safety note ──────────────────────────────────────────────────────────────
  describe('Safety Note Banner (FLOW-17)', () => {
    it('renders the critical safety note', () => {
      const { getByText } = render(<NotificationSettingsScreen />);
      expect(
        getByText(
          'Critical safety alerts (product recalls) are always delivered regardless of your preferences.'
        )
      ).toBeTruthy();
    });
  });

  // ─── Accessibility ────────────────────────────────────────────────────────────
  describe('Accessibility (FLOW-17)', () => {
    it('back button has correct accessibilityRole and label', () => {
      const { getByTestId } = render(<NotificationSettingsScreen />);
      const btn = getByTestId('back-button');
      expect(btn.props.accessibilityRole).toBe('button');
      expect(btn.props.accessibilityLabel).toBe('Go back');
    });
  });

  // ─── Whisk Design System ──────────────────────────────────────────────────────
  describe('Whisk Design System Compliance (FLOW-17)', () => {
    it('screen renders with Whisk structure', () => {
      const { getByTestId, getByText } = render(<NotificationSettingsScreen />);
      expect(getByTestId('notification-settings-screen')).toBeTruthy();
      expect(getByText('Notification Settings')).toBeTruthy();
    });
  });
});
