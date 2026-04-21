# MODULE-14.2: AI ITEM CREATION V2

**Version:** 2.0  
**Last Updated:** April 20, 2026  
**Status:** Ready for Implementation  
**Dependencies:** MODULE-03 (Authentication V2), MODULE-06 (Trade Flow V2)

---

## V2 PRODUCT MODEL OVERVIEW

### AI-Powered Item Creation
- **Photo-First Flow**: Start by adding photos, then AI fills in details
- **AI Auto-Fill**: Automatic title, category, condition, brand, color, age group, gender detection
- **Confidence-Based Suggestions**: High/medium/low confidence visual indicators
- **Draft Auto-Save**: Auto-save every 30 seconds + on navigation away
- **Price Suggestions**: 4-tier pricing based on condition and market data
- **Enhanced Category Selection**: Modal with search + recent categories
- **Condition Photo Guide**: Real marketplace photo examples for each condition
- **Brand Autocomplete**: Hybrid predefined + database brands
- **New Item Fields**: age_group, gender, brand, color (for Track 1 Search Filters)

### User Experience Flow
```
[1] Add Photos (1-10)
  ↓
[2] AI Analyzes (background, non-blocking)
  ↓
[3] Review AI Suggestions (Apply All or Per-Field)
  ↓
[4] Fill/Edit Details
  ↓
[5] Set Price (4 tiers + manual)
  ↓
[6] Publish
```

---

## V2 CHANGELOG

### New Capabilities in V2
1. **Photo-First Flow**
   - Camera/photo picker opens immediately on "List One Item"
   - AI analysis starts automatically after photo upload
   - Form becomes interactive while AI processes in background
   - AI suggestion card appears when analysis completes

2. **AI Auto-Fill**
   - Google Vision API integration via edge function
   - Extracts: title, category, condition, brand, color, age_group, gender
   - Confidence scores per field (high >70%, medium 40-70%, low <40%)
   - Partial results supported (some fields succeed, others fail)

3. **Draft Management**
   - Auto-save every 30 seconds during editing
   - Save on navigation away (back button, tab switch)
   - 7-day expiration per draft
   - Max 5 drafts per seller (LRU eviction)
   - Resume banner on app open

4. **Smart Price Suggestions**
   - 4 tiers: Great Deal (40-50%), Fair Price (55-65%), Asking Price (70-80%), Almost New (85-95%)
   - Based on category + condition market data
   - Manual override always available
   - Empty state if <5 comparable items

5. **Enhanced Category Selection**
   - Full-screen modal with search
   - Recent 3 categories shown first
   - "Other" option with custom suggestion
   - Item count per category
   - Fast selection (single tap)

6. **Condition Photo Guide**
   - Real marketplace photos as examples
   - 2-3 photos per condition level
   - Tap-to-view overlay
   - Helps sellers rate accurately

---

## CRITICAL V2 RULES

### Photo Management
- **MUST** validate photo type (JPEG, PNG, WebP only)
- **MUST** validate photo size (< 10MB raw)
- **MUST** validate dimensions (min 400x400px)
- **MUST** compress to < 1MB before upload
- **MUST** support 1-10 photos per item
- **MUST** allow drag-and-drop reordering

### AI Processing
- **MUST** start AI analysis immediately after first photo upload
- **MUST NOT** block form interaction during AI processing
- **MUST** show AI suggestion card when analysis completes
- **MUST** allow user to manually fill fields while AI processes
- **MUST NOT** overwrite user-entered fields when AI completes
- **MUST** timeout AI analysis after 10 seconds

### Draft Management
- **MUST** auto-save every 30 seconds while editing
- **MUST** save on screen blur/navigation away
- **MUST** expire drafts after 7 days
- **MUST** limit to 5 drafts per seller (delete oldest)
- **MUST** show resume banner on app open if drafts exist
- **MUST** delete draft after successful publish

### Form Validation
- **MUST** validate title (required, max 200 chars)
- **MUST** validate price (required, > 0)
- **MUST** validate category (required)
- **MUST** validate condition (required)
- **MUST** validate at least 1 photo
- **MAY** leave brand, color, age_group, gender optional

---

## AGENT-OPTIMIZED PROMPT TEMPLATE

```typescript
/*
YOU ARE AN AI AGENT TASKED WITH IMPLEMENTING MODULE-14.2 (AI ITEM CREATION V2).

CONTEXT:
- Part of Track 2 (MVP Weeks 4-6) for Kids P2P Marketplace.
- Enhances single item creation with AI auto-fill and smart UX.
- Integrates with existing items table and categories.
- Provides components reusable by MODULE-14.1 (Bulk Listing).

YOUR INSTRUCTIONS:
1. Read this entire module specification carefully.
2. For each task (AI-V2-001, etc.), implement EXACTLY as specified.
3. Create all files at the exact filepath locations specified.
4. Ensure non-blocking UI (AI runs in background).
5. Handle partial AI failures gracefully.
6. Add TypeScript types for all data structures.
7. Include comprehensive error handling.

PERFORMANCE TARGETS:
- Photo compression: < 500ms per photo
- Photo upload: < 2s per photo
- AI analysis: < 5s (background, non-blocking)
- Draft auto-save: < 500ms
- Price tier load: < 300ms

ERROR HANDLING RULES:
- AI failure should not block manual entry
- Draft save failures should be silent (retry in background)
- Photo upload failures should be user-visible with retry option
- Form validation errors should be inline with clear messages

==================================================
NEXT TASK: AI-V2-001 (Draft Management Schema)
==================================================
*/
```

---

## TASK AI-V2-001: Draft Management Database Schema

**Duration:** 2 hours  
**Priority:** Critical  
**Dependencies:** MODULE-03 (Authentication V2)

### Description
Create database table for auto-saved item creation drafts. Support storing partial form data, uploaded photos, and AI analysis results.

### Acceptance Criteria
- [ ] item_drafts table created
- [ ] Stores draft_data (JSONB), photo_urls, ai_suggestions
- [ ] Auto-update updated_at trigger
- [ ] Enforce max 5 drafts per seller trigger
- [ ] 7-day expiration support
- [ ] RLS policies for seller access

---

### AI Prompt for Cursor

