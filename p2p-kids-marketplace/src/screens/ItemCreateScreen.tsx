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
  ScrollView,
  StyleSheet,
  Alert,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../hooks/useAuth';
import { useItemDraft } from '../hooks/useItemDraft';
import { useAIAnalysis } from '../hooks/useAIAnalysis';
import { createListing, uploadListingImages } from '../services/listing';
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
  const sellerId = session?.user?.id || '';
  const hasTriggeredInitialDraftCreateRef = useRef(false);
  const hasHydratedDraftRef = useRef(false);
  const pendingCategoryIdRef = useRef<string | null>(null);

  // State machine
  const [flowState, dispatch] = useReducer(stateReducer, 'IDLE');

  // Form state
  const [photos, setPhotos] = useState<PhotoAsset[]>([]);
  const [uploadedPhotoUrls, setUploadedPhotoUrls] = useState<string[]>([]);
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
  const [, setError] = useState<string | null>(null);
  const [isDraftHydrated, setIsDraftHydrated] = useState(!draftId);

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
  } = useAIAnalysis(uploadedPhotoUrls, sellerId);

  // Load categories + subscription status on mount and on screen focus
  useEffect(() => {
    loadCategories();
    loadSubscription();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSubscription();
    }, [session?.user?.id])
  );

  // Reset hydration guards when navigating to a different draft.
  useEffect(() => {
    hasHydratedDraftRef.current = false;
    pendingCategoryIdRef.current = null;
    setIsDraftHydrated(!draftId);
  }, [draftId]);

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

    setUploadedPhotoUrls(restoredPhotoUrls);
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

  // Auto-save draft on changes
  useEffect(() => {
    if (!isDraftHydrated) {
      return;
    }

    const hasUploadedPhotos = uploadedPhotoUrls.length > 0;
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
      photo_urls: uploadedPhotoUrls,
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

  const loadSubscription = async () => {
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
  };

  const loadCategories = async () => {
    try {
      const cats = await getCategories();
      setCategories(cats);
      // TODO: Load recent categories from AsyncStorage
    } catch (err: any) {
      console.error('[ItemCreateScreen] Load categories error:', err);
    }
  };

  const handleAddPhotos = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 1,
        selectionLimit: 10 - photos.length,
      });

      if (!result.canceled && result.assets) {
        const newPhotos: PhotoAsset[] = result.assets.map((asset, index) => ({
          id: `${Date.now()}-${index}`,
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          fileSize: asset.fileSize,
          mimeType: asset.mimeType,
        }));

        setPhotos([...photos, ...newPhotos]);
        dispatch({ type: 'PHOTOS_ADDED' });

        // Upload photos in background
        uploadPhotos([...photos, ...newPhotos]);
      }
    } catch (err: any) {
      console.error('[ItemCreateScreen] Add photos error:', err);
      Alert.alert('Error', 'Failed to add photos');
    }
  };

  const uploadPhotos = async (photosToUpload: PhotoAsset[]) => {
    try {
      const result = await uploadPhotoBatch(
        photosToUpload,
        sellerId
      );

      if (result.urls.length > 0) {
        setUploadedPhotoUrls(result.urls);
      }

      if (result.errors.length > 0) {
        console.error('[ItemCreateScreen] Photo upload errors:', result.errors);
      }
    } catch (err: any) {
      console.error('[ItemCreateScreen] Upload photos error:', err);
    }
  };

  const handleRemovePhoto = (photoId: string) => {
    setPhotos(photos.filter((p) => p.id !== photoId));
    // TODO: Remove from uploadedPhotoUrls
  };

  const handleReorderPhotos = (newOrder: PhotoAsset[]) => {
    setPhotos(newOrder);
  };

  const handleApplyAllAI = () => {
    if (!aiResult) return;

    // Apply only to empty fields
    if (!title && aiResult.title) {
      setTitle(aiResult.title.value);
    }

    if (!category && aiResult.category) {
      const matchedCat = categories.find(
        (c) => c.id === aiResult.category?.value.categoryId
      );
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
    if (!canPublish()) {
      Alert.alert('Missing Fields', 'Please fill all required fields');
      return;
    }

    dispatch({ type: 'PUBLISH_START' });

    try {
      const isOtherCategory =
        category?.id === 'other' || category?.name?.trim().toLowerCase() === 'other';

      // Step 1: Create item record (starts in pending admin review)
      const item = await createListing({
        seller_id: sellerId,
        title: title.trim(),
        description: description.trim() || '',
        price: parseFloat(priceInput),
        category_id: isOtherCategory ? undefined : category?.id,
        requested_category_name:
          isOtherCategory ? requestedCategoryName.trim() || null : null,
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
      setError(err.message || 'Failed to submit item for review');
      dispatch({ type: 'PUBLISH_ERROR' });
      Alert.alert('Error', 'Failed to submit item for review. Please try again.');
    }
  };

  const isPublishing = flowState === 'PUBLISHING';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            saveNow();
            navigation.goBack();
          }}
          testID="back-button"
        >
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Listing</Text>
        <View style={styles.headerRight}>
          {aiStatus === 'analyzing' && (
            <ActivityIndicator size="small" color="#007AFF" />
          )}
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Photo Upload */}
        <PhotoUploadManager
          photos={photos}
          onAddPhotos={handleAddPhotos}
          onRemovePhoto={handleRemovePhoto}
          onReorder={handleReorderPhotos}
        />

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

        {/* AI Analysis Error */}
        {aiStatus === 'error' && photos.length > 0 && (
          <View style={styles.aiErrorCard}>
            <Text style={styles.aiErrorTitle}>AI analysis failed</Text>
            <Text style={styles.aiErrorMessage}>
              {aiError || 'Please try AI analysis again.'}
            </Text>
            <TouchableOpacity
              style={styles.aiRetryButton}
              onPress={retryAI}
              accessibilityRole="button"
              testID="ai-retry-button"
            >
              <Text style={styles.aiRetryButtonText}>Retry AI</Text>
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
                testID="description-input"
              />
            </View>

            {/* Category */}
            <View style={styles.field}>
              <Text style={styles.label}>Category *</Text>
              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => setShowCategoryModal(true)}
                testID="category-select-button"
              >
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
                  <ActivityIndicator size="small" color="#007AFF" />
                  <Text style={styles.spLoadingText}>Checking subscription...</Text>
                </View>
              ) : canAcceptSP ? (
                <>
                  <View style={styles.spToggleRow}>
                    <View style={styles.spToggleLabelGroup}>
                      <Text style={styles.spToggleLabel}>Accept Swap Points?</Text>
                      <Text style={styles.spToggleHint}>
                        Allow buyers to pay up to 50% with Swap Points
                      </Text>
                    </View>
                    <Switch
                      value={acceptsSwapPoints}
                      onValueChange={setAcceptsSwapPoints}
                      trackColor={{ false: '#ccc', true: '#34C759' }}
                      thumbColor="#fff"
                      testID="sp-toggle"
                    />
                  </View>
                  {acceptsSwapPoints && (
                    <View style={styles.spEligibleBadge}>
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
                    onPress={() => navigation.navigate('SubscriptionChoice')}
                    testID="sp-upgrade-button"
                  >
                    <Text style={styles.spUpgradeButtonText}>Upgrade Now</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Price (manual only) */}
            <View style={styles.field}>
              <Text style={styles.label}>Price *</Text>
              <TextInput
                style={styles.input}
                value={priceInput}
                onChangeText={setPriceInput}
                placeholder="0.00"
                keyboardType="decimal-pad"
                maxLength={10}
                testID="manual-price-input"
              />
            </View>

            {/* Publish Button */}
            <PublishButton
              onPress={handlePublish}
              loading={isPublishing}
              disabled={!canPublish()}
              label="Submit for Review"
            />
          </>
        )}

        {saveError && (
          <Text style={styles.errorText}>Draft save error: {saveError}</Text>
        )}
      </ScrollView>

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

      <Modal visible={isPublishing} animationType="fade" transparent>
        <View style={styles.processingOverlay}>
          <View style={styles.processingCard}>
            <ActivityIndicator size="large" color="#007AFF" />
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
              To ensure the marketplace is safe and free of offensive items, we are going to review your item and approve it.
            </Text>
            <Text style={styles.submitModalMessage}>
              This will not take long. You will get a notification as soon as we complete the review. You can check the latest status by checking in My Items view.
            </Text>

            <TouchableOpacity
              style={styles.submitModalPrimaryButton}
              onPress={() => {
                setShowSubmitReviewModal(false);
                navigation.navigate('MyListings');
              }}
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
              testID="submit-review-go-dashboard"
            >
              <Text style={styles.submitModalSecondaryButtonText}>Go To Dashboard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  headerRight: {
    width: 28,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
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
    color: '#000000',
    marginBottom: 8,
  },
  input: {
    fontSize: 16,
    color: '#000000',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  selectButton: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  selectButtonText: {
    fontSize: 16,
    color: '#000000',
  },
  helperText: {
    marginTop: 8,
    fontSize: 13,
    color: '#666666',
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
    backgroundColor: '#007AFF',
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
    borderRadius: 8,
    padding: 16,
  },
  spSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  spLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  spLoadingText: {
    fontSize: 14,
    color: '#666',
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
    color: '#000000',
    marginBottom: 2,
  },
  spToggleHint: {
    fontSize: 13,
    color: '#666666',
  },
  spEligibleBadge: {
    marginTop: 10,
    backgroundColor: '#E8F5E9',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  spEligibleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2E7D32',
  },
  spUpgradePrompt: {
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    padding: 12,
  },
  spUpgradeText: {
    fontSize: 14,
    color: '#795548',
    marginBottom: 10,
  },
  spUpgradeButton: {
    backgroundColor: '#FF9800',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
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
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitModalPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  submitModalSecondaryButton: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitModalSecondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '700',
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
});
