/**
 * File: p2p-kids-marketplace/src/screens/ItemCreateScreen.tsx
 * MODULE-04 LISTING-V3-005: Item Create Screen (Photo-First Flow)
 * Task: LISTING-V3-005 - Rebuild as photo-first state machine
 *
 * Features:
 * - Photo-first state machine flow
 * - AI auto-fill suggestions (non-blocking)
 * - Draft auto-save every 30s
 * - V3 fields: age_group, gender, brand, color
 * - "Other" category flow with admin review flag
 * - Manual price entry
 */

import React, { useReducer, useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  ScrollView,
  StyleSheet,
  Alert,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  InteractionManager,
} from 'react-native';
import { Coins, Tag } from 'phosphor-react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../hooks/useAuth';
import { useItemDraft } from '../hooks/useItemDraft';
import { useAIAnalysis } from '../hooks/useAIAnalysis';
import { getUserFriendlyAiError } from '../utils/aiErrorFormat';
import { createListing, uploadListingImages } from '../services/listing';
import { getAdminConfig } from '../services/adminConfig';
import { getSubscriptionSummary } from '../services/subscription';
import { uploadPhotoBatch } from '../services/photoService';
import {
  getCategories,
  flagForCategoryReview,
  createCategorySuggestionFromItem,
} from '../services/categoryService';
import { PhotoAsset, Condition, DraftData, AIAnalysisResult } from '../types/listing';

// Import V3 components
import { PhotoUploadManager } from '../components/listing/PhotoUploadManager';
import { AIAnalysisCard } from '../components/listing/AIAnalysisCard';
import { CategorySelectModal, Category } from '../components/listing/CategorySelectModal';
import { ConditionSelector } from '../components/listing/ConditionSelector';
import { ConditionGuideOverlay } from '../components/listing/ConditionGuideOverlay';
import { ColorPicker } from '../components/listing/ColorPicker';
import { BrandAutocompleteInput } from '../components/molecules/BrandAutocompleteInput';
import { AgeGroupSelector } from '../components/listing/AgeGroupSelector';
import { GenderSelector } from '../components/listing/GenderSelector';
import { PublishButton } from '../components/listing/PublishButton';
import { SPEarningsPreview } from '../components/listing/SPEarningsPreview';

// AUTH-V3-008: Phone verification gate
import PhoneVerificationModal from '../components/auth/PhoneVerificationModal';
import { isPhoneRequired } from '../services/phoneService';
import { LoadingSpinner } from '@/components/ui';
import ScreenLayout from '@/components/ScreenLayout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// State machine states
type CreateScreenState =
  | 'IDLE'
  | 'ADDING_PHOTOS'
  | 'AI_ANALYZING'
  | 'REVIEWING_SUGGESTIONS'
  | 'FILLING_DETAILS'
  | 'SETTING_PRICE'
  | 'PUBLISHING'
  | 'SUCCESS'
  | 'ERROR';

// State machine actions
type CreateScreenAction =
  | { type: 'PHOTOS_ADDED' }
  | { type: 'AI_STARTED' }
  | { type: 'AI_READY' }
  | { type: 'AI_ERROR' }
  | { type: 'DETAILS_FILLED' }
  | { type: 'PRICE_SET' }
  | { type: 'PUBLISH_START' }
  | { type: 'PUBLISH_SUCCESS' }
  | { type: 'PUBLISH_ERROR' };

type PhotoSourceOption = 'camera' | 'library';

const AI_ANALYSIS_BLOCKING_TIMEOUT_MS = 7000;

// State reducer
function stateReducer(state: CreateScreenState, action: CreateScreenAction): CreateScreenState {
  switch (action.type) {
    case 'PHOTOS_ADDED':
      return 'ADDING_PHOTOS';
    case 'AI_STARTED':
      return 'AI_ANALYZING';
    case 'AI_READY':
      return 'REVIEWING_SUGGESTIONS';
    case 'AI_ERROR':
      return 'FILLING_DETAILS';
    case 'DETAILS_FILLED':
      return 'SETTING_PRICE';
    case 'PRICE_SET':
      return 'FILLING_DETAILS';
    case 'PUBLISH_START':
      return 'PUBLISHING';
    case 'PUBLISH_SUCCESS':
      return 'SUCCESS';
    case 'PUBLISH_ERROR':
      return 'ERROR';
    default:
      return state;
  }
}