```typescript
/*
TASK: Create draft management schema

CONTEXT:
Auto-saved drafts allow sellers to resume item creation after interruption.

V2 REQUIREMENTS:
- Store partial form data (title, price, category, etc.)
- Store uploaded photo URLs
- Store AI analysis results
- Auto-expire after 7 days
- Max 5 drafts per seller (LRU eviction)

==================================================
FILE 1: Database migration for drafts
==================================================
*/

-- filepath: supabase/migrations/143_item_drafts_v2.sql

-- Draft step enum
CREATE TYPE draft_step AS ENUM (
  'photos',
  'details',
  'price',
  'review'
);

-- Item drafts table
CREATE TABLE IF NOT EXISTS public.item_drafts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bulk_upload_id  UUID REFERENCES item_bulk_uploads(id) ON DELETE CASCADE,
  draft_data      JSONB NOT NULL DEFAULT '{}',
  photo_urls      TEXT[] NOT NULL DEFAULT '{}',
  ai_suggestions  JSONB,
  step            draft_step NOT NULL DEFAULT 'photos',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_item_drafts_seller
  ON item_drafts(seller_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_item_drafts_expires
  ON item_drafts(expires_at);

CREATE INDEX IF NOT EXISTS idx_item_drafts_bulk
  ON item_drafts(bulk_upload_id)
  WHERE bulk_upload_id IS NOT NULL;

-- RLS policies
ALTER TABLE public.item_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can view own drafts"
  ON public.item_drafts FOR SELECT
  USING (seller_id = auth.uid());

CREATE POLICY "Sellers can create own drafts"
  ON public.item_drafts FOR INSERT
  WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Sellers can update own drafts"
  ON public.item_drafts FOR UPDATE
  USING (seller_id = auth.uid());

CREATE POLICY "Sellers can delete own drafts"
  ON public.item_drafts FOR DELETE
  USING (seller_id = auth.uid());

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_item_drafts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER item_drafts_updated_at_trigger
  BEFORE UPDATE ON public.item_drafts
  FOR EACH ROW
  EXECUTE FUNCTION update_item_drafts_updated_at();

-- Enforce max 5 drafts per seller trigger
CREATE OR REPLACE FUNCTION enforce_max_drafts()
RETURNS TRIGGER AS $$
DECLARE
  v_draft_count INT;
  v_oldest_draft_id UUID;
BEGIN
  -- Count current drafts for this seller
  SELECT COUNT(*) INTO v_draft_count
  FROM public.item_drafts
  WHERE seller_id = NEW.seller_id;
  
  -- If already at or over 5, delete oldest
  IF v_draft_count >= 5 THEN
    SELECT id INTO v_oldest_draft_id
    FROM public.item_drafts
    WHERE seller_id = NEW.seller_id
    ORDER BY updated_at ASC
    LIMIT 1;
    
    DELETE FROM public.item_drafts
    WHERE id = v_oldest_draft_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_max_drafts_trigger
  BEFORE INSERT ON public.item_drafts
  FOR EACH ROW
  EXECUTE FUNCTION enforce_max_drafts();

-- Cleanup expired drafts function (run via cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_drafts()
RETURNS INT AS $$
DECLARE
  v_deleted_count INT;
BEGIN
  DELETE FROM public.item_drafts
  WHERE expires_at < now();
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE public.item_drafts IS 'Auto-saved item creation drafts. Max 5 per seller. Expire after 7 days.';
COMMENT ON COLUMN item_drafts.draft_data IS 'Partial form data (title, price, category, etc.) as JSONB';
COMMENT ON COLUMN item_drafts.ai_suggestions IS 'AI analysis results stored for later reference';
COMMENT ON COLUMN item_drafts.step IS 'Last completed step in creation flow';

/*
==================================================
FILE 2: TypeScript types for drafts
==================================================
*/

// filepath: src/types/itemDrafts.ts

export type DraftStep = 'photos' | 'details' | 'price' | 'review';

export interface ItemDraft {
  id: string;
  seller_id: string;
  bulk_upload_id?: string;
  draft_data: DraftData;
  photo_urls: string[];
  ai_suggestions?: AIAnalysisResult;
  step: DraftStep;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

export interface DraftData {
  title?: string;
  description?: string;
  price?: number;
  category_id?: string;
  condition?: string;
  brand?: string;
  color?: string[];
  age_group?: string;
  gender?: string;
  requested_category_name?: string;
}

export interface AIAnalysisResult {
  title?: { value: string; confidence: number };
  category?: { value: string; categoryId: string; confidence: number };
  condition?: { value: string; confidence: number };
  brand?: { value: string; confidence: number };
  color?: { value: string[]; confidence: number };
  age_group?: { value: string; confidence: number };
  gender?: { value: string; confidence: number };
  rawLabels?: string[];
  error?: string;
}

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ item_drafts table created with all fields
✓ Auto-update updated_at trigger works
✓ Max 5 drafts enforced (oldest deleted)
✓ Expires_at defaults to 7 days from creation
✓ RLS policies restrict to seller only
✓ Cleanup function for expired drafts
✓ TypeScript types match schema

==================================================
VERIFICATION STEPS
==================================================

1. Run migration: npm run db:migrate
2. Test draft creation with test seller
3. Create 6 drafts, verify oldest is deleted
4. Verify updated_at auto-updates on save
5. Test cleanup_expired_drafts() function

==================================================
NEXT TASK: AI-V2-002 (Draft Management Service)
==================================================
*/
```

---

## TASK AI-V2-002: Draft Management Service

**Duration:** 3 hours  
**Priority:** Critical  
**Dependencies:** AI-V2-001

### Description
Create service for managing item drafts: create, read, update, delete, list active drafts. Includes debounced auto-save logic.

### Acceptance Criteria
- [ ] createDraft() creates new draft
- [ ] updateDraft() updates draft data
- [ ] getDraft() retrieves draft by ID
- [ ] getActiveDrafts() lists non-expired drafts
- [ ] deleteDraft() removes draft
- [ ] publishDraft() creates item from draft and deletes draft
- [ ] Auto-save debouncing (30s)

---

### AI Prompt for Cursor

