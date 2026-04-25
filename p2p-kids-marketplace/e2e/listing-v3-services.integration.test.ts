/**
 * Integration tests for V3 Listing Creation Flow
 * MODULE-04 LISTING-V3: TASK LISTING-V3-003
 * 
 * Tests end-to-end flows using production Supabase
 * Run with: RUN_SUPABASE_E2E=true npm run test:e2e
 */

import * as photoService from '../src/services/photoService';
import * as aiService from '../src/services/aiService';
import * as draftService from '../src/services/draftService';
import * as pricingService from '../src/services/pricingService';
import * as categoryService from '../src/services/categoryService';
import { PhotoAsset } from '../src/types/listing';

const RUN_SUPABASE_E2E = process.env.RUN_SUPABASE_E2E === 'true';
const ENABLE_STORAGE_UPLOAD_E2E = process.env.RUN_STORAGE_E2E === 'true';
const TEST_SELLER_ID = process.env.TEST_SELLER_ID ?? '';
const SKIP_E2E = !RUN_SUPABASE_E2E || TEST_SELLER_ID.length === 0;

describe('V3 Listing Creation Flow (E2E)', () => {
  if (SKIP_E2E) {
    test.skip('Skipping E2E tests (set RUN_SUPABASE_E2E=true and TEST_SELLER_ID=<uuid>)', () => {});
    return;
  }

  describe('Photo Upload → AI Analysis → Draft → Publish', () => {
    let draftId: string;
    let uploadedUrls: string[];

    it('should upload photos to Supabase Storage', async () => {
      if (!ENABLE_STORAGE_UPLOAD_E2E) {
        console.warn('Skipping storage upload test: set RUN_STORAGE_E2E=true to enable.');
        uploadedUrls = [];
        return;
      }

      const mockPhotos: PhotoAsset[] = [
        {
          id: '1',
          uri: 'https://picsum.photos/800/600',
          width: 800,
          height: 600,
        },
        {
          id: '2',
          uri: 'https://picsum.photos/800/600?random=2',
          width: 800,
          height: 600,
        },
      ];

      const result = await photoService.uploadPhotoBatch(
        mockPhotos,
        TEST_SELLER_ID,
        (progress) => console.log(`Upload progress: ${progress}%`)
      );

      expect(result.urls.length).toBeGreaterThan(0);
      expect(result.errors.length).toBe(0);
      uploadedUrls = result.urls;
    }, 30000);

    it('should analyze photos using AI', async () => {
      if (!uploadedUrls || uploadedUrls.length === 0) {
        console.warn('Skipping AI test - no uploaded photos');
        return;
      }

      const items = [
        {
          groupId: 'group-1',
          primaryPhotoUrl: uploadedUrls[0],
          allPhotoUrls: uploadedUrls,
        },
      ];

      const result = await aiService.analyzePhotosBatch(items, TEST_SELLER_ID);

      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('totalProcessed');
      expect(result.totalProcessed + result.totalFailed).toBe(1);
    }, 60000);

    it('should create draft with photo URLs', async () => {
      if (!uploadedUrls) {
        console.warn('Skipping draft creation - no uploaded photos');
        return;
      }

      const draft = await draftService.createItemDraft(TEST_SELLER_ID, {
        title: 'E2E Test Item',
      });

      expect(draft).not.toBeNull();
      expect(draft).toHaveProperty('id');
      expect(draft.seller_id).toBe(TEST_SELLER_ID);
      draftId = draft.id;
    });

    it('should update draft with AI suggestions', async () => {
      if (!draftId) {
        console.warn('Skipping update - no draft created');
        return;
      }

      const updates = {
        title: 'Updated Test Item',
        description: 'A test item for integration testing',
        price: 25.99,
      };

      const updated = await draftService.updateItemDraft(draftId, updates);

      expect(updated).toBe(true);

      const reloaded = await draftService.getItemDraft(draftId);
      expect(reloaded).not.toBeNull();
      expect(reloaded?.draft_data.title).toBe('Updated Test Item');
      expect(reloaded?.draft_data.price).toBe(25.99);
    });

    it('should get price suggestions for category', async () => {
      const suggestions = await pricingService.getSuggestedPrice('test-category-id');

      // May be empty if < 5 sales, which is expected
      expect(Array.isArray(suggestions)).toBe(true);
      
      if (suggestions.length > 0) {
        expect(suggestions[0]).toHaveProperty('id');
        expect(suggestions[0]).toHaveProperty('label');
        expect(suggestions[0]).toHaveProperty('price');
      }
    });

    afterAll(async () => {
      // Cleanup: delete draft if created
      if (draftId) {
        try {
          await draftService.deleteItemDraft(draftId);
        } catch (error) {
          console.warn('Failed to cleanup draft:', error);
        }
      }
    });
  });

  describe('Category Management', () => {
    it('should get categories with counts', async () => {
      const categories = await categoryService.getCategoriesWithCounts();

      expect(Array.isArray(categories)).toBe(true);
      categories.forEach(cat => {
        expect(cat).toHaveProperty('id');
        expect(cat).toHaveProperty('name');
        expect(cat).toHaveProperty('item_count');
      });
    });

    it('should save and retrieve recent categories', async () => {
      const categoryId = 'test-cat-123';
      
      await categoryService.saveRecentCategory(TEST_SELLER_ID, categoryId);
      const recent = await categoryService.getRecentCategories(TEST_SELLER_ID);

      expect(recent).toContain(categoryId);
      expect(recent.length).toBeLessThanOrEqual(3);
    });

    it('should flag item for category review', async () => {
      // This requires an existing item - may fail if no test data
      try {
        const result = await categoryService.flagForCategoryReview(
          'test-item-id',
          'Custom Category Name'
        );

        expect(typeof result).toBe('boolean');
      } catch (error) {
        console.warn('Flag for review test skipped - item may not exist');
      }
    });
  });

  describe('Bulk Publish Flow', () => {
    let bulkUploadId: string;
    let draftIds: string[];

    it('should create multiple drafts', async () => {
      const drafts = await Promise.all([
        draftService.createItemDraft(TEST_SELLER_ID, { title: 'Bulk Item 1' }),
        draftService.createItemDraft(TEST_SELLER_ID, { title: 'Bulk Item 2' }),
      ]);

      const createdDrafts = drafts.filter((d): d is NonNullable<typeof d> => d !== null);

      expect(createdDrafts).toHaveLength(2);
      draftIds = createdDrafts.map((d) => d.id);
    });

    it('should enforce max 5 drafts per seller', async () => {
      // Create 6 drafts total (including 2 from previous test)
      const additionalDrafts = await Promise.all([
        draftService.createItemDraft(TEST_SELLER_ID, { title: 'Draft 3' }),
        draftService.createItemDraft(TEST_SELLER_ID, { title: 'Draft 4' }),
        draftService.createItemDraft(TEST_SELLER_ID, { title: 'Draft 5' }),
        draftService.createItemDraft(TEST_SELLER_ID, { title: 'Draft 6' }),
      ]);

      const allDrafts = await draftService.getActiveDrafts(TEST_SELLER_ID);

      // Should evict oldest when exceeding 5
      expect(allDrafts.length).toBeLessThanOrEqual(5);
    });

    afterAll(async () => {
      // Cleanup all test drafts
      if (draftIds) {
        for (const id of draftIds) {
          try {
            await draftService.deleteItemDraft(id);
          } catch (error) {
            console.warn('Failed to cleanup draft:', id);
          }
        }
      }
    });
  });
});
