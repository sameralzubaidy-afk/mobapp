/**
 * Unit tests for useItemDraft hook
 * MODULE-04 LISTING-V3: TASK LISTING-V3-010
 * Tests 30s debounce, blur-flush, saveNow
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useItemDraft } from '../../hooks/useItemDraft';
import * as draftService from '../../services/draftService';

// Mock draftService
jest.mock('../../services/draftService', () => ({
  createItemDraft: jest.fn(),
  getItemDraft: jest.fn(),
  updateItemDraft: jest.fn(),
  deleteItemDraft: jest.fn(),
}));

// Mock navigation
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: any) => {
    // Execute callback immediately for testing
    callback();
  },
}));

const mockDraftService = draftService as jest.Mocked<typeof draftService>;

describe('useItemDraft', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('should load existing draft on mount when draftId provided', async () => {
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

    mockDraftService.getItemDraft.mockResolvedValue(mockDraft);

    const { result } = renderHook(() => useItemDraft('draft-123', 'seller-123'));

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockDraftService.getItemDraft).toHaveBeenCalledWith('draft-123');
    expect(result.current.draft).toEqual(mockDraft);
  });

  it('should create new draft on mount when no draftId provided', async () => {
    const mockNewDraft = {
      id: 'draft-new',
      seller_id: 'seller-456',
      draft_data: {},
      photo_urls: [],
      step: 'photos',
    };

    mockDraftService.createItemDraft.mockResolvedValue(mockNewDraft);

    const { result } = renderHook(() => useItemDraft(undefined, 'seller-456'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockDraftService.createItemDraft).toHaveBeenCalledWith('seller-456');
    expect(result.current.draft).toEqual(mockNewDraft);
  });

  it('should auto-save every 30 seconds', async () => {
    const mockDraft = {
      id: 'draft-auto',
      seller_id: 'seller-789',
      draft_data: { title: 'Auto Save Test' },
      photo_urls: [],
      step: 'details',
    };

    mockDraftService.getItemDraft.mockResolvedValue(mockDraft);
    mockDraftService.updateItemDraft.mockResolvedValue(mockDraft);

    const { result } = renderHook(() => useItemDraft('draft-auto', 'seller-789'));

    await waitFor(() => {
      expect(result.current.draft).not.toBeNull();
    });

    // Make changes
    act(() => {
      result.current.save({ title: 'Updated Title' });
    });

    // Fast-forward 29 seconds (should not save yet)
    act(() => {
      jest.advanceTimersByTime(29000);
    });

    expect(mockDraftService.updateItemDraft).not.toHaveBeenCalled();

    // Fast-forward 1 more second (total 30s, should trigger save)
    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve(); // Flush promises
    });

    await waitFor(() => {
      expect(mockDraftService.updateItemDraft).toHaveBeenCalledWith('draft-auto', {
        title: 'Updated Title',
      });
    });
  });

  it('should flush pending changes on saveNow call', async () => {
    const mockDraft = {
      id: 'draft-immediate',
      seller_id: 'seller-now',
      draft_data: {},
      photo_urls: [],
      step: 'photos',
    };

    mockDraftService.getItemDraft.mockResolvedValue(mockDraft);
    mockDraftService.updateItemDraft.mockResolvedValue(mockDraft);

    const { result } = renderHook(() => useItemDraft('draft-immediate', 'seller-now'));

    await waitFor(() => {
      expect(result.current.draft).not.toBeNull();
    });

    // Make changes
    act(() => {
      result.current.save({ title: 'Immediate Save' });
    });

    // Call saveNow without waiting for 30s timer
    await act(async () => {
      await result.current.saveNow();
    });

    expect(mockDraftService.updateItemDraft).toHaveBeenCalledWith('draft-immediate', {
      title: 'Immediate Save',
    });
  });

  it('should set isSaving state during save operation', async () => {
    const mockDraft = {
      id: 'draft-saving',
      seller_id: 'seller-saving',
      draft_data: {},
      photo_urls: [],
      step: 'photos',
    };

    mockDraftService.getItemDraft.mockResolvedValue(mockDraft);
    let resolveUpdate: ((value: boolean) => void) | null = null;
    mockDraftService.updateItemDraft.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        })
    );

    const { result } = renderHook(() => useItemDraft('draft-saving', 'seller-saving'));

    await waitFor(() => {
      expect(result.current.draft).not.toBeNull();
    });

    act(() => {
      result.current.save({ title: 'Saving Test' });
    });

    let savePromise: Promise<void>;
    act(() => {
      savePromise = result.current.saveNow();
    });

    // Should show isSaving immediately
    expect(result.current.isSaving).toBe(true);

    // Resolve and wait for save to complete
    await act(async () => {
      resolveUpdate?.(true);
      await savePromise;
    });

    // Should clear isSaving
    await waitFor(() => {
      expect(result.current.isSaving).toBe(false);
    });
  });

  it('should expose saveError and never throw', async () => {
    const mockDraft = {
      id: 'draft-error',
      seller_id: 'seller-error',
      draft_data: {},
      photo_urls: [],
      step: 'photos',
    };

    mockDraftService.getItemDraft.mockResolvedValue(mockDraft);
    mockDraftService.updateItemDraft.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useItemDraft('draft-error', 'seller-error'));

    await waitFor(() => {
      expect(result.current.draft).not.toBeNull();
    });

    act(() => {
      result.current.save({ title: 'Error Test' });
    });

    // Attempt save (should fail)
    await act(async () => {
      await result.current.saveNow();
    });

    // Should expose error, not throw
    expect(result.current.saveError).toBe('Network error');
    expect(result.current.isSaving).toBe(false);
  });

  it('should discard draft and call deleteItemDraft', async () => {
    const mockDraft = {
      id: 'draft-discard',
      seller_id: 'seller-discard',
      draft_data: {},
      photo_urls: [],
      step: 'photos',
    };

    mockDraftService.getItemDraft.mockResolvedValue(mockDraft);
    mockDraftService.deleteItemDraft.mockResolvedValue(true);

    const { result } = renderHook(() => useItemDraft('draft-discard', 'seller-discard'));

    await waitFor(() => {
      expect(result.current.draft).not.toBeNull();
    });

    // Discard draft
    await act(async () => {
      await result.current.discard();
    });

    expect(mockDraftService.deleteItemDraft).toHaveBeenCalledWith('draft-discard');
    expect(result.current.draft).toBeNull();
  });

  it('should accumulate multiple save calls before flush', async () => {
    const mockDraft = {
      id: 'draft-accumulate',
      seller_id: 'seller-acc',
      draft_data: {},
      photo_urls: [],
      step: 'photos',
    };

    mockDraftService.getItemDraft.mockResolvedValue(mockDraft);
    mockDraftService.updateItemDraft.mockResolvedValue(mockDraft);

    const { result } = renderHook(() => useItemDraft('draft-accumulate', 'seller-acc'));

    await waitFor(() => {
      expect(result.current.draft).toBeDefined();
    });

    // Make multiple changes
    act(() => {
      result.current.save({ title: 'First Change' });
    });

    act(() => {
      result.current.save({ description: 'Second Change' });
    });

    act(() => {
      result.current.save({ price: 25.0 });
    });

    // Flush all changes at once
    await act(async () => {
      await result.current.saveNow();
    });

    // Should merge all updates
    expect(mockDraftService.updateItemDraft).toHaveBeenCalledWith('draft-accumulate', {
      title: 'First Change',
      description: 'Second Change',
      price: 25.0,
    });
  });

  it('should not create draft on mount when autoCreateOnMount is false', async () => {
    const { result } = renderHook(() =>
      useItemDraft(undefined, 'seller-no-auto', { autoCreateOnMount: false })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockDraftService.createItemDraft).not.toHaveBeenCalled();
    expect(result.current.draft).toBeNull();
  });
});
