/**
 * File: p2p-kids-marketplace/src/hooks/__tests__/useItemDraft.test.tsx
 * MODULE-04 LISTING-V3-004: useItemDraft Hook Unit Tests
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useItemDraft } from '../useItemDraft';
import * as draftService from '../../services/draftService';
import { ItemDraft, DraftData } from '../../types/listing';

let focusCleanup: (() => void) | undefined;
let appStateChangeListener: ((state: string) => void) | undefined;

// Mock dependencies
jest.mock('../../services/draftService');
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({}),
  useFocusEffect: (callback: () => void | (() => void)) => {
    focusCleanup = callback() as (() => void) | undefined;
  },
}));

// Mock timers
jest.useFakeTimers();

const mockDraft: ItemDraft = {
  id: 'draft-123',
  seller_id: 'seller-456',
  bulk_upload_id: null,
  draft_data: {
    title: 'Test Item',
    price: 25,
  },
  photo_urls: ['https://example.com/photo.jpg'],
  ai_suggestions: null,
  step: 'photos',
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('useItemDraft', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    focusCleanup = undefined;
    appStateChangeListener = undefined;
    AppState.currentState = 'active';

    jest.spyOn(AppState, 'addEventListener').mockImplementation((eventType: any, listener: any) => {
      if (eventType === 'change') {
        appStateChangeListener = listener;
      }

      return {
        remove: jest.fn(),
      } as any;
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.restoreAllMocks();
  });

  describe('Loading existing draft', () => {
    it('should load existing draft on mount', async () => {
      (draftService.getItemDraft as jest.Mock).mockResolvedValue(mockDraft);

      const { result } = renderHook(() => useItemDraft('draft-123'));

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.draft).toEqual(mockDraft);
      expect(draftService.getItemDraft).toHaveBeenCalledWith('draft-123');
    });

    it('should handle draft load error', async () => {
      (draftService.getItemDraft as jest.Mock).mockResolvedValue(null);

      const { result } = renderHook(() => useItemDraft('draft-123'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.draft).toBeNull();
      expect(result.current.saveError).toBe('Draft not found or expired');
    });
  });

  describe('Creating new draft', () => {
    it('should create new draft when sellerId provided', async () => {
      (draftService.createItemDraft as jest.Mock).mockResolvedValue(mockDraft);

      const { result } = renderHook(() => useItemDraft(undefined, 'seller-456'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.draft).toEqual(mockDraft);
      expect(draftService.createItemDraft).toHaveBeenCalledWith('seller-456');
    });

    it('should handle draft creation error', async () => {
      (draftService.createItemDraft as jest.Mock).mockResolvedValue(null);

      const { result } = renderHook(() => useItemDraft(undefined, 'seller-456'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.draft).toBeNull();
      expect(result.current.saveError).toBe('Failed to create draft');
    });

    it('should not create draft on mount when autoCreateOnMount is false', async () => {
      const { result } = renderHook(() =>
        useItemDraft(undefined, 'seller-456', { autoCreateOnMount: false })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.draft).toBeNull();
      expect(draftService.createItemDraft).not.toHaveBeenCalled();
    });

    it('should create draft on first saveNow when autoCreateOnMount is false', async () => {
      (draftService.createItemDraft as jest.Mock).mockResolvedValue({
        ...mockDraft,
        draft_data: {
          title: 'First draft save',
          photo_urls: ['https://example.com/photo.jpg'],
        },
      });

      const { result } = renderHook(() =>
        useItemDraft(undefined, 'seller-456', { autoCreateOnMount: false })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.save({
          title: 'First draft save',
          photo_urls: ['https://example.com/photo.jpg'],
        });
      });

      await act(async () => {
        await result.current.saveNow();
      });

      expect(draftService.createItemDraft).toHaveBeenCalledWith('seller-456', {
        title: 'First draft save',
        photo_urls: ['https://example.com/photo.jpg'],
      });
      expect(result.current.draft?.id).toBe('draft-123');
    });
  });

  describe('Saving draft', () => {
    it('should queue updates and update local state immediately', async () => {
      (draftService.getItemDraft as jest.Mock).mockResolvedValue(mockDraft);

      const { result } = renderHook(() => useItemDraft('draft-123'));

      await waitFor(() => {
        expect(result.current.draft).toEqual(mockDraft);
      });

      const updates: Partial<DraftData> = {
        description: 'New description',
      };

      act(() => {
        result.current.save(updates);
      });

      // Local state updated immediately
      expect(result.current.draft?.draft_data.description).toBe('New description');
      expect(result.current.saveError).toBeNull();
    });

    it('should auto-save every 30 seconds', async () => {
      (draftService.getItemDraft as jest.Mock).mockResolvedValue(mockDraft);
      (draftService.updateItemDraft as jest.Mock).mockResolvedValue(true);

      const { result } = renderHook(() => useItemDraft('draft-123'));

      await waitFor(() => {
        expect(result.current.draft).toEqual(mockDraft);
      });

      act(() => {
        result.current.save({ description: 'Auto-saved' });
      });

      // Fast-forward 30 seconds
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        expect(draftService.updateItemDraft).toHaveBeenCalledWith('draft-123', {
          description: 'Auto-saved',
        });
      });
    });

    it('should save immediately when saveNow is called', async () => {
      (draftService.getItemDraft as jest.Mock).mockResolvedValue(mockDraft);
      (draftService.updateItemDraft as jest.Mock).mockResolvedValue(true);

      const { result } = renderHook(() => useItemDraft('draft-123'));

      await waitFor(() => {
        expect(result.current.draft).toEqual(mockDraft);
      });

      act(() => {
        result.current.save({ description: 'Immediate save' });
      });

      await act(async () => {
        await result.current.saveNow();
      });

      expect(draftService.updateItemDraft).toHaveBeenCalledWith('draft-123', {
        description: 'Immediate save',
      });
    });

    it('should handle save errors gracefully', async () => {
      (draftService.getItemDraft as jest.Mock).mockResolvedValue(mockDraft);
      (draftService.updateItemDraft as jest.Mock).mockResolvedValue(false);

      const { result } = renderHook(() => useItemDraft('draft-123'));

      await waitFor(() => {
        expect(result.current.draft).toEqual(mockDraft);
      });

      act(() => {
        result.current.save({ description: 'Failed save' });
      });

      await act(async () => {
        await result.current.saveNow();
      });

      expect(result.current.saveError).toBe('Failed to save draft');
      expect(result.current.isSaving).toBe(false);
    });
  });

  describe('AppState flush', () => {
    it('should flush pending updates when app goes to background', async () => {
      (draftService.getItemDraft as jest.Mock).mockResolvedValue(mockDraft);
      (draftService.updateItemDraft as jest.Mock).mockResolvedValue(true);

      const { result } = renderHook(() => useItemDraft('draft-123'));

      await waitFor(() => {
        expect(result.current.draft).toEqual(mockDraft);
      });

      act(() => {
        result.current.save({ description: 'Background flush' });
      });

      // Simulate app going to background
      act(() => {
        appStateChangeListener?.('background');
      });

      await waitFor(() => {
        expect(draftService.updateItemDraft).toHaveBeenCalledWith('draft-123', {
          description: 'Background flush',
        });
      });
    });
  });

  describe('Navigation blur flush', () => {
    it('should flush pending updates on blur', async () => {
      (draftService.getItemDraft as jest.Mock).mockResolvedValue(mockDraft);
      (draftService.updateItemDraft as jest.Mock).mockResolvedValue(true);

      const { result } = renderHook(() => useItemDraft('draft-123'));

      await waitFor(() => {
        expect(result.current.draft).toEqual(mockDraft);
      });

      act(() => {
        result.current.save({ description: 'Blur flush' });
      });

      act(() => {
        focusCleanup?.();
      });

      await waitFor(() => {
        expect(draftService.updateItemDraft).toHaveBeenCalled();
      });
    });
  });

  describe('Discarding draft', () => {
    it('should delete draft and clear state', async () => {
      (draftService.getItemDraft as jest.Mock).mockResolvedValue(mockDraft);
      (draftService.deleteItemDraft as jest.Mock).mockResolvedValue(true);

      const { result } = renderHook(() => useItemDraft('draft-123'));

      await waitFor(() => {
        expect(result.current.draft).toEqual(mockDraft);
      });

      await act(async () => {
        await result.current.discard();
      });

      expect(draftService.deleteItemDraft).toHaveBeenCalledWith('draft-123');
      expect(result.current.draft).toBeNull();
    });

    it('should handle discard errors', async () => {
      (draftService.getItemDraft as jest.Mock).mockResolvedValue(mockDraft);
      (draftService.deleteItemDraft as jest.Mock).mockResolvedValue(false);

      const { result } = renderHook(() => useItemDraft('draft-123'));

      await waitFor(() => {
        expect(result.current.draft).toEqual(mockDraft);
      });

      await act(async () => {
        await result.current.discard();
      });

      expect(result.current.saveError).toBe('Failed to delete draft');
      expect(result.current.draft).toEqual(mockDraft); // Draft still present
    });
  });

  describe('Merge behavior', () => {
    it('should merge multiple pending updates', async () => {
      (draftService.getItemDraft as jest.Mock).mockResolvedValue(mockDraft);
      (draftService.updateItemDraft as jest.Mock).mockResolvedValue(true);

      const { result } = renderHook(() => useItemDraft('draft-123'));

      await waitFor(() => {
        expect(result.current.draft).toEqual(mockDraft);
      });

      act(() => {
        result.current.save({ description: 'First update' });
        result.current.save({ price: 30 });
        result.current.save({ title: 'Updated title' });
      });

      await act(async () => {
        await result.current.saveNow();
      });

      expect(draftService.updateItemDraft).toHaveBeenCalledWith('draft-123', {
        description: 'First update',
        price: 30,
        title: 'Updated title',
      });
    });
  });
});
