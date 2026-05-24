import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  InteractionManager,
} from 'react-native';
import { Package } from 'phosphor-react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../hooks/useAuth';
import { PhotoAsset, PhotoGroup } from '../types/listing';
import {
  uploadPhotoBatch,
  groupPhotosAuto,
  mergeGroups,
  splitGroup,
  addEmptyGroup,
  removeGroup,
  removePhotoFromGroups,
  appendPhotosAsGroups,
  addPhotosToGroup,
  PHOTO_LIMITS,
} from '../services/photoService';
import { analyzePhotosBatch } from '../services/aiService';
import {
  createItemDraft,
  getActiveDrafts,
  markBulkSessionProcessing,
  publishBulkDrafts,
  startBulkSession,
  updateItemDraft,
} from '../services/draftService';
import { getSubscriptionSummary } from '../services/subscription';
import { getCategories } from '../services/categoryService';
import { computePhotoHash, findDuplicateIndices } from '../utils/photoHash';
import { Category, CategorySelectModal } from '../components/listing/CategorySelectModal';
import { BulkPhotoUploader } from '../components/bulk/BulkPhotoUploader';
import { PhotoSelectGrid } from '../components/bulk/PhotoSelectGrid';
import { SelectionActionBar } from '../components/bulk/SelectionActionBar';
import { BulkStepIndicator, BulkStep } from '../components/bulk/BulkStepIndicator';
import { BulkIntroSheet } from '../components/bulk/BulkIntroSheet';
import { ApplyToAllBar } from '../components/bulk/ApplyToAllBar';
import { BulkEditableItem } from '../components/bulk/BulkItemCard';
import { ItemCardStack } from '../components/bulk/ItemCardStack';
import { BulkPublishBar } from '../components/bulk/BulkPublishBar';
import { BulkPublishConfirmSheet } from '../components/bulk/BulkPublishConfirmSheet';
import { BulkFlowState, bulkListingReducer } from './bulkListingStateMachine';
import { BulkSPSummaryCard } from '../components/bulk/BulkSPSummaryCard';
import { LoadingSpinner } from '@/components/ui';
import ScreenLayout from '@/components/ScreenLayout';

const BULK_AI_ANALYSIS_BLOCKING_TIMEOUT_MS = 7000;
type PhotoSourceOption = 'camera' | 'library';

function getMissingRequired(item: BulkEditableItem): string[] {
  const missing: string[] = [];
  if (!item.title.trim()) missing.push('title');
  if (!item.condition) missing.push('condition');
  const isOtherCategory =
    item.category_id === 'other' || item.category_name?.trim().toLowerCase() === 'other';
  if (isOtherCategory) {
    if (!item.requested_category_name?.trim()) missing.push('category');
  } else if (!item.category_id && !item.requested_category_name?.trim()) {
    missing.push('category');
  }
  const parsedPrice = Number(item.price);
  if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) missing.push('price');
  return missing;
}

function coverUriForGroup(group: PhotoGroup | undefined): string | null {
  if (!group || group.photos.length === 0) return null;
  const cover = group.photos[group.primaryPhotoIndex] || group.photos[0];
  return cover?.uri || null;
}

function mapGroupsToItems(
  groups: PhotoGroup[],
  previous: BulkEditableItem[] = []
): BulkEditableItem[] {
  return groups.map((group) => {
    const prev = previous.find((item) => item.groupId === group.groupId);
    const mapped: BulkEditableItem = {
      groupId: group.groupId,
      title: prev?.title || '',
      description: prev?.description || '',
      price: prev?.price || '',
      category_name: prev?.category_name,
      category_id: prev?.category_id,
      requested_category_name: prev?.requested_category_name,
      condition: prev?.condition || null,
      brand: prev?.brand || '',
      color: prev?.color || [],
      age_group: prev?.age_group || null,
      gender: prev?.gender || null,
      accepts_swap_points: prev?.accepts_swap_points ?? false,
      includeInPublish: prev?.includeInPublish ?? true,
      missingRequired: prev?.missingRequired || [],
      aiState: prev?.aiState ?? 'idle',
      aiFilledFields: prev?.aiFilledFields || [],
      aiError: prev?.aiError ?? null,
      coverPhotoUri: coverUriForGroup(group),
    };
    mapped.missingRequired = getMissingRequired(mapped);
    return mapped;
  });
}

function flowStateToStep(flowState: BulkFlowState): BulkStep {
  if (flowState === 'IDLE' || flowState === 'ADDING_PHOTOS') return 'photos';
  if (flowState === 'GROUPING') return 'group';
  if (flowState === 'AI_ANALYZING' || flowState === 'REVIEWING_ITEMS') return 'review';
  return 'publish';
}

function hasPhotoHash(hashMap: Record<string, string>, photoId: string): boolean {
  return Object.prototype.hasOwnProperty.call(hashMap, photoId);
}

function isLikelyLocalPhotoUri(uri: string): boolean {
  return (
    uri.startsWith('file://') ||
    uri.startsWith('ph://') ||
    uri.startsWith('content://') ||
    uri.startsWith('asset-library://') ||
    uri.startsWith('assets-library://')
  );
}

function photoLabelFromUri(uri: string, index: number): string {
  const tail = uri.split('/').pop();
  if (tail && tail.trim().length > 0) return tail;
  return `Photo ${index + 1}`;
}

function buildUploadFailureMessage(
  errors: { index: number; error: string }[],
  picked: PhotoAsset[]
): string {
  const header =
    errors.length === 1
      ? '1 photo failed to upload and was skipped.'
      : `${errors.length} photos failed to upload and were skipped.`;
  const details = errors.slice(0, 3).map((entry) => {
    const label = photoLabelFromUri(picked[entry.index]?.uri || '', entry.index);
    return `- ${label}: ${entry.error}`;
  });
  const remainder = errors.length > 3 ? `\n- +${errors.length - 3} more failure(s)` : '';
  return `${header}\n${details.join('\n')}${remainder}\nUse "+ Add more photos" to retry.`;
}

