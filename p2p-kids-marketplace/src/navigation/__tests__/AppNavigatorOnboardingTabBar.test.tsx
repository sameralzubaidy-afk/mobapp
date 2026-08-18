// FILE: p2p-kids-marketplace/src/navigation/__tests__/AppNavigatorOnboardingTabBar.test.tsx
// MODULE-18 EDU-004 REGRESSION: The Onboarding screen must flip the root-level
// onboarding gate through the REAL AppNavigator wiring so the PersistentTabBar
// mounts immediately after Skip / Get Started — WITHOUT a relaunch.
//
// Why this file exists:
// OnboardingScreen.test.tsx mocks `useRoute` and injects the
// `onOnboardingFinished` param directly, so it can never catch a missing
// `initialParams` on the Onboarding Stack.Screen in AppNavigator.tsx. That is
// exactly how this bug escaped: the wiring was lost from the working tree and
// every existing test still passed. This suite renders the REAL RootNavigator
// (and the REAL OnboardingScreen) so the child->parent gate-flip is exercised
// end-to-end. If the `initialParams` wiring is removed again, the tab bar
// never mounts and these tests fail.

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { RootNavigator } from '../AppNavigator';
import { AuthContext } from '../../contexts/AuthContext';
import * as educationAnalyticsService from '../../services/educationAnalyticsService';

// ── Mocks ────────────────────────────────────────────────────────────────────
//
// Mock the analytics service used BOTH by RootNavigator's dynamic import
// (shouldShowOnboarding) AND by OnboardingScreen (markOnboardingSkipped /
// markOnboardingComplete / trackEducationEvent).
jest.mock('../../services/educationAnalyticsService');

// Mock the carousel so the REAL OnboardingScreen handlers (handleSkip /
// handleComplete) are driven from the rendered test tree, mirroring how the
// on-device flow works. We keep a reference to the captured props so the
// "Get Started" path can also be driven directly.
let mockCarouselProps: { onComplete: () => void; onSkip: () => void } | undefined;
jest.mock('../../components/onboarding/OnboardingCarousel', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return function MockOnboardingCarousel(props: any) {
    mockCarouselProps = props;
    return React.createElement(
      Pressable,
      { testID: 'onboarding-skip-button', onPress: props.onSkip },
      React.createElement(Text, null, 'Skip')
    );
  };
});

// HomeTabNavigator is not under test here (the gate flip is). Stub it so the
// post-Skip navigation to 'Home' stays light and deterministic.
jest.mock('../HomeTabNavigator', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    HomeTabNavigator: () =>
      React.createElement(
        View,
        { testID: 'home-tab-stub' },
        React.createElement(Text, null, 'Home')
      ),
    default: () => null,
  };
});

// Phosphor icons render via react-native-svg; stub them for the REAL
// PersistentTabBar so it renders in the test environment.
jest.mock('phosphor-react-native', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const MockIcon = () => React.createElement(Text, null, '•');
  return {
    House: MockIcon,
    MagnifyingGlass: MockIcon,
    Tag: MockIcon,
    Receipt: MockIcon,
    ShoppingCart: MockIcon,
    Package: MockIcon,
  };
});

// Expo native modules referenced across the AppNavigator screen graph — stub
// them so module-level imports don't touch native runtimes.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { appOwnership: 'expo', expoConfig: null },
  appOwnership: 'expo',
  expoConfig: null,
}));
jest.mock('expo-linking', () => {
  const createURL = () => 'p2pkidsmarketplace://';
  const openURL = jest.fn();
  return {
    __esModule: true,
    default: { createURL, openURL },
    createURL,
    openURL,
  };
});
jest.mock('expo-notifications', () => {
  const setNotificationHandler = jest.fn();
  const addNotificationResponseReceivedListener = () => ({ remove: jest.fn() });
  const getLastNotificationResponseAsync = async () => null;
  const getExpoPushTokenAsync = async () => ({ data: 'test-push-token' });
  const requestPermissionsAsync = async () => ({ status: 'granted' });
  return {
    __esModule: true,
    default: {
      setNotificationHandler,
      addNotificationResponseReceivedListener,
      getLastNotificationResponseAsync,
      getExpoPushTokenAsync,
      requestPermissionsAsync,
    },
    setNotificationHandler,
    addNotificationResponseReceivedListener,
    getLastNotificationResponseAsync,
    getExpoPushTokenAsync,
    requestPermissionsAsync,
  };
});
jest.mock('expo-image-picker', () => ({
  __esModule: true,
  default: {
    requestMediaLibraryPermissionsAsync: async () => ({ status: 'granted' }),
    requestCameraPermissionsAsync: async () => ({ status: 'granted' }),
    launchImageLibraryAsync: async () => ({ canceled: true, assets: [] }),
    launchCameraAsync: async () => ({ canceled: true, assets: [] }),
    MediaTypeOptions: { Images: 'Images' },
  },
  MediaTypeOptions: { Images: 'Images' },
}));
jest.mock('expo-secure-store', () => {
  const getItemAsync = async () => null;
  const setItemAsync = async () => undefined;
  const deleteItemAsync = async () => undefined;
  return {
    __esModule: true,
    default: { getItemAsync, setItemAsync, deleteItemAsync },
    getItemAsync,
    setItemAsync,
    deleteItemAsync,
  };
});
jest.mock('expo-crypto', () => {
  const randomUUID = () => '00000000-0000-0000-0000-000000000000';
  const getRandomBytesAsync = async () => new Uint8Array(16);
  return {
    __esModule: true,
    default: { randomUUID, getRandomBytesAsync },
    randomUUID,
    getRandomBytesAsync,
  };
});
jest.mock('expo-device', () => ({
  __esModule: true,
  default: { isDevice: false, osName: 'ios', osVersion: '17.0' },
  isDevice: false,
  osName: 'ios',
  osVersion: '17.0',
}));
jest.mock('expo-clipboard', () => {
  const getStringAsync = async () => '';
  const setString = jest.fn();
  return {
    __esModule: true,
    default: { getStringAsync, setString },
    getStringAsync,
    setString,
  };
});
jest.mock('expo-auth-session', () => {
  const makeRedirectUri = () => 'p2pkidsmarketplace://oauth';
  const loadAsync = async () => ({});
  return {
    __esModule: true,
    default: { makeRedirectUri, loadAsync },
    makeRedirectUri,
    loadAsync,
  };
});
jest.mock('expo-image-manipulator', () => {
  const manipulateAsync = async (uri: string) => ({ uri });
  return {
    __esModule: true,
    default: { manipulateAsync },
    manipulateAsync,
  };
});
jest.mock('expo-web-browser', () => {
  const openBrowserAsync = jest.fn();
  const openAuthSessionAsync = jest.fn();
  const maybeCompleteAuthSession = jest.fn();
  const dismissBrowser = jest.fn();
  return {
    __esModule: true,
    default: { openBrowserAsync, openAuthSessionAsync, maybeCompleteAuthSession, dismissBrowser },
    openBrowserAsync,
    openAuthSessionAsync,
    maybeCompleteAuthSession,
    dismissBrowser,
  };
});

