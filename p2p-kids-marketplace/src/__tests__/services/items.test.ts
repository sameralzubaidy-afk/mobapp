/**
 * File: p2p-kids-marketplace/src/__tests__/services/items.test.ts
 * MODULE-03 NODE-006: Node-Specific Item Filtering Tests
 * 
 * Tests:
 * - Node-based item filtering
 * - Cross-node search within radius
 * - Item queries with filters
 */

import { getItems, getItemsWithinRadius, getItemById, getCategories } from '../../services/items';
import { supabase } from '../../services/supabase';

// Mock supabase
jest.mock('../../services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    auth: {
      getUser: jest.fn(),
    },
  },
}));

// Mock analytics
jest.mock('../../services/analytics', () => ({
  trackEvent: jest.fn(),
}));

describe('items.ts - NODE-006: Node-Specific Item Filtering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getItems', () => {
    it('should filter items by node_id when provided', async () => {
      const mockItems = [
        {
          id: 'item-1',
          title: 'Test Item',
          price: 10.99,
          seller: {
            node_id: 'node-norwalk',
            node: { name: 'Norwalk Central', city: 'Norwalk', state: 'CT' },
          },
        },
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockItems, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const filters = {
        node_id: 'node-norwalk',
        include_all_nodes: false,
      };

      const result = await getItems(filters, 'user-123');

      expect(result).toEqual(mockItems);
      expect(supabase.from).toHaveBeenCalledWith('items');
      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'available');
      expect(mockQuery.eq).toHaveBeenCalledWith('seller.node_id', 'node-norwalk');
    });

    it('should not filter by node when include_all_nodes is true', async () => {
      const mockItems = [
        {
          id: 'item-1',
          title: 'Item from Norwalk',
          seller: { node: { name: 'Norwalk Central' } },
        },
        {
          id: 'item-2',
          title: 'Item from Little Falls',
          seller: { node: { name: 'Little Falls' } },
        },
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockItems, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const filters = {
        node_id: 'node-norwalk',
        include_all_nodes: true,
      };

      const result = await getItems(filters, 'user-123');

      expect(result).toEqual(mockItems);
      expect(result.length).toBe(2);
      // Should NOT have called eq with node_id filter
      expect(mockQuery.eq).not.toHaveBeenCalledWith('seller.node_id', expect.any(String));
    });

    it('should apply category filter', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const filters = {
        category_id: 'cat-toys',
      };

      await getItems(filters, 'user-123');

      expect(mockQuery.eq).toHaveBeenCalledWith('category_id', 'cat-toys');
    });

    it('should apply price range filters', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const filters = {
        min_price: 5,
        max_price: 50,
      };

      await getItems(filters, 'user-123');

      expect(mockQuery.gte).toHaveBeenCalledWith('price', 5);
      expect(mockQuery.lte).toHaveBeenCalledWith('price', 50);
    });

    it('should apply search query filter', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const filters = {
        search_query: 'lego',
      };

      await getItems(filters, 'user-123');

      expect(mockQuery.or).toHaveBeenCalledWith(
        'title.ilike.%lego%,description.ilike.%lego%'
      );
    });

    it('should handle errors gracefully', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        order: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      await expect(getItems({}, 'user-123')).rejects.toThrow();
    });
  });

  describe('getItemsWithinRadius', () => {
    it('should find items within radius', async () => {
      const mockNode = { latitude: 41.1175, longitude: -73.4079 };
      const mockNearbyNodes = [
        { id: 'node-1', name: 'Node 1', distance_miles: 5 },
        { id: 'node-2', name: 'Node 2', distance_miles: 10 },
      ];
      const mockItems = [
        { id: 'item-1', title: 'Item 1', seller: { node_id: 'node-1' } },
        { id: 'item-2', title: 'Item 2', seller: { node_id: 'node-2' } },
      ];

      // Mock node lookup
      const mockNodeQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockNode, error: null }),
      };

      // Mock items query
      const mockItemsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockItems, error: null }),
      };

      (supabase.from as jest.Mock).mockImplementation((table) => {
        if (table === 'geographic_nodes') return mockNodeQuery;
        if (table === 'items') return mockItemsQuery;
        return mockNodeQuery;
      });

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockNearbyNodes,
        error: null,
      });

      const result = await getItemsWithinRadius('node-norwalk', 10, 'user-123');

      expect(result).toEqual(mockItems);
      expect(supabase.rpc).toHaveBeenCalledWith('get_nodes_within_radius', {
        center_lat: mockNode.latitude,
        center_lng: mockNode.longitude,
        radius_miles: 10,
      });
      expect(mockItemsQuery.in).toHaveBeenCalledWith('seller.node_id', ['node-1', 'node-2']);
    });

    it('should handle node lookup errors', async () => {
      const mockNodeQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockRejectedValue(new Error('Node not found')),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockNodeQuery);

      await expect(
        getItemsWithinRadius('invalid-node', 10, 'user-123')
      ).rejects.toThrow();
    });
  });

  describe('getItemById', () => {
    it('should return item by ID', async () => {
      const mockItem = {
        id: 'item-123',
        title: 'Test Item',
        price: 15.99,
      };

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockItem, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await getItemById('item-123');

      expect(result).toEqual(mockItem);
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'item-123');
    });

    it('should return null on error', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await getItemById('invalid-id');

      expect(result).toBeNull();
    });
  });

  describe('getCategories', () => {
    it('should return active categories', async () => {
      const mockCategories = [
        { id: 'cat-1', name: 'Toys', icon: '🧸', display_order: 1 },
        { id: 'cat-2', name: 'Games', icon: '🎮', display_order: 2 },
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockCategories, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await getCategories();

      expect(result).toEqual(mockCategories);
      expect(mockQuery.eq).toHaveBeenCalledWith('is_active', true);
      expect(mockQuery.order).toHaveBeenCalledWith('display_order', { ascending: true });
    });

    it('should return empty array on error', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Error' },
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await getCategories();

      expect(result).toEqual([]);
    });
  });
});
