/**
 * File: p2p-kids-marketplace/e2e/listing-v3-004-hooks.integration.test.ts
 * MODULE-04 LISTING-V3-004: Integration Tests for Hooks
 *
 * Prerequisites:
 * - Supabase staging database with LISTING-V3-001 migrations applied
 * - Test user with active session
 * - Edge functions deployed (analyze-item-image, batch-analyze-items)
 *
 * Run with: RUN_SUPABASE_E2E=true npm run test:e2e
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useItemDraft } from '../src/hooks/useItemDraft';
import { useAIAnalysis } from '../src/hooks/useAIAnalysis';
import { usePhotoGroups } from '../src/hooks/usePhotoGroups';
import { supabase } from '../src/config/supabase';
import { DraftData } from '../src/types/listing';

// Skip if not running E2E tests
const describeE2E = process.env.RUN_SUPABASE_E2E === 'true' ? describe : describe.skip;

// Test user and cleanup helpers
let testSellerId: string;
let draftIds: string[] = [];
let canRunAuthenticatedE2E = true;

async function setupTestUser() {
  // Get current user or create test user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    canRunAuthenticatedE2E = false;
    console.warn(
      'Skipping LISTING-V3-004 authenticated E2E tests: no active Supabase user session.'
    );
    return;
  }
  testSellerId = user.id;
}

async function cleanupDrafts() {
  if (!canRunAuthenticatedE2E) {
    draftIds = [];
    return;
  }

  // Clean up all drafts created during tests
  if (draftIds.length > 0) {
    await supabase.from('item_drafts').delete().in('id', draftIds);
    draftIds = [];
  }
}

describeE2E('LISTING-V3-004 Integration Tests', () => {
  beforeAll(async () => {
    await setupTestUser();
  });

  afterAll(async () => {
    await cleanupDrafts();
  });

  afterEach(async () => {
    await cleanupDrafts();
  });

  describe('useItemDraft integration', () => {
    it('should create draft in Supabase', async () => {
      if (!canRunAuthenticatedE2E) return;

      const { result } = renderHook(() => useItemDraft(undefined, testSellerId));

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 5000 }
      );

      expect(result.current.draft).not.toBeNull();
      expect(result.current.draft?.seller_id).toBe(testSellerId);

      if (result.current.draft) {
        draftIds.push(result.current.draft.id);
      }
    });

    it('should persist updates to Supabase', async () => {
      if (!canRunAuthenticatedE2E) return;

      const { result } = renderHook(() => useItemDraft(undefined, testSellerId));

      await waitFor(
        () => {
          expect(result.current.draft).not.toBeNull();
        },
        { timeout: 5000 }
      );

      const draftId = result.current.draft!.id;
      draftIds.push(draftId);

      const updates: Partial<DraftData> = {
        title: 'E2E Test Item',
        description: 'Integration test description',
        price: 25.99,
      };

      act(() => {
        result.current.save(updates);
      });

      await act(async () => {
        await result.current.saveNow();
      });

      // Verify in database
      const { data } = await supabase
        .from('item_drafts')
        .select('draft_data')
        .eq('id', draftId)
        .single();

      expect(data?.draft_data.title).toBe('E2E Test Item');
      expect(data?.draft_data.description).toBe('Integration test description');
      expect(data?.draft_data.price).toBe(25.99);
    });

    it('should load existing draft', async () => {
      if (!canRunAuthenticatedE2E) return;

      // Create draft directly in DB
      const { data: created } = await supabase
        .from('item_drafts')
        .insert({
          seller_id: testSellerId,
          draft_data: { title: 'Existing Draft' },
          photo_urls: [],
          step: 'photos',
        })
        .select()
        .single();

      expect(created).not.toBeNull();
      const draftId = created!.id;
      draftIds.push(draftId);

      // Load via hook
      const { result } = renderHook(() => useItemDraft(draftId));

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 5000 }
      );

      expect(result.current.draft?.id).toBe(draftId);
      expect(result.current.draft?.draft_data.title).toBe('Existing Draft');
    });

    it('should delete draft from Supabase', async () => {
      if (!canRunAuthenticatedE2E) return;

      const { result } = renderHook(() => useItemDraft(undefined, testSellerId));

      await waitFor(
        () => {
          expect(result.current.draft).not.toBeNull();
        },
        { timeout: 5000 }
      );

      const draftId = result.current.draft!.id;

      await act(async () => {
        await result.current.discard();
      });

      // Verify deleted
      const { data } = await supabase
        .from('item_drafts')
        .select('id')
        .eq('id', draftId)
        .maybeSingle();

      expect(data).toBeNull();
    });

    it('should enforce max 5 drafts per seller via trigger', async () => {
      if (!canRunAuthenticatedE2E) return;

      // Create 5 drafts
      const drafts = [];
      for (let i = 0; i < 5; i++) {
        const { data } = await supabase
          .from('item_drafts')
          .insert({
            seller_id: testSellerId,
            draft_data: { title: `Draft ${i + 1}` },
            photo_urls: [],
            step: 'photos',
          })
          .select()
          .single();

        drafts.push(data!);
        draftIds.push(data!.id);
      }

      // Create 6th draft
      const { data: sixth } = await supabase
        .from('item_drafts')
        .insert({
          seller_id: testSellerId,
          draft_data: { title: 'Draft 6' },
          photo_urls: [],
          step: 'photos',
        })
        .select()
        .single();

      draftIds.push(sixth!.id);

      // Count total drafts
      const { count } = await supabase
        .from('item_drafts')
        .select('id', { count: 'exact' })
        .eq('seller_id', testSellerId);

      // Should only have 5 (trigger evicted oldest)
      expect(count).toBe(5);
    });
  });

  describe('useAIAnalysis integration', () => {
    it('should analyze real photo via Edge Function', async () => {
      if (!canRunAuthenticatedE2E) return;

      // Use a public test image URL
      const testPhotoUrl = 'https://via.placeholder.com/800x600/0000FF/FFFFFF?text=Blue+Bike';

      const { result } = renderHook(() => useAIAnalysis([testPhotoUrl], testSellerId));

      expect(result.current.status).toBe('analyzing');

      await waitFor(
        () => {
          expect(result.current.status).toBe('ready');
        },
        { timeout: 15000 }
      ); // AI can take time

      // Should have some analysis result
      expect(result.current.result).not.toBeNull();
      expect(result.current.error).toBeNull();

      // Result should have at least one field
      const hasResults =
        result.current.result &&
        (result.current.result.title ||
          result.current.result.category ||
          result.current.result.color);

      expect(hasResults).toBe(true);
    }, 20000);

    it('should handle invalid photo URL gracefully', async () => {
      if (!canRunAuthenticatedE2E) return;

      const invalidUrl = 'https://invalid-url-that-does-not-exist.com/photo.jpg';

      const { result } = renderHook(() => useAIAnalysis([invalidUrl], testSellerId));

      await waitFor(
        () => {
          expect(result.current.status).toBe('error');
        },
        { timeout: 15000 }
      );

      expect(result.current.error).not.toBeNull();
      expect(result.current.result).toBeNull();
    }, 20000);
  });

  describe('usePhotoGroups integration', () => {
    it('should manage photo groups in memory', () => {
      if (!canRunAuthenticatedE2E) return;

      const { result } = renderHook(() => usePhotoGroups());

      const mockPhotos = [
        { id: '1', uri: 'file://photo1.jpg', width: 800, height: 600 },
        { id: '2', uri: 'file://photo2.jpg', width: 800, height: 600 },
        { id: '3', uri: 'file://photo3.jpg', width: 800, height: 600 },
      ];

      act(() => {
        result.current.addPhotos(mockPhotos);
      });

      expect(result.current.groups).toHaveLength(1);
      expect(result.current.groups[0].photos).toHaveLength(3);
      expect(result.current.totalPhotos).toBe(3);
    });

    it('should enforce caps correctly', () => {
      if (!canRunAuthenticatedE2E) return;

      const { result } = renderHook(() => usePhotoGroups());

      // Create 31 photos (exceeds max 30)
      const manyPhotos = Array.from({ length: 31 }, (_, i) => ({
        id: `photo-${i}`,
        uri: `file://photo${i}.jpg`,
        width: 800,
        height: 600,
      }));

      act(() => {
        result.current.addPhotos(manyPhotos);
      });

      // Should only add 30
      expect(result.current.totalPhotos).toBe(30);
      expect(result.current.errors).toHaveLength(1);
      expect(result.current.errors[0].type).toBe('max_photos_total');
    });
  });

  describe('Full flow integration', () => {
    it('should create draft → add photos → save → load → delete', async () => {
      if (!canRunAuthenticatedE2E) return;

      // 1. Create draft
      const { result: draftResult } = renderHook(() => useItemDraft(undefined, testSellerId));

      await waitFor(
        () => {
          expect(draftResult.current.draft).not.toBeNull();
        },
        { timeout: 5000 }
      );

      const draftId = draftResult.current.draft!.id;
      draftIds.push(draftId);

      // 2. Add photos to group
      const { result: groupResult } = renderHook(() => usePhotoGroups());

      act(() => {
        groupResult.current.addPhotos([
          { id: '1', uri: 'file://photo1.jpg', width: 800, height: 600 },
          { id: '2', uri: 'file://photo2.jpg', width: 800, height: 600 },
        ]);
      });

      expect(groupResult.current.totalPhotos).toBe(2);

      // 3. Save draft with photo URLs
      const photoUrls = ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'];

      act(() => {
        draftResult.current.save({
          title: 'Full Flow Test',
          price: 30,
          photo_urls: photoUrls,
        });
      });

      await act(async () => {
        await draftResult.current.saveNow();
      });

      // 4. Load draft in new hook instance
      const { result: loadedResult } = renderHook(() => useItemDraft(draftId));

      await waitFor(
        () => {
          expect(loadedResult.current.draft).not.toBeNull();
        },
        { timeout: 5000 }
      );

      expect(loadedResult.current.draft?.draft_data.title).toBe('Full Flow Test');
      expect(loadedResult.current.draft?.photo_urls).toEqual(photoUrls);

      // 5. Delete draft
      await act(async () => {
        await loadedResult.current.discard();
      });

      const { data } = await supabase
        .from('item_drafts')
        .select('id')
        .eq('id', draftId)
        .maybeSingle();

      expect(data).toBeNull();
    }, 15000);
  });
});