export default function BulkListingCreateScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { session } = useAuth();
  const sellerId = session?.user?.id || '';
  const initialPhotoSource = route.params?.initialPhotoSource as PhotoSourceOption | undefined;
  const showPhotoSourcePrompt = Boolean(route.params?.showPhotoSourcePrompt);

  const [flowState, dispatch] = useReducer(bulkListingReducer, 'IDLE' as BulkFlowState);
  const [photos, setPhotos] = useState<PhotoAsset[]>([]);
  const [groups, setGroups] = useState<PhotoGroup[]>([]);
  const [items, setItems] = useState<BulkEditableItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [draftId, setDraftId] = useState<string | null>(null);
  const [bulkUploadId, setBulkUploadId] = useState<string | null>(null);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [categoryPickerGroupId, setCategoryPickerGroupId] = useState<string | null>(null);

  // V3.1 multi-select grouping state (Decision 4)
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  // V3.1 dup detection (Decision 12)
  const [photoHashes, setPhotoHashes] = useState<Record<string, string>>({});
  const [duplicatePhotoIds, setDuplicatePhotoIds] = useState<string[]>([]);

  const [uploading, setUploading] = useState(false);
  const [processingAI, setProcessingAI] = useState(false);
  const [showConfirmSheet, setShowConfirmSheet] = useState(false);
  const [publishErrors, setPublishErrors] = useState<string[]>([]);
  const [showSubmitReviewModal, setShowSubmitReviewModal] = useState(false);
  const [showPhotoSourceModal, setShowPhotoSourceModal] = useState(false);
  const [pendingPhotoSource, setPendingPhotoSource] = useState<PhotoSourceOption | null>(null);
  const [pendingPhotoSourceTargetGroupId, setPendingPhotoSourceTargetGroupId] = useState<
    string | null | undefined
  >(undefined);
  const [canAcceptSP, setCanAcceptSP] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(true);
  const [allowManualWhileAnalyzing, setAllowManualWhileAnalyzing] = useState(false);

  const lastSavedPayload = useRef<string>('');
  const restoringDraftRef = useRef(false);
  const attemptedRestoreRef = useRef(false);
  const aiBlockingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiReviewReleasedRef = useRef(false);
  const aiRunIdRef = useRef(0);
  const hasHandledInitialPhotoSourceRef = useRef(false);

  const clearAIBlockingTimeout = useCallback(() => {
    if (aiBlockingTimeoutRef.current) {
      clearTimeout(aiBlockingTimeoutRef.current);
      aiBlockingTimeoutRef.current = null;
    }
  }, []);

  const releaseAIReview = useCallback(() => {
    if (aiReviewReleasedRef.current) {
      return;
    }
    aiReviewReleasedRef.current = true;
    setAllowManualWhileAnalyzing(true);
    dispatch({ type: 'AI_DONE' });
  }, []);

  const resetBulkSessionState = useCallback(() => {
    clearAIBlockingTimeout();
    aiRunIdRef.current += 1;
    aiReviewReleasedRef.current = false;
    setPhotos([]);
    setGroups([]);
    setItems([]);
    setDraftId(null);
    setBulkUploadId(null);
    setExpandedGroupId(null);
    setCategoryPickerGroupId(null);
    setSelectedPhotoIds([]);
    setPhotoHashes({});
    setDuplicatePhotoIds([]);
    setUploading(false);
    setProcessingAI(false);
    setShowConfirmSheet(false);
    setPublishErrors([]);
    setShowSubmitReviewModal(false);
    setAllowManualWhileAnalyzing(false);
    lastSavedPayload.current = '';
    attemptedRestoreRef.current = false;
    dispatch({ type: 'RESET' });
  }, [clearAIBlockingTimeout]);

  useEffect(() => {
    return () => {
      clearAIBlockingTimeout();
      aiRunIdRef.current += 1;
    };
  }, [clearAIBlockingTimeout]);

  const hydrateFromDraft = useCallback(async (draft: any) => {
    const draftData = (draft?.draft_data || {}) as any;
    const draftItems = Array.isArray(draftData.items) ? draftData.items : [];

    const fallbackPhotoUrls = Array.isArray(draftData?.photo_urls)
      ? draftData.photo_urls
      : Array.isArray(draft?.photo_urls)
        ? draft.photo_urls
        : [];

    if (!draftItems.length && fallbackPhotoUrls.length === 0) {
      return false;
    }

    const restoredGroups: PhotoGroup[] = draftItems.length
      ? draftItems
          .map((item: any, itemIndex: number) => {
            const photoUrls = Array.isArray(item?.photo_urls) ? item.photo_urls : [];
            const photosForGroup: PhotoAsset[] = photoUrls
              .filter(
                (uri: unknown): uri is string => typeof uri === 'string' && uri.trim().length > 0
              )
              .map((uri: string, photoIndex: number) => ({
                id: `${item?.groupId || `restored-${itemIndex}`}-photo-${photoIndex}`,
                uri,
                width: 0,
                height: 0,
              }));

            return {
              groupId: String(item?.groupId || `restored-group-${itemIndex}`),
              photos: photosForGroup,
              primaryPhotoIndex: 0,
            } satisfies PhotoGroup;
          })
          .filter((group: PhotoGroup) => group.photos.length > 0)
      : fallbackPhotoUrls
          .filter((uri: unknown): uri is string => typeof uri === 'string' && uri.trim().length > 0)
          .map((uri: string, itemIndex: number) => ({
            groupId: `restored-group-${itemIndex}`,
            photos: [
              {
                id: `restored-group-${itemIndex}-photo-0`,
                uri,
                width: 0,
                height: 0,
              },
            ],
            primaryPhotoIndex: 0,
          }));

    if (!restoredGroups.length) {
      return false;
    }

    const restoredItems: BulkEditableItem[] = restoredGroups.map((group, groupIndex) => {
      const source =
        draftItems.find((entry: any) => String(entry?.groupId) === group.groupId) ||
        draftItems[groupIndex] ||
        {};
      const restored: BulkEditableItem = {
        groupId: group.groupId,
        title: String(source?.title || ''),
        description: String(source?.description || ''),
        price: source?.price != null ? String(source.price) : '',
        category_name: source?.category_name || undefined,
        category_id: source?.category_id || undefined,
        requested_category_name: source?.requested_category_name || undefined,
        condition: source?.condition || null,
        brand: String(source?.brand || ''),
        color: Array.isArray(source?.color) ? source.color : [],
        age_group: source?.age_group || null,
        gender: source?.gender || null,
        accepts_swap_points: Boolean(source?.accepts_swap_points),
        includeInPublish: source?.includeInPublish !== false,
        missingRequired: [],
        aiState: 'idle',
        aiFilledFields: [],
        aiError: null,
        coverPhotoUri: coverUriForGroup(group),
      };
      restored.missingRequired = getMissingRequired(restored);
      return restored;
    });

    const flattenedPhotos = restoredGroups.flatMap((group) => group.photos);
    const nextStep = String(draftData?.step || draft?.step || 'grouping');

    setDraftId(String(draft.id));
    setBulkUploadId((draft as any)?.bulk_upload_id || null);
    setPhotos(flattenedPhotos);
    setGroups(restoredGroups);
    setItems(restoredItems);
    setExpandedGroupId(restoredItems[0]?.groupId || null);

    if (nextStep === 'review') {
      dispatch({ type: 'AI_DONE' });
    } else {
      dispatch({ type: 'GROUPS_READY' });
    }

    const snapshot = {
      step: nextStep === 'review' ? 'review' : 'grouping',
      items: restoredItems.map((item) => {
        const group = restoredGroups.find((candidate) => candidate.groupId === item.groupId);
        return {
          groupId: item.groupId,
          title: item.title,
          description: item.description,
          price: Number(item.price) || 0,
          category_id: item.category_id,
          requested_category_name: item.requested_category_name,
          condition: item.condition,
          brand: item.brand,
          color: item.color,
          age_group: item.age_group,
          gender: item.gender,
          accepts_swap_points: Boolean(item.accepts_swap_points),
          includeInPublish: item.includeInPublish,
          photo_urls: group?.photos.map((photo) => photo.uri) || [],
        };
      }),
      photo_urls: flattenedPhotos.map((photo) => photo.uri),
    };
    lastSavedPayload.current = JSON.stringify(snapshot);

    return true;
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!sellerId) return undefined;
      if (attemptedRestoreRef.current) return undefined;
      if (restoringDraftRef.current) return undefined;
      if (draftId || photos.length > 0 || groups.length > 0 || items.length > 0) {
        attemptedRestoreRef.current = true;
        return undefined;
      }

      let cancelled = false;

      const restoreDraft = async () => {
        restoringDraftRef.current = true;
        try {
          const drafts = await getActiveDrafts(sellerId);
          if (cancelled || !drafts.length) {
            attemptedRestoreRef.current = true;
            return;
          }

          const bulkDraft = drafts.find((entry: any) => {
            const data = (entry?.draft_data || {}) as any;
            const hasItems = Array.isArray(data?.items) && data.items.length > 0;
            const hasPhotos =
              (Array.isArray(data?.photo_urls) && data.photo_urls.length > 0) ||
              (Array.isArray(entry?.photo_urls) && entry.photo_urls.length > 0);
            return hasItems || ((entry?.bulk_upload_id || null) && hasPhotos);
          });

          if (!bulkDraft) {
            attemptedRestoreRef.current = true;
            return;
          }

          const restored = await hydrateFromDraft(bulkDraft as any);
          if (!cancelled) {
            attemptedRestoreRef.current = true;
            if (restored) {
              Alert.alert('Draft Restored', 'Your bulk draft has been restored.');
            }
          }
        } catch (error) {
          console.error('[BulkListingCreateScreen] restore draft error:', error);
          if (!cancelled) {
            attemptedRestoreRef.current = true;
          }
        } finally {
          restoringDraftRef.current = false;
        }
      };

      void restoreDraft();

      return () => {
        cancelled = true;
      };
    }, [sellerId, draftId, photos.length, groups.length, items.length, hydrateFromDraft])
  );

  useEffect(() => {
    void getCategories().then((data) => setCategories(data as Category[]));
  }, []);

  const loadSubscription = useCallback(async () => {
    if (!session?.user?.id) {
      setCanAcceptSP(false);
      setCheckingSubscription(false);
      return;
    }
    try {
      setCheckingSubscription(true);
      const summary = await getSubscriptionSummary(session.user.id);
      setCanAcceptSP(summary.can_spend_sp);
    } catch (err) {
      console.error('[BulkListingCreateScreen] loadSubscription error:', err);
      setCanAcceptSP(false);
    } finally {
      setCheckingSubscription(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    void loadSubscription();
  }, [loadSubscription]);

  useFocusEffect(
    useCallback(() => {
      void loadSubscription();
      return undefined;
    }, [loadSubscription])
  );

  useEffect(() => {
    if (canAcceptSP) return;
    setItems((prev) => {
      const hasAnyEnabled = prev.some((item) => item.accepts_swap_points);
      if (!hasAnyEnabled) return prev;
      return prev.map((item) => ({ ...item, accepts_swap_points: false }));
    });
  }, [canAcceptSP]);

  // V3.1 (Decision 12): compute perceptual hashes for newly uploaded photos
  // and surface duplicate detections.
  useEffect(() => {
    let cancelled = false;
    const missing = photos.filter(
      (p) => !hasPhotoHash(photoHashes, p.id) && isLikelyLocalPhotoUri(p.uri)
    );
    if (missing.length === 0) return;
    (async () => {
      const updates: Record<string, string> = {};
      for (const photo of missing) {
        const hash = await computePhotoHash(photo.uri);
        updates[photo.id] = hash;
      }
      if (cancelled) return;
      setPhotoHashes((prev) => ({ ...prev, ...updates }));
    })();
    return () => {
      cancelled = true;
    };
  }, [photos, photoHashes]);

  useEffect(() => {
    const ordered = photos.map((p) => photoHashes[p.id] ?? '');
    const dupIndices = findDuplicateIndices(ordered);
    setDuplicatePhotoIds(dupIndices.map((idx) => photos[idx].id));
  }, [photos, photoHashes]);

  const persistPayload = useMemo(
    () => ({
      step: flowState === 'GROUPING' ? 'grouping' : 'review',
      items: items.map((item) => {
        const group = groups.find((g) => g.groupId === item.groupId);
        return {
          groupId: item.groupId,
          title: item.title,
          description: item.description,
          price: Number(item.price) || 0,
          category_id: item.category_id,
          requested_category_name: item.requested_category_name,
          condition: item.condition,
          brand: item.brand,
          color: item.color,
          age_group: item.age_group,
          gender: item.gender,
          accepts_swap_points: Boolean(item.accepts_swap_points),
          includeInPublish: item.includeInPublish,
          photo_urls: group?.photos.map((p) => p.uri) || [],
        };
      }),
      photo_urls: photos.map((photo) => photo.uri),
    }),
    [flowState, groups, items, photos]
  );

  const saveNow = useCallback(async () => {
    if (!draftId) return;
    if (restoringDraftRef.current) return;
    const serialized = JSON.stringify(persistPayload);
    if (serialized === lastSavedPayload.current) return;
    const ok = await updateItemDraft(draftId, persistPayload as any);
    if (ok) {
      lastSavedPayload.current = serialized;
    }
  }, [draftId, persistPayload]);

  useEffect(() => {
    void saveNow();
  }, [saveNow]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        void saveNow();
      };
    }, [saveNow])
  );

  // ───────────────────────────────────────────────────────────────────
  // Photo picking
  // ───────────────────────────────────────────────────────────────────

  const pickAssetsFromSource = async (source: PhotoSourceOption, selectionLimit: number) => {
    console.log('[BulkCreate] pickAssetsFromSource called - source:', source, 'limit:', selectionLimit);
    
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
      if (result.canceled || !result.assets || result.assets.length === 0) return null;
      return result.assets.slice(0, 1).map((asset, index) => ({
        id: `${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`,
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        fileSize: asset.fileSize,
        mimeType: asset.mimeType,
      })) as PhotoAsset[];
    }

    console.log('[BulkCreate] Requesting media library permissions...');
    const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    console.log('[BulkCreate] Media permission status:', mediaPermission?.status);
    
    if (mediaPermission?.status && mediaPermission.status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library access is needed to select photos.');
      return null;
    }

    console.log('[BulkCreate] Launching image library picker...');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit,
      quality: 1,
    });
    console.log('[BulkCreate] Picker result - canceled:', result.canceled, 'assets:', result.assets?.length);
    
    if (result.canceled || !result.assets || result.assets.length === 0) return null;
    return result.assets.slice(0, selectionLimit).map((asset, index) => ({
      id: `${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`,
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      fileSize: asset.fileSize,
      mimeType: asset.mimeType,
    })) as PhotoAsset[];
  };

  const handlePickPhotosFromSource = useCallback(
    async (source: PhotoSourceOption) => {
      try {
        const limit = PHOTO_LIMITS.MAX_PHOTOS_TOTAL;
        const picked = await pickAssetsFromSource(source, limit);
        if (!picked) return;

        dispatch({ type: 'PHOTOS_ADDED' });

        const hashEntries = await Promise.all(
          picked.map(async (photo) => [photo.id, await computePhotoHash(photo.uri)] as const)
        );
        setPhotoHashes((prev) => ({ ...prev, ...Object.fromEntries(hashEntries) }));

        setUploading(true);
        const uploadResult = await uploadPhotoBatch(picked, sellerId);
        const failedIndexes = new Set(uploadResult.errors.map((entry) => entry.index));
        const successfulAssets: PhotoAsset[] = [];
        let uploadedUrlIndex = 0;
        picked.forEach((asset, index) => {
          if (failedIndexes.has(index)) return;
          const uploadedUri = uploadResult.urls[uploadedUrlIndex];
          uploadedUrlIndex += 1;
          successfulAssets.push({
            ...asset,
            uri: uploadedUri || asset.uri,
          });
        });
        if (successfulAssets.length === 0) {
          Alert.alert('Uploads failed', buildUploadFailureMessage(uploadResult.errors, picked));
          dispatch({ type: 'FAIL' });
          return;
        }

        const capped = successfulAssets.slice(0, limit);
        // Default 1 photo per item — Decision 1
        const nextGroups = groupPhotosAuto(capped, 1);
        const nextItems = mapGroupsToItems(nextGroups);
        const groupedPhotos = nextGroups.flatMap((group) => group.photos);

        setPhotos(groupedPhotos);
        setGroups(nextGroups);
        setItems(nextItems);
        dispatch({ type: 'GROUPS_READY' });

        const sessionRow = await startBulkSession(sellerId);
        if (!sessionRow) {
          Alert.alert('Error', 'Failed to start bulk session');
          return;
        }
        setBulkUploadId(sessionRow.id);

        const draft = await createItemDraft(
          sellerId,
          {
            step: 'grouping',
            items: nextItems,
            photo_urls: groupedPhotos.map((photo) => photo.uri),
          } as any,
          sessionRow.id
        );
        if (draft) setDraftId(draft.id);

        if (uploadResult.errors.length > 0) {
          Alert.alert('Some uploads failed', buildUploadFailureMessage(uploadResult.errors, picked));
        }
      } catch (error: any) {
        Alert.alert('Error', error?.message || 'Failed to add photos');
        dispatch({ type: 'FAIL' });
      } finally {
        setUploading(false);
      }
    },
    [sellerId]
  );

  const handlePickPhotos = () => {
    if (!showPhotoSourcePrompt) {
      void handlePickPhotosFromSource('library');
      return;
    }

    setPendingPhotoSourceTargetGroupId(undefined);
    setShowPhotoSourceModal(true);
  };

  const handleAddMorePhotosFromSource = useCallback(
    async (source: PhotoSourceOption, targetGroupId?: string | null) => {
      try {
        const remainingTotal = PHOTO_LIMITS.MAX_PHOTOS_TOTAL - photos.length;
        if (remainingTotal <= 0) {
          Alert.alert('Limit reached', 'You have already added the maximum number of photos.');
          return;
        }

        const remainingGroups = PHOTO_LIMITS.MAX_GROUPS - groups.length;
        const limit = targetGroupId
          ? remainingTotal
          : Math.min(remainingTotal, Math.max(0, remainingGroups));
        if (limit <= 0) {
          Alert.alert(
            'Item limit reached',
            `You can create at most ${PHOTO_LIMITS.MAX_GROUPS} items. Use "+ Photos" on an existing item to add more photos.`
          );
          return;
        }
        const picked = await pickAssetsFromSource(source, limit);
        if (!picked) return;

        const hashEntries = await Promise.all(
          picked.map(async (photo) => [photo.id, await computePhotoHash(photo.uri)] as const)
        );
        setPhotoHashes((prev) => ({ ...prev, ...Object.fromEntries(hashEntries) }));

        setUploading(true);
        const uploadResult = await uploadPhotoBatch(picked, sellerId);
        const failedIndexes = new Set(uploadResult.errors.map((entry) => entry.index));
        const successfulAssets: PhotoAsset[] = [];
        let uploadedUrlIndex = 0;
        picked.forEach((asset, index) => {
          if (failedIndexes.has(index)) return;
          const uploadedUri = uploadResult.urls[uploadedUrlIndex];
          uploadedUrlIndex += 1;
          successfulAssets.push({
            ...asset,
            uri: uploadedUri || asset.uri,
          });
        });

        if (successfulAssets.length === 0) {
          Alert.alert('Uploads failed', buildUploadFailureMessage(uploadResult.errors, picked));
          return;
        }

        let nextGroups = groups;
        if (targetGroupId) {
          nextGroups = addPhotosToGroup(groups, targetGroupId, successfulAssets);
        } else {
          nextGroups = appendPhotosAsGroups(groups, successfulAssets);
        }
        // Recompute photos (in case caps trimmed)
        const nextPhotos = nextGroups.flatMap((g) => g.photos);

        setPhotos(nextPhotos);
        setGroups(nextGroups);
        setItems((current) => mapGroupsToItems(nextGroups, current));

        if (uploadResult.errors.length > 0) {
          Alert.alert('Some uploads failed', buildUploadFailureMessage(uploadResult.errors, picked));
        }
      } catch (error: any) {
        Alert.alert('Error', error?.message || 'Failed to add photos');
      } finally {
        setUploading(false);
      }
    },
    [photos, groups, sellerId]
  );

  const handleAddMorePhotos = (targetGroupId?: string | null) => {
    if (!showPhotoSourcePrompt) {
      void handleAddMorePhotosFromSource('library', targetGroupId);
      return;
    }

    setPendingPhotoSourceTargetGroupId(targetGroupId ?? null);
    setShowPhotoSourceModal(true);
  };

  useEffect(() => {
    console.log('[BulkCreate] Photo source effect - modal:', showPhotoSourceModal, 'pending:', pendingPhotoSource, 'targetGroup:', pendingPhotoSourceTargetGroupId);
    
    if (showPhotoSourceModal || !pendingPhotoSource) {
      return;
    }

    console.log('[BulkCreate] Queueing picker launch for:', pendingPhotoSource);
    const sourceToLaunch = pendingPhotoSource;
    const targetGroupId = pendingPhotoSourceTargetGroupId;

    // Wait for modal close animation AND all pending interactions to complete
    const interactionHandle = InteractionManager.runAfterInteractions(() => {
      console.log('[BulkCreate] Interactions complete, waiting additional delay...');
      setTimeout(() => {
        console.log('[BulkCreate] Launching picker for:', sourceToLaunch, 'targetGroup:', targetGroupId);
        if (targetGroupId === undefined) {
          void handlePickPhotosFromSource(sourceToLaunch);
        } else {
          void handleAddMorePhotosFromSource(sourceToLaunch, targetGroupId);
        }
        setPendingPhotoSource(null);
        setPendingPhotoSourceTargetGroupId(undefined);
      }, 500);
    });

    return () => {
      console.log('[BulkCreate] Clearing picker interaction handle');
      interactionHandle.cancel();
    };
  }, [
    showPhotoSourceModal,
    pendingPhotoSource,
    pendingPhotoSourceTargetGroupId,
    handlePickPhotosFromSource,
    handleAddMorePhotosFromSource,
  ]);

  useEffect(() => {
    if (hasHandledInitialPhotoSourceRef.current) {
      return;
    }
    if (!initialPhotoSource || photos.length > 0) {
      return;
    }

    hasHandledInitialPhotoSourceRef.current = true;
    void handlePickPhotosFromSource(initialPhotoSource);
  }, [handlePickPhotosFromSource, initialPhotoSource, photos.length]);

  // ───────────────────────────────────────────────────────────────────
  // Multi-select grouping (Decision 4)
  // ───────────────────────────────────────────────────────────────────

  const togglePhotoSelection = (photoId: string) => {
    setSelectedPhotoIds((prev) =>
      prev.includes(photoId) ? prev.filter((id) => id !== photoId) : [...prev, photoId]
    );
  };

  const longPressPhoto = (photoId: string) => {
    setSelectedPhotoIds((prev) => (prev.length === 0 ? [photoId] : prev));
  };

  const clearSelection = () => setSelectedPhotoIds([]);

  // Map photoId → { groupId, photo }
  const photoIndex = useMemo(() => {
    const map = new Map<string, { groupId: string; photo: PhotoAsset }>();
    groups.forEach((g) => g.photos.forEach((p) => map.set(p.id, { groupId: g.groupId, photo: p })));
    return map;
  }, [groups]);

  const selectedSourceGroupIds = useMemo(() => {
    const ids = new Set<string>();
    selectedPhotoIds.forEach((pid) => {
      const entry = photoIndex.get(pid);
      if (entry) ids.add(entry.groupId);
    });
    return Array.from(ids);
  }, [photoIndex, selectedPhotoIds]);

  const handleMergeSelection = () => {
    if (selectedSourceGroupIds.length < 2) {
      Alert.alert(
        'Select photos from different items',
        'Pick photos from at least two different items to merge them into one.'
      );
      return;
    }
    const { groups: merged, overflow } = mergeGroups(groups, selectedSourceGroupIds);
    setGroups(merged);
    setItems((current) => mapGroupsToItems(merged, current));
    setSelectedPhotoIds([]);
    if (overflow > 0) {
      Alert.alert(
        'Some photos couldn\u2019t be merged',
        `Each item can hold at most ${PHOTO_LIMITS.MAX_PHOTOS_PER_GROUP} photos. ${overflow} extra photo(s) were left in their original items.`
      );
    }
  };

  const handleMoveSelectionToNewItem = () => {
    if (selectedPhotoIds.length === 0) return;
    if (groups.length >= PHOTO_LIMITS.MAX_GROUPS) {
      Alert.alert(
        'Item limit reached',
        `You can list at most ${PHOTO_LIMITS.MAX_GROUPS} items per bulk session.`
      );
      return;
    }
    let nextGroups = groups;
    const moving: PhotoAsset[] = [];
    selectedPhotoIds.forEach((pid) => {
      const entry = photoIndex.get(pid);
      if (entry) {
        moving.push(entry.photo);
        nextGroups = removePhotoFromGroups(nextGroups, pid);
      }
    });
    if (moving.length === 0) return;
    nextGroups = appendPhotosAsGroups(nextGroups, moving);
    // Then collapse the trailing 1-photo groups into a single new group
    const lastN = nextGroups.slice(-moving.length).map((g) => g.groupId);
    if (lastN.length > 1) {
      const merged = mergeGroups(nextGroups, lastN);
      nextGroups = merged.groups;
    }
    setGroups(nextGroups);
    setItems((current) => mapGroupsToItems(nextGroups, current));
    setSelectedPhotoIds([]);
  };

  const handleDeleteSelection = () => {
    Alert.alert('Delete selected photos?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          let nextGroups = groups;
          selectedPhotoIds.forEach((pid) => {
            nextGroups = removePhotoFromGroups(nextGroups, pid);
          });
          setGroups(nextGroups);
          setPhotos(nextGroups.flatMap((g) => g.photos));
          setItems((current) => mapGroupsToItems(nextGroups, current));
          setSelectedPhotoIds([]);
        },
      },
    ]);
  };

  // ───────────────────────────────────────────────────────────────────
  // Per-photo / per-group actions
  // ───────────────────────────────────────────────────────────────────

  const handleSetCover = (groupId: string, photoIndexInGroup: number) => {
    setGroups((prev) => {
      const next = prev.map((g) =>
        g.groupId === groupId ? { ...g, primaryPhotoIndex: photoIndexInGroup } : g
      );
      setItems((current) => mapGroupsToItems(next, current));
      return next;
    });
  };

  const handleDeletePhoto = (photoId: string) => {
    const nextGroups = removePhotoFromGroups(groups, photoId);
    setGroups(nextGroups);
    setPhotos(nextGroups.flatMap((g) => g.photos));
    setItems((current) => mapGroupsToItems(nextGroups, current));
  };

  const handleDeleteGroup = (groupId: string) => {
    Alert.alert('Delete this item?', 'All photos for this item will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const nextGroups = removeGroup(groups, groupId);
          setGroups(nextGroups);
          setPhotos(nextGroups.flatMap((g) => g.photos));
          setItems((current) => mapGroupsToItems(nextGroups, current));
        },
      },
    ]);
  };

  const handleSplitGroup = (groupId: string) => {
    const nextGroups = splitGroup(groups, groupId);
    setGroups(nextGroups);
    setItems((current) => mapGroupsToItems(nextGroups, current));
  };

  const handleAddPhotosToGroup = (groupId: string) => {
    handleAddMorePhotos(groupId);
  };

  const handleAddEmptyGroup = () => {
    const nextGroups = addEmptyGroup(groups);
    setGroups(nextGroups);
    setItems((current) => mapGroupsToItems(nextGroups, current));
  };

  // Decision 7: reset every photo into its own item
  const handleResetGrouping = () => {
    Alert.alert(
      'Reset grouping?',
      'Every photo will become its own item. You can re-merge them after.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            const flat = groups.flatMap((g) => g.photos);
            const fresh = groupPhotosAuto(flat, 1);
            setGroups(fresh);
            setPhotos(flat);
            setItems(mapGroupsToItems(fresh));
            dispatch({ type: 'RESET_GROUPING' });
          },
        },
      ]
    );
  };

  const handleEditGrouping = () => {
    dispatch({ type: 'EDIT_GROUPING' });
  };

  // ───────────────────────────────────────────────────────────────────
  // AI batch + per-item retry (Decision 11)
  // ───────────────────────────────────────────────────────────────────

  const applyAIToItem = (groupId: string, analysis?: any) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.groupId !== groupId) return item;
        const next: BulkEditableItem = { ...item };
        const filled: string[] = [];
        if (analysis?.title?.value && !next.title.trim()) {
          next.title = analysis.title.value;
          filled.push('title');
        }
        if (analysis?.condition?.value && !next.condition) {
          next.condition = analysis.condition.value;
          filled.push('condition');
        }
        if (analysis?.brand?.value && !next.brand.trim()) {
          next.brand = analysis.brand.value;
          filled.push('brand');
        }
        if (analysis?.age_group?.value && !next.age_group) {
          next.age_group = analysis.age_group.value;
          filled.push('age_group');
        }
        if (analysis?.gender?.value && !next.gender) {
          next.gender = analysis.gender.value;
          filled.push('gender');
        }
        if (analysis?.color?.value && next.color.length === 0) {
          next.color = analysis.color.value;
          filled.push('color');
        }
        // Only auto-apply AI category when it maps to a real category id in our list.
        // If AI proposes an unlisted label (e.g. "Sleeve"), keep category blank so user selects manually.
        if (analysis?.category?.value && !next.category_id) {
          const aiCategoryId = analysis.category.value.categoryId;
          const matchedCategory = aiCategoryId
            ? categories.find((category) => category.id === aiCategoryId)
            : undefined;

          if (matchedCategory) {
            next.category_id = matchedCategory.id;
            next.category_name = matchedCategory.name;
            filled.push('category');
          }
        }

        // Clean up legacy invalid state from older AI runs where category_name was set
        // without a real category_id.
        const hasManualCustomCategory = Boolean(next.requested_category_name?.trim());
        if (!next.category_id && !hasManualCustomCategory) {
          next.category_name = undefined;
        }
        next.aiState = analysis ? 'success' : 'failed';
        next.aiFilledFields = filled;
        next.aiError = analysis ? null : 'Could not analyze this photo';
        next.missingRequired = getMissingRequired(next);
        return next;
      })
    );
  };

  const handleConfirmGrouping = async () => {
    if (!bulkUploadId) {
      Alert.alert('Missing session', 'Bulk session was not initialized. Please reselect photos.');
      return;
    }

    const groupsWithoutPhotos = groups
      .map((group, index) => ({ group, index }))
      .filter(({ group }) => group.photos.length === 0)
      .map(({ index }) => index + 1);

    if (groupsWithoutPhotos.length > 0) {
      const itemLabel = groupsWithoutPhotos.length === 1 ? 'item' : 'items';
      Alert.alert(
        'Cannot Proceed Yet',
        `One or more of your ${itemLabel} has no photo. Please upload at least one photo for ${itemLabel} ${groupsWithoutPhotos.join(', ')} before proceeding.`
      );
      return;
    }

    const runId = aiRunIdRef.current + 1;
    aiRunIdRef.current = runId;
    aiReviewReleasedRef.current = false;
    setAllowManualWhileAnalyzing(false);
    clearAIBlockingTimeout();

    setProcessingAI(true);
    dispatch({ type: 'AI_START' });
    setItems((prev) => prev.map((it) => ({ ...it, aiState: 'analyzing', aiError: null })));

    aiBlockingTimeoutRef.current = setTimeout(() => {
      if (runId !== aiRunIdRef.current) {
        return;
      }
      releaseAIReview();
    }, BULK_AI_ANALYSIS_BLOCKING_TIMEOUT_MS);

    const groupsSnapshot = [...groups];
    void (async () => {
      try {
        await markBulkSessionProcessing(bulkUploadId, photos.length, groupsSnapshot.length);

        await Promise.all(
          groupsSnapshot.map(async (group) => {
            const primary = group.photos[group.primaryPhotoIndex]?.uri;
            if (!primary) {
              applyAIToItem(group.groupId, undefined);
              return;
            }
            try {
              const response = await analyzePhotosBatch(
                [
                  {
                    groupId: group.groupId,
                    primaryPhotoUrl: primary,
                    allPhotoUrls: group.photos.map((p) => p.uri),
                  },
                ],
                sellerId
              );
              const result = response.results[0];
              applyAIToItem(group.groupId, result?.analysis);
            } catch (error) {
              console.warn('[BulkListing] AI failure for group', group.groupId, error);
              applyAIToItem(group.groupId, undefined);
            }
          })
        );
      } catch (error) {
        console.warn('[BulkListing] AI batch flow failed', error);
      } finally {
        if (runId !== aiRunIdRef.current) {
          return;
        }
        clearAIBlockingTimeout();
        setProcessingAI(false);
        releaseAIReview();
      }
    })();
  };

  const handleContinueWithoutAI = () => {
    clearAIBlockingTimeout();
    releaseAIReview();
  };

  const handleRetryAIForItem = async (groupId: string) => {
    const group = groups.find((g) => g.groupId === groupId);
    if (!group) return;
    const primary = group.photos[group.primaryPhotoIndex]?.uri;
    if (!primary) {
      Alert.alert('Add a photo first', 'This item has no photos to analyze.');
      return;
    }
    setItems((prev) =>
      prev.map((it) =>
        it.groupId === groupId ? { ...it, aiState: 'analyzing', aiError: null } : it
      )
    );
    try {
      const response = await analyzePhotosBatch(
        [
          {
            groupId,
            primaryPhotoUrl: primary,
            allPhotoUrls: group.photos.map((p) => p.uri),
          },
        ],
        sellerId
      );
      applyAIToItem(groupId, response.results[0]?.analysis);
    } catch (error) {
      console.warn('[BulkListing] retry AI failed', error);
      applyAIToItem(groupId, undefined);
    }
  };

  // ───────────────────────────────────────────────────────────────────
  // Item editing + publish
  // ───────────────────────────────────────────────────────────────────

  const updateItem = (groupId: string, patch: Partial<BulkEditableItem>) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.groupId !== groupId) return item;
        const next = { ...item, ...patch };
        next.missingRequired = getMissingRequired(next);
        return next;
      })
    );
  };

  const showReviewSection =
    flowState === 'REVIEWING_ITEMS' ||
    flowState === 'PUBLISHING' ||
    flowState === 'PARTIAL' ||
    flowState === 'SUCCESS';

  const includedCount = items.filter((item) => item.includeInPublish).length;

  const hasIncludedItemsWithMissingDetails = items.some(
    (item) => item.includeInPublish && item.missingRequired.length > 0
  );

  const hasIncludedItemsWithoutPhoto = items.some((item) => {
    if (!item.includeInPublish) return false;
    const group = groups.find((candidate) => candidate.groupId === item.groupId);
    return !group || group.photos.length === 0;
  });

  const canSubmitForReview =
    showReviewSection &&
    includedCount > 0 &&
    !hasIncludedItemsWithMissingDetails &&
    !hasIncludedItemsWithoutPhoto;

  const hasSubmissionBlockingIssues =
    hasIncludedItemsWithMissingDetails || hasIncludedItemsWithoutPhoto;

  const isAIAnalyzing = flowState === 'AI_ANALYZING' && processingAI;
  const isAIAnalyzingBlocking = isAIAnalyzing && !allowManualWhileAnalyzing;

  const handleOpenPublishConfirm = () => {
    if (!showReviewSection) return;

    if (includedCount === 0) {
      Alert.alert('No items selected', 'Select at least one item to submit for review.');
      return;
    }

    if (hasIncludedItemsWithMissingDetails || hasIncludedItemsWithoutPhoto) {
      Alert.alert(
        'Missing Fields',
        'Please complete all required fields and ensure each included item has at least one photo before submitting for review.'
      );
      return;
    }

    setPublishErrors([]);
    setShowConfirmSheet(true);
  };

  const handlePublish = async () => {
    if (!bulkUploadId || !draftId) {
      Alert.alert('Cannot submit for review', 'Missing bulk session or draft session.');
      return;
    }

    if (includedCount === 0 || hasSubmissionBlockingIssues) {
      Alert.alert(
        'Missing Fields',
        'Please complete all required fields and ensure each included item has at least one photo before submitting for review.'
      );
      return;
    }

    dispatch({ type: 'PUBLISH_START' });
    await saveNow();
    const result = await publishBulkDrafts(bulkUploadId, [draftId]);
    if (result.failed.length > 0) {
      const failures = result.failed.map((entry) => `${entry.draftId}: ${entry.error}`);
      setPublishErrors(failures);
      setShowConfirmSheet(true);
      if (result.published.length > 0) dispatch({ type: 'PUBLISH_PARTIAL' });
      else dispatch({ type: 'FAIL' });
      return;
    }
    dispatch({ type: 'PUBLISH_SUCCESS' });
    setShowConfirmSheet(false);
    setShowSubmitReviewModal(true);
  };

  const handleSelectCategory = (category: Category) => {
    if (!categoryPickerGroupId) return;
    const isOtherCategory =
      category.id === 'other' || category.name.trim().toLowerCase() === 'other';

    updateItem(categoryPickerGroupId, {
      category_id: category.id,
      category_name: category.name,
      requested_category_name: isOtherCategory ? '' : undefined,
    });
    setCategoryPickerGroupId(null);
  };

  const handleSelectOtherCategory = (customName: string) => {
    if (!categoryPickerGroupId) return;
    updateItem(categoryPickerGroupId, {
      category_id: undefined,
      category_name: 'Other',
      requested_category_name: customName,
    });
    setCategoryPickerGroupId(null);
  };

  const currentStep = flowStateToStep(flowState);
  const reachedSteps = useMemo(() => {
    const set = new Set<BulkStep>([currentStep]);
    if (photos.length > 0) set.add('photos');
    if (groups.length > 0) set.add('group');
    if (
      flowState === 'REVIEWING_ITEMS' ||
      flowState === 'PUBLISHING' ||
      flowState === 'PARTIAL' ||
      flowState === 'SUCCESS'
    ) {
      set.add('review');
      set.add('group');
      set.add('photos');
    }
    if (flowState === 'PUBLISHING' || flowState === 'SUCCESS' || flowState === 'PARTIAL') {
      set.add('publish');
    }
    return set;
  }, [currentStep, photos.length, groups.length, flowState]);

  const handleStepPress = (step: BulkStep) => {
    if (
      step === 'group' &&
      !processingAI &&
      (flowState === 'REVIEWING_ITEMS' || flowState === 'AI_ANALYZING')
    ) {
      handleEditGrouping();
    }
  };

  return (
    <ScreenLayout variant="detail" title="Bulk Upload">
      <BulkIntroSheet />


      <BulkStepIndicator
        currentStep={currentStep}
        reachedSteps={reachedSteps}
        onStepPress={handleStepPress}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {photos.length === 0 && (
          <View style={styles.emptyState}>
            <Package size={64} color="#E0E0E0" weight="regular" />
            <Text style={styles.emptyStateText}>Add photos to get started</Text>
          </View>
        )}

        <BulkPhotoUploader
          photos={photos}
          uploading={uploading}
          onPickPhotos={handlePickPhotos}
          onAddMore={
            photos.length > 0
              ? () => {
                  handleAddMorePhotos(null);
                }
              : undefined
          }
          duplicateCount={duplicatePhotoIds.length}
        />

        {(flowState === 'GROUPING' || flowState === 'AI_ANALYZING') && groups.length > 0 && (
          <>
            <View style={styles.groupingHeader}>
              <Text style={styles.sectionTitle}>Group photos by item</Text>
              <View style={styles.groupingActions}>
                <TouchableOpacity
                  onPress={handleAddEmptyGroup}
                  style={styles.headerActionBtn}
                  accessibilityLabel="Add an empty item without photos"
                  testID="bulk-add-empty-item"
                >
                  <Text style={styles.headerActionText}>+ Add item</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleResetGrouping}
                  style={styles.headerActionBtn}
                  accessibilityLabel="Reset grouping so each photo becomes its own item"
                  testID="bulk-reset-grouping"
                >
                  <Text style={styles.headerActionText}>Reset</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.instructionBanner} testID="bulk-grouping-instructions">
              <Text style={styles.instructionText}>
                💡 <Text style={styles.instructionBold}>Long-press</Text> any photo to start
                selecting, then tap more photos to merge them into one item
              </Text>
            </View>

            <PhotoSelectGrid
              groups={groups}
              selectedPhotoIds={selectedPhotoIds}
              duplicatePhotoIds={duplicatePhotoIds}
              onTogglePhotoSelection={togglePhotoSelection}
              onLongPressPhoto={longPressPhoto}
              onSetCover={handleSetCover}
              onDeletePhoto={handleDeletePhoto}
              onDeleteGroup={handleDeleteGroup}
              onSplitGroup={handleSplitGroup}
              onAddPhotosToGroup={handleAddPhotosToGroup}
            />

            <TouchableOpacity
              style={[styles.confirmBtn, processingAI && styles.confirmBtnDisabled]}
              onPress={handleConfirmGrouping}
              disabled={processingAI || groups.length === 0}
              accessibilityLabel="Confirm grouping and run AI auto-fill"
              testID="bulk-confirm-grouping"
            >
              <Text style={styles.confirmBtnText}>
                {processingAI ? 'Analyzing…' : 'Looks good — run AI auto-fill'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {showReviewSection && (
          <>
            <View style={styles.groupingHeader}>
              <Text style={styles.sectionTitle}>
                Review {items.length} item{items.length === 1 ? '' : 's'}
              </Text>
              <TouchableOpacity
                onPress={handleEditGrouping}
                style={[styles.headerActionBtn, processingAI && styles.headerActionBtnDisabled]}
                disabled={processingAI}
                accessibilityLabel="Go back to grouping step"
                testID="bulk-edit-grouping"
              >
                <Text style={styles.headerActionText}>Edit grouping</Text>
              </TouchableOpacity>
            </View>

            {/* Bulk SP Summary Card (LISTING-V3-011) */}
            <BulkSPSummaryCard
              items={items.map((item) => ({
                category_id: item.category_id || null,
                price: parseFloat(item.price) || 0,
                includeInPublish: item.includeInPublish,
                accepts_swap_points: Boolean(item.accepts_swap_points),
              }))}
              isSubscriber={canAcceptSP}
              onUpgradePress={() => navigation.navigate('SubscriptionChoice')}
              testID="bulk-sp-summary"
            />

            <ItemCardStack
              items={items}
              expandedGroupId={expandedGroupId}
              onExpand={setExpandedGroupId}
              onToggleInclude={(groupId, include) =>
                updateItem(groupId, { includeInPublish: include })
              }
              onChangeItem={updateItem}
              onOpenCategoryPicker={(groupId) => setCategoryPickerGroupId(groupId)}
              canAcceptSP={canAcceptSP}
              checkingSubscription={checkingSubscription}
              onUpgradePress={() => navigation.navigate('SubscriptionChoice')}
              onRetryAI={handleRetryAIForItem}
            />
          </>
        )}

        {flowState === 'PARTIAL' && publishErrors.length > 0 && (
          <View style={styles.partialBanner} testID="bulk-partial-banner">
            <Text style={styles.partialTitle}>Partial Submission</Text>
            {publishErrors.slice(0, 3).map((error, index) => (
              <Text style={styles.partialItem} key={`${error}-${index}`}>
                {error}
              </Text>
            ))}
          </View>
        )}
      </ScrollView>

      {showReviewSection && (
        <ApplyToAllBar
          items={items}
          onApply={(next) =>
            setItems(next.map((it) => ({ ...it, missingRequired: getMissingRequired(it) })))
          }
        />
      )}

      {showReviewSection && processingAI && (
        <View style={styles.aiBackgroundBanner} testID="bulk-ai-background-banner">
          <ActivityIndicator size="small" color="#5DBB8E" />
          <Text style={styles.aiBackgroundBannerText}>
            AI is still analyzing photos in the background. You can continue editing now.
          </Text>
        </View>
      )}

      {showReviewSection && (
        <BulkPublishBar
          count={includedCount}
          disabled={!canSubmitForReview}
          onPress={handleOpenPublishConfirm}
        />
      )}

      <SelectionActionBar
        selectedCount={selectedPhotoIds.length}
        canMerge={selectedSourceGroupIds.length >= 2}
        onMerge={handleMergeSelection}
        onMoveToNew={handleMoveSelectionToNewItem}
        onDelete={handleDeleteSelection}
        onClear={clearSelection}
      />

      <BulkPublishConfirmSheet
        visible={showConfirmSheet}
        items={items}
        errors={publishErrors}
        publishing={flowState === 'PUBLISHING'}
        onCancel={() => setShowConfirmSheet(false)}
        onConfirm={handlePublish}
      />

      <Modal
        visible={showPhotoSourceModal}
        animationType="fade"
        transparent
        onRequestClose={() => {
          setShowPhotoSourceModal(false);
          setPendingPhotoSourceTargetGroupId(undefined);
        }}
      >
        <View style={styles.photoSourceModalOverlay}>
          <View style={styles.photoSourceModalCard}>
            <Text style={styles.photoSourceModalTitle}>Add Photos</Text>
            <Text style={styles.photoSourceModalMessage}>Choose how you want to add photos.</Text>

            <TouchableOpacity
              style={styles.photoSourceOptionButton}
              onPress={() => {
                setPendingPhotoSource('camera');
                setShowPhotoSourceModal(false);
              }}
              testID="bulk-photo-source-camera"
            >
              <Text style={styles.photoSourceOptionText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.photoSourceOptionButton}
              onPress={() => {
                setPendingPhotoSource('library');
                setShowPhotoSourceModal(false);
              }}
              testID="bulk-photo-source-library"
            >
              <Text style={styles.photoSourceOptionText}>Photo Library</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.photoSourceCancelButton}
              onPress={() => {
                setPendingPhotoSource(null);
                setShowPhotoSourceModal(false);
                setPendingPhotoSourceTargetGroupId(undefined);
              }}
              testID="bulk-photo-source-cancel"
            >
              <Text style={styles.photoSourceCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={flowState === 'PUBLISHING'} animationType="fade" transparent>
        <View style={styles.processingOverlay}>
          <View style={styles.processingCard}>
            <LoadingSpinner />
            <Text style={styles.processingTitle}>Submitting Items For Review...</Text>
            <Text style={styles.processingMessage}>
              Please wait. We are uploading your items and preparing them for admin review.
            </Text>
          </View>
        </View>
      </Modal>

      <Modal visible={isAIAnalyzingBlocking} animationType="fade" transparent>
        <View style={styles.aiLoadingOverlay}>
          <View style={styles.aiLoadingCard}>
            <LoadingSpinner />
            <Text style={styles.aiLoadingTitle}>Analyzing Item Photos...</Text>
            <Text style={styles.aiLoadingMessage}>
              Our AI is reviewing your grouped photos to suggest item details.
            </Text>
            <Text style={styles.aiLoadingHint}>
              If this takes too long, continue manually now and we will keep analyzing in the
              background.
            </Text>
            <TouchableOpacity
              style={styles.aiContinueButton}
              onPress={handleContinueWithoutAI}
              accessibilityRole="button"
              testID="bulk-ai-continue-manual-button"
            >
              <Text style={styles.aiContinueButtonText}>Continue Without AI</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSubmitReviewModal}
        animationType="fade"
        transparent
        onRequestClose={() => {
          resetBulkSessionState();
        }}
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
                resetBulkSessionState();
                navigation.navigate('MyListings');
              }}
              testID="bulk-submit-review-go-my-items"
            >
              <Text style={styles.submitModalPrimaryButtonText}>Go To My Items</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.submitModalSecondaryButton}
              onPress={() => {
                resetBulkSessionState();
                navigation.navigate('Home');
              }}
              testID="bulk-submit-review-go-dashboard"
            >
              <Text style={styles.submitModalSecondaryButtonText}>Go To Dashboard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <CategorySelectModal
        visible={Boolean(categoryPickerGroupId)}
        categories={categories}
        recent={[]}
        onSelect={handleSelectCategory}
        onSelectOther={handleSelectOtherCategory}
        onClose={() => setCategoryPickerGroupId(null)}
      />
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  backButton: {
    fontSize: 24,
    color: '#111827',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerRight: {
    width: 24,
    alignItems: 'flex-end',
  },
  scroll: {
    flex: 1,
    marginBottom: 86,
  },
  content: {
    padding: 16,
    paddingBottom: 80,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 15,
    color: '#6B6B6B',
  },
  groupingHeader: {
    marginTop: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  groupingActions: {
    flexDirection: 'row',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  headerActionBtn: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    justifyContent: 'center',
  },
  headerActionBtnDisabled: {
    opacity: 0.5,
  },
  headerActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  confirmBtn: {
    marginTop: 14,
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
    minHeight: 52,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.6,
  },
  confirmBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  partialBanner: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 10,
  },
  partialTitle: {
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 4,
  },
  partialItem: {
    color: '#B91C1C',
    fontSize: 12,
    marginBottom: 2,
  },
  instructionBanner: {
    backgroundColor: '#E8F5F0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 13,
    color: '#065F46',
    lineHeight: 18,
  },
  instructionBold: {
    fontWeight: '700',
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
  processingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  processingCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
  },
  processingTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  processingMessage: {
    marginTop: 8,
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
  },
  submitModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  submitModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
  },
  submitModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  submitModalMessage: {
    fontSize: 15,
    lineHeight: 22,
    color: '#374151',
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
    fontWeight: '600',
  },
  submitModalSecondaryButton: {
    marginTop: 10,
    borderRadius: 24,
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#6B6B6B',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitModalSecondaryButtonText: {
    color: '#6B6B6B',
    fontSize: 15,
    fontWeight: '500',
  },
  aiLoadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  aiLoadingCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  aiLoadingTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  aiLoadingMessage: {
    marginTop: 8,
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
  },
  aiLoadingHint: {
    marginTop: 8,
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
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
  aiBackgroundBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiBackgroundBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#065F46',
    lineHeight: 16,
  },
});