// Stripe native SDK has module-level TurboModule side effects; several screens
// in the AppNavigator graph import it at module scope, so stub it explicitly.
jest.mock('@stripe/stripe-react-native', () => {
  const { fn } = require('jest-mock');
  return {
    __esModule: true,
    useStripe: fn(() => ({
      retrieveSetupIntent: fn(async () => ({
        setupIntent: { paymentMethodId: 'pm_test_default' },
        error: null,
      })),
    })),
    initPaymentSheet: fn(async () => ({ error: null })),
    presentPaymentSheet: fn(async () => ({ error: null })),
    PaymentSheetError: {},
  };
});

// ── Fixtures ─────────────────────────────────────────────────────────────────

const TAB_TEST_IDS = ['tab-home', 'tab-discover', 'tab-sell', 'tab-trades', 'tab-trade-basket'];

// An authenticated session so RootNavigator renders the dashboard stack with
// the first-run onboarding carousel gated on.
const mockSession = {
  user: {
    id: 'test-user-123',
    user_id: 'test-user-123',
    email: 'test@example.com',
    account_status: 'active',
  },
  subscription_status: 'active',
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_at: 4102444800,
};

const mockAuthContextValue = {
  session: mockSession,
  isLoading: false,
  refreshSession: jest.fn(),
};

const mockShouldShowOnboarding =
  educationAnalyticsService.shouldShowOnboarding as jest.Mock;
const mockMarkOnboardingSkipped =
  educationAnalyticsService.markOnboardingSkipped as jest.Mock;
const mockMarkOnboardingComplete =
  educationAnalyticsService.markOnboardingComplete as jest.Mock;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function renderRootNavigator() {
  const utils = render(
    <AuthContext.Provider value={mockAuthContextValue as any}>
      <RootNavigator />
    </AuthContext.Provider>
  );

  // Wait until the onboarding check resolves and the REAL OnboardingScreen
  // mounts (the carousel mock captures its onSkip/onComplete props).
  await waitFor(() => expect(mockCarouselProps).toBeDefined());

  return utils;
}

function expectAllTabsPresent(query: (id: string) => any) {
  for (const id of TAB_TEST_IDS) {
    expect(query(id)).toBeTruthy();
  }
}

function expectNoTabsPresent(query: (id: string) => any) {
  for (const id of TAB_TEST_IDS) {
    expect(query(id)).toBeNull();
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AppNavigator onboarding → tab-bar wiring (real RootNavigator)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockShouldShowOnboarding.mockResolvedValue(true);
    mockMarkOnboardingSkipped.mockResolvedValue(true);
    mockMarkOnboardingComplete.mockResolvedValue(true);
    mockCarouselProps = undefined;
  });

  it('keeps the tab bar hidden while the onboarding carousel is showing', async () => {
    const { queryByTestId } = await renderRootNavigator();

    // The floating pill must NOT overlap the first-run carousel.
    expectNoTabsPresent(queryByTestId);
  });

  it('mounts all five tab-bar items after Skip — no relaunch — via the real initialParams wiring', async () => {
    const { getByTestId, queryByTestId } = await renderRootNavigator();

    expectNoTabsPresent(queryByTestId);

    // Tap Skip → the REAL handleSkip runs: markOnboardingSkipped →
    // navigateToHome() → navigation.replace('Home') + route.params
    // .onOnboardingFinished() (wired by AppNavigator's initialParams) →
    // PersistentTabBar mounts.
    fireEvent.press(getByTestId('onboarding-skip-button'));

    await waitFor(() => {
      expectAllTabsPresent(getByTestId);
    });

    expect(mockMarkOnboardingSkipped).toHaveBeenCalledWith('test-user-123');
  });

  it('mounts all five tab-bar items after Get Started (complete path) — no relaunch', async () => {
    const { getByTestId, queryByTestId } = await renderRootNavigator();

    expectNoTabsPresent(queryByTestId);

    // Drive the REAL handleComplete through the captured carousel props.
    await mockCarouselProps!.onComplete();

    await waitFor(() => {
      expectAllTabsPresent(getByTestId);
    });

    expect(mockMarkOnboardingComplete).toHaveBeenCalledWith('test-user-123');
  });
});
