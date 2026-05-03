/**
 * File: p2p-kids-marketplace/src/hooks/useItemDraft.ts
 * MODULE-04 LISTING-V3-004: Item Draft Hook
 *
 * Provides autosave functionality for item drafts with:
 * - 30-second interval auto-save
 * - AppState background flush
 * - Navigation blur flush
 * - Immediate save method
 * - Error state management
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ItemDraft, DraftData } from '../types/listing';
import {
  createItemDraft,
  getItemDraft,
  updateItemDraft,
  deleteItemDraft,
} from '../services/draftService';

const AUTOSAVE_INTERVAL_MS = 30000; // 30 seconds

export interface UseItemDraftResult {
  draft: ItemDraft | null;
  save: (updates: Partial<DraftData>) => void;
  saveNow: () => Promise<void>;
  discard: () => Promise<void>;
  isSaving: boolean;
  saveError: string | null;
  isLoading: boolean;
}

export interface UseItemDraftOptions {
  autoCreateOnMount?: boolean;
}

/**
 * Hook for managing item draft with autosave
 *
 * Features:
 * - Loads existing draft on mount if draftId provided
 * - Auto-saves every 30s while screen is focused
 * - Flushes pending changes on AppState -> background
 * - Flushes pending changes on navigation blur
 * - Provides immediate save method
 * - Never throws - exposes saveError instead
 *
 * @param draftId - Optional existing draft ID to load
 * @param sellerId - Seller ID for creating new draft
 * @returns Draft state and control methods
 */
export function useItemDraft(
  draftId?: string,
  sellerId?: string,
  options?: UseItemDraftOptions
): UseItemDraftResult {
  const autoCreateOnMount = options?.autoCreateOnMount ?? true;
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdatesRef = useRef<Partial<DraftData> | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const draftRef = useRef<ItemDraft | null>(null);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  // Load existing draft on mount
  useEffect(() => {
    if (draftId) {
      loadDraft(draftId);
    } else if (sellerId && autoCreateOnMount) {
      createNewDraft(sellerId);
    } else {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, sellerId, autoCreateOnMount]);

  // Load draft from server
  const loadDraft = async (id: string) => {
    try {
      setIsLoading(true);
      const loaded = await getItemDraft(id);
      if (loaded) {
        setDraft(loaded);
      } else {
        setSaveError('Draft not found or expired');
      }
    } catch (error: any) {
      setSaveError(error.message || 'Failed to load draft');
    } finally {
      setIsLoading(false);
    }
  };

  // Create new draft
  const createNewDraft = async (seller_id: string) => {
    try {
      setIsLoading(true);
      const created = await createItemDraft(seller_id);
      if (created) {
        setDraft(created);
      } else {
        setSaveError('Failed to create draft');
      }
    } catch (error: any) {
      setSaveError(error.message || 'Failed to create draft');
    } finally {
      setIsLoading(false);
    }
  };

  // Queue updates for autosave
  const save = useCallback((updates: Partial<DraftData>) => {
    setSaveError(null);

    // Merge with pending updates
    if (pendingUpdatesRef.current) {
      pendingUpdatesRef.current = { ...pendingUpdatesRef.current, ...updates };
    } else {
      pendingUpdatesRef.current = updates;
    }

    // Update local draft state immediately for UI responsiveness
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        draft_data: { ...prev.draft_data, ...updates },
        updated_at: new Date().toISOString(),
      };
    });
  }, []);

  // Flush pending updates immediately
  const saveNow = useCallback(async () => {
    if (!pendingUpdatesRef.current) return;

    const currentDraft = draftRef.current;

    if (!currentDraft) {
      if (!sellerId) return;

      try {
        setIsSaving(true);
        setSaveError(null);

        const created = await createItemDraft(sellerId, pendingUpdatesRef.current);
        if (created) {
          setDraft(created);
          pendingUpdatesRef.current = null;
        } else {
          setSaveError('Failed to create draft');
        }
      } catch (error: any) {
        setSaveError(error.message || 'Failed to create draft');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);

      const success = await updateItemDraft(currentDraft.id, pendingUpdatesRef.current);

      if (success) {
        pendingUpdatesRef.current = null;
      } else {
        setSaveError('Failed to save draft');
      }
    } catch (error: any) {
      setSaveError(error.message || 'Failed to save draft');
    } finally {
      setIsSaving(false);
    }
  }, [sellerId]);

  // Delete draft
  const discard = useCallback(async () => {
    if (!draft) return;

    try {
      setIsSaving(true);
      setSaveError(null);

      const success = await deleteItemDraft(draft.id);

      if (success) {
        setDraft(null);
        pendingUpdatesRef.current = null;
      } else {
        setSaveError('Failed to delete draft');
      }
    } catch (error: any) {
      setSaveError(error.message || 'Failed to delete draft');
    } finally {
      setIsSaving(false);
    }
  }, [draft]);

  // Setup autosave timer
  useEffect(() => {
    if (!draft) return;

    // Clear existing timer
    if (autosaveTimerRef.current) {
      clearInterval(autosaveTimerRef.current);
    }

    // Start new timer
    autosaveTimerRef.current = setInterval(() => {
      if (pendingUpdatesRef.current) {
        saveNow();
      }
    }, AUTOSAVE_INTERVAL_MS);

    return () => {
      if (autosaveTimerRef.current) {
        clearInterval(autosaveTimerRef.current);
      }
    };
  }, [draft, saveNow]);

  // Flush on AppState change to background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/active|inactive/) && nextAppState === 'background') {
        // App going to background - flush pending updates
        if (pendingUpdatesRef.current) {
          saveNow();
        }
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [saveNow]);

  // Flush on navigation blur (screen loses focus)
  useFocusEffect(
    useCallback(() => {
      return () => {
        // Screen is blurring - flush pending updates
        if (pendingUpdatesRef.current) {
          saveNow();
        }
      };
    }, [saveNow])
  );

  return {
    draft,
    save,
    saveNow,
    discard,
    isSaving,
    saveError,
    isLoading,
  };
}
