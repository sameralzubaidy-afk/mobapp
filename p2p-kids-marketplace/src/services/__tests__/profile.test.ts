// File: p2p-kids-marketplace/src/services/__tests__/profile.test.ts
// Unit tests for profile service (AUTH-005, AUTH-006, AUTH-007)

import { findNearestNode, setupUserProfile, updateUserProfile, getUserProfile } from '../profile';
import { supabase } from '../supabase/client';
import { assignNodeByZipCode } from '../location';

// Mock Supabase client
jest.mock('../supabase/client', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getUser: jest.fn(),
    },
    functions: {
      invoke: jest.fn(),
    },
    storage: {
      from: jest.fn(),
    },
  },
}));

// Mock location service used by profile.ts
jest.mock('../location', () => ({
  assignNodeByZipCode: jest.fn(),
  incrementNodeMemberCount: jest.fn().mockResolvedValue(undefined),
}));

describe('Profile Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: return an auth user object so profile service can return `user`.
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          display_name: 'Test User',
        },
      },
      error: null,
    });
  });

  describe('findNearestNode', () => {
    it('should return nearest node based on zip code', async () => {
      (assignNodeByZipCode as jest.Mock).mockResolvedValue({
        nodeId: '1',
        nodeName: 'Norwalk CT',
        matchType: 'zip',
        distanceMiles: 0,
      });

      const result = await findNearestNode('06851'); // Norwalk, CT zip
      
      expect(result).toBeTruthy();
      expect(result?.node_id).toBe('1');
      expect(result?.node_name).toContain('Norwalk');
    });

    it('should return null if no active nodes exist', async () => {
      (assignNodeByZipCode as jest.Mock).mockRejectedValue(new Error('not currently active'));

      const result = await findNearestNode('12345');
      expect(result).toBeNull();
    });
  });

  describe('setupUserProfile', () => {
    it('should create user profile with node assignment', async () => {
      const mockUser = {
        id: 'user-1',
        display_name: 'Test User',
        node_id: 'node-1',
      };

      (assignNodeByZipCode as jest.Mock).mockResolvedValue({
        nodeId: 'node-1',
        nodeName: 'Test Node',
        matchType: 'zip',
        distanceMiles: 0,
      });

      // Mock profiles lookup + upsert chain used by setupUserProfile
      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table !== 'profiles') {
          return null;
        }

        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
          upsert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockUser,
                error: null,
              }),
            }),
          }),
        };
      });

      const result = await setupUserProfile('user-1', {
        display_name: 'Test User',
        zip_code: '06851',
      });

      expect(result.user).toBeTruthy();
      expect(result.error).toBeNull();
      expect(result.user?.display_name).toBe('Test User');
    });
  });

  describe('updateUserProfile', () => {
    it('should update user profile fields', async () => {
      const mockUpdatedUser = {
        id: 'user-1',
        display_name: 'Updated Name',
        bio: 'Updated bio',
      };

      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: {
          user: {
            id: 'user-1',
            display_name: 'Updated Name',
          },
        },
        error: null,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockUpdatedUser,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await updateUserProfile('user-1', {
        display_name: 'Updated Name',
        bio: 'Updated bio',
      });

      expect(result.user).toBeTruthy();
      expect(result.error).toBeNull();
      expect(result.user?.display_name).toBe('Updated Name');
    });
  });

  describe('getUserProfile', () => {
    it('should fetch user profile by ID', async () => {
      const mockUser = {
        id: 'user-1',
        display_name: 'Test User',
        email: 'test@example.com',
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockUser,
              error: null,
            }),
          }),
        }),
      });

      const result = await getUserProfile('user-1');

      expect(result.user).toBeTruthy();
      expect(result.error).toBeNull();
      expect(result.user?.id).toBe('user-1');
    });
  });
});
