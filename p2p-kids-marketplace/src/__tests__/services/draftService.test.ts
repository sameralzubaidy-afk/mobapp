/**
 * Unit tests for draftService
 * MODULE-04 LISTING-V3: TASK LISTING-V3-003
 * Tests draft lifecycle: create, update, get, delete, publish
 */

import * as draftService from '../../services/draftService';
import { supabase } from '../../config/supabase';
import * as listingService from '../../services/listing';

// Mock supabase
jest.mock('../../config/supabase');

// Mock listing service
jest.mock('../../services/listing', () => ({
  createListing: jest.fn(),
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('draftService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createItemDraft', () => {
    it('should create draft with initial data', async () => {
      const mockDraft = {
        id: 'draft-123',
        seller_id: 'seller-123',
        draft_data: { title: 'Test Item' },
        photo_urls: [],
        ai_suggestions: null,
        step: 'photos',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      mockSupabase.from = jest.fn(() => ({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: mockDraft, error: null }),
          })),
        })),
      })) as any;

      const result = await draftService.createItemDraft('seller-123', { title: 'Test Item' });

      expect(result).toEqual(mockDraft);
    });

    it('should create draft with defaults when no initial data', async () => {
      const mockDraft = {
        id: 'draft-123',
        seller_id: 'seller-123',
        draft_data: {},
        photo_urls: [],
        step: 'photos',
      };

      mockSupabase.from = jest.fn(() => ({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: mockDraft, error: null }),
          })),
        })),
      })) as any;

      const result = await draftService.createItemDraft('seller-123');

      expect(result).toBeDefined();
    });
  });

  describe('getActiveDrafts', () => {
    it('should return active drafts for seller', async () => {
      const mockDrafts = [
        {
          id: 'draft-1',
          seller_id: 'seller-123',
          draft_data: { title: 'Item 1' },
          photo_urls: [],
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'draft-2',
          seller_id: 'seller-123',
          draft_data: { title: 'Item 2' },
          photo_urls: [],
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      mockSupabase.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gt: jest.fn(() => ({
              order: jest.fn().mockResolvedValue({ data: mockDrafts, error: null }),
            })),
          })),
        })),
      })) as any;

      const result = await draftService.getActiveDrafts('seller-123');

      expect(result).toEqual(mockDrafts);
      expect(result).toHaveLength(2);
    });
  });

  describe('publishDraft', () => {
    it('should validate required fields before publishing', async () => {
      const mockDraft = {
        id: 'draft-123',
        seller_id: 'seller-123',
        draft_data: {
          title: '',
          description: 'Test description',
          price: 10,
          category_id: 'cat-1',
          condition: 'good' as const,
        },
        photo_urls: ['url1'],
        ai_suggestions: null,
        step: 'review' as const,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockSupabase.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gt: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({ data: mockDraft, error: null }),
            })),
          })),
        })),
      })) as any;

      await expect(draftService.publishDraft('draft-123')).rejects.toThrow('Title is required');
    });

    it('should publish valid draft', async () => {
      const mockDraft = {
        id: 'draft-123',
        seller_id: 'seller-123',
        draft_data: {
          title: 'Test Item',
          description: 'Test description',
          price: 10,
          category_id: 'cat-1',
          condition: 'good' as const,
        },
        photo_urls: ['url1', 'url2'],
        ai_suggestions: null,
        step: 'review' as const,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockSupabase.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gt: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({ data: mockDraft, error: null }),
            })),
          })),
        })),
        delete: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ error: null }),
        })),
      })) as any;

      (listingService.createListing as jest.Mock).mockResolvedValue({ id: 'item-123' });

      const result = await draftService.publishDraft('draft-123');

      expect(result).toBe('item-123');
      expect(listingService.createListing).toHaveBeenCalled();
    });
  });

  describe('publishBulkDrafts', () => {
    it('should publish multiple drafts and update bulk upload status', async () => {
      const mockDraft1 = {
        id: 'draft-1',
        draft_data: {
          title: 'Item 1',
          description: 'Desc 1',
          price: 10,
          category_id: 'cat-1',
          condition: 'good' as const,
        },
        photo_urls: ['url1'],
      };

      const mockDraft2 = {
        id: 'draft-2',
        draft_data: {
          title: 'Item 2',
          description: 'Desc 2',
          price: 20,
          category_id: 'cat-1',
          condition: 'like_new' as const,
        },
        photo_urls: ['url2'],
      };

      mockSupabase.from = jest.fn((table) => {
        if (table === 'item_drafts') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                gt: jest.fn(() => ({
                  single: jest.fn()
                    .mockResolvedValueOnce({ data: mockDraft1, error: null })
                    .mockResolvedValueOnce({ data: mockDraft2, error: null }),
                })),
              })),
            })),
            delete: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({ error: null }),
            })),
          } as any;
        } else if (table === 'item_bulk_uploads') {
          return {
            update: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({ error: null }),
            })),
          } as any;
        }
        return {} as any;
      }) as any;

      (listingService.createListing as jest.Mock)
        .mockResolvedValueOnce({ id: 'item-1' })
        .mockResolvedValueOnce({ id: 'item-2' });

      const result = await draftService.publishBulkDrafts('bulk-123', ['draft-1', 'draft-2']);

      expect(result.published).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
    });
  });
});
