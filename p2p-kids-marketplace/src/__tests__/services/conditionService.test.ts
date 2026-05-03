/**
 * Unit tests for conditionService
 * MODULE-04 LISTING-V3: TASK LISTING-V3-003
 * Tests condition guides and color palette (MODULE-05 V3 reuse)
 */

import * as conditionService from '../../services/conditionService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('conditionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getConditionGuide', () => {
    it('should return 5 condition guides', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const guides = await conditionService.getConditionGuide();

      expect(guides).toHaveLength(5);
      expect(guides[0].code).toBe('new');
      expect(guides[1].code).toBe('like_new');
      expect(guides[2].code).toBe('good');
      expect(guides[3].code).toBe('fair');
      expect(guides[4].code).toBe('worn');
    });

    it('should include label, description, and keywords for each condition', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const guides = await conditionService.getConditionGuide();

      guides.forEach((guide) => {
        expect(guide).toHaveProperty('code');
        expect(guide).toHaveProperty('label');
        expect(guide).toHaveProperty('description');
        expect(guide).toHaveProperty('keywords');
        expect(Array.isArray(guide.keywords)).toBe(true);
        expect(guide.label).toBeTruthy();
        expect(guide.description).toBeTruthy();
      });
    });

    it('should cache guides in AsyncStorage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await conditionService.getConditionGuide();

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@kids_marketplace:condition_guide',
        expect.any(String)
      );
    });

    it('should return cached guides if available and not expired', async () => {
      const cached = {
        guides: [{ code: 'new', label: 'New with Tags', description: 'Test', keywords: ['new'] }],
        timestamp: Date.now(),
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cached));

      const guides = await conditionService.getConditionGuide();

      expect(guides).toEqual(cached.guides);
      expect(AsyncStorage.setItem).not.toHaveBeenCalled(); // No new write
    });

    it('should refresh cache if expired (24 hours)', async () => {
      const expired = {
        guides: [{ code: 'new', label: 'New with Tags', description: 'Old', keywords: ['new'] }],
        timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(expired));
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const guides = await conditionService.getConditionGuide();

      expect(guides).toHaveLength(5); // Fresh data
      expect(AsyncStorage.setItem).toHaveBeenCalled(); // New write
    });
  });

  describe('getConditionLabel', () => {
    it('should return correct label for each condition', () => {
      expect(conditionService.getConditionLabel('new')).toBe('New with Tags');
      expect(conditionService.getConditionLabel('like_new')).toBe('Like New');
      expect(conditionService.getConditionLabel('good')).toBe('Good');
      expect(conditionService.getConditionLabel('fair')).toBe('Fair');
      expect(conditionService.getConditionLabel('worn')).toBe('Worn');
    });

    it('should return raw code for unknown condition', () => {
      expect(conditionService.getConditionLabel('unknown' as any)).toBe('unknown');
    });
  });

  describe('getPopularColors', () => {
    it('should return 12 colors from MODULE-05 V3 COLOR_PALETTE', () => {
      const colors = conditionService.getPopularColors();

      expect(colors).toHaveLength(12);
    });

    it('should return color labels only', () => {
      const colors = conditionService.getPopularColors();

      colors.forEach((color) => {
        expect(typeof color).toBe('string');
        expect(color.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getColorPalette', () => {
    it('should return full COLOR_PALETTE from MODULE-05 V3', () => {
      const palette = conditionService.getColorPalette();

      expect(palette).toHaveLength(12);
      expect(palette[0]).toHaveProperty('id');
      expect(palette[0]).toHaveProperty('label');
      expect(palette[0]).toHaveProperty('hex');
    });
  });

  describe('matchColorToPalette', () => {
    it('should match exact color name', () => {
      const result = conditionService.matchColorToPalette('red');

      expect(result).toBe('red');
    });

    it('should be case-insensitive', () => {
      const result1 = conditionService.matchColorToPalette('RED');
      const result2 = conditionService.matchColorToPalette('red');

      expect(result1).toEqual(result2);
    });

    it('should return null if no match', () => {
      const result = conditionService.matchColorToPalette('zebra-striped-ultraviolet');

      expect(result).toBeNull();
    });

    it('should match partial terms', () => {
      const result = conditionService.matchColorToPalette('blu');

      expect(result).toBe('blue');
    });
  });

  describe('getColorHex', () => {
    it('should return hex code for known color', () => {
      const hex = conditionService.getColorHex('red');

      expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it('should return null for unknown color', () => {
      const hex = conditionService.getColorHex('unknown-color');

      expect(hex).toBeNull();
    });
  });

  describe('isValidCondition', () => {
    it('should accept valid conditions', () => {
      expect(conditionService.isValidCondition('new')).toBe(true);
      expect(conditionService.isValidCondition('like_new')).toBe(true);
      expect(conditionService.isValidCondition('good')).toBe(true);
      expect(conditionService.isValidCondition('fair')).toBe(true);
      expect(conditionService.isValidCondition('worn')).toBe(true);
    });

    it('should reject invalid conditions', () => {
      expect(conditionService.isValidCondition('poor')).toBe(false); // V2 legacy
      expect(conditionService.isValidCondition('excellent')).toBe(false);
      expect(conditionService.isValidCondition('unknown' as any)).toBe(false);
    });
  });
});