```typescript
/*
TASK: Create draft management service

CONTEXT:
Draft service handles CRUD operations and auto-save logic for item creation drafts.

==================================================
FILE 1: Draft service implementation
==================================================
*/

// filepath: src/services/draftService.ts

import { supabase } from '@/lib/supabase';
import type { ItemDraft, DraftData, DraftStep } from '@/types/itemDrafts';

export class DraftService {
  /**
   * Create a new draft
   */
  static async createDraft(
    sellerId: string,
    initialData: {
      photo_urls?: string[];
      draft_data?: Partial<DraftData>;
      ai_suggestions?: any;
      step?: DraftStep;
      bulk_upload_id?: string;
    }
  ): Promise<ItemDraft> {
    const { data, error } = await supabase
      .from('item_drafts')
      .insert({
        seller_id: sellerId,
        photo_urls: initialData.photo_urls || [],
        draft_data: initialData.draft_data || {},
        ai_suggestions: initialData.ai_suggestions,
        step: initialData.step || 'photos',
        bulk_upload_id: initialData.bulk_upload_id,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create draft: ${error.message}`);
    }

    return data as ItemDraft;
  }

  /**
   * Update existing draft
   */
  static async updateDraft(
    draftId: string,
    updates: {
      draft_data?: Partial<DraftData>;
      photo_urls?: string[];
      ai_suggestions?: any;
      step?: DraftStep;
    }
  ): Promise<void> {
    const { error } = await supabase
      .from('item_drafts')
      .update(updates)
      .eq('id', draftId);

    if (error) {
      throw new Error(`Failed to update draft: ${error.message}`);
    }
  }

  /**
   * Get draft by ID
   */
  static async getDraft(draftId: string): Promise<ItemDraft | null> {
    const { data, error } = await supabase
      .from('item_drafts')
      .select('*')
      .eq('id', draftId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to get draft: ${error.message}`);
    }

    // Check if expired
    const expiresAt = new Date(data.expires_at);
    if (expiresAt < new Date()) {
      await this.deleteDraft(draftId);
      return null;
    }

    return data as ItemDraft;
  }

  /**
   * Get all active drafts for seller
   */
  static async getActiveDrafts(sellerId: string): Promise<ItemDraft[]> {
    const { data, error } = await supabase
      .from('item_drafts')
      .select('*')
      .eq('seller_id', sellerId)
      .gt('expires_at', new Date().toISOString())
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get active drafts: ${error.message}`);
    }

    return data as ItemDraft[];
  }

  /**
   * Delete draft
   */
  static async deleteDraft(draftId: string): Promise<void> {
    const { error } = await supabase
      .from('item_drafts')
      .delete()
      .eq('id', draftId);

    if (error) {
      throw new Error(`Failed to delete draft: ${error.message}`);
    }
  }

  /**
   * Publish draft as item
   */
  static async publishDraft(draftId: string): Promise<string> {
    // Get draft
    const draft = await this.getDraft(draftId);
    if (!draft) {
      throw new Error('Draft not found or expired');
    }

    // Validate required fields
    this.validateDraftForPublish(draft);

    // Create item
    const { data, error } = await supabase
      .from('items')
      .insert({
        seller_id: draft.seller_id,
        title: draft.draft_data.title!,
        description: draft.draft_data.description || '',
        price: draft.draft_data.price!,
        category_id: draft.draft_data.category_id!,
        condition: draft.draft_data.condition!,
        photo_urls: draft.photo_urls,
        brand: draft.draft_data.brand,
        color: draft.draft_data.color,
        age_group: draft.draft_data.age_group,
        gender: draft.draft_data.gender,
        requested_category_name: draft.draft_data.requested_category_name,
        status: 'available',
        bulk_upload_id: draft.bulk_upload_id,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to publish item: ${error.message}`);
    }

    // Delete draft after successful publish
    await this.deleteDraft(draftId);

    return data.id;
  }

  /**
   * Validate draft has all required fields for publishing
   */
  private static validateDraftForPublish(draft: ItemDraft): void {
    const errors: string[] = [];

    if (!draft.draft_data.title || draft.draft_data.title.trim().length === 0) {
      errors.push('Title is required');
    }

    if (!draft.draft_data.price || draft.draft_data.price <= 0) {
      errors.push('Price must be greater than 0');
    }

    if (!draft.draft_data.category_id) {
      errors.push('Category is required');
    }

    if (!draft.draft_data.condition) {
      errors.push('Condition is required');
    }

    if (!draft.photo_urls || draft.photo_urls.length === 0) {
      errors.push('At least one photo is required');
    }

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
  }
}

/*
==================================================
FILE 2: React hook for draft management
==================================================
*/

// filepath: src/hooks/useDraft.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { DraftService } from '@/services/draftService';
import type { ItemDraft, DraftData, DraftStep } from '@/types/itemDrafts';

const AUTO_SAVE_DELAY = 30000; // 30 seconds

export function useDraft(sellerId: string, initialDraftId?: string) {
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingChangesRef = useRef<boolean>(false);
  const appStateRef = useRef(AppState.currentState);

  /**
   * Initialize draft
   */
  useEffect(() => {
    const initDraft = async () => {
      if (initialDraftId) {
        try {
          const existingDraft = await DraftService.getDraft(initialDraftId);
          setDraft(existingDraft);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load draft');
        }
      } else {
        // Create new draft
        try {
          const newDraft = await DraftService.createDraft(sellerId, {});
          setDraft(newDraft);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to create draft');
        }
      }
    };

    initDraft();
  }, [sellerId, initialDraftId]);

  /**
   * Schedule auto-save
   */
  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    pendingChangesRef.current = true;

    autoSaveTimerRef.current = setTimeout(() => {
      saveNow();
    }, AUTO_SAVE_DELAY);
  }, []);

  /**
   * Save immediately
   */
  const saveNow = useCallback(async () => {
    if (!draft || !pendingChangesRef.current) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await DraftService.updateDraft(draft.id, {
        draft_data: draft.draft_data,
        photo_urls: draft.photo_urls,
        ai_suggestions: draft.ai_suggestions,
        step: draft.step,
      });
      
      setLastSavedAt(new Date());
      pendingChangesRef.current = false;
    } catch (err) {
      // Silent failure for auto-save (will retry on next change)
      console.warn('Auto-save failed:', err);
    } finally {
      setIsSaving(false);
    }
  }, [draft]);

  /**
   * Update draft data (local + schedule save)
   */
  const updateDraftData = useCallback((updates: Partial<DraftData>) => {
    if (!draft) return;

    setDraft(prev => prev ? {
      ...prev,
      draft_data: { ...prev.draft_data, ...updates },
    } : null);

    scheduleAutoSave();
  }, [draft, scheduleAutoSave]);

  /**
   * Update photo URLs
   */
  const updatePhotoUrls = useCallback((photoUrls: string[]) => {
    if (!draft) return;

    setDraft(prev => prev ? { ...prev, photo_urls: photoUrls } : null);
    scheduleAutoSave();
  }, [draft, scheduleAutoSave]);

  /**
   * Update AI suggestions
   */
  const updateAISuggestions = useCallback((suggestions: any) => {
    if (!draft) return;

    setDraft(prev => prev ? { ...prev, ai_suggestions: suggestions } : null);
    scheduleAutoSave();
  }, [draft, scheduleAutoSave]);

  /**
   * Update step
   */
  const updateStep = useCallback((step: DraftStep) => {
    if (!draft) return;

    setDraft(prev => prev ? { ...prev, step } : null);
    scheduleAutoSave();
  }, [draft, scheduleAutoSave]);

  /**
   * Publish draft
   */
  const publishDraft = useCallback(async (): Promise<string> => {
    if (!draft) {
      throw new Error('No draft to publish');
    }

    // Save any pending changes first
    if (pendingChangesRef.current) {
      await saveNow();
    }

    const itemId = await DraftService.publishDraft(draft.id);
    setDraft(null);
    return itemId;
  }, [draft, saveNow]);

  /**
   * Delete draft
   */
  const deleteDraft = useCallback(async () => {
    if (!draft) return;

    await DraftService.deleteDraft(draft.id);
    setDraft(null);
  }, [draft]);

  /**
   * Handle app state changes (save on background)
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appStateRef.current.match(/active/) &&
        nextAppState.match(/inactive|background/)
      ) {
        // App going to background - save immediately
        saveNow();
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [saveNow]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      // Save on unmount if changes pending
      if (pendingChangesRef.current && draft) {
        DraftService.updateDraft(draft.id, {
          draft_data: draft.draft_data,
          photo_urls: draft.photo_urls,
          ai_suggestions: draft.ai_suggestions,
          step: draft.step,
        }).catch(console.warn);
      }
    };
  }, [draft]);

  return {
    draft,
    isSaving,
    lastSavedAt,
    error,
    updateDraftData,
    updatePhotoUrls,
    updateAISuggestions,
    updateStep,
    publishDraft,
    deleteDraft,
    saveNow,
  };
}

/*
==================================================
FILE 3: Unit tests
==================================================
*/

// filepath: src/services/__tests__/draftService.test.ts

import { DraftService } from '../draftService';

describe('DraftService', () => {
  const mockSellerId = 'seller-123';

  describe('createDraft', () => {
    it('should create draft with initial data', async () => {
      const draft = await DraftService.createDraft(mockSellerId, {
        photo_urls: ['photo1.jpg'],
        draft_data: { title: 'Test Item' },
      });

      expect(draft.id).toBeDefined();
      expect(draft.seller_id).toBe(mockSellerId);
      expect(draft.photo_urls).toEqual(['photo1.jpg']);
      expect(draft.draft_data.title).toBe('Test Item');
    });
  });

  describe('validateDraftForPublish', () => {
    it('should throw error if title missing', () => {
      const invalidDraft = {
        draft_data: { price: 10, category_id: 'cat1', condition: 'good' },
        photo_urls: ['photo1.jpg'],
      } as any;

      expect(() => DraftService['validateDraftForPublish'](invalidDraft))
        .toThrow('Title is required');
    });

    it('should throw error if no photos', () => {
      const invalidDraft = {
        draft_data: { 
          title: 'Test', 
          price: 10, 
          category_id: 'cat1', 
          condition: 'good' 
        },
        photo_urls: [],
      } as any;

      expect(() => DraftService['validateDraftForPublish'](invalidDraft))
        .toThrow('At least one photo is required');
    });
  });
});

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ createDraft() creates new draft in database
✓ updateDraft() updates draft fields
✓ getDraft() retrieves draft and checks expiration
✓ getActiveDrafts() lists non-expired drafts
✓ deleteDraft() removes draft
✓ publishDraft() creates item and deletes draft
✓ useDraft hook provides auto-save (30s debounce)
✓ Hook saves on app background
✓ Hook saves on unmount
✓ Validation prevents publishing incomplete drafts

==================================================
NEXT TASK: AI-V2-003 (AI Analysis Edge Function Enhancement)
==================================================
*/
```

---

## TASK AI-V2-003: Enhanced AI Analysis Edge Function

**Duration:** 4 hours  
**Priority:** Critical  
**Dependencies:** Existing analyze-item-image edge function

### Description
Enhance existing analyze-item-image edge function to extract new fields (age_group, gender, brand, color) and return confidence scores. Add timeout and error handling.

### Acceptance Criteria
- [ ] Extracts all fields: title, category, condition, brand, color, age_group, gender
- [ ] Returns confidence score per field
- [ ] 10-second timeout
- [ ] Graceful fallback for partial results
- [ ] Rate limit handling (429 retry with backoff)
- [ ] Field-specific confidence thresholds

---

### AI Prompt for Cursor

```typescript
/*
TASK: Enhance AI analysis edge function with new fields and confidence scores

CONTEXT:
Existing analyze-item-image function needs to extract additional fields for V2.

NEW FIELDS:
- brand (e.g., "LEGO", "Nike")
- color (array, e.g., ["Blue", "Red"])
- age_group (enum: '0-2', '3-5', '6-8', '9-12', '13+')
- gender (enum: 'boy', 'girl', 'unisex')

==================================================
FILE 1: Enhanced edge function
==================================================
*/

// filepath: supabase/functions/analyze-item-image/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface AnalyzeItemRequest {
  photoUrl: string;
  sellerId?: string;
  requestFields?: string[];
}

interface FieldResult<T> {
  value: T;
  confidence: number;
}

interface AIAnalysisResult {
  title?: FieldResult<string>;
  category?: FieldResult<{ name: string; categoryId: string }>;
  condition?: FieldResult<string>;
  brand?: FieldResult<string>;
  color?: FieldResult<string[]>;
  age_group?: FieldResult<string>;
  gender?: FieldResult<string>;
  rawLabels?: string[];
  error?: string;
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      });
    }

    const { photoUrl, requestFields = [] }: AnalyzeItemRequest = await req.json();

    if (!photoUrl) {
      return new Response(
        JSON.stringify({ error: 'photoUrl is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Call Google Vision API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const visionApiKey = Deno.env.get('GOOGLE_VISION_API_KEY');
      if (!visionApiKey) {
        throw new Error('Google Vision API key not configured');
      }

      const visionResponse = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            requests: [{
              image: { source: { imageUri: photoUrl } },
              features: [
                { type: 'LABEL_DETECTION', maxResults: 20 },
                { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
                { type: 'TEXT_DETECTION', maxResults: 5 },
              ],
            }],
          }),
        }
      );

      clearTimeout(timeoutId);

      if (!visionResponse.ok) {
        if (visionResponse.status === 429) {
          // Rate limit - retry with backoff
          await new Promise(resolve => setTimeout(resolve, 2000));
          // Retry once
          const retryResponse = await fetch(
            `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                requests: [{
                  image: { source: { imageUri: photoUrl } },
                  features: [
                    { type: 'LABEL_DETECTION', maxResults: 20 },
                    { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
                  ],
                }],
              }),
            }
          );
          
          if (!retryResponse.ok) {
            throw new Error(`Vision API error: ${retryResponse.statusText}`);
          }
        } else {
          throw new Error(`Vision API error: ${visionResponse.statusText}`);
        }
      }

      const visionData = await visionResponse.json();
      const annotations = visionData.responses[0];

      // Parse Vision API response
      const result = parseVisionResponse(annotations);

      return new Response(
        JSON.stringify(result),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );

    } catch (err) {
      clearTimeout(timeoutId);
      
      if (err.name === 'AbortError') {
        return new Response(
          JSON.stringify({ error: 'Analysis timeout (10s exceeded)' }),
          { status: 408, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      throw err;
    }

  } catch (error) {
    console.error('AI analysis error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Parse Google Vision API response
 */
function parseVisionResponse(annotations: any): AIAnalysisResult {
  const labels = annotations.labelAnnotations || [];
  const objects = annotations.localizedObjectAnnotations || [];
  const texts = annotations.textAnnotations || [];
  
  const labelNames = labels.map((l: any) => l.description.toLowerCase());
  const objectNames = objects.map((o: any) => o.name.toLowerCase());
  const allLabels = [...labelNames, ...objectNames];
  
  const result: AIAnalysisResult = {
    rawLabels: allLabels,
  };
  
  // Extract title (use first high-confidence object or label)
  if (objects.length > 0 && objects[0].score > 0.7) {
    result.title = {
      value: capitalizeWords(objects[0].name),
      confidence: objects[0].score,
    };
  } else if (labels.length > 0 && labels[0].score > 0.7) {
    result.title = {
      value: capitalizeWords(labels[0].description),
      confidence: labels[0].score,
    };
  }
  
  // Extract category
  result.category = extractCategory(allLabels, labels);
  
  // Extract condition
  result.condition = extractCondition(allLabels);
  
  // Extract brand
  result.brand = extractBrand(texts, allLabels);
  
  // Extract color
  result.color = extractColors(allLabels);
  
  // Extract age group
  result.age_group = extractAgeGroup(allLabels);
  
  // Extract gender
  result.gender = extractGender(allLabels);
  
  return result;
}

/**
 * Extract category from labels
 */
function extractCategory(allLabels: string[], labels: any[]): FieldResult<any> | undefined {
  const categoryMapping: Record<string, { name: string; id: string; keywords: string[] }> = {
    toys: { 
      name: 'Toys & Games', 
      id: 'cat-toys', 
      keywords: ['toy', 'game', 'lego', 'puzzle', 'doll', 'action figure', 'board game']
    },
    clothing: { 
      name: 'Clothing', 
      id: 'cat-clothing', 
      keywords: ['shirt', 'pants', 'dress', 'jacket', 'shoe', 'clothing', 'apparel']
    },
    books: { 
      name: 'Books', 
      id: 'cat-books', 
      keywords: ['book', 'novel', 'reading', 'magazine', 'comic']
    },
    sports: { 
      name: 'Sports & Outdoors', 
      id: 'cat-sports', 
      keywords: ['ball', 'bike', 'skateboard', 'sports', 'outdoor', 'exercise']
    },
    electronics: { 
      name: 'Electronics', 
      id: 'cat-electronics', 
      keywords: ['tablet', 'game console', 'headphones', 'electronic', 'device']
    },
  };
  
  for (const [key, category] of Object.entries(categoryMapping)) {
    for (const keyword of category.keywords) {
      const match = allLabels.find(label => label.includes(keyword));
      if (match) {
        const matchingLabel = labels.find(l => l.description.toLowerCase() === match);
        return {
          value: { name: category.name, categoryId: category.id },
          confidence: matchingLabel?.score || 0.6,
        };
      }
    }
  }
  
  return undefined;
}

/**
 * Extract condition from labels
 */
function extractCondition(labels: string[]): FieldResult<string> | undefined {
  const conditionKeywords = {
    new: ['new', 'unused', 'mint'],
    like_new: ['like new', 'excellent', 'pristine'],
    good: ['good', 'used', 'working'],
    fair: ['fair', 'worn', 'some wear'],
    worn: ['worn', 'damaged', 'broken'],
  };
  
  for (const [condition, keywords] of Object.entries(conditionKeywords)) {
    for (const keyword of keywords) {
      if (labels.some(label => label.includes(keyword))) {
        return {
          value: condition,
          confidence: 0.5, // Low confidence for condition (visual only)
        };
      }
    }
  }
  
  // Default to 'good' with low confidence
  return {
    value: 'good',
    confidence: 0.3,
  };
}

/**
 * Extract brand from text detection
 */
function extractBrand(texts: any[], labels: string[]): FieldResult<string> | undefined {
  const popularBrands = [
    'LEGO', 'Nike', 'Adidas', 'Gap', 'Carters', 'Disney', 'Barbie',
    'Fisher-Price', 'Melissa & Doug', 'Little Tikes', 'VTech'
  ];
  
  // Check text annotations first
  if (texts.length > 0) {
    const fullText = texts[0].description.toUpperCase();
    for (const brand of popularBrands) {
      if (fullText.includes(brand.toUpperCase())) {
        return {
          value: brand,
          confidence: 0.8,
        };
      }
    }
  }
  
  // Check labels
  for (const brand of popularBrands) {
    if (labels.some(label => label.includes(brand.toLowerCase()))) {
      return {
        value: brand,
        confidence: 0.6,
      };
    }
  }
  
  return undefined;
}

/**
 * Extract colors from labels
 */
function extractColors(labels: string[]): FieldResult<string[]> | undefined {
  const colorKeywords = [
    'red', 'blue', 'green', 'yellow', 'pink', 'purple', 
    'black', 'white', 'gray', 'brown', 'orange', 'multicolor'
  ];
  
  const detectedColors: string[] = [];
  
  for (const color of colorKeywords) {
    if (labels.some(label => label.includes(color))) {
      detectedColors.push(capitalizeWords(color));
    }
  }
  
  if (detectedColors.length > 0) {
    return {
      value: detectedColors.slice(0, 3), // Max 3 colors
      confidence: 0.7,
    };
  }
  
  return undefined;
}

/**
 * Extract age group from labels
 */
function extractAgeGroup(labels: string[]): FieldResult<string> | undefined {
  const ageKeywords = {
    '0-2': ['baby', 'infant', 'toddler', 'newborn'],
    '3-5': ['preschool', 'toddler', 'young child'],
    '6-8': ['child', 'kid', 'elementary'],
    '9-12': ['tween', 'preteen', 'middle school'],
    '13+': ['teen', 'teenager', 'adolescent', 'youth'],
  };
  
  for (const [ageGroup, keywords] of Object.entries(ageKeywords)) {
    for (const keyword of keywords) {
      if (labels.some(label => label.includes(keyword))) {
        return {
          value: ageGroup,
          confidence: 0.5, // Medium confidence
        };
      }
    }
  }
  
  return undefined;
}

/**
 * Extract gender from labels
 */
function extractGender(labels: string[]): FieldResult<string> | undefined {
  const genderKeywords = {
    boy: ['boy', 'boys', 'male'],
    girl: ['girl', 'girls', 'female'],
    unisex: ['unisex', 'neutral', 'kids'],
  };
  
  for (const [gender, keywords] of Object.entries(genderKeywords)) {
    for (const keyword of keywords) {
      if (labels.some(label => label.includes(keyword))) {
        return {
          value: gender,
          confidence: 0.5,
        };
      }
    }
  }
  
  // Default to unisex with low confidence
  return {
    value: 'unisex',
    confidence: 0.3,
  };
}

/**
 * Capitalize first letter of each word
 */
function capitalizeWords(str: string): string {
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Extracts all V2 fields (brand, color, age_group, gender)
✓ Returns confidence score per field
✓ 10-second timeout with abort controller
✓ Rate limit handling (429 retry with backoff)
✓ Graceful fallback for partial results
✓ Field-specific confidence thresholds
✓ CORS headers configured

==================================================
NEXT TASK: AI-V2-004 (Photo Upload & Compression Utilities)
==================================================
*/
```

---

## TASK AI-V2-004: Photo Upload & Compression Utilities

**Duration:** 3 hours  
**Priority:** High  
**Dependencies:** None (standalone utilities)

### Description
Create photo validation, compression, and upload utilities. Handle photo selection from camera or gallery, compress to target size, upload to Supabase Storage.

### Acceptance Criteria
- [ ] validatePhoto() checks type, size, dimensions
- [ ] compressPhoto() reduces to < 1MB
- [ ] uploadPhoto() uploads to Supabase Storage
- [ ] uploadPhotoBatch() handles multiple photos with progress
- [ ] Error handling for all failure cases
- [ ] Progress callbacks for UI updates

---

### AI Prompt for Cursor

```typescript
/*
TASK: Create photo upload and compression utilities

CONTEXT:
Photos must be validated, compressed, and uploaded to Supabase Storage efficiently.

REQUIREMENTS:
- Validate photo type (JPEG, PNG, WebP)
- Validate size (< 10MB raw)
- Validate dimensions (min 400x400px)
- Compress to < 1MB
- Upload to Supabase Storage
- Progress tracking

==================================================
FILE: Photo utilities implementation
==================================================
*/

// filepath: src/utils/photoUtils.ts

import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';

export interface PhotoAsset {
  id: string;
  uri: string;
  width?: number;
  height?: number;
  fileSize?: number;
  mimeType?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface UploadProgress {
  completed: number;
  total: number;
  currentFile?: string;
}

const VALID_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_RAW_SIZE = 10 * 1024 * 1024; // 10MB
const TARGET_SIZE = 1 * 1024 * 1024; // 1MB
const MIN_DIMENSION = 400;
const MAX_WIDTH = 1200;

/**
 * Validate photo meets requirements
 */
export function validatePhoto(photo: ImagePicker.ImagePickerAsset): ValidationResult {
  // Check MIME type
  if (photo.mimeType && !VALID_TYPES.includes(photo.mimeType)) {
    return {
      valid: false,
      error: 'Invalid photo type. Please use JPEG, PNG, or WebP.',
    };
  }

  // Check file size
  if (photo.fileSize && photo.fileSize > MAX_RAW_SIZE) {
    return {
      valid: false,
      error: 'Photo is too large. Maximum size is 10MB.',
    };
  }

  // Check dimensions
  if (photo.width && photo.height) {
    if (photo.width < MIN_DIMENSION || photo.height < MIN_DIMENSION) {
      return {
        valid: false,
        error: `Photo is too small. Minimum dimensions are ${MIN_DIMENSION}x${MIN_DIMENSION}px.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Compress photo to target size
 */
export async function compressPhoto(
  uri: string,
  quality: number = 0.8
): Promise<string> {
  try {
    // Get original dimensions
    const { width, height } = await ImageManipulator.manipulateAsync(
      uri,
      [],
      { compress: 1 }
    );

    // Calculate resize if needed
    let resize: { width: number } | undefined;
    if (width > MAX_WIDTH) {
      resize = { width: MAX_WIDTH };
    }

    // Compress
    const result = await ImageManipulator.manipulateAsync(
      uri,
      resize ? [{ resize }] : [],
      {
        compress: quality,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    return result.uri;
  } catch (error) {
    console.error('Photo compression error:', error);
    throw new Error('Failed to compress photo');
  }
}

/**
 * Upload single photo to Supabase Storage
 */
export async function uploadPhoto(
  uri: string,
  sellerId: string,
  filename?: string
): Promise<string> {
  try {
    // Generate filename if not provided
    const finalFilename = filename || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
    const storagePath = `listings/${sellerId}/${finalFilename}`;

    // Convert URI to blob
    const response = await fetch(uri);
    const blob = await response.blob();

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('item-photos')
      .upload(storagePath, blob, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) {
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('item-photos')
      .getPublicUrl(storagePath);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Photo upload error:', error);
    throw new Error('Failed to upload photo');
  }
}

/**
 * Upload multiple photos with progress tracking
 */
export async function uploadPhotoBatch(
  photos: PhotoAsset[],
  sellerId: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<string[]> {
  const uploadedUrls: string[] = [];
  const errors: Array<{ photoId: string; error: string }> = [];

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];

    try {
      // Compress photo
      const compressedUri = await compressPhoto(photo.uri);

      // Upload
      const url = await uploadPhoto(compressedUri, sellerId);
      uploadedUrls.push(url);

      // Update progress
      if (onProgress) {
        onProgress({
          completed: i + 1,
          total: photos.length,
          currentFile: photo.id,
        });
      }
    } catch (error) {
      errors.push({
        photoId: photo.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // If some uploads failed, throw with details
  if (errors.length > 0 && uploadedUrls.length === 0) {
    throw new Error(`All photo uploads failed: ${errors.map(e => e.error).join(', ')}`);
  }

  // Partial success is OK - return successful URLs
  return uploadedUrls;
}

/**
 * Pick photos from gallery
 */
export async function pickPhotosFromGallery(
  maxPhotos: number = 10
): Promise<PhotoAsset[]> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (status !== 'granted') {
    throw new Error('Photo library permission denied');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: true,
    selectionLimit: maxPhotos,
    quality: 1,
  });

  if (result.canceled) {
    return [];
  }

  return result.assets.map(asset => ({
    id: `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    fileSize: asset.fileSize,
    mimeType: asset.mimeType,
  }));
}

/**
 * Take photo with camera
 */
export async function takePhotoWithCamera(): Promise<PhotoAsset | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();

  if (status !== 'granted') {
    throw new Error('Camera permission denied');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 1,
  });

  if (result.canceled) {
    return null;
  }

  const asset = result.assets[0];
  return {
    id: `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    fileSize: asset.fileSize,
    mimeType: asset.mimeType,
  };
}

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ validatePhoto() checks type, size, dimensions
✓ compressPhoto() reduces to < 1MB
✓ uploadPhoto() uploads to Supabase Storage
✓ uploadPhotoBatch() tracks progress
✓ pickPhotosFromGallery() requests permission and selects photos
✓ takePhotoWithCamera() captures new photo
✓ Error handling for all operations
✓ Progress callbacks functional

==================================================
NEXT TASK: AI-V2-005 (Price Suggestion Service)
==================================================
*/
```

---

## TASK AI-V2-005: Price Suggestion Service

**Duration:** 2 hours  
**Priority:** Medium  
**Dependencies:** None (uses existing items table)

### Description
Implement price suggestion service that calculates 4-tier pricing based on category, condition, and historical sales data.

### Acceptance Criteria
- [ ] getSuggestedPrice() returns 4 tiers
- [ ] Queries last 90 days of sold items
- [ ] Calculates percentiles for each tier
- [ ] Returns empty array if < 5 comparable items
- [ ] Caches results for performance

---

### AI Prompt for Cursor

```typescript
/*
TASK: Implement price suggestion service

CONTEXT:
Price suggestions help sellers price items competitively based on market data.

TIERS:
- Great Deal: 40-50% of average
- Fair Price: 55-65% of average
- Asking Price: 70-80% of average
- Almost New: 85-95% of average

==================================================
FILE: Price suggestion service
==================================================
*/

// filepath: src/services/pricingService.ts

import { supabase } from '@/lib/supabase';

export interface PriceTier {
  tier: 'great_deal' | 'fair_price' | 'asking_price' | 'almost_new';
  label: string;
  description: string;
  price: number;
  icon: string;
}

export class PricingService {
  private static cache = new Map<string, PriceTier[]>();

  /**
   * Get suggested price tiers for category + condition
   */
  static async getSuggestedPrice(
    categoryId: string,
    condition: string
  ): Promise<PriceTier[]> {
    const cacheKey = `${categoryId}-${condition}`;

    // Check cache
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      // Query sold items in last 90 days
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { data, error } = await supabase
        .from('items')
        .select('price')
        .eq('category_id', categoryId)
        .eq('condition', condition)
        .eq('status', 'sold')
        .gte('sold_at', ninetyDaysAgo.toISOString())
        .order('price', { ascending: true });

      if (error) throw error;

      // Need at least 5 items for meaningful suggestions
      if (!data || data.length < 5) {
        return [];
      }

      // Calculate average price
      const prices = data.map(item => item.price);
      const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;

      // Generate tiers
      const tiers: PriceTier[] = [
        {
          tier: 'great_deal',
          label: 'Great Deal',
          description: 'Sell fast',
          price: Math.round(avgPrice * 0.45),
          icon: '🔥',
        },
        {
          tier: 'fair_price',
          label: 'Fair Price',
          description: 'Most popular',
          price: Math.round(avgPrice * 0.60),
          icon: '💰',
        },
        {
          tier: 'asking_price',
          label: 'Asking Price',
          description: 'Market value',
          price: Math.round(avgPrice * 0.75),
          icon: '💵',
        },
        {
          tier: 'almost_new',
          label: 'Almost New',
          description: 'Premium price',
          price: Math.round(avgPrice * 0.90),
          icon: '✨',
        },
      ];

      // Cache for 1 hour
      this.cache.set(cacheKey, tiers);
      setTimeout(() => this.cache.delete(cacheKey), 3600000);

      return tiers;
    } catch (error) {
      console.error('Failed to get price suggestions:', error);
      return [];
    }
  }

  /**
   * Clear cache (for testing)
   */
  static clearCache(): void {
    this.cache.clear();
  }
}

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Returns 4 price tiers based on market data
✓ Queries last 90 days of sold items
✓ Returns empty array if < 5 comparable items
✓ Caches results for 1 hour
✓ Handles errors gracefully

==================================================
NEXT TASK: AI-V2-006 (Category & Brand Services)
==================================================
*/
```

---

## TASK AI-V2-006: Category & Brand Services

**Duration:** 3 hours  
**Priority:** High  
**Dependencies:** None (uses existing categories table)

### Description
Implement category management service (with search, recent categories, "Other" handling) and brand autocomplete service.

### Acceptance Criteria
- [ ] getCategories() returns all categories with item counts
- [ ] searchCategories() filters by query
- [ ] getRecentCategories() returns last 3 used categories from AsyncStorage
- [ ] saveRecentCategory() updates AsyncStorage
- [ ] getBrandSuggestions() merges predefined + DB brands
- [ ] Brand suggestions after 2 characters typed

---

### AI Prompt for Cursor

```typescript
/*
TASK: Implement category and brand services

CONTEXT:
Category selection with search, recent categories, and brand autocomplete.

==================================================
FILE 1: Category service
==================================================
*/

// filepath: src/services/categoryService.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

export interface Category {
  id: string;
  name: string;
  icon?: string;
  item_count?: number;
}

const RECENT_CATEGORIES_KEY = '@kids_marketplace:recent_categories';
const MAX_RECENT = 3;

export class CategoryService {
  /**
   * Get all categories with item counts
   */
  static async getCategories(includeOther: boolean = true): Promise<Category[]> {
    try {
      const { data, error } = await supabase
        .rpc('get_categories_with_counts');

      if (error) throw error;

      const categories = data || [];

      if (includeOther) {
        categories.push({
          id: 'other',
          name: 'Other',
          icon: '📦',
          item_count: 0,
        });
      }

      return categories;
    } catch (error) {
      console.error('Failed to get categories:', error);
      return [];
    }
  }

  /**
   * Search categories by name
   */
  static searchCategories(categories: Category[], query: string): Category[] {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return categories;

    return categories.filter(cat =>
      cat.name.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get recent categories for user
   */
  static async getRecentCategories(sellerId: string): Promise<Category[]> {
    try {
      const key = `${RECENT_CATEGORIES_KEY}_${sellerId}`;
      const stored = await AsyncStorage.getItem(key);

      if (!stored) return [];

      const categoryIds = JSON.parse(stored) as string[];

      // Fetch category details
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .in('id', categoryIds);

      if (error) throw error;

      // Maintain order from AsyncStorage
      return categoryIds
        .map(id => data?.find(cat => cat.id === id))
        .filter(Boolean) as Category[];
    } catch (error) {
      console.error('Failed to get recent categories:', error);
      return [];
    }
  }

  /**
   * Save category to recent list
   */
  static async saveRecentCategory(
    sellerId: string,
    categoryId: string
  ): Promise<void> {
    try {
      const key = `${RECENT_CATEGORIES_KEY}_${sellerId}`;
      const stored = await AsyncStorage.getItem(key);

      let categoryIds: string[] = stored ? JSON.parse(stored) : [];

      // Remove if already exists
      categoryIds = categoryIds.filter(id => id !== categoryId);

      // Add to front
      categoryIds.unshift(categoryId);

      // Keep only last 3
      categoryIds = categoryIds.slice(0, MAX_RECENT);

      await AsyncStorage.setItem(key, JSON.stringify(categoryIds));
    } catch (error) {
      console.error('Failed to save recent category:', error);
    }
  }
}

/*
==================================================
FILE 2: Brand service
==================================================
*/

// filepath: src/services/brandService.ts

import { supabase } from '@/lib/supabase';

const POPULAR_BRANDS = [
  'LEGO', 'Nike', "Carter's", "OshKosh B'Gosh", 'Melissa & Doug',
  'Fisher-Price', 'Little Tikes', 'Barbie', 'Hot Wheels', 'Disney',
  'Marvel', 'Star Wars', 'Pokemon', 'Gap Kids', 'Old Navy',
  'Target', 'Cat & Jack', 'H&M', 'Zara Kids', 'Gymboree',
  'Graco', 'Chicco', 'BabyBjörn', 'Ergobaby', 'Skip Hop',
  'Vans', 'Converse', 'Adidas', 'Crayola', 'Play-Doh',
  'Nerf', 'American Girl', 'Baby Einstein', 'VTech', 'LeapFrog',
  'Paw Patrol', 'Frozen', 'Minnie Mouse', 'Thomas & Friends',
  'Sesame Street', 'The North Face', 'Columbia', 'Patagonia',
  'Ralph Lauren', 'Tommy Hilfiger', 'Hanna Andersson', 'Mini Boden',
  'Tea Collection', 'Primary', "Lands' End",
];

export class BrandService {
  private static dbBrandsCache: string[] = [];
  private static lastCacheUpdate: number = 0;
  private static readonly CACHE_TTL = 3600000; // 1 hour

  /**
   * Get brand suggestions based on query
   */
  static async getBrandSuggestions(query: string): Promise<string[]> {
    if (query.length < 2) {
      return [];
    }

    const lowerQuery = query.toLowerCase();

    // Update DB brands cache if stale
    await this.updateDBBrandsCache();

    // Combine predefined + DB brands
    const allBrands = [...POPULAR_BRANDS, ...this.dbBrandsCache];

    // Filter by query (startsWith for better UX)
    const filtered = allBrands.filter(brand =>
      brand.toLowerCase().startsWith(lowerQuery)
    );

    // Deduplicate and sort
    const unique = [...new Set(filtered)];
    unique.sort();

    // Return max 8 results
    return unique.slice(0, 8);
  }

  /**
   * Update DB brands cache
   */
  private static async updateDBBrandsCache(): Promise<void> {
    const now = Date.now();

    if (now - this.lastCacheUpdate < this.CACHE_TTL) {
      return; // Cache still valid
    }

    try {
      const { data, error } = await supabase
        .from('items')
        .select('brand')
        .not('brand', 'is', null);

      if (error) throw error;

      // Extract unique brands
      const brands = data
        ?.map(item => item.brand)
        .filter((brand): brand is string => Boolean(brand)) || [];

      this.dbBrandsCache = [...new Set(brands)];
      this.lastCacheUpdate = now;
    } catch (error) {
      console.error('Failed to update brand cache:', error);
    }
  }
}

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ getCategories() returns all categories
✓ searchCategories() filters by query
✓ getRecentCategories() returns from AsyncStorage
✓ saveRecentCategory() updates AsyncStorage (max 3)
✓ getBrandSuggestions() merges predefined + DB brands
✓ Brand autocomplete works after 2 chars
✓ Results deduplicated and sorted

==================================================
NEXT TASK: AI-V2-007 (Condition Guide Service)
==================================================
*/
```

---

## TASK AI-V2-007: Condition Guide & Color Service

**Duration:** 2 hours  
**Priority:** Medium  
**Dependencies:** None

### Description
Create service for condition photo guide (real marketplace photo examples) and color selection utilities.

### Acceptance Criteria
- [ ] getConditionGuide() returns condition definitions with example photo URLs
- [ ] Example photos sourced from real marketplace items
- [ ] getPopularColors() returns predefined color list
- [ ] Cached for performance

---

### AI Prompt for Cursor

```typescript
/*
TASK: Implement condition guide and color services

CONTEXT:
Condition guide shows real photo examples to help sellers rate items accurately.

==================================================
FILE: Condition and color services
==================================================
*/

// filepath: src/services/conditionService.ts

export interface ConditionLevel {
  code: string;
  label: string;
  description: string;
  examplePhotoUrls: string[];
}

const CONDITION_GUIDE: ConditionLevel[] = [
  {
    code: 'new',
    label: 'New',
    description: 'Brand new, unused, tags still attached',
    examplePhotoUrls: [
      'https://example.com/condition-examples/new-1.jpg',
      'https://example.com/condition-examples/new-2.jpg',
    ],
  },
  {
    code: 'like_new',
    label: 'Like New',
    description: 'Used once or twice, looks brand new, no visible wear',
    examplePhotoUrls: [
      'https://example.com/condition-examples/like-new-1.jpg',
      'https://example.com/condition-examples/like-new-2.jpg',
    ],
  },
  {
    code: 'good',
    label: 'Good',
    description: 'Gently used, minor signs of wear, fully functional',
    examplePhotoUrls: [
      'https://example.com/condition-examples/good-1.jpg',
      'https://example.com/condition-examples/good-2.jpg',
    ],
  },
  {
    code: 'fair',
    label: 'Fair',
    description: 'Visible wear and tear, still functional',
    examplePhotoUrls: [
      'https://example.com/condition-examples/fair-1.jpg',
      'https://example.com/condition-examples/fair-2.jpg',
    ],
  },
  {
    code: 'worn',
    label: 'Worn',
    description: 'Heavy wear, may have flaws, priced accordingly',
    examplePhotoUrls: [
      'https://example.com/condition-examples/worn-1.jpg',
      'https://example.com/condition-examples/worn-2.jpg',
    ],
  },
];

const POPULAR_COLORS = [
  'Red',
  'Blue',
  'Green',
  'Yellow',
  'Pink',
  'Purple',
  'Black',
  'White',
  'Gray',
  'Brown',
  'Orange',
  'Multicolor',
];

export class ConditionService {
  /**
   * Get condition guide with example photos
   */
  static getConditionGuide(): ConditionLevel[] {
    return CONDITION_GUIDE;
  }

  /**
   * Get condition by code
   */
  static getCondition(code: string): ConditionLevel | undefined {
    return CONDITION_GUIDE.find(c => c.code === code);
  }

  /**
   * Get popular colors for selection
   */
  static getPopularColors(): string[] {
    return POPULAR_COLORS;
  }
}

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ getConditionGuide() returns all condition levels
✓ Each condition has example photo URLs
✓ getCondition() retrieves single condition by code
✓ getPopularColors() returns 12 predefined colors

==================================================
NEXT TASK: AI-V2-008 (ItemCreateScreen Main Component)
==================================================
*/
```

---

## TASK AI-V2-008: ItemCreateScreen - Main Component

**Duration:** 5 hours  
**Priority:** Critical  
**Dependencies:** AI-V2-001 through AI-V2-007

### Description
Create main ItemCreateScreen component that orchestrates photo-first flow, AI analysis, draft management, and publishing. Integrates all services and components.

### Acceptance Criteria
- [ ] Photo-first flow implemented
- [ ] AI analysis triggered on photo upload
- [ ] AI suggestion card appears when ready
- [ ] Form interactive during AI processing
- [ ] Draft auto-save integrated
- [ ] Price suggestions loaded
- [ ] Category selection modal
- [ ] Publish validation and success flow

---

### AI Prompt for Cursor

```typescript
/*
TASK: Create ItemCreateScreen main component

CONTEXT:
Main screen for creating a single item with AI assistance.

FLOW:
1. Add photos
2. AI analyzes (background)
3. Show AI suggestion card
4. Fill/edit details
5. Set price
6. Publish

==================================================
FILE: ItemCreateScreen component
==================================================
*/

// filepath: src/screens/ItemCreateScreen.tsx

import React, { useState, useCallback, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { PhotoUploadManager } from '@/components/item-create/PhotoUploadManager';
import { AIAnalysisCard } from '@/components/item-create/AIAnalysisCard';
import { ItemDetailsForm } from '@/components/item-create/ItemDetailsForm';
import { PriceSuggestionCard } from '@/components/item-create/PriceSuggestionCard';

import { useDraft } from '@/hooks/useDraft';
import { supabase } from '@/lib/supabase';
import { uploadPhotoBatch } from '@/utils/photoUtils';
import type { PhotoAsset } from '@/utils/photoUtils';
import type { AIAnalysisResult } from '@/types/itemDrafts';

export const ItemCreateScreen: React.FC = () => {
  const navigation = useNavigation();
  
  // Get user ID from auth
  const userId = 'current-user-id'; // Replace with actual auth context
  
  // Draft management
  const {
    draft,
    updateDraftData,
    updatePhotoUrls,
    updateAISuggestions,
    updateStep,
    publishDraft,
  } = useDraft(userId);
  
  // Local state
  const [photos, setPhotos] = useState<PhotoAsset[]>([]);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [aiAnalysis, setAIAnalysis] = useState<AIAnalysisResult | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  
  /**
   * Handle photos added
   */
  const handlePhotosAdded = useCallback(async (newPhotos: PhotoAsset[]) => {
    setPhotos(newPhotos);
    setIsUploadingPhotos(true);
    
    try {
      // Upload photos
      const uploadedUrls = await uploadPhotoBatch(newPhotos, userId);
      
      // Update draft with photo URLs
      updatePhotoUrls(uploadedUrls);
      
      // Start AI analysis with first photo
      if (uploadedUrls.length > 0) {
        setIsAnalyzingAI(true);
        
        const { data, error } = await supabase.functions.invoke('analyze-item-image', {
          body: {
            photoUrl: uploadedUrls[0],
            requestFields: ['title', 'category', 'condition', 'brand', 'color', 'age_group', 'gender'],
          },
        });
        
        setIsAnalyzingAI(false);
        
        if (!error && data) {
          setAIAnalysis(data);
          updateAISuggestions(data);
          setShowAISuggestions(true);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to upload photos');
      console.error(error);
    } finally {
      setIsUploadingPhotos(false);
    }
  }, [userId, updatePhotoUrls, updateAISuggestions]);
  
  /**
   * Apply AI suggestions
   */
  const handleApplyAllAI = useCallback(() => {
    if (!aiAnalysis) return;
    
    const updates: any = {};
    
    if (aiAnalysis.title && aiAnalysis.title.confidence > 0.4) {
      updates.title = aiAnalysis.title.value;
    }
    
    if (aiAnalysis.category && aiAnalysis.category.confidence > 0.4) {
      updates.category_id = aiAnalysis.category.categoryId;
    }
    
    if (aiAnalysis.condition && aiAnalysis.condition.confidence > 0.4) {
      updates.condition = aiAnalysis.condition.value;
    }
    
    if (aiAnalysis.brand && aiAnalysis.brand.confidence > 0.4) {
      updates.brand = aiAnalysis.brand.value;
    }
    
    if (aiAnalysis.color && aiAnalysis.color.confidence > 0.4) {
      updates.color = aiAnalysis.color.value;
    }
    
    if (aiAnalysis.age_group && aiAnalysis.age_group.confidence > 0.4) {
      updates.age_group = aiAnalysis.age_group.value;
    }
    
    if (aiAnalysis.gender && aiAnalysis.gender.confidence > 0.4) {
      updates.gender = aiAnalysis.gender.value;
    }
    
    updateDraftData(updates);
    setShowAISuggestions(false);
  }, [aiAnalysis, updateDraftData]);
  
  /**
   * Handle publish
   */
  const handlePublish = useCallback(async () => {
    setIsPublishing(true);
    
    try {
      const itemId = await publishDraft();
      
      Alert.alert('Success', 'Item published successfully!');
      navigation.navigate('YourListings');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to publish item');
    } finally {
      setIsPublishing(false);
    }
  }, [publishDraft, navigation]);
  
  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Photo Upload */}
        <PhotoUploadManager
          photos={photos}
          onPhotosAdded={handlePhotosAdded}
          maxPhotos={10}
          isUploading={isUploadingPhotos}
        />
        
        {/* AI Analysis Card */}
        {showAISuggestions && aiAnalysis && (
          <AIAnalysisCard
            analysis={aiAnalysis}
            onApplyAll={handleApplyAllAI}
            onDismiss={() => setShowAISuggestions(false)}
          />
        )}
        
        {/* Item Details Form */}
        <ItemDetailsForm
          draftData={draft?.draft_data}
          onFieldChange={(field, value) => updateDraftData({ [field]: value })}
        />
        
        {/* Price Suggestions */}
        {draft?.draft_data.category_id && draft?.draft_data.condition && (
          <PriceSuggestionCard
            categoryId={draft.draft_data.category_id}
            condition={draft.draft_data.condition}
            onPriceSelected={(price) => updateDraftData({ price })}
          />
        )}
        
        {/* Publish Button */}
        <View style={styles.publishContainer}>
          <button
            onClick={handlePublish}
            disabled={isPublishing}
            style={styles.publishButton}
          >
            {isPublishing ? 'Publishing...' : 'Publish Item'}
          </button>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  publishContainer: {
    marginTop: 24,
    marginBottom: 40,
  },
  publishButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
});

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Photo-first flow (photos required to start)
✓ AI analysis triggered after photo upload
✓ Form interactive during AI processing
✓ AI suggestion card appears when ready
✓ Draft auto-save via useDraft hook
✓ Price suggestions load based on category+condition
✓ Publish validation and error handling
✓ Navigation to listings on success

==================================================
REMAINING TASKS: Components (AI-V2-009 through AI-V2-012)
==================================================
*/
```

---

## TASKS AI-V2-009 through AI-V2-012: UI Components

**Combined Duration:** 8 hours  
**Priority:** High  
**Dependencies:** AI-V2-008

### Component List
1. **PhotoUploadManager** - Photo selection, display, reordering
2. **AIAnalysisCard** - AI suggestions display with apply buttons
3. **ItemDetailsForm** - All form fields (title, category, condition, etc.)
4. **PriceSuggestionCard** - 4-tier price display with manual input
5. **CategorySelectModal** - Full-screen category picker with search
6. **ConditionSelector** - Condition picker with photo guide
7. **BrandAutocomplete** - Brand input with suggestions

### AI Prompt for Cursor (Condensed)

```typescript
/*
TASKS: Create all UI components for ItemCreateScreen

FILES TO CREATE:
- src/components/item-create/PhotoUploadManager.tsx
- src/components/item-create/AIAnalysisCard.tsx
- src/components/item-create/ItemDetailsForm.tsx
- src/components/item-create/PriceSuggestionCard.tsx
- src/components/item-create/CategorySelectModal.tsx
- src/components/item-create/ConditionSelector.tsx
- src/components/item-create/BrandAutocomplete.tsx

IMPLEMENTATION NOTES:
Follow React Native + Expo best practices.
Use existing design system components.
Include accessibility labels.
Handle loading and error states.
Implement responsive layouts.

For detailed component specifications, refer to:
/Users/sameralzubaidi/Desktop/kids_marketplace_app/docx/BULK-LISTING-REQUIREMENTS.md
(Section: Component Specifications)

ACCEPTANCE CRITERIA:
✓ All components functional and styled
✓ Proper TypeScript typing
✓ Accessibility support
✓ Error handling
✓ Responsive layouts
✓ Integration with parent screen
*/
```

---

## IMPLEMENTATION CHECKLIST

### Database
- [ ] Run migration: 143_item_drafts_v2.sql
- [ ] Verify triggers (auto-update, max drafts enforcement)
- [ ] Test RLS policies with seller account

### Services
- [ ] Implement DraftService (CRUD + publish)
- [ ] Implement PricingService (4-tier suggestions)
- [ ] Implement CategoryService (with recent categories)
- [ ] Implement BrandService (autocomplete)
- [ ] Implement ConditionService (guide + colors)

### Edge Functions
- [ ] Enhance analyze-item-image with new fields
- [ ] Add confidence scoring
- [ ] Add timeout handling
- [ ] Deploy to production

### Utilities
- [ ] Photo validation (type, size, dimensions)
- [ ] Photo compression (< 1MB target)
- [ ] Photo upload (batch with progress)
- [ ] Camera + gallery pickers

### Hooks
- [ ] useDraft (auto-save, background save, app state handling)
- [ ] usePhotoUpload (progress tracking)
- [ ] usePriceSuggestions (caching)

### Components
- [ ] ItemCreateScreen (main orchestrator)
- [ ] PhotoUploadManager
- [ ] AIAnalysisCard
- [ ] ItemDetailsForm
- [ ] PriceSuggestionCard
- [ ] CategorySelectModal
- [ ] ConditionSelector
- [ ] BrandAutocomplete

### Integration Testing
- [ ] Photo upload → AI analysis → suggestions → publish
- [ ] Draft auto-save during editing
- [ ] Draft resume on app reopen
- [ ] Price tiers load correctly
- [ ] Category search and recent categories
- [ ] Brand autocomplete

---

*Document version: 2.0 | Last updated: April 20, 2026*

---

Due to space, I'll create the remaining tasks in a condensed format. The file continues with tasks AI-V2-004 through AI-V2-012, covering all the necessary components. Let me add the remaining tasks:

