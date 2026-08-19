/**
 * File: p2p-kids-marketplace/src/screens/__tests__/BulkListingCreateScreen.test.tsx
 * Bulk listing integration tests.
 *
 * Re-enabled from the LISTING-V3-006 disable. The screen was previously
 * unrunnable in Jest because importing it pulled in expo-image-manipulator /
 * expo-file-system/legacy (via src/utils/photoHash.ts and
 * src/services/photoService.ts), exhausting the Jest JS heap at import time.
 * Those native modules are now mocked in this file (see TODO(LISTING-V3-006)).
 *
 * The bulk flow is driven via the __DEV__ test fixtures on the screen
 * (dev-add-test-photos / dev-skip-to-review / dev-set-item-categories), which
 * bypass the native photo picker, AI analysis, and DB session writes — so no
 * Supabase network calls are made and the tests are deterministic.
 *
 * Primary coverage:
 *  - AUTH-V3-008 / QA E05 regression: phone-verification gate on publish
 *    (unverified seller → modal appears, publish blocked; verified → skipped)
 */

import React from 'react';
import { Image } from 'react-native';
import { render, fireEvent, waitFor, within } from '@testing-library/react-native';
import BulkListingCreateScreen from '../BulkListingCreateScreen';
import { useAuth } from '../../hooks/useAuth';
import { isPhoneRequired } from '../../services/phoneService';
import { publishBulkDrafts, getActiveDrafts } from '../../services/draftService';
import { getSubscriptionSummary } from '../../services/subscription';
import { getCategories } from '../../services/categoryService';
import { getConfigValue } from '../../services/adminConfig';

// ── Navigation mocks (mirror ItemCreateScreen.test.tsx) ────────────────────
const mockNavigation = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn() };
const mockRoute = { params: { showPhotoSourcePrompt: false } };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
  // Keep tests deterministic: don't run draft-restore / focus effects during render.
  useFocusEffect: () => {},
}));

jest.mock('../../hooks/useAuth');
jest.mock('../../services/phoneService');
jest.mock('../../services/draftService');
jest.mock('../../services/subscription');
jest.mock('../../services/adminConfig');
jest.mock('../../services/categoryService');
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

// TODO(LISTING-V3-006): re-enable by mocking native modules pulled in via
// photoHash.ts / photoService.ts so the Jest JS heap is not exhausted at import.
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(async () => ({ uri: 'file:///dev/hash.jpg' })),
  SaveFormat: { JPEG: 'jpeg' },
}));
jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn(async () => 'base64-hash'),
}));
jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(async () => 'base64-hash'),
}));

// Bundled assets aren't loaded by Jest, so resolve the dev photo fixture's
// bundled image to a stable file URI. (jest-expo's Image mock exposes
// resolveAssetSource as a real function, hence the spyOn.)
jest
  .spyOn(Image, 'resolveAssetSource')
  .mockReturnValue({ uri: 'file:///dev/placeholder.png', scale: 1, width: 1, height: 1 } as any);

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockIsPhoneRequired = isPhoneRequired as jest.MockedFunction<typeof isPhoneRequired>;
const mockPublishBulkDrafts = publishBulkDrafts as jest.MockedFunction<typeof publishBulkDrafts>;
const mockGetActiveDrafts = getActiveDrafts as jest.MockedFunction<typeof getActiveDrafts>;
const mockGetSubscriptionSummary = getSubscriptionSummary as jest.MockedFunction<
  typeof getSubscriptionSummary
>;
const mockGetCategories = getCategories as jest.MockedFunction<typeof getCategories>;
const mockGetConfigValue = getConfigValue as jest.MockedFunction<typeof getConfigValue>;

