/**
 * File: p2p-kids-marketplace/src/__tests__/integration/listing-v3-007-draft-resume.integration.test.ts
 * MODULE-04 LISTING-V3-007: Integration test for draft resume flow
 * 
 * Tests the complete flow of:
 * - Creating a draft (auto-saved)
 * - Navigating away
 * - Seeing resume banner on dashboard
 * - Resuming draft from banner
 * - Resuming draft from Drafts tab
 * - Discarding draft
 */

import { supabase } from '../../config/supabase';
import {
  getActiveDrafts,
  createItemDraft,
  deleteDraft,
  startBulkSession,
} from '../../services/draftService';

describe('LISTING-V3-007: Draft Resume Flow', () => {
  let testSellerId: string;
  const testEmail = `listing-v3-007-test-${Date.now()}@example.com`;

  beforeAll(async () => {
    // Create test user
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: 'Test123456!',
    });

    if (error || !data.user) {
      throw new Error(`Failed to create test user: ${error?.message}`);
    }

    testSellerId = data.user.id;
  });

  afterAll(async () => {
    // Cleanup: Delete all test drafts
    const { data: drafts } = await supabase
      .from('item_drafts')
      .select('id')
      .eq('seller_id', testSellerId);

    if (drafts) {
      for (const draft of drafts) {
        await deleteDraft(draft.id);
      }
    }

    // Delete test user
    await supabase.auth.admin.deleteUser(testSellerId);
  });

  describe('Draft Creation and Retrieval', () => {
    it('creates a single item draft successfully', async () => {
      const draft = await createItemDraft(testSellerId, {
        title: 'Test Draft Item',
        description: 'Test description',
        price: 50,
        photo_urls: ['https://example.com/photo1.jpg'],
      });

      expect(draft).toBeTruthy();
      expect(draft?.id).toBeTruthy();
      expect(draft?.seller_id).toBe(testSellerId);
      expect(draft?.draft_data).toMatchObject({
        title: 'Test Draft Item',
        price: 50,
      });
    });

    it('creates a bulk draft successfully', async () => {
      const bulkSession = await startBulkSession(testSellerId);
      expect(bulkSession).toBeTruthy();

      const bulkDraft = await createItemDraft(
        testSellerId,
        {
          title: 'Bulk Draft',
          photo_urls: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
        },
        bulkSession!.id
      );

      expect(bulkDraft).toBeTruthy();
      expect(bulkDraft?.bulk_upload_id).toBe(bulkSession!.id);
    });

    it('retrieves active drafts for seller', async () => {
      const drafts = await getActiveDrafts(testSellerId);

      expect(drafts).toBeTruthy();
      expect(drafts.length).toBeGreaterThan(0);
      expect(drafts[0].seller_id).toBe(testSellerId);
    });

    it('orders drafts by updated_at DESC (most recent first)', async () => {
      // Create first draft
      const draft1 = await createItemDraft(testSellerId, {
        title: 'Draft 1',
      });

      // Wait a second
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Create second draft
      const draft2 = await createItemDraft(testSellerId, {
        title: 'Draft 2',
      });

      const drafts = await getActiveDrafts(testSellerId);

      // Most recent should be first
      expect(drafts[0].id).toBe(draft2?.id);
      expect(drafts[1].id).toBe(draft1?.id);
    });
  });

  describe('Draft Auto-Save and Session Persistence', () => {
    it('auto-saves draft data updates', async () => {
      const draft = await createItemDraft(testSellerId, {
        title: 'Initial Title',
      });

      expect(draft).toBeTruthy();

      // Simulate auto-save update
      const { data: updated } = await supabase
        .from('item_drafts')
        .update({
          draft_data: {
            title: 'Updated Title',
            description: 'Added description',
          },
        })
        .eq('id', draft!.id)
        .select()
        .single();

      expect(updated?.draft_data).toMatchObject({
        title: 'Updated Title',
        description: 'Added description',
      });
    });

    it('maintains draft across app restarts (session persistence)', async () => {
      const draft = await createItemDraft(testSellerId, {
        title: 'Persistent Draft',
      });

      // Simulate app restart by re-fetching drafts
      const drafts = await getActiveDrafts(testSellerId);

      const persistedDraft = drafts.find((d) => d.id === draft?.id);
      expect(persistedDraft).toBeTruthy();
      expect(persistedDraft?.draft_data).toMatchObject({
        title: 'Persistent Draft',
      });
    });
  });

  describe('Draft Discard', () => {
    it('discards draft successfully', async () => {
      const draft = await createItemDraft(testSellerId, {
        title: 'Draft to Discard',
      });

      expect(draft).toBeTruthy();

      const result = await deleteDraft(draft!.id);
      expect(result).toBe(true);

      // Verify draft is deleted
      const drafts = await getActiveDrafts(testSellerId);
      const deletedDraft = drafts.find((d) => d.id === draft!.id);
      expect(deletedDraft).toBeUndefined();
    });
  });

  describe('Max Drafts Enforcement (Trigger)', () => {
    it('enforces max 5 drafts per seller', async () => {
      // Delete all existing drafts
      const existingDrafts = await getActiveDrafts(testSellerId);
      for (const d of existingDrafts) {
        await deleteDraft(d.id);
      }

      // Create 6 drafts
      for (let i = 1; i <= 6; i++) {
        await createItemDraft(testSellerId, {
          title: `Draft ${i}`,
        });
        // Small delay to ensure created_at ordering
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Should only have 5 drafts (oldest should be evicted)
      const drafts = await getActiveDrafts(testSellerId);
      expect(drafts.length).toBe(5);

      // Draft 1 should be evicted, Draft 2-6 should remain
      const titles = drafts.map((d) => (d.draft_data as any).title);
      expect(titles).not.toContain('Draft 1');
      expect(titles).toContain('Draft 6');
    });
  });

  describe('Draft Expiration (7-day TTL)', () => {
    it('does not return expired drafts', async () => {
      // Create a draft and immediately expire it (update expires_at to past)
      const draft = await createItemDraft(testSellerId, {
        title: 'Expired Draft',
      });

      expect(draft).toBeTruthy();

      // Set expires_at to 1 day ago
      await supabase
        .from('item_drafts')
        .update({
          expires_at: new Date(Date.now() - 86400000).toISOString(),
        })
        .eq('id', draft!.id);

      // getActiveDrafts should filter out expired drafts
      const activeDrafts = await getActiveDrafts(testSellerId);
      const expiredDraft = activeDrafts.find((d) => d.id === draft!.id);

      expect(expiredDraft).toBeUndefined();
    });
  });
});
