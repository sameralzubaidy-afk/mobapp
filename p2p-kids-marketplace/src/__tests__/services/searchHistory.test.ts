/**
 * Unit tests for searchHistory service
 * MODULE-05-DISCOVERY-V3: TASK DISCOVERY-V3-003
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getRecentSearches,
  addSearchToHistory,
  removeSearchFromHistory,
  clearSearchHistory,
  getAutocompleteSuggestions,
} from '../../services/searchHistory';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const STORAGE_KEY = '@kids_marketplace:recent_searches';

describe('searchHistory service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getRecentSearches', () => {
    it('should return empty array when no history exists', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await getRecentSearches();

      expect(result).toEqual([]);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it('should return stored searches', async () => {
      const storedSearches = ['LEGO', 'bicycle', 'books'];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(storedSearches));

      const result = await getRecentSearches();

      expect(result).toEqual(storedSearches);
    });

    it('should handle invalid JSON gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid json');

      const result = await getRecentSearches();

      expect(result).toEqual([]);
    });

    it('should handle storage errors gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const result = await getRecentSearches();

      expect(result).toEqual([]);
    });
  });

  describe('addSearchToHistory', () => {
    it('should add new search to empty history', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await addSearchToHistory('LEGO');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(['LEGO']));
    });

    it('should prepend new search to existing history (LRU)', async () => {
      const existing = ['bicycle', 'books'];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(existing));

      await addSearchToHistory('LEGO');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify(['LEGO', 'bicycle', 'books'])
      );
    });

    it('should deduplicate case-insensitive', async () => {
      const existing = ['bicycle', 'LEGO', 'books'];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(existing));

      await addSearchToHistory('lego'); // lowercase version

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify(['lego', 'bicycle', 'books']) // moved to front, old removed
      );
    });

    it('should cap at 8 searches maximum', async () => {
      const existing = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(existing));

      await addSearchToHistory('new search');

      const savedData = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls[0][1]);

      expect(savedData).toHaveLength(8);
      expect(savedData[0]).toBe('new search');
      expect(savedData).not.toContain('s8'); // oldest evicted
    });

    it('should ignore empty or whitespace-only queries', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await addSearchToHistory('');
      await addSearchToHistory('   ');

      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it('should trim whitespace from query', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await addSearchToHistory('  LEGO  ');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(['LEGO']));
    });
  });

  describe('removeSearchFromHistory', () => {
    it('should remove matching search (case-insensitive)', async () => {
      const existing = ['LEGO', 'bicycle', 'books'];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(existing));

      await removeSearchFromHistory('lego'); // lowercase

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify(['bicycle', 'books'])
      );
    });

    it('should handle non-existent search gracefully', async () => {
      const existing = ['LEGO', 'bicycle'];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(existing));

      await removeSearchFromHistory('books');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify(['LEGO', 'bicycle'])
      );
    });
  });

  describe('clearSearchHistory', () => {
    it('should remove storage key', async () => {
      await clearSearchHistory();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it('should handle errors gracefully', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(clearSearchHistory()).resolves.not.toThrow();
    });
  });

  describe('getAutocompleteSuggestions', () => {
    const recentSearches = ['LEGO Star Wars', 'LEGO City', 'bicycle', 'books', 'LEGO Friends'];

    beforeEach(() => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(recentSearches));
    });

    it('should return searches that start with query (case-insensitive)', async () => {
      const result = await getAutocompleteSuggestions('lego');

      expect(result).toEqual(['LEGO Star Wars', 'LEGO City', 'LEGO Friends']);
    });

    it('should cap at max 5 results by default', async () => {
      const manySearches = [
        'LEGO 1',
        'LEGO 2',
        'LEGO 3',
        'LEGO 4',
        'LEGO 5',
        'LEGO 6',
        'LEGO 7',
        'bicycle',
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(manySearches));

      const result = await getAutocompleteSuggestions('lego');

      expect(result).toHaveLength(5);
    });

    it('should respect custom max parameter', async () => {
      const result = await getAutocompleteSuggestions('lego', 2);

      expect(result).toHaveLength(2);
      expect(result).toEqual(['LEGO Star Wars', 'LEGO City']);
    });

    it('should return empty array for non-matching query', async () => {
      const result = await getAutocompleteSuggestions('xyz');

      expect(result).toEqual([]);
    });

    it('should return empty array for empty query', async () => {
      const result = await getAutocompleteSuggestions('');

      expect(result).toEqual([]);
    });

    it('should trim whitespace from query', async () => {
      const result = await getAutocompleteSuggestions('  lego  ');

      expect(result).toEqual(['LEGO Star Wars', 'LEGO City', 'LEGO Friends']);
    });

    it('should handle storage errors gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const result = await getAutocompleteSuggestions('lego');

      expect(result).toEqual([]);
    });
  });
});