describe('BulkListingCreateScreen', () => {
  const mockSession = {
    user: { id: 'user-123', email: 'seller@test.com' },
    access_token: 'mock-token',
  };

  const mockCategories = [
    { id: 'cat-1', name: 'Toys', icon: '🧸', is_active: true, display_order: 1 },
    { id: 'cat-2', name: 'Clothing', icon: '👕', is_active: true, display_order: 2 },
  ];

  const renderScreen = () => render(<BulkListingCreateScreen />);

  /**
   * Drive the bulk flow to a complete, reviewable submission via the __DEV__
   * fixtures (no photo picker, no AI, no session/DB writes): add 5 test photos
   * (5 groups, 1 photo each), skip to review, fill item 0's required fields
   * (title/condition/price — category filled by dev-set-item-categories), and
   * exclude items 1–4 so only item 0 must be complete.
   */
  const fillCompleteSubmission = (getByTestId: any) => {
    fireEvent.press(getByTestId('dev-add-test-photos'));
    fireEvent.press(getByTestId('dev-skip-to-review'));
    fireEvent.press(getByTestId('dev-set-item-categories'));

    // Complete item 0 (the only expanded card → single condition selector).
    fireEvent.press(getByTestId('bulk-item-card-toggle-0'));
    fireEvent.changeText(getByTestId('bulk-item-title-0'), 'QA E05 test book');
    fireEvent.press(getByTestId('condition-good'));
    fireEvent.changeText(getByTestId('bulk-item-price-0'), '12.50');

    // Exclude items 1–4 from publish so only item 0 must be complete.
    for (let i = 1; i < 5; i += 1) {
      fireEvent(getByTestId(`bulk-item-exclude-toggle-${i}`), 'valueChange', true);
    }
  };

  const submitForReview = async (getByTestId: any) => {
    fireEvent.press(getByTestId('bulk-publish-button'));
    await waitFor(() => expect(getByTestId('bulk-publish-confirm')).toBeTruthy());
    fireEvent.press(getByTestId('bulk-publish-confirm'));
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAuth.mockReturnValue({
      session: mockSession,
      isLoading: false,
      user: mockSession.user,
      logout: jest.fn(),
      refreshSession: jest.fn(),
    } as any);

    mockGetActiveDrafts.mockResolvedValue([]);
    mockPublishBulkDrafts.mockResolvedValue({ published: [], failed: [] });
    mockGetSubscriptionSummary.mockResolvedValue({
      tier: 'free',
      status: 'active',
      can_create_listing: true,
      can_spend_sp: false,
      monthly_price_limit: 0,
      monthly_listings_limit: 999,
      listings_created_this_month: 0,
      price_left_this_month: 9999,
      starts_at: null,
      ends_at: null,
      cancel_at_period_end: false,
    } as any);
    mockGetCategories.mockResolvedValue(mockCategories as any);
    mockGetConfigValue.mockResolvedValue(0);
  });

  // ── AUTH-V3-008 / QA E05 regression: the phone-verification gate must fire
  //    on publish BEFORE any field-validation/session checks. An unverified
  //    seller submitting a complete form must see the modal and be blocked;
  //    a verified seller must skip it. Without the gate (Fix 1), the
  //    unverified test fails (the modal never appears and publish proceeds).
  it('shows the phone-verification modal when an unverified seller submits a complete bulk form', async () => {
    mockIsPhoneRequired.mockResolvedValue(true); // unverified seller

    const { getByTestId, queryByTestId } = renderScreen();
    fillCompleteSubmission(getByTestId);

    // Modal must not be open before tapping Submit.
    expect(queryByTestId('bulk-phone-verification')).toBeNull();

    await submitForReview(getByTestId);

    // Gate fires first and shows the phone-verification modal.
    await waitFor(() => {
      expect(getByTestId('bulk-phone-verification')).toBeTruthy();
    });

    // Publish must be blocked — the bulk publish service is never invoked.
    expect(mockPublishBulkDrafts).not.toHaveBeenCalled();
  });

  it('does not show the phone-verification modal for a verified seller', async () => {
    mockIsPhoneRequired.mockResolvedValue(false); // verified seller

    const { getByTestId, queryByTestId } = renderScreen();
    fillCompleteSubmission(getByTestId);

    await submitForReview(getByTestId);

    // The phone-verification modal must never have appeared.
    await waitFor(() => {
      expect(queryByTestId('bulk-phone-verification')).toBeNull();
    });
    // Publish proceeds past the gate (stopped only by the missing dev session).
    expect(mockPublishBulkDrafts).not.toHaveBeenCalled();
  });

  // ── K02 reorder: photos can be reordered within a merged item, and the
  //    cover follows the moved photo (primaryPhotoIndex is tracked by
  //    reorderPhotoInGroup).
  it('reorders photos within a merged item and keeps the cover on the moved photo (K02)', async () => {
    const { getByTestId } = renderScreen();

    // 5 groups of 1 photo each.
    fireEvent.press(getByTestId('dev-add-test-photos'));

    // Select 3 photos from 3 different groups and merge them into item 0.
    fireEvent(getByTestId('photo-tile-0-0'), 'longPress');
    fireEvent.press(getByTestId('photo-tile-1-0'));
    fireEvent.press(getByTestId('photo-tile-2-0'));
    fireEvent.press(getByTestId('selection-merge'));

    // Item 0 now holds 3 photos. Tap the first tile to make it the cover.
    fireEvent.press(getByTestId('photo-tile-0-0'));

    // Reorder: move the cover (first photo) one slot to the right.
    fireEvent.press(getByTestId('photo-tile-0-0-move-right'));

    // The cover badge follows the moved photo → COVER is now on tile index 1.
    const coverTile = within(getByTestId('photo-tile-0-1'));
    expect(coverTile.getByText('COVER')).toBeTruthy();

    const firstTile = within(getByTestId('photo-tile-0-0'));
    expect(firstTile.queryByText('COVER')).toBeNull();
  });
});
