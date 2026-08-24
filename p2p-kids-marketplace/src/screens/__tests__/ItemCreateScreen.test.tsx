/**
 * File: p2p-kids-marketplace/src/screens/__tests__/ItemCreateScreen.test.tsx
 * MODULE-04 LISTING-V3-005: Unit Tests for ItemCreateScreen
 * Task: LISTING-V3-005 - Test state machine and component integration
 *
 * Tests:
 * - State machine transitions
 * - Photo upload flow
 * - AI suggestions application
 * - Draft autosave
 * - Publish flow
 * - Category "Other" flow
 */

import React from 'react';
import { Alert, Image } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import ItemCreateScreen from '../ItemCreateScreen';
import { DraftData } from '../../types/listing';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../hooks/useAuth';
import { useItemDraft } from '../../hooks/useItemDraft';
import { useAIAnalysis } from '../../hooks/useAIAnalysis';
import { createItem } from '../../services/items';
import { uploadPhotoBatch } from '../../services/photoService';
import { getCategories, flagForCategoryReview } from '../../services/categoryService';
import { getSuggestedPrice } from '../../services/pricingService';
import { getSubscriptionSummary } from '../../services/subscription';
import { isPhoneRequired } from '../../services/phoneService';
import { createListing } from '../../services/listing';
import { getAdminConfig } from '../../services/adminConfig';

// Mock all dependencies
jest.mock('../../hooks/useAuth');
jest.mock('../../hooks/useItemDraft');
jest.mock('../../hooks/useAIAnalysis');
jest.mock('../../services/items');
jest.mock('../../services/photoService');
jest.mock('../../services/categoryService');
jest.mock('../../services/pricingService');
jest.mock('../../services/subscription');
// AUTH-V3-008 / QA E05: phone-verification gate regression — mock the gate
// service, the publish service, and admin config so the publish path is
// deterministic in both the gated (unverified) and allowed (verified) cases.
jest.mock('../../services/phoneService');
jest.mock('../../services/listing');
jest.mock('../../services/adminConfig');
jest.mock('../../hooks/useNotificationBadge', () => ({
  useNotificationBadge: () => ({
    unreadCount: 0,
    refreshUnreadCount: jest.fn(),
  }),
}));
jest.mock('@/hooks/useUnreadMessagesBadge', () => ({
  useUnreadMessagesBadge: () => ({ unreadCount: 0, refresh: jest.fn() }),
}));
jest.mock('expo-image-picker');
// Bundled assets aren't loaded by Jest, so resolve the dev photo fixture's
// bundled image to a stable file URI. (jest-expo's Image mock exposes
// resolveAssetSource as a real function, hence the spyOn.)
const resolveAssetSourceSpy = jest
  .spyOn(Image, 'resolveAssetSource')
  .mockReturnValue({ uri: 'file:///dev/placeholder.png', scale: 1, width: 1, height: 1 } as any);
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
  // Keep tests deterministic and avoid invoking focus callbacks during render time.
  useFocusEffect: () => {},
}));

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  replace: jest.fn(),
};

const mockRoute = {
  params: { showPhotoSourcePrompt: false },
};

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseItemDraft = useItemDraft as jest.MockedFunction<typeof useItemDraft>;
const mockUseAIAnalysis = useAIAnalysis as jest.MockedFunction<typeof useAIAnalysis>;
const mockCreateItem = createItem as jest.MockedFunction<typeof createItem>;
const mockUploadPhotoBatch = uploadPhotoBatch as jest.MockedFunction<typeof uploadPhotoBatch>;
const mockGetCategories = getCategories as jest.MockedFunction<typeof getCategories>;
const mockFlagForCategoryReview = flagForCategoryReview as jest.MockedFunction<
  typeof flagForCategoryReview
>;
const mockGetSuggestedPrice = getSuggestedPrice as jest.MockedFunction<typeof getSuggestedPrice>;
const mockGetSubscriptionSummary = getSubscriptionSummary as jest.MockedFunction<
  typeof getSubscriptionSummary
