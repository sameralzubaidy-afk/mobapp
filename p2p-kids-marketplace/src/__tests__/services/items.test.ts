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
      const mockItemsList = [
        {
          id: 'item-1',
          seller_id: 'seller-1',
          title: 'Test Item',
          description: null,
          price: 10.99,
          category_id: 'cat-1',
          condition: null,
          status: 'available',
          accepts_swap_points: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sold_at: null,
        },
        {
          id: 'item-2',
          seller_id: 'seller-2',
          title: 'Other Item',
          description: null,
          price: 5,
          category_id: 'cat-1',
          condition: null,
          status: 'available',
          accepts_swap_points: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sold_at: null,
        },
      ];

      const mockProfiles = [
        { user_id: 'seller-1', name: 'Seller 1', avatar_url: null, node_id: 'node-norwalk' },
        { user_id: 'seller-2', name: 'Seller 2', avatar_url: null, node_id: 'node-other' },
      ];

      const mockNodes = [
        { id: 'node-norwalk', name: 'Norwalk Central', city: 'Norwalk', state: 'CT' },
        { id: 'node-other', name: 'Other Node', city: 'Other', state: 'CT' },
      ];

      const mockImages = [
        {
          id: 'img-1',
          item_id: 'item-1',
          url: 'https://example.com/item-1.jpg',
          thumbnail_url: null,
          display_order: 1,
        },
      ];

      const mockCategories = [{ id: 'cat-1', name: 'Toys', icon: '🧸' }];

      const mockItemsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockItemsList, error: null }),
      };

      const mockProfilesQuery = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: mockProfiles, error: null }),
      };

      const mockNodesQuery = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: mockNodes, error: null }),
      };

      const mockImagesQuery = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: mockImages, error: null }),
      };

      const mockCategoriesQuery = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: mockCategories, error: null }),
      };

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'items') return mockItemsQuery;
        if (table === 'profiles') return mockProfilesQuery;
        if (table === 'geographic_nodes') return mockNodesQuery;
        if (table === 'item_images') return mockImagesQuery;
        if (table === 'categories') return mockCategoriesQuery;
        return {};
      });

      const filters = {
        node_id: 'node-norwalk',
        include_all_nodes: false,
      };

      const result = await getItems(filters, 'user-123');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('item-1');
      expect(result[0].seller?.node_id).toBe('node-norwalk');
      expect(supabase.from).toHaveBeenCalledWith('items');
      expect(mockItemsQuery.eq).toHaveBeenCalledWith('status', 'available');
      expect(mockProfilesQuery.in).toHaveBeenCalledWith('user_id', ['seller-1', 'seller-2']);
    });

    it('should not filter by node when include_all_nodes is true', async () => {
      const mockItemsList = [
        {
          id: 'item-1',
          seller_id: 'seller-1',
          title: 'Item from Norwalk',
          description: null,
          price: 10,
          category_id: 'cat-1',
          condition: null,
          status: 'available',
          accepts_swap_points: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sold_at: null,
        },
        {
          id: 'item-2',
          seller_id: 'seller-2',
          title: 'Item from Little Falls',
          description: null,
          price: 5,
          category_id: 'cat-1',
          condition: null,
          status: 'available',
          accepts_swap_points: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sold_at: null,
        },
      ];

      const mockProfiles = [
        { user_id: 'seller-1', name: 'Seller 1', avatar_url: null, node_id: 'node-norwalk' },
        { user_id: 'seller-2', name: 'Seller 2', avatar_url: null, node_id: 'node-littlefalls' },
      ];

      const mockNodes = [
        { id: 'node-norwalk', name: 'Norwalk Central', city: 'Norwalk', state: 'CT' },
        { id: 'node-littlefalls', name: 'Little Falls', city: 'Little Falls', state: 'NJ' },
      ];

      const mockItemsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockItemsList, error: null }),
      };

      const mockProfilesQuery = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: mockProfiles, error: null }),
      };

      const mockNodesQuery = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: mockNodes, error: null }),
      };

      const mockImagesQuery = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      const mockCategoriesQuery = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'items') return mockItemsQuery;
        if (table === 'profiles') return mockProfilesQuery;
        if (table === 'geographic_nodes') return mockNodesQuery;
        if (table === 'item_images') return mockImagesQuery;
        if (table === 'categories') return mockCategoriesQuery;
        return {};
      });

      const filters = {
        node_id: 'node-norwalk',
        include_all_nodes: true,
      };

      const result = await getItems(filters, 'user-123');

      expect(result.length).toBe(2);
      // Node filtering is applied in-app after profiles fetch; include_all_nodes skips it.
      expect(result.map((i: any) => i.id).sort()).toEqual(['item-1', 'item-2']);
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
      const mockSellersInRadius = [{ user_id: 'seller-1' }, { user_id: 'seller-2' }];
      const mockItemsList = [
        {
          id: 'item-1',
          seller_id: 'seller-1',
          title: 'Item 1',
          description: null,
          price: 10,
          category_id: 'cat-1',
          condition: null,
          status: 'available',
          accepts_swap_points: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sold_at: null,
        },
        {
          id: 'item-2',
          seller_id: 'seller-2',
          title: 'Item 2',
          description: null,
          price: 5,
          category_id: 'cat-1',
          condition: null,
          status: 'available',
          accepts_swap_points: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sold_at: null,
        },
      ];

      const mockProfiles = [
        { user_id: 'seller-1', name: 'Seller 1', avatar_url: null, node_id: 'node-1' },
        { user_id: 'seller-2', name: 'Seller 2', avatar_url: null, node_id: 'node-2' },
      ];

      const mockNodes = [
        { id: 'node-1', name: 'Node 1', city: 'City 1', state: 'ST' },
        { id: 'node-2', name: 'Node 2', city: 'City 2', state: 'ST' },
      ];

      // Mock node lookup
      const mockNodeQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: mockNodes, error: null }),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockNode, error: null }),
      };

      const mockItemsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockItemsList, error: null }),
      };

      const mockProfilesNodeQuery = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: mockSellersInRadius, error: null }),
      };

      const mockProfilesDetailsQuery = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: mockProfiles, error: null }),
      };

      const mockImagesQuery = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      const mockCategoriesQuery = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      (supabase.from as jest.Mock).mockImplementation((table) => {
        if (table === 'geographic_nodes') return mockNodeQuery;
        if (table === 'profiles') {
          // first call: sellers in radius; second call: seller details
          const callCount = (supabase.from as jest.Mock).mock.calls.filter((c) => c[0] === 'profiles')
            .length;
          return callCount === 1 ? mockProfilesNodeQuery : mockProfilesDetailsQuery;
        }
        if (table === 'items') return mockItemsQuery;
        if (table === 'item_images') return mockImagesQuery;
        if (table === 'categories') return mockCategoriesQuery;
        return {};
      });

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockNearbyNodes,
        error: null,
      });

      const result = await getItemsWithinRadius('node-norwalk', 10, 'user-123');

      expect(result).toHaveLength(2);
      expect(supabase.rpc).toHaveBeenCalledWith('get_nodes_within_radius', {
        center_lat: mockNode.latitude,
        center_lng: mockNode.longitude,
        radius_miles: 10,
      });
      expect(mockProfilesNodeQuery.in).toHaveBeenCalledWith('node_id', ['node-1', 'node-2']);
      expect(mockItemsQuery.in).toHaveBeenCalledWith('seller_id', ['seller-1', 'seller-2']);
    });

    it('should handle node lookup errors', async () => {
      const mockNodeQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: { message: 'Node not found' } }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockNodeQuery);

      await expect(getItemsWithinRadius('invalid-node', 10, 'user-123')).resolves.toEqual([]);
    });
  });

  describe('getItemById', () => {
    it('should return item by ID', async () => {
      const mockItem = {
        id: 'item-123',
        title: 'Test Item',
        price: 15.99,
        seller: {
          user_id: 'seller-1',
          name: 'Seller Name',
          avatar_url: 'https://example.com/avatar.jpg',
        },
        category: {
          id: 'cat-1',
          name: 'Toys',
          icon: '🧸',
        },
        images: [
          {
            id: 'img-1',
            url: 'https://example.com/item.jpg',
            thumbnail_url: 'https://example.com/item-thumb.jpg',
            display_order: 1,
          },
        ],
      };

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockItem, error: null }),
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
        maybeSingle: jest.fn().mockResolvedValue({
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
