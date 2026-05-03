// FILE: p2p-kids-marketplace/src/__tests__/services/educationContentService.test.ts
// MODULE-18 V1 EDU-003: Unit tests for education content service

import { getPublishedSections, getSectionByType } from '../../services/educationContentService';
import { supabase } from '../../config/supabase';

// Mock Supabase
jest.mock('../../config/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('educationContentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPublishedSections', () => {
    it('should fetch all published sections ordered by display_order', async () => {
      const mockSections = [
        {
          id: '1',
          title: 'Welcome',
          body: 'Welcome to trading',
          section_type: 'general',
          is_published: true,
          display_order: 1,
        },
        {
          id: '2',
          title: 'What are Swap Points?',
          body: 'Swap Points are...',
          section_type: 'sp_definition',
          is_published: true,
          display_order: 2,
        },
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockSections, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await getPublishedSections();

      expect(result).toEqual(mockSections);
      expect(supabase.from).toHaveBeenCalledWith('education_sections');
      expect(mockQuery.eq).toHaveBeenCalledWith('is_published', true);
      expect(mockQuery.order).toHaveBeenCalledWith('display_order', { ascending: true });
    });

    it('should return empty array on error', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await getPublishedSections();

      expect(result).toEqual([]);
    });
  });

  describe('getSectionByType', () => {
    it('should fetch single published section by type', async () => {
      const mockSection = {
        id: '1',
        title: 'What are Swap Points?',
        body: 'SP are...',
        section_type: 'sp_definition',
        is_published: true,
      };

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockSection, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await getSectionByType('sp_definition');

      expect(result).toEqual(mockSection);
      expect(mockQuery.eq).toHaveBeenCalledWith('section_type', 'sp_definition');
      expect(mockQuery.eq).toHaveBeenCalledWith('is_published', true);
    });

    it('should return null when no published section exists', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await getSectionByType('example');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await getSectionByType('sp_earning');

      expect(result).toBeNull();
    });
  });
});