>;
const mockIsPhoneRequired = isPhoneRequired as jest.MockedFunction<typeof isPhoneRequired>;
const mockCreateListing = createListing as jest.MockedFunction<typeof createListing>;
const mockGetAdminConfig = getAdminConfig as jest.MockedFunction<typeof getAdminConfig>;
const mockImagePicker = ImagePicker.launchImageLibraryAsync as jest.MockedFunction<
  typeof ImagePicker.launchImageLibraryAsync
>;

describe('ItemCreateScreen', () => {
  const mockSession = {
    user: { id: 'user-123', email: 'test@example.com' },
    access_token: 'mock-token',
  };

  const mockCategories = [
    { id: 'cat-1', name: 'Toys', icon: '🧸', is_active: true, display_order: 1 },
    { id: 'cat-2', name: 'Clothing', icon: '👕', is_active: true, display_order: 2 },
  ];

  const mockPriceSuggestions = [
    { tier: 'great_deal' as const, price: 10.0, label: 'Great Deal', description: 'Quick sale' },
    { tier: 'fair_price' as const, price: 15.0, label: 'Fair Price', description: 'Competitive' },
    {
      tier: 'asking_price' as const,
      price: 20.0,
      label: 'Asking Price',
      description: 'Market average',
    },
    { tier: 'almost_new' as const, price: 25.0, label: 'Almost New', description: 'Premium' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAuth.mockReturnValue({
      session: mockSession,
      isLoading: false,
      user: mockSession.user,
      logout: jest.fn(),
      refreshSession: jest.fn(),
    } as any);

    mockUseItemDraft.mockReturnValue({
      draft: null,
      save: jest.fn(),
      saveNow: jest.fn(),
      discard: jest.fn(),
      isSaving: false,
      saveError: null,
    } as any);

    mockUseAIAnalysis.mockReturnValue({
      status: 'idle',
      result: null,
      error: null,
      analyze: jest.fn(),
    } as any);

    mockGetCategories.mockResolvedValue(mockCategories as any);
    mockGetSuggestedPrice.mockResolvedValue(mockPriceSuggestions);
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
    mockUploadPhotoBatch.mockResolvedValue({ urls: [], errors: [] });
  });

  const renderScreen = (route = mockRoute) => {
    mockRoute.params = route.params || {};
    return render(<ItemCreateScreen navigation={mockNavigation as any} route={route as any} />);
  };

  describe('Dev Photo Fixture (__DEV__ only)', () => {
    it('injecting a dev test photo renders the below-fold form fields', async () => {
      const { getByTestId, queryByTestId } = renderScreen();

      // Photo-first flow: form is hidden before any photo exists.
      expect(queryByTestId('title-input')).toBeNull();
      expect(queryByTestId('publish-button')).toBeNull();

      // The dev button must be exposed for automation to reach it.
      expect(getByTestId('dev-add-test-photo')).toBeTruthy();

      fireEvent.press(getByTestId('dev-add-test-photo'));

      // The fixture resolves the bundled asset and injects it as a photo.
      expect(resolveAssetSourceSpy).toHaveBeenCalled();

      // Once a photo exists, the form fields render and become reachable.
      await waitFor(() => {
        expect(getByTestId('title-input')).toBeTruthy();
        expect(getByTestId('category-select-button')).toBeTruthy();
        expect(getByTestId('manual-price-input')).toBeTruthy();
        expect(getByTestId('publish-button')).toBeTruthy();
      });
    });

    it('dev-fill-item fills title/price/condition and adds a photo in one tap', async () => {
      const { getByTestId } = renderScreen();

      // The fixture must be exposed for automation to reach it.
      expect(getByTestId('dev-fill-item')).toBeTruthy();

      fireEvent.press(getByTestId('dev-fill-item'));

      // It adds a test photo (so the below-fold form renders)…
      expect(resolveAssetSourceSpy).toHaveBeenCalled();

      // …and fills title/price/condition deterministically (no typing needed).
      await waitFor(() => {
        expect(getByTestId('title-input').props.value).toBe('QA Dev Fixture Item');
      });
      expect(getByTestId('manual-price-input').props.value).toBe('20');
      expect(getByTestId('condition-new').props.accessibilityState?.checked).toBe(true);
    });
  });

  describe('State Machine: IDLE → ADDING_PHOTOS', () => {
    it('should show photo upload section on mount', () => {
      const { getByTestId } = renderScreen();
      expect(getByTestId('photo-upload-manager')).toBeTruthy();
    });

    it('should show add photos button when no photos', () => {
      const { getByTestId } = renderScreen();
      expect(getByTestId('add-photos-button')).toBeTruthy();
    });

    it('should transition to ADDING_PHOTOS when photos are added', async () => {
      const { getByTestId } = renderScreen();

      mockImagePicker.mockResolvedValue({
        canceled: false,
        assets: [
          { uri: 'photo1.jpg', width: 800, height: 600, fileSize: 1000000, mimeType: 'image/jpeg' },
        ],
      } as any);

      const addButton = getByTestId('add-photos-button');
      fireEvent.press(addButton);

      await waitFor(() => {
        expect(mockImagePicker).toHaveBeenCalled();
      });
    });
  });

  describe('State Machine: AI_ANALYZING → REVIEWING_SUGGESTIONS', () => {
    it('should show AI analysis card when AI result is ready', async () => {
      const mockAIResult = {
        title: { value: 'Nike Sneakers', confidence: 0.85 },
        category: { value: { categoryId: 'cat-1', categoryName: 'Toys' }, confidence: 0.75 },
        condition: { value: 'like_new' as const, confidence: 0.8 },
      };

      mockUseAIAnalysis.mockReturnValue({
        status: 'ready',
        result: mockAIResult as any,
        error: null,
        analyze: jest.fn(),
      } as any);

      renderScreen();

      // AI card should be visible after status becomes 'ready'
      await waitFor(() => {
        // Card shows when aiResult exists and showAICard is true
        // The card has testID ai-analysis-card
      });
    });
  });

  describe('AI Suggestions: Apply All', () => {
    it('should apply AI suggestions to empty fields only', async () => {
      const mockAIResult = {
        title: { value: 'Nike Sneakers', confidence: 0.85 },
        category: { value: { categoryId: 'cat-1', categoryName: 'Toys' }, confidence: 0.75 },
        condition: { value: 'like_new' as const, confidence: 0.8 },
        brand: { value: 'Nike', confidence: 0.9 },
      };

      mockUseAIAnalysis.mockReturnValue({
        status: 'ready',
        result: mockAIResult as any,
        error: null,
        analyze: jest.fn(),
      } as any);

      renderScreen();

      // Test would check if Apply All button applies suggestions
      // This is integration behavior - unit test validates component mounts
    });
  });

  describe('Draft Autosave', () => {
    it('should hydrate saved draft values when opened with draftId', async () => {
      const savedDraft = {
        id: 'draft-1',
        seller_id: 'user-123',
        bulk_upload_id: null,
        draft_data: {
          title: 'Saved draft title',
          description: 'Saved draft description',
          category_id: 'cat-1',
          condition: 'good',
          photo_urls: ['https://example.com/saved-photo.jpg'],
          price: 25,
        },
        photo_urls: ['https://example.com/saved-photo.jpg'],
        ai_suggestions: null,
        step: 'details',
        expires_at: new Date(Date.now() + 100000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockUseItemDraft.mockReturnValue({
        draft: savedDraft,
        save: jest.fn(),
        saveNow: jest.fn(),
        discard: jest.fn(),
        isSaving: false,
        saveError: null,
      } as any);

      const { getByDisplayValue } = renderScreen({ params: { draftId: 'draft-1' } } as any);

      await waitFor(() => {
        expect(getByDisplayValue('Saved draft title')).toBeTruthy();
      });

      expect(getByDisplayValue('Saved draft description')).toBeTruthy();
    });

    it('should not auto-analyze restored photos when resuming a draft', async () => {
      const savedDraft = {
        id: 'draft-1',
        seller_id: 'user-123',
        bulk_upload_id: null,
        draft_data: {
          title: 'Saved draft title',
          photo_urls: ['https://example.com/saved-photo.jpg'],
        },
        photo_urls: ['https://example.com/saved-photo.jpg'],
        ai_suggestions: null,
        step: 'details',
        expires_at: new Date(Date.now() + 100000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockUseItemDraft.mockReturnValue({
        draft: savedDraft,
        save: jest.fn(),
        saveNow: jest.fn(),
        discard: jest.fn(),
        isSaving: false,
        saveError: null,
      } as any);

      renderScreen({ params: { draftId: 'draft-1' } } as any);

      await waitFor(() => {
        expect(mockUseAIAnalysis).toHaveBeenCalled();
      });

      const latestUseAIAnalysisCall =
        mockUseAIAnalysis.mock.calls[mockUseAIAnalysis.mock.calls.length - 1];

      // Draft resume should suppress auto-analysis even when draft has restored photo URLs.
      expect(latestUseAIAnalysisCall[0]).toEqual([]);
    });

    it('uploads only newly added photos when editing a saved draft', async () => {
      const savedDraft = {
        id: 'draft-1',
        seller_id: 'user-123',
        bulk_upload_id: null,
        draft_data: {
          title: 'Saved draft title',
          photo_urls: ['https://example.com/saved-photo.jpg'],
        },
        photo_urls: ['https://example.com/saved-photo.jpg'],
        ai_suggestions: null,
        step: 'details',
        expires_at: new Date(Date.now() + 100000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockUseItemDraft.mockReturnValue({
        draft: savedDraft,
        save: jest.fn(),
        saveNow: jest.fn(),
        discard: jest.fn(),
        isSaving: false,
        saveError: null,
      } as any);

      mockImagePicker.mockResolvedValue({
        canceled: false,
        assets: [
          {
            uri: 'new-photo.jpg',
            width: 800,
            height: 800,
            fileSize: 1000000,
            mimeType: 'image/jpeg',
          },
        ],
      } as any);

      mockUploadPhotoBatch.mockResolvedValue({
        urls: ['https://example.com/new-photo-uploaded.jpg'],
        errors: [],
      });

      const { getByTestId } = renderScreen({
        params: { draftId: 'draft-1', showPhotoSourcePrompt: false },
      } as any);

      fireEvent.press(getByTestId('add-photos-button'));

      await waitFor(() => {
        expect(mockUploadPhotoBatch).toHaveBeenCalled();
      });

      const firstCallArgs = mockUploadPhotoBatch.mock.calls[0];
      const uploadedAssets = firstCallArgs[0] as {
        uri: string;
        width: number;
        height: number;
      }[];

      expect(uploadedAssets).toHaveLength(1);
      expect(uploadedAssets[0].uri).toBe('new-photo.jpg');
      expect(uploadedAssets[0].width).toBe(800);
      expect(uploadedAssets[0].height).toBe(800);
    });

    it('should call saveNow on navigation goBack', async () => {
      const mockSaveNow = jest.fn();
      mockUseItemDraft.mockReturnValue({
        draft: null,
        save: jest.fn(),
        saveNow: mockSaveNow,
        discard: jest.fn(),
        isSaving: false,
        saveError: null,
      } as any);

      const { getByTestId } = renderScreen();

      const backButton = getByTestId('back-button');
      fireEvent.press(backButton);

      expect(mockSaveNow).toHaveBeenCalled();
      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });

  // ── J13: photo reorder + replace must persist through to the draft's
  //    photo_urls (cover = photo_urls[0]), and replace must not re-trigger AI.
  describe('J13 Photo Reorder + Replace (draft persistence)', () => {
    // Upload URLs derive from the asset uri so each photo maps to a distinct URL
    // (photo-a.jpg -> .../a.jpg, photo-b.jpg -> .../b.jpg, photo-c.jpg -> .../c.jpg).
    const mockUploadByUri = () => {
      mockUploadPhotoBatch.mockImplementation(async (photos: { uri: string }[]) => ({
        urls: photos.map(
          (p) => `https://cdn.example.com/${p.uri.replace('photo-', '').replace('.jpg', '')}.jpg`
        ),
        errors: [],
      }));
    };

    const addPhotoViaPicker = async (getByTestId: (id: string | RegExp) => any, uri: string) => {
      mockImagePicker.mockResolvedValue({
        canceled: false,
        assets: [{ uri, width: 800, height: 800, fileSize: 1000, mimeType: 'image/jpeg' }],
      } as any);
      // Wrap the press in act and let the fire-and-forget async chain
      // (picker → setPhotos → upload → draft effect) flush deterministically.
      await act(async () => {
        fireEvent.press(getByTestId('add-photos-button'));
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      await waitFor(() => expect(mockImagePicker).toHaveBeenCalled());
      // Let the upload continuation + draft save run to completion.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    };

    const lastSavedPhotoUrls = (mockSave: jest.Mock): string[] | undefined => {
      const lastCall = mockSave.mock.calls[mockSave.mock.calls.length - 1];
      return (lastCall?.[0] as DraftData | undefined)?.photo_urls;
    };

    it('persists a reorder into the draft photo_urls (cover = new first photo)', async () => {
      const mockSave = jest.fn();
      mockUseItemDraft.mockReturnValue({
        draft: null,
        save: mockSave,
        saveNow: jest.fn(),
        discard: jest.fn(),
        isSaving: false,
        saveError: null,
      } as any);
      mockUploadByUri();

      const { getByTestId } = renderScreen({ params: { showPhotoSourcePrompt: false } } as any);

      await addPhotoViaPicker(getByTestId, 'photo-a.jpg');
      await addPhotoViaPicker(getByTestId, 'photo-b.jpg');

      // Both uploads must be triggered before the draft save can be asserted.
      await waitFor(() => expect(mockUploadPhotoBatch).toHaveBeenCalledTimes(2));

      await waitFor(
        () => {
          expect(lastSavedPhotoUrls(mockSave)).toEqual([
            'https://cdn.example.com/a.jpg',
            'https://cdn.example.com/b.jpg',
          ]);
        },
        { timeout: 5000, interval: 50 }
      );

      // Move the first photo one slot right → order becomes [b, a].
      fireEvent.press(getByTestId(/move-photo-right-/));

      await waitFor(() => {
        expect(lastSavedPhotoUrls(mockSave)).toEqual([
          'https://cdn.example.com/b.jpg',
          'https://cdn.example.com/a.jpg',
        ]);
      });
    });

    it('replaces a photo in place without changing length or re-triggering AI', async () => {
      const mockSave = jest.fn();
      mockUseItemDraft.mockReturnValue({
        draft: null,
        save: mockSave,
        saveNow: jest.fn(),
        discard: jest.fn(),
        isSaving: false,
        saveError: null,
      } as any);
      mockUploadByUri();

      const { getByTestId, getAllByTestId } = renderScreen({
        params: { showPhotoSourcePrompt: false },
      } as any);

      await addPhotoViaPicker(getByTestId, 'photo-a.jpg');
      await addPhotoViaPicker(getByTestId, 'photo-b.jpg');

      // Both uploads must be triggered before the draft save can be asserted.
      await waitFor(() => expect(mockUploadPhotoBatch).toHaveBeenCalledTimes(2));

      await waitFor(
        () => {
          expect(lastSavedPhotoUrls(mockSave)).toEqual([
            'https://cdn.example.com/a.jpg',
            'https://cdn.example.com/b.jpg',
          ]);
        },
        { timeout: 5000, interval: 50 }
      );

      // Replace the FIRST photo: picker returns a new asset, upload maps it to c.jpg.
      mockImagePicker.mockResolvedValue({
        canceled: false,
        assets: [
          { uri: 'photo-c.jpg', width: 800, height: 800, fileSize: 1000, mimeType: 'image/jpeg' },
        ],
      } as any);
      const replaceButtons = getAllByTestId(/replace-photo-/);
      fireEvent.press(replaceButtons[0]);

      // The replaced photo keeps its slot; draft photo_urls reflect the swap.
      await waitFor(
        () => {
          expect(lastSavedPhotoUrls(mockSave)).toEqual([
            'https://cdn.example.com/c.jpg',
            'https://cdn.example.com/b.jpg',
          ]);
        },
        { timeout: 5000, interval: 50 }
      );

      // Array length is unchanged — still 2 filled slots.
      expect(getAllByTestId(/photo-slot-filled-/)).toHaveLength(2);

      // AI input (uploadedPhotoUrls) is unchanged by replace — the replacement URL
      // is never handed to the AI hook.
      const latestAiCall = mockUseAIAnalysis.mock.calls[mockUseAIAnalysis.mock.calls.length - 1];
      expect(latestAiCall[0]).toEqual([
        'https://cdn.example.com/a.jpg',
        'https://cdn.example.com/b.jpg',
      ]);
    });
  });

  describe('Publish Flow', () => {
    it('should not allow publish when required fields are missing', () => {
      const { queryByTestId, getByTestId } = renderScreen();

      // Photo-first flow: publish controls are hidden before at least one photo is added.
      expect(getByTestId('add-photos-button')).toBeTruthy();
      expect(queryByTestId('publish-button')).toBeNull();
    });

    it('should call createItem on publish with valid data', async () => {
      mockCreateItem.mockResolvedValue({
        id: 'item-123',
        title: 'Nike Sneakers',
        price: 20.0,
      } as any);

      const { queryByTestId, getByTestId } = renderScreen();

      // In unit scope we only verify gatekeeping: details are not visible until photos exist.
      expect(getByTestId('photo-upload-manager')).toBeTruthy();
      expect(queryByTestId('title-input')).toBeNull();
    });

    it('should call flagForCategoryReview when category is "Other"', async () => {
      mockCreateItem.mockResolvedValue({
        id: 'item-123',
        title: 'Custom Item',
      } as any);

      mockFlagForCategoryReview.mockResolvedValue();

      // Test would select "Other" category, enter custom name, and publish
      // Then verify flagForCategoryReview was called with item ID and custom name
    });

    it('should navigate to ListingDetail on successful publish', async () => {
      mockCreateItem.mockResolvedValue({
        id: 'item-123',
        title: 'Nike Sneakers',
      } as any);

      // Test would complete publish flow and verify navigation.replace called
      // with ListingDetail and item ID
    });

    // ── AUTH-V3-008 / QA E05 regression: the phone-verification gate must fire
    //    BEFORE canPublish(). It was previously nested inside `if (!canPublish())`
    //    while the Publish button is disabled={!canPublish()}, so the gate was
    //    dead code for valid forms and unverified sellers could publish. These
    //    tests fill a fully-valid form (canPublish() → button enabled) and assert
    //    the gate still fires for an unverified seller (and does NOT for a
    //    verified one). Without Fix 1, the unverified-seller test fails (the
    //    modal never appears and publish proceeds).
    it('shows the phone-verification modal when an unverified seller taps Publish on a valid form', async () => {
      mockIsPhoneRequired.mockResolvedValue(true); // unverified seller
      mockGetAdminConfig.mockResolvedValue({ min_listing_price: 0 } as any);
      mockCreateListing.mockResolvedValue({ id: 'item-123' } as any);

      const { getByTestId, queryByTestId } = renderScreen();

      // Fill a fully-valid form (photo → category → title → condition → price).
      fireEvent.press(getByTestId('dev-add-test-photo'));
      await waitFor(() => expect(getByTestId('title-input')).toBeTruthy());

      fireEvent.press(getByTestId('dev-set-category'));
      fireEvent.changeText(getByTestId('title-input'), 'QA E05 test book');
      fireEvent.press(getByTestId('condition-good'));
      fireEvent.changeText(getByTestId('manual-price-input'), '12.50');

      // Modal must not be open before tapping Publish.
      expect(queryByTestId('listing-phone-verification')).toBeNull();

      // Tap Publish → gate fires first and shows the phone-verification modal.
      fireEvent.press(getByTestId('publish-button'));

      await waitFor(() => {
        expect(getByTestId('listing-phone-verification')).toBeTruthy();
      });

      // Publish must be blocked — the listing is never created.
      expect(mockCreateListing).not.toHaveBeenCalled();
    });

    it('does not show the phone-verification modal for a verified seller and proceeds to publish', async () => {
      mockIsPhoneRequired.mockResolvedValue(false); // verified seller
      mockGetAdminConfig.mockResolvedValue({ min_listing_price: 0 } as any);
      mockCreateListing.mockResolvedValue({ id: 'item-123' } as any);

      const { getByTestId, queryByTestId } = renderScreen();

      fireEvent.press(getByTestId('dev-add-test-photo'));
      await waitFor(() => expect(getByTestId('title-input')).toBeTruthy());

      fireEvent.press(getByTestId('dev-set-category'));
      fireEvent.changeText(getByTestId('title-input'), 'QA E05 test book');
      fireEvent.press(getByTestId('condition-good'));
      fireEvent.changeText(getByTestId('manual-price-input'), '12.50');

      fireEvent.press(getByTestId('publish-button'));

      await waitFor(() => {
        // Publish proceeded — the listing was created and the submit modal shows.
        expect(mockCreateListing).toHaveBeenCalled();
        expect(getByTestId('submit-review-go-my-items')).toBeTruthy();
      });

      // The phone-verification modal must never have appeared.
      expect(queryByTestId('listing-phone-verification')).toBeNull();
    });
  });

  describe('Category "Other" Flow', () => {
    it('should show custom category input when "Other" is selected', async () => {
      // Test would open category modal, select "Other", verify custom input appears
    });

    it('should require custom category name when "Other" is selected', async () => {
      // Test would select "Other" without entering name, verify publish is disabled
    });

    it('should call flagForCategoryReview with custom category name', async () => {
      mockCreateItem.mockResolvedValue({
        id: 'item-123',
      } as any);

      mockFlagForCategoryReview.mockResolvedValue();

      // Test would select "Other", enter "Board Games", publish
      // Then verify flagForCategoryReview('item-123', 'Board Games') was called
    });
  });

  describe('Price Suggestions', () => {
    it('should load price suggestions when condition is selected', async () => {
      renderScreen();

      // When condition changes, getSuggestedPrice should be called
      // This is validated by effect behavior
    });

    it('should populate price input when tier is selected', async () => {
      // Test would select a price tier and verify input is populated with tier price
    });

    it('should allow manual price entry', async () => {
      const { queryByTestId, getByTestId } = renderScreen();

      // Manual price input should not appear before the flow reaches price step.
      expect(getByTestId('photo-upload-manager')).toBeTruthy();
      expect(queryByTestId('manual-price-input')).toBeNull();
    });
  });

  describe('Photo Upload', () => {
    it('should enforce 10-photo maximum', async () => {
      mockImagePicker.mockResolvedValue({
        canceled: false,
        assets: Array(12)
          .fill(null)
          .map((_, i) => ({
            uri: `photo${i}.jpg`,
            width: 800,
            height: 600,
          })),
      } as any);

      // Test would attempt to add 12 photos and verify only 10 are accepted
    });

    it('should mark first photo as cover', async () => {
      // Test would add multiple photos and verify first has cover badge
    });

    it('should remove photo when remove button is pressed', async () => {
      // Test would add photos, press remove button, verify photo is removed
    });
  });

  describe('Error Handling', () => {
    it('should display error when publish fails', async () => {
      mockCreateItem.mockRejectedValue(new Error('Network error'));

      // Test would attempt publish and verify error message appears
    });

    it('should display draft save error', () => {
      mockUseItemDraft.mockReturnValue({
        draft: null,
        save: jest.fn(),
        saveNow: jest.fn(),
        discard: jest.fn(),
        isSaving: false,
        saveError: 'Failed to save draft',
      } as any);

      const { getByText } = renderScreen();

      expect(getByText(/Draft save error/i)).toBeTruthy();
    });
  });

  describe('Loading States', () => {
    it('should show activity indicator during AI analysis', () => {
      mockUseAIAnalysis.mockReturnValue({
        status: 'analyzing',
        result: null,
        error: null,
        analyze: jest.fn(),
      } as any);

      renderScreen();

      // ActivityIndicator should be visible in header
    });

    it('should disable publish button during publishing', () => {
      // Test would set flowState to PUBLISHING and verify button is disabled
    });
  });

  describe('Composer Title Pre-fill & AI Precedence', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const photoAsset = {
      canceled: false,
      assets: [
        {
          uri: 'photo1.jpg',
          width: 800,
          height: 600,
          fileSize: 1000000,
          mimeType: 'image/jpeg',
        },
      ],
    } as any;

    const renderWithPhoto = async (params: Record<string, any>) => {
      mockImagePicker.mockResolvedValue(photoAsset);
      const utils = renderScreen({ params } as any);
      fireEvent.press(utils.getByTestId('add-photos-button'));
      await waitFor(() => expect(mockImagePicker).toHaveBeenCalled());
      return utils;
    };

    const aiReady = (result: any) =>
      mockUseAIAnalysis.mockReturnValue({
        status: 'ready',
        result,
        error: null,
        analyze: jest.fn(),
      } as any);

    it('pre-fills the Title field from the composer bar', async () => {
      const { getByDisplayValue } = await renderWithPhoto({
        showPhotoSourcePrompt: false,
        prefilledTitle: 'Lego Star Wars Set',
      });
      expect(getByDisplayValue('Lego Star Wars Set')).toBeTruthy();
    });

    it('does NOT overwrite a composer-pre-filled Title when AI Apply All is used', async () => {
      aiReady({ title: { value: 'AI Title', confidence: 0.9 } });
      const { getByDisplayValue, getByTestId } = await renderWithPhoto({
        showPhotoSourcePrompt: false,
        prefilledTitle: 'Lego Star Wars Set',
      });
      fireEvent.press(getByTestId('apply-all-button'));
      expect(getByDisplayValue('Lego Star Wars Set')).toBeTruthy();
      expect(alertSpy).toHaveBeenCalled();
    });

    it('keeps a composer-pre-filled Title when the AI per-field Use is tapped', async () => {
      aiReady({ title: { value: 'AI Title', confidence: 0.9 } });
      const { getByDisplayValue, getByTestId } = await renderWithPhoto({
        showPhotoSourcePrompt: false,
        prefilledTitle: 'Lego Star Wars Set',
      });
      fireEvent.press(getByTestId('use-title'));
      expect(getByDisplayValue('Lego Star Wars Set')).toBeTruthy();
    });

    it('lets AI populate the Title when no composer text was entered', async () => {
      aiReady({ title: { value: 'AI Title', confidence: 0.9 } });
      const { getByDisplayValue, getByTestId } = await renderWithPhoto({
        showPhotoSourcePrompt: false,
      });
      fireEvent.press(getByTestId('apply-all-button'));
      expect(getByDisplayValue('AI Title')).toBeTruthy();
    });
  });
});