export default function ItemCreateScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { session } = useAuth();

  const draftId = route.params?.draftId;
  const initialPhotoSource = route.params?.initialPhotoSource as PhotoSourceOption | undefined;
  const showPhotoSourcePrompt = route.params?.showPhotoSourcePrompt !== false;
  // Home composer pre-fill — Title came from the composer bar and must NEVER be
  // overwritten by AI analysis, even via the per-field "Use" action (spec).
  const prefilledTitle = route.params?.prefilledTitle;
  const titlePrefilledFromComposerRef = useRef(Boolean(prefilledTitle));
  const insets = useSafeAreaInsets();
  const sellerId = session?.user?.id || '';
  const hasTriggeredInitialDraftCreateRef = useRef(false);
  const hasHydratedDraftRef = useRef(false);
  const hasHandledInitialPhotoSourceRef = useRef(false);
  const pendingCategoryIdRef = useRef<string | null>(null);

  // State machine
  const [flowState, dispatch] = useReducer(stateReducer, 'IDLE');

  // Form state
  const [photos, setPhotos] = useState<PhotoAsset[]>([]);
  const [uploadedPhotoUrls, setUploadedPhotoUrls] = useState<string[]>([]);
  const [restoredPhotoUrls, setRestoredPhotoUrls] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [condition, setCondition] = useState<Condition | null>(null);
  const [brand, setBrand] = useState('');
  const [colors, setColors] = useState<string[]>([]);
  const [ageGroup, setAgeGroup] = useState<'0-2' | '3-5' | '6-8' | '9-12' | '13+' | null>(null);
  const [gender, setGender] = useState<'boy' | 'girl' | 'unisex' | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [requestedCategoryName, setRequestedCategoryName] = useState('');

  // Payment preference state
  const [acceptsSwapPoints, setAcceptsSwapPoints] = useState(false);
  const [canAcceptSP, setCanAcceptSP] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(true);

  // UI state
  const [categories, setCategories] = useState<Category[]>([]);
  const [recentCategories] = useState<Category[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showConditionGuide, setShowConditionGuide] = useState(false);
  const [selectedConditionGuide, setSelectedConditionGuide] = useState<Condition | null>(null);
  const [showAICard, setShowAICard] = useState(false);
  const [showSubmitReviewModal, setShowSubmitReviewModal] = useState(false);
  const [showPhotoSourceModal, setShowPhotoSourceModal] = useState(false);
  const [pendingPhotoSource, setPendingPhotoSource] = useState<PhotoSourceOption | null>(null);
  const [, setError] = useState<string | null>(null);
  const [isDraftHydrated, setIsDraftHydrated] = useState(!draftId);
  const [allowManualWhileAnalyzing, setAllowManualWhileAnalyzing] = useState(false);

  // AUTH-V3-008: Phone verification modal state
  const [showPhoneVerificationModal, setShowPhoneVerificationModal] = useState(false);
  const [phoneVerificationPending, setPhoneVerificationPending] = useState(false);
  const aiBlockingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Price adjustment modal state (min listing price validation)
  const [showPriceAdjustmentModal, setShowPriceAdjustmentModal] = useState(false);
  const [priceAdjustmentThreshold, setPriceAdjustmentThreshold] = useState(0);
  const [priceFieldY, setPriceFieldY] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const priceInputRef = useRef<TextInput>(null);

  // Draft management
  const {
    draft,
    save: saveDraft,
    saveNow,
    discard: discardDraft,
    saveError,
  } = useItemDraft(draftId, sellerId, { autoCreateOnMount: false });

  // AI analysis
  const {
    status: aiStatus,
    result: aiResult,
    error: aiError,
    retry: retryAI,
    reset: resetAI,
  } = useAIAnalysis(uploadedPhotoUrls, sellerId);

  const clearAIBlockingTimeout = useCallback(() => {
    if (aiBlockingTimeoutRef.current) {
      clearTimeout(aiBlockingTimeoutRef.current);
      aiBlockingTimeoutRef.current = null;
    }
  }, []);

  const loadSubscription = useCallback(async () => {
    if (!session?.user?.id) {
      setCheckingSubscription(false);
      return;
    }
    try {
      setCheckingSubscription(true);
      const summary = await getSubscriptionSummary(session.user.id);
      setCanAcceptSP(summary.can_spend_sp);
      // If user lost subscription, reset toggle
      if (!summary.can_spend_sp) {
        setAcceptsSwapPoints(false);
      }
    } catch (err: any) {
      console.error('[ItemCreateScreen] loadSubscription error:', err);
      setCanAcceptSP(false);
    } finally {
      setCheckingSubscription(false);
    }
  }, [session?.user?.id]);

  // Load categories + subscription status on mount and on screen focus
  useEffect(() => {
    loadCategories();
    void loadSubscription();
  }, [loadSubscription]);

  useFocusEffect(
    useCallback(() => {
      void loadSubscription();
    }, [loadSubscription])
  );

  // Reset hydration guards when navigating to a different draft.
  useEffect(() => {
    hasHydratedDraftRef.current = false;
    pendingCategoryIdRef.current = null;
    setRestoredPhotoUrls([]);
    setIsDraftHydrated(!draftId);
  }, [draftId]);

  // Composer pre-fill: if the user typed a title in the Home composer bar, pre-fill
  // the Title field. Draft resume takes precedence when a draftId is present.
  useEffect(() => {
    if (draftId) return; // draft resume wins
    if (!prefilledTitle) return;
    setTitle(prefilledTitle);
  }, [draftId, prefilledTitle]);

  // Hydrate form state once when resuming an existing draft.
  useEffect(() => {
    if (!draftId || !draft || hasHydratedDraftRef.current) {
      return;
    }

    const draftData = (draft.draft_data || {}) as Partial<DraftData>;
    const restoredPhotoUrls = Array.isArray(draftData.photo_urls)
      ? draftData.photo_urls
      : Array.isArray(draft.photo_urls)
        ? draft.photo_urls
        : [];

    setTitle(draftData.title || '');
    setDescription(draftData.description || '');
    setRequestedCategoryName(draftData.requested_category_name || '');
    setCondition(draftData.condition || null);
    setBrand(draftData.brand || '');
    setColors(Array.isArray(draftData.color) ? draftData.color : []);
    setAgeGroup(draftData.age_group || null);
    setGender(draftData.gender || null);
    setAcceptsSwapPoints(Boolean(draftData.accepts_swap_points));

    setRestoredPhotoUrls(restoredPhotoUrls);
    setUploadedPhotoUrls([]);
    setPhotos(
      restoredPhotoUrls.map((uri, index) => ({
        id: `restored-photo-${index}`,
        uri,
        width: 0,
        height: 0,
      }))
    );

    const savedCategoryId =
      typeof draftData.category_id === 'string' && draftData.category_id.trim().length > 0
        ? draftData.category_id
        : null;

    if (savedCategoryId) {
      pendingCategoryIdRef.current = savedCategoryId;
      const matchedCategory = categories.find((c) => c.id === savedCategoryId);
      if (matchedCategory) {
        setCategory(matchedCategory);
        pendingCategoryIdRef.current = null;
      } else if (savedCategoryId === 'other') {
        setCategory({ id: 'other', name: 'Other', icon: null } as Category);
        pendingCategoryIdRef.current = null;
      }
    }

    if (restoredPhotoUrls.length > 0) {
      dispatch({ type: 'PHOTOS_ADDED' });
    }

    hasHydratedDraftRef.current = true;
    setIsDraftHydrated(true);
  }, [draftId, draft, categories]);

  // Resolve saved category id once categories load.
  useEffect(() => {
    if (!pendingCategoryIdRef.current || categories.length === 0) {
      return;
    }

    const matchedCategory = categories.find((c) => c.id === pendingCategoryIdRef.current);
    if (matchedCategory) {
      setCategory(matchedCategory);
      pendingCategoryIdRef.current = null;
    }
  }, [categories]);

  // Watch AI analysis status
  useEffect(() => {
    if (aiStatus === 'analyzing' && flowState !== 'AI_ANALYZING') {
      dispatch({ type: 'AI_STARTED' });
      setShowAICard(false);
    } else if (aiStatus === 'ready' && aiResult) {
      if (flowState !== 'REVIEWING_SUGGESTIONS') {
        dispatch({ type: 'AI_READY' });
      }
      setShowAICard(true);
    } else if (aiStatus === 'error') {
      if (flowState === 'AI_ANALYZING') {
        dispatch({ type: 'AI_ERROR' });
      }
      setShowAICard(false);
    }
  }, [aiStatus, aiResult, flowState]);

  // Prevent AI latency from blocking listing creation.
  useEffect(() => {
    if (aiStatus !== 'analyzing') {
      clearAIBlockingTimeout();
      setAllowManualWhileAnalyzing(false);
      return;
    }

    setAllowManualWhileAnalyzing(false);
    clearAIBlockingTimeout();
    aiBlockingTimeoutRef.current = setTimeout(() => {
      setAllowManualWhileAnalyzing(true);
    }, AI_ANALYSIS_BLOCKING_TIMEOUT_MS);

    return clearAIBlockingTimeout;
  }, [aiStatus, clearAIBlockingTimeout]);

  // Auto-save draft on changes
  useEffect(() => {
    if (!isDraftHydrated) {
      return;
    }

    const combinedPhotoUrls = [...restoredPhotoUrls, ...uploadedPhotoUrls];
    const hasUploadedPhotos = combinedPhotoUrls.length > 0;
    const isResumedDraft = Boolean(draftId);

    // LISTING-V3-007 / TC-002 rule:
    // Do not create or save a draft on first screen before any photo upload.
    if (!hasUploadedPhotos && !isResumedDraft) {
      return;
    }

    const draftData: DraftData = {
      title,
      description,
      category_id: category?.id,
      requested_category_name: requestedCategoryName,
      condition: condition || undefined,
      brand,
      color: colors,
      age_group: ageGroup || undefined,
      gender: gender || undefined,
      accepts_swap_points: canAcceptSP ? acceptsSwapPoints : false,
      photo_urls: combinedPhotoUrls,
      ai_suggestions: aiResult || undefined,
      step:
        photos.length === 0
          ? 'photos'
          : !title || !category || !condition
            ? 'details'
            : !priceInput
              ? 'price'
              : 'review',
    };

    saveDraft(draftData);

    // Ensure first save after photo upload creates the draft row immediately.
    if (!isResumedDraft && !hasTriggeredInitialDraftCreateRef.current) {
      hasTriggeredInitialDraftCreateRef.current = true;
      void saveNow();
    }
  }, [
    title,
    description,
    category,
    condition,
    brand,
    colors,
    ageGroup,
    gender,
    uploadedPhotoUrls,
    restoredPhotoUrls,
    acceptsSwapPoints,
    aiResult,
    canAcceptSP,
    draftId,
    requestedCategoryName,
    photos,
    priceInput,
    saveDraft,
    saveNow,
    isDraftHydrated,
  ]);

  // On blur, save immediately
  useFocusEffect(
    useCallback(() => {
      return () => {
        saveNow();
      };
    }, [saveNow])
  );

  const loadCategories = async () => {
    try {
      const cats = await getCategories();
      setCategories(cats);
      // TODO: Load recent categories from AsyncStorage
    } catch (err: any) {
      console.error('[ItemCreateScreen] Load categories error:', err);
    }
  };

  const pickAssetsFromSource = async (
    source: PhotoSourceOption,
    selectionLimit: number
  ): Promise<PhotoAsset[] | null> => {
    console.log(
      '[ItemCreate] pickAssetsFromSource called - source:',
      source,
      'limit:',
      selectionLimit
    );

    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera access is needed to take photos.');
        return null;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 1,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      return result.assets.slice(0, 1).map((asset, index) => ({
        id: `${Date.now()}-${index}`,
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        fileSize: asset.fileSize,
        mimeType: asset.mimeType,
      }));
    }

    console.log('[ItemCreate] Requesting media library permissions...');
    const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    console.log('[ItemCreate] Media permission status:', mediaPermission?.status);

    if (mediaPermission?.status && mediaPermission.status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library access is needed to select photos.');
      return null;
    }

    console.log('[ItemCreate] Launching image library picker...');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 1,
      selectionLimit,
    });

    console.log(
      '[ItemCreate] Picker result - canceled:',
      result.canceled,
      'assets:',
      result.assets?.length
    );

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    return result.assets.slice(0, selectionLimit).map((asset, index) => ({
      id: `${Date.now()}-${index}`,
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      fileSize: asset.fileSize,
      mimeType: asset.mimeType,
    }));
  };

  const uploadPhotos = useCallback(
    async (photosToUpload: PhotoAsset[]) => {
      try {
        const result = await uploadPhotoBatch(photosToUpload, sellerId);

        if (result.urls.length > 0) {
          setUploadedPhotoUrls((prev) => [...prev, ...result.urls]);
        }

        if (result.errors.length > 0) {
          console.error('[ItemCreateScreen] Photo upload errors:', result.errors);
        }
      } catch (err: any) {
        console.error('[ItemCreateScreen] Upload photos error:', err);
      }
    },
    [sellerId]
  );

  const addPhotosFromSource = useCallback(
    async (source: PhotoSourceOption) => {
      try {
        const selectionLimit = Math.max(0, 10 - photos.length);
        if (selectionLimit <= 0) {
          Alert.alert('Limit reached', 'You can add up to 10 photos.');
          return;
        }

        const newPhotos = await pickAssetsFromSource(source, selectionLimit);
        if (!newPhotos) {
          return;
        }

        setPhotos((prev) => [...prev, ...newPhotos]);
        dispatch({ type: 'PHOTOS_ADDED' });

        // Upload photos in background
        void uploadPhotos(newPhotos);
      } catch (err: any) {
        console.error('[ItemCreateScreen] Add photos error:', err);
        Alert.alert('Error', 'Failed to add photos');
      }
    },
    [photos.length, uploadPhotos]
  );

  useEffect(() => {
    console.log(
      '[ItemCreate] Photo source effect - modal:',
      showPhotoSourceModal,
      'pending:',
      pendingPhotoSource
    );

    if (showPhotoSourceModal || !pendingPhotoSource) {
      return;
    }

    console.log('[ItemCreate] Queueing picker launch for:', pendingPhotoSource);
    // Wait for modal close animation AND all pending interactions to complete
    const sourceToLaunch = pendingPhotoSource;

    const interactionHandle = InteractionManager.runAfterInteractions(() => {
      console.log('[ItemCreate] Interactions complete, waiting additional delay...');
      setTimeout(() => {
        console.log('[ItemCreate] Launching picker for:', sourceToLaunch);
        void addPhotosFromSource(sourceToLaunch);
        setPendingPhotoSource(null);
      }, 500);
    });

    return () => {
      console.log('[ItemCreate] Clearing picker interaction handle');
      interactionHandle.cancel();
    };
  }, [showPhotoSourceModal, pendingPhotoSource, addPhotosFromSource]);

  const handleAddPhotos = () => {
    if (!showPhotoSourcePrompt) {
      void addPhotosFromSource('library');
      return;
    }
    setShowPhotoSourceModal(true);
  };

  // DEV-ONLY fixture: inject a bundled placeholder photo without the native
  // image picker so QA automation can reach the below-fold form fields (the
  // form only renders after photos.length > 0). Gated by __DEV__ — never in
  // release builds. Does NOT set uploadedPhotoUrls, so AI analysis stays idle.
  const handleAddDevTestPhoto = useCallback(() => {
    const source = Image.resolveAssetSource(require('../../assets/adaptive-icon.png'));
    const uri = source?.uri;
    if (!uri) {
      console.warn('[ItemCreateScreen] Dev test photo: bundled asset unresolved');
      return;
    }
    setPhotos((prev) => [
      ...prev,
      { id: `dev-photo-${Date.now()}`, uri, width: 1024, height: 1024, mimeType: 'image/png' },
    ]);
    dispatch({ type: 'PHOTOS_ADDED' });
  }, []);

  // DEV-ONLY fixture: set a valid category directly, bypassing the native
  // fullScreen CategorySelectModal (unreachable by QA automation — synthetic
  // taps land on the layer beneath, AUTH-TC-E05). Gated by __DEV__ — never in
  // release builds. No DB writes, no AI; local form state only, so canPublish()'s
  // category check passes and the phone-verification gate becomes reachable.
  // Prefers a real non-Other category from the loaded list; disabled until
  // categories are loaded so it can never inject a fake category id.
  const handleDevSetCategory = useCallback(() => {
    const cat =
      categories.find((c) => c.id !== 'other' && c.name.trim().toLowerCase() !== 'other') ??
      categories[0];
    if (!cat) return;
    setCategory(cat);
    setRequestedCategoryName('');
  }, [categories]);

  // DEV-ONLY fixture: fill title/price/condition in ONE tap, bypassing the manual
  // form-fill + keyboard-dismiss dance (and its price-corruption risk). Mirrors
  // handleAddDevTestPhoto/handleDevSetCategory — gated by __DEV__, never in
  // release builds. Adds a test photo if none exists (the form fields only render
  // after photos.length > 0). Local form state only, so canPublish() passes and
  // QA can reach the phone-verification gate / Submit without typing anything.
  const handleDevFillItem = useCallback(() => {
    if (photos.length === 0) {
      handleAddDevTestPhoto();
    }
    setTitle('QA Dev Fixture Item');
    setPriceInput('20');
    setCondition('new');
  }, [photos.length, handleAddDevTestPhoto]);

  useEffect(() => {
    if (hasHandledInitialPhotoSourceRef.current) {
      return;
    }
    if (!initialPhotoSource || photos.length > 0) {
      return;
    }

    hasHandledInitialPhotoSourceRef.current = true;
    void addPhotosFromSource(initialPhotoSource);
  }, [addPhotosFromSource, initialPhotoSource, photos.length]);

  const handleRemovePhoto = (photoId: string) => {
    setPhotos(photos.filter((p) => p.id !== photoId));
    // TODO: Remove from uploadedPhotoUrls
  };

  const handleReorderPhotos = (newOrder: PhotoAsset[]) => {
    setPhotos(newOrder);
  };

  const handleApplyAllAI = () => {
    if (!aiResult) return;

    // Apply only to empty fields. A composer-pre-filled Title is NEVER
    // overwritten by AI (spec: composer-bar text always wins).
    if (!title && aiResult.title && !titlePrefilledFromComposerRef.current) {
      setTitle(aiResult.title.value);
    }

    if (!category && aiResult.category) {
      const matchedCat = categories.find((c) => c.id === aiResult.category?.value.categoryId);
      if (matchedCat) {
        setCategory(matchedCat);
      }
    }

    if (!condition && aiResult.condition) {
      setCondition(aiResult.condition.value);
    }

    if (!brand && aiResult.brand) {
      setBrand(aiResult.brand.value);
    }

    if (colors.length === 0 && aiResult.color) {
      setColors(aiResult.color.value);
    }

    if (!ageGroup && aiResult.age_group) {
      setAgeGroup(aiResult.age_group.value);
    }

    if (!gender && aiResult.gender) {
      setGender(aiResult.gender.value);
    }

    Alert.alert('Success', 'AI suggestions applied to empty fields');
  };

  const handleApplyFieldAI = (field: keyof AIAnalysisResult, value: any) => {
    switch (field) {
      case 'title':
        // Composer-pre-filled titles must never be overwritten by AI (spec).
        if (titlePrefilledFromComposerRef.current) break;
        setTitle(value);
        break;
      case 'category':
        const matchedCat = categories.find((c) => c.id === value.categoryId);
        if (matchedCat) setCategory(matchedCat);
        break;
      case 'condition':
        setCondition(value);
        break;
      case 'brand':
        setBrand(value);
        break;
      case 'color':
        setColors(value);
        break;
      case 'age_group':
        setAgeGroup(value);
        break;
      case 'gender':
        setGender(value);
        break;
    }

    Alert.alert('Applied', 'AI suggestion applied');
  };

  const isFieldFilled = (field: keyof AIAnalysisResult): boolean => {
    switch (field) {
      case 'title':
        return title.length > 0;
      case 'category':
        return category !== null;
      case 'condition':
        return condition !== null;
      case 'brand':
        return brand.length > 0;
      case 'color':
        return colors.length > 0;
      case 'age_group':
        return ageGroup !== null;
      case 'gender':
        return gender !== null;
      default:
        return false;
    }
  };

  const handleSelectCategory = (cat: Category) => {
    setCategory(cat);
    setShowCategoryModal(false);

    // Keep "Other" flow explicit on the main form so sellers can see/edit
    // the custom category name before submit.
    if (cat.id !== 'other' && cat.name.toLowerCase() !== 'other') {
      setRequestedCategoryName('');
    }
  };

  const handleSelectOtherCategory = (customName: string) => {
    setCategory({ id: 'other', name: 'Other', icon: null });
    setRequestedCategoryName(customName);
    setShowCategoryModal(false);
  };

  const handleOpenConditionGuide = (cond: Condition) => {
    setSelectedConditionGuide(cond);
    setShowConditionGuide(true);
  };

  const handleContinueWithoutAI = () => {
    clearAIBlockingTimeout();
    setAllowManualWhileAnalyzing(true);
    resetAI();
  };

  const canPublish = (): boolean => {
    const isOtherCategory =
      category?.id === 'other' || category?.name?.trim().toLowerCase() === 'other';

    return (
      photos.length > 0 &&
      title.trim().length > 0 &&
      category !== null &&
      condition !== null &&
      priceInput.trim().length > 0 &&
      parseFloat(priceInput) > 0 &&
      (!isOtherCategory || requestedCategoryName.trim().length > 0)
    );
  };

  const handlePublish = async () => {
    // AUTH-V3-008: Phone verification gate — check FIRST, before canPublish().
    // The Publish button is disabled={!canPublish()}, so a gate nested inside
    // `if (!canPublish())` was unreachable for valid forms (dead code) and an
    // unverified seller could publish with zero phone verification (QA E05, P0).
    // Hoisted here so the modal fires for unverified sellers regardless of form
    // completeness; the modal's onSuccess re-invokes handlePublish() after
    // verification, at which point isPhoneRequired() returns false.
    if (!phoneVerificationPending) {
      try {
        const phoneRequired = await isPhoneRequired(sellerId);
        if (phoneRequired) {
          setPhoneVerificationPending(true);
          setShowPhoneVerificationModal(true);
          return; // Block publish - modal will call handlePublish again on success
        }
      } catch (err) {
        console.error('[ItemCreateScreen] Phone check error:', err);
        // Graceful fallback: allow publish if the check itself fails
      }
    }

    if (!canPublish()) {
      Alert.alert('Missing Fields', 'Please fill all required fields');
      return;
    }

    dispatch({ type: 'PUBLISH_START' });

    try {
      // Screen-level min listing price check (belt-and-suspenders — service layer also checks)
      const adminConfig = await getAdminConfig(true); // forceRefresh to bypass cache
      const minListingPrice = adminConfig.min_listing_price;
      const parsedPrice = parseFloat(priceInput);
      const effectiveMinPrice =
        typeof minListingPrice === 'number' && Number.isFinite(minListingPrice)
          ? minListingPrice
          : Number(minListingPrice) || 0;
      if (effectiveMinPrice > 0 && parsedPrice < effectiveMinPrice) {
        // Dismiss PUBLISHING modal first (PUBLISH_ERROR → flowState = ERROR
        // → isPublishing = false → Modal visible=false).
        dispatch({ type: 'PUBLISH_ERROR' });
        setPriceAdjustmentThreshold(effectiveMinPrice);
        // Wait for the PUBLISHING modal's fade-out animation to fully
        // complete (300ms default) before showing the price modal.
        // Two RN Modals with overlapping fade animations create a blank
        // native overlay that blocks touches but shows no content.
        setTimeout(() => {
          setShowPriceAdjustmentModal(true);
        }, 400);
        return;
      }

      const isOtherCategory =
        category?.id === 'other' || category?.name?.trim().toLowerCase() === 'other';

      // Step 1: Create item record (starts in pending admin review)
      const item = await createListing({
        seller_id: sellerId,
        title: title.trim(),
        description: description.trim() || '',
        price: parseFloat(priceInput),
        category_id: isOtherCategory ? undefined : category?.id,
        requested_category_name: isOtherCategory ? requestedCategoryName.trim() || null : null,
        condition: condition!,
        accepts_swap_points: canAcceptSP ? acceptsSwapPoints : false,
        brand: brand.trim() || null,
        color: colors.length > 0 ? colors : null,
        age_group: ageGroup || null,
        gender: gender || null,
      });

      // Step 2: Attach listing images to item_images so admin review can render photos.
      const localImageUris = photos.map((photo) => photo.uri);
      if (localImageUris.length > 0) {
        await uploadListingImages(item.id, sellerId, localImageUris);
      }

      // If "Other" category, flag for review
      if (isOtherCategory && requestedCategoryName.trim()) {
        await flagForCategoryReview(item.id, requestedCategoryName.trim());

        // Non-blocking queue insert for admin category suggestions tab.
        const suggestionSaved = await createCategorySuggestionFromItem(
          item.id,
          requestedCategoryName.trim(),
          sellerId
        );
        if (!suggestionSaved) {
          console.warn(
            '[ItemCreateScreen] category suggestion queue insert failed; listing publish continues',
            {
              itemId: item.id,
              requestedCategoryName: requestedCategoryName.trim(),
            }
          );
        }
      }

      // Delete draft if exists
      if (draftId) {
        await discardDraft();
      }

      dispatch({ type: 'PUBLISH_SUCCESS' });
      setShowSubmitReviewModal(true);
    } catch (err: any) {
      console.error('[ItemCreateScreen] Submit for review error:', err);
      const errorMsg = err.message || 'Failed to submit item for review';
      setError(errorMsg);
      dispatch({ type: 'PUBLISH_ERROR' });
      Alert.alert('Error', errorMsg);
    }
  };

  const isPublishing = flowState === 'PUBLISHING';
  const isAnalyzing = aiStatus === 'analyzing';
  const isAnalyzingBlocking = isAnalyzing && !allowManualWhileAnalyzing;

  // Price Adjustment: dismiss modal → scroll to price field → focus
  const handlePriceAdjustmentUpdate = useCallback(() => {
    setShowPriceAdjustmentModal(false);
    // Small delay to let modal dismiss animation settle
    setTimeout(() => {
      // Scroll to the price field's Y position within the ScrollView content.
      // The onLayout on the price field wrapper captures this value relative
      // to the ScrollView's content container.
      if (priceFieldY > 0) {
        scrollViewRef.current?.scrollTo({ y: Math.max(0, priceFieldY - 100), animated: true });
      }
      // Focus the price input after a brief pause for scroll animation
      setTimeout(() => {
        priceInputRef.current?.focus();
      }, 350);
    }, 100);
  }, [priceFieldY]);

  const handleBackPress = useCallback(() => {
    void saveNow();
    navigation.goBack();
  }, [navigation, saveNow]);

  return (
    <ScreenLayout variant="detail" title="New Item" onBack={handleBackPress}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        testID="item-create-scroll-view"
      >
        {/* Photo Upload */}
        <PhotoUploadManager
          photos={photos}
          onAddPhotos={handleAddPhotos}
          onRemovePhoto={handleRemovePhoto}
          onReorder={handleReorderPhotos}
        />

        {/* DEV-ONLY: bypass the native photo picker so QA automation can reach
            the below-fold form fields. The form renders only after at least one
            photo is added. Never rendered in release builds (__DEV__ false). */}
        {__DEV__ && (
          <TouchableOpacity
            style={styles.devTestPhotoButton}
            onPress={handleAddDevTestPhoto}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Add test photo (dev only)"
            testID="dev-add-test-photo"
          >
            <Text style={styles.devTestPhotoButtonText}>Dev: Add Test Photo</Text>
          </TouchableOpacity>
        )}

        {/* DEV-ONLY: bypass the native fullScreen CategorySelectModal so QA can
            set a category without the modal (AUTH-TC-E05). No DB writes, no AI —
            local form state only, so canPublish()'s category check passes and the
            phone-verification gate becomes reachable. Disabled until the real
            category list loads. Never rendered in release builds (__DEV__ false). */}
        {__DEV__ && (
          <TouchableOpacity
            style={[
              styles.devTestPhotoButton,
              categories.length === 0 && styles.devFixtureButtonDisabled,
            ]}
            onPress={handleDevSetCategory}
            disabled={categories.length === 0}
            accessible
            accessibilityRole="button"
            // Dynamic label so QA can read which category was actually set (the
            // visible text updates but a static label would not).
            accessibilityLabel={
              category
                ? `Set category without modal (dev only): ${category.name}`
                : 'Set category without modal (dev only)'
            }
            testID="dev-set-category"
          >
            <Text style={styles.devTestPhotoButtonText}>
              Dev: Set Category{category ? ` (${category.name})` : ''}
            </Text>
          </TouchableOpacity>
        )}

        {/* DEV-ONLY: fill title/price/condition in one tap so QA can skip the
            manual form-fill + keyboard-dismiss dance entirely. Adds a test photo
            if none exists. Never rendered in release builds (__DEV__ false). */}
        {__DEV__ && (
          <TouchableOpacity
            style={styles.devTestPhotoButton}
            onPress={handleDevFillItem}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Fill item with test values (dev only)"
            testID="dev-fill-item"
          >
            <Text style={styles.devTestPhotoButtonText}>
              Dev: Fill Item (Title/Price/Condition)
            </Text>
          </TouchableOpacity>
        )}

        {/* AI Analysis Card */}
        {showAICard && aiResult && (
          <AIAnalysisCard
            analysis={aiResult}
            isFieldFilled={isFieldFilled}
            onApplyAll={handleApplyAllAI}
            onApplyField={handleApplyFieldAI}
            onDismiss={() => setShowAICard(false)}
          />
        )}

        {/* AI Analysis Error — user-friendly message, raw error logged to console */}
        {aiStatus === 'error' && photos.length > 0 && (
          <View style={styles.aiErrorCard}>
            <Text style={styles.aiErrorTitle}>Photo analysis issue</Text>
            <Text style={styles.aiErrorMessage}>{getUserFriendlyAiError(aiError)}</Text>
            <TouchableOpacity
              style={styles.aiRetryButton}
              onPress={retryAI}
              accessibilityRole="button"
              testID="ai-retry-button"
            >
              <Text style={styles.aiRetryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Form Fields */}
        {photos.length > 0 && (
          <>
            {/* Title */}
            <View style={styles.field}>
              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g., Nike Sneakers Size 5"
                maxLength={100}
                editable={!isAnalyzingBlocking}
                testID="title-input"
              />
            </View>

            {/* Description */}
            <View style={styles.field}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Describe the item..."
                multiline
                numberOfLines={4}
                maxLength={500}
                editable={!isAnalyzingBlocking}
                testID="description-input"
              />
            </View>

            {/* Category */}
            <View style={styles.field}>
              <Text style={styles.label}>Category *</Text>
              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => setShowCategoryModal(true)}
                disabled={isAnalyzingBlocking}
                accessible
                accessibilityRole="button"
                accessibilityLabel="Select category"
                testID="category-select-button"
              >
                <Tag size={20} color="#6B6B6B" weight="regular" />
                <Text style={styles.selectButtonText}>
                  {category ? category.name : 'Select category'}
                </Text>
              </TouchableOpacity>
            </View>

            {(category?.id === 'other' || category?.name?.toLowerCase() === 'other') && (
              <View style={styles.field}>
                <Text style={styles.label}>Custom Category Name *</Text>
                <TextInput
                  style={styles.input}
                  value={requestedCategoryName}
                  onChangeText={setRequestedCategoryName}
                  placeholder="e.g., Board Games"
                  maxLength={100}
                  editable={!isAnalyzingBlocking}
                  testID="custom-category-name-input"
                />
                <Text style={styles.helperText}>
                  This custom category will be sent to admin for review.
                </Text>
              </View>
            )}

            {/* Condition */}
            <ConditionSelector
              value={condition}
              onChange={setCondition}
              onOpenGuide={handleOpenConditionGuide}
            />

            {/* Brand */}
            <BrandAutocompleteInput
              value={brand}
              onChange={setBrand}
              label="Brand"
              placeholder="e.g., LEGO, Nike, Carter's..."
              testID="brand-input"
            />

            {/* Color */}
            <ColorPicker selectedColors={colors} onChange={setColors} />

            {/* Age Group */}
            <AgeGroupSelector value={ageGroup} onChange={setAgeGroup} />

            {/* Gender */}
            <GenderSelector value={gender} onChange={setGender} />

            {/* Payment Preference */}
            <View style={styles.spSection}>
              <Text style={styles.spSectionTitle}>Payment Preference</Text>
              {checkingSubscription ? (
                <View style={styles.spLoadingRow}>
                  <ActivityIndicator size="small" color="#5DBB8E" />
                  <Text style={styles.spLoadingText}>Checking subscription...</Text>
                </View>
              ) : canAcceptSP ? (
                <>
                  <View style={styles.spToggleRow}>
                    <View style={styles.spToggleLabelGroup}>
                      <Text style={styles.spToggleLabel}>Accept Swap Points?</Text>
                      <Text style={styles.spToggleHint}>Allow buyers to pay with Swap Points</Text>
                    </View>
                    <Switch
                      value={acceptsSwapPoints}
                      onValueChange={setAcceptsSwapPoints}
                      trackColor={{ false: '#ccc', true: '#5DBB8E' }}
                      thumbColor="#fff"
                      testID="sp-toggle"
                    />
                  </View>
                  {acceptsSwapPoints && (
                    <View style={styles.spEligibleBadge}>
                      <Coins size={16} color="#F59E0B" weight="regular" />
                      <Text style={styles.spEligibleText}>✓ SP Eligible</Text>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.spUpgradePrompt}>
                  <Text style={styles.spUpgradeText}>
                    🌟 Subscribe to Kids Club+ to accept Swap Points and unlock more features!
                  </Text>
                  <TouchableOpacity
                    style={styles.spUpgradeButton}
                    onPress={() => navigation.navigate('JoinKidsClub')}
                    testID="sp-upgrade-button"
                  >
                    <Text style={styles.spUpgradeButtonText}>Upgrade Now</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Price (manual only) */}
            <View style={styles.field} onLayout={(e) => setPriceFieldY(e.nativeEvent.layout.y)}>
              <Text style={styles.label}>Price *</Text>
              <TextInput
                ref={priceInputRef}
                style={styles.input}
                value={priceInput}
                onChangeText={setPriceInput}
                placeholder="0.00"
                keyboardType="decimal-pad"
                maxLength={10}
                editable={!isAnalyzingBlocking}
                testID="manual-price-input"
              />
            </View>

            {/* SP Earnings Preview (LISTING-V3-011) */}
            <SPEarningsPreview
              categoryId={category?.id || null}
              price={parseFloat(priceInput) || 0}
              isSubscriber={canAcceptSP}
              onLearnMore={() => {
                navigation.navigate('Help', { section: 'sp_definition' });
              }}
              onUpgradePress={() => navigation.navigate('JoinKidsClub')}
              testID="sp-earnings-preview"
            />
          </>
        )}

        {saveError && <Text style={styles.errorText}>Draft save error: {saveError}</Text>}
      </ScrollView>

      {/* Sticky Publish footer (Fix 4 / UX): the primary CTA now lives OUTSIDE
          the ScrollView, pinned above the bottom safe-area inset, so sellers
          always see it without scrolling to the absolute bottom of the form.
          The PersistentTabBar is hidden on ItemCreate (Fix 3), so this footer
          is the only bottom-anchored element here. No overlap: the ScrollView
          (flex:1) shrinks to make room — the footer never covers the form
          fields (e.g. the SP-estimate copy or the Kids Club+ upgrade banner). */}
      {photos.length > 0 && (
        <View style={[styles.publishFooter, { paddingBottom: insets.bottom + 12 }]}>
          <PublishButton
            onPress={handlePublish}
            loading={isPublishing}
            disabled={!canPublish()}
            label="Submit for Review"
          />
        </View>
      )}

      {/* Category Modal */}
      <CategorySelectModal
        visible={showCategoryModal}
        categories={categories}
        recent={recentCategories}
        onSelect={handleSelectCategory}
        onSelectOther={handleSelectOtherCategory}
        onClose={() => setShowCategoryModal(false)}
      />

      {/* Condition Guide Overlay */}
      <ConditionGuideOverlay
        visible={showConditionGuide}
        condition={selectedConditionGuide}
        onClose={() => setShowConditionGuide(false)}
      />

      <Modal
        visible={showPhotoSourceModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowPhotoSourceModal(false)}
      >
        <View style={styles.photoSourceModalOverlay}>
          <View style={styles.photoSourceModalCard}>
            <Text style={styles.photoSourceModalTitle}>Add Photos</Text>
            <Text style={styles.photoSourceModalMessage}>Choose how you want to add photos.</Text>

            <TouchableOpacity
              style={styles.photoSourceOptionButton}
              onPress={() => {
                console.log('[ItemCreate] Camera button pressed');
                setPendingPhotoSource('camera');
                setShowPhotoSourceModal(false);
              }}
              testID="item-photo-source-camera"
            >
              <Text style={styles.photoSourceOptionText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.photoSourceOptionButton}
              onPress={() => {
                console.log('[ItemCreate] Library button pressed');
                setPendingPhotoSource('library');
                setShowPhotoSourceModal(false);
              }}
              testID="item-photo-source-library"
            >
              <Text style={styles.photoSourceOptionText}>Photo Library</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.photoSourceCancelButton}
              onPress={() => {
                setPendingPhotoSource(null);
                setShowPhotoSourceModal(false);
              }}
              testID="item-photo-source-cancel"
            >
              <Text style={styles.photoSourceCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={isPublishing} animationType="fade" transparent>
        <View style={styles.processingOverlay}>
          <View style={styles.processingCard}>
            <LoadingSpinner />
            <Text style={styles.processingTitle}>Submitting Item For Review...</Text>
            <Text style={styles.processingMessage}>
              Please wait. We are uploading your item and preparing it for admin review.
            </Text>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSubmitReviewModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowSubmitReviewModal(false)}
      >
        <View style={styles.submitModalOverlay}>
          <View style={styles.submitModalCard}>
            <Text style={styles.submitModalTitle}>Thanks for submitting!</Text>
            <Text style={styles.submitModalMessage}>
              To ensure the marketplace is safe and free of offensive items, we are going to review
              your item and approve it.
            </Text>
            <Text style={styles.submitModalMessage}>
              This will not take long. You will get a notification as soon as we complete the
              review. You can check the latest status by checking in My Items view.
            </Text>

            <TouchableOpacity
              style={styles.submitModalPrimaryButton}
              onPress={() => {
                setShowSubmitReviewModal(false);
                navigation.navigate('MyListings');
              }}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Go to my items"
              testID="submit-review-go-my-items"
            >
              <Text style={styles.submitModalPrimaryButtonText}>Go To My Items</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.submitModalSecondaryButton}
              onPress={() => {
                setShowSubmitReviewModal(false);
                navigation.navigate('Home');
              }}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Go to dashboard"
              testID="submit-review-go-dashboard"
            >
              <Text style={styles.submitModalSecondaryButtonText}>Go To Dashboard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Price Adjustment Modal (min listing price validation) */}
      <Modal
        visible={showPriceAdjustmentModal}
        transparent
        animationType="fade"
        onRequestClose={handlePriceAdjustmentUpdate}
      >
        <View style={styles.priceAdjOverlay}>
          <View style={styles.priceAdjDialog}>
            <Text style={styles.priceAdjTitle}>Let's Adjust Your Price</Text>
            <Text style={styles.priceAdjMessage}>
              To keep Pass It Up full of quality items buyers can trust, listings must be priced at
              ${priceAdjustmentThreshold.toFixed(2)} or more. Update your price to publish this
              listing.
            </Text>
            <TouchableOpacity
              style={styles.priceAdjButton}
              onPress={handlePriceAdjustmentUpdate}
              accessibilityRole="button"
              accessibilityLabel="Update Price"
              testID="price-adjustment-update-btn"
            >
              <Text style={styles.priceAdjButtonText}>Update Price</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* AUTH-V3-008: Phone Verification Modal (transaction gate) */}
      <PhoneVerificationModal
        visible={showPhoneVerificationModal}
        onClose={() => {
          setShowPhoneVerificationModal(false);
          setPhoneVerificationPending(false);
        }}
        onSuccess={() => {
          setShowPhoneVerificationModal(false);
          setPhoneVerificationPending(false);
          // Retry publish after successful verification
          void handlePublish();
        }}
        required={true}
        testID="listing-phone-verification"
      />

      {/* AI Analysis Loading Overlay */}
      <Modal visible={isAnalyzingBlocking} animationType="fade" transparent>
        <View style={styles.aiLoadingOverlay}>
          <View style={styles.aiLoadingCard}>
            <LoadingSpinner />
            <Text style={styles.aiLoadingTitle}>Analyzing Your Photos...</Text>
            <Text style={styles.aiLoadingMessage}>
              Our AI is reviewing your photos to suggest item details.
            </Text>
            <Text style={styles.aiLoadingHint}>
              If this takes too long, continue manually now and we will show suggestions when ready.
            </Text>
            <TouchableOpacity
              style={styles.aiContinueButton}
              onPress={handleContinueWithoutAI}
              accessibilityRole="button"
              testID="ai-continue-manual-button"
            >
              <Text style={styles.aiContinueButtonText}>Continue Without AI</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    fontSize: 28,
    color: '#5DBB8E',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  headerRight: {
    width: 28,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    // Keep the last form section clear of the sticky Publish footer.
    paddingBottom: 24,
  },
  // Sticky footer that holds the always-visible Publish button above the
  // bottom safe-area inset (Fix 4). Rendered OUTSIDE the ScrollView so it never
  // overlaps form content — the ScrollView (flex:1) shrinks to make room.
  publishFooter: {
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  field: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  input: {
    fontSize: 16,
    color: '#1A1A1A',
    borderWidth: 0,
    borderRadius: 12,
    minHeight: 52,
    paddingHorizontal: 16,
    backgroundColor: '#F0F0F0',
  },
  textArea: {
    minHeight: 100,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  selectButton: {
    borderWidth: 0,
    borderRadius: 12,
    minHeight: 52,
    paddingHorizontal: 16,
    backgroundColor: '#F0F0F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectButtonText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  helperText: {
    marginTop: 8,
    fontSize: 13,
    color: '#666666',
  },
  photoSourceModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  photoSourceModalCard: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 24,
  },
  photoSourceModalTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: '#1A1A1A',
    lineHeight: 40,
  },
  photoSourceModalMessage: {
    marginTop: 12,
    marginBottom: 24,
    fontSize: 18,
    lineHeight: 26,
    color: '#6B6B6B',
  },
  photoSourceOptionButton: {
    minHeight: 72,
    borderRadius: 36,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  photoSourceOptionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  photoSourceCancelButton: {
    minHeight: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: '#6B6B6B',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  photoSourceCancelText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#6B6B6B',
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  aiErrorCard: {
    backgroundColor: '#FFF4F4',
    borderColor: '#FFD4D4',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  aiErrorTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C62828',
    marginBottom: 4,
  },
  aiErrorMessage: {
    fontSize: 13,
    color: '#7A1A1A',
    marginBottom: 10,
  },
  aiRetryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#5DBB8E',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  aiRetryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  spSection: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  spSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  spLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  spLoadingText: {
    fontSize: 14,
    color: '#6B6B6B',
    marginLeft: 8,
  },
  spToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spToggleLabelGroup: {
    flex: 1,
    marginRight: 12,
  },
  spToggleLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  spToggleHint: {
    fontSize: 13,
    color: '#666666',
  },
  spEligibleBadge: {
    marginTop: 10,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  spEligibleText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#F59E0B',
  },
  spUpgradePrompt: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
  },
  spUpgradeText: {
    fontSize: 14,
    color: '#7A5A2A',
    marginBottom: 10,
  },
  spUpgradeButton: {
    backgroundColor: '#5DBB8E',
    borderRadius: 24,
    minHeight: 48,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  spUpgradeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  submitModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  submitModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
  },
  submitModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 12,
  },
  submitModalMessage: {
    fontSize: 15,
    lineHeight: 22,
    color: '#444444',
    marginBottom: 10,
  },
  submitModalPrimaryButton: {
    marginTop: 8,
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
    minHeight: 52,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitModalPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  submitModalSecondaryButton: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#6B6B6B',
    borderRadius: 24,
    minHeight: 48,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitModalSecondaryButtonText: {
    color: '#6B6B6B',
    fontSize: 16,
    fontWeight: '500',
  },
  processingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  processingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  processingTitle: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: '700',
    color: '#1F1F1F',
    textAlign: 'center',
  },
  processingMessage: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#555555',
    textAlign: 'center',
  },
  aiLoadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  aiLoadingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  aiLoadingTitle: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: '700',
    color: '#1F1F1F',
    textAlign: 'center',
  },
  aiLoadingMessage: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#555555',
    textAlign: 'center',
  },
  aiLoadingHint: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    color: '#6B6B6B',
    textAlign: 'center',
  },
  aiContinueButton: {
    marginTop: 16,
    backgroundColor: '#5DBB8E',
    borderRadius: 24,
    minHeight: 44,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiContinueButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  priceAdjOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  priceAdjDialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  priceAdjTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 12,
  },
  priceAdjMessage: {
    fontSize: 15,
    lineHeight: 22,
    color: '#6B6B6B',
    textAlign: 'center',
    marginBottom: 24,
  },
  priceAdjButton: {
    backgroundColor: '#5DBB8E',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  priceAdjButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  devTestPhotoButton: {
    backgroundColor: '#EAF7F0',
    borderColor: '#5DBB8E',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  devTestPhotoButtonText: {
    color: '#2E7D5B',
    fontSize: 14,
    fontWeight: '600',
  },
  devFixtureButtonDisabled: {
    opacity: 0.5,
  },
});
