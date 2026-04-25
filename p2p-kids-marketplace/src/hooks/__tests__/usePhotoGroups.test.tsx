/**
 * File: p2p-kids-marketplace/src/hooks/__tests__/usePhotoGroups.test.tsx
 * MODULE-04 LISTING-V3-004: usePhotoGroups Hook Unit Tests
 */

import { renderHook, act } from '@testing-library/react-native';
import { usePhotoGroups } from '../usePhotoGroups';
import { PhotoAsset, PhotoGroup } from '../../types/listing';
import { v4 as uuidv4 } from 'uuid';

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(),
}));

let uuidCounter = 0;

const createMockPhoto = (id: string): PhotoAsset => ({
  id,
  uri: `file://photo-${id}.jpg`,
  width: 800,
  height: 600,
  fileSize: 500000,
  mimeType: 'image/jpeg',
});

const createMockPhotos = (count: number, prefix: string = 'photo'): PhotoAsset[] => {
  return Array.from({ length: count }, (_, i) => createMockPhoto(`${prefix}-${i + 1}`));
};

describe('usePhotoGroups', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    uuidCounter = 0;
    (uuidv4 as jest.Mock).mockImplementation(() => {
      uuidCounter += 1;
      return `mock-uuid-${uuidCounter}`;
    });
  });

  describe('Initial state', () => {
    it('should start with empty groups', () => {
      const { result } = renderHook(() => usePhotoGroups());

      expect(result.current.groups).toEqual([]);
      expect(result.current.errors).toEqual([]);
      expect(result.current.totalPhotos).toBe(0);
    });

    it('should accept initial groups', () => {
      const initialGroups: PhotoGroup[] = [
        {
          groupId: 'group-1',
          photos: createMockPhotos(3),
          primaryPhotoIndex: 0,
        },
      ];

      const { result } = renderHook(() => usePhotoGroups(initialGroups));

      expect(result.current.groups).toEqual(initialGroups);
      expect(result.current.totalPhotos).toBe(3);
    });
  });

  describe('Adding photos', () => {
    it('should add photos to new group', () => {
      const { result } = renderHook(() => usePhotoGroups());

      const photos = createMockPhotos(3);

      act(() => {
        result.current.addPhotos(photos);
      });

      expect(result.current.groups).toHaveLength(1);
      expect(result.current.groups[0].photos).toEqual(photos);
      expect(result.current.groups[0].primaryPhotoIndex).toBe(0);
      expect(result.current.totalPhotos).toBe(3);
    });

    it('should fill existing group before creating new one', () => {
      const { result } = renderHook(() => usePhotoGroups());

      // Add 5 photos (creates one group with 5 photos)
      act(() => {
        result.current.addPhotos(createMockPhotos(5));
      });

      expect(result.current.groups).toHaveLength(1);
      expect(result.current.groups[0].photos).toHaveLength(5);

      // Add 3 more photos (fills existing group to 8 photos)
      act(() => {
        result.current.addPhotos(createMockPhotos(3));
      });

      expect(result.current.groups).toHaveLength(1);
      expect(result.current.groups[0].photos).toHaveLength(8);
    });

    it('should create new group when existing group is full', () => {
      const { result } = renderHook(() => usePhotoGroups());

      // Add 10 photos (max per group)
      act(() => {
        result.current.addPhotos(createMockPhotos(10));
      });

      expect(result.current.groups).toHaveLength(1);

      // Add 3 more photos (creates new group)
      act(() => {
        result.current.addPhotos(createMockPhotos(3));
      });

      expect(result.current.groups).toHaveLength(2);
      expect(result.current.groups[0].photos).toHaveLength(10);
      expect(result.current.groups[1].photos).toHaveLength(3);
    });

    it('should enforce max 30 photos total', () => {
      const { result } = renderHook(() => usePhotoGroups());

      // Add 30 photos
      act(() => {
        result.current.addPhotos(createMockPhotos(30));
      });

      expect(result.current.totalPhotos).toBe(30);

      // Try to add more
      act(() => {
        result.current.addPhotos(createMockPhotos(5));
      });

      // Should still be 30
      expect(result.current.totalPhotos).toBe(30);
      expect(result.current.errors).toHaveLength(1);
      expect(result.current.errors[0].type).toBe('max_photos_total');
    });

    it('should enforce max 15 groups', () => {
      const { result } = renderHook(() => usePhotoGroups());

      // Pre-create 15 groups, then try to add photos that would need a 16th group.
      // With 15 empty groups, adding 30 photos will fill one group and then attempt
      // to create additional groups for remaining photos, hitting the max_groups guard.
      for (let i = 0; i < 15; i++) {
        act(() => {
          result.current.createGroup();
        });
      }

      expect(result.current.groups).toHaveLength(15);

      // Try to add photos that exceed current grouped capacity.
      act(() => {
        result.current.addPhotos(createMockPhotos(30, 'cap-test'));
      });

      expect(result.current.groups).toHaveLength(15);
      expect(result.current.errors.some((e) => e.type === 'max_groups')).toBe(true);
    });
  });

  describe('Removing photos', () => {
    it('should remove photo from group', () => {
      const { result } = renderHook(() => usePhotoGroups());

      const photos = createMockPhotos(3);

      act(() => {
        result.current.addPhotos(photos);
      });

      const groupId = result.current.groups[0].groupId;

      act(() => {
        result.current.removePhoto(groupId, 'photo-2');
      });

      expect(result.current.groups[0].photos).toHaveLength(2);
      expect(result.current.groups[0].photos.find((p) => p.id === 'photo-2')).toBeUndefined();
    });

    it('should remove empty group after removing last photo', () => {
      const { result } = renderHook(() => usePhotoGroups());

      const photos = createMockPhotos(1);

      act(() => {
        result.current.addPhotos(photos);
      });

      const groupId = result.current.groups[0].groupId;

      act(() => {
        result.current.removePhoto(groupId, 'photo-1');
      });

      expect(result.current.groups).toHaveLength(0);
    });

    it('should adjust primary photo index when removing photo before it', () => {
      const { result } = renderHook(() => usePhotoGroups());

      const photos = createMockPhotos(3);

      act(() => {
        result.current.addPhotos(photos);
      });

      const groupId = result.current.groups[0].groupId;

      // Set primary to index 2
      act(() => {
        result.current.setCover(groupId, 2);
      });

      expect(result.current.groups[0].primaryPhotoIndex).toBe(2);

      // Remove photo at index 0
      act(() => {
        result.current.removePhoto(groupId, 'photo-1');
      });

      // Primary index should be adjusted to 1
      expect(result.current.groups[0].primaryPhotoIndex).toBe(1);
    });

    it('should reset primary to 0 when removing the primary photo', () => {
      const { result } = renderHook(() => usePhotoGroups());

      const photos = createMockPhotos(3);

      act(() => {
        result.current.addPhotos(photos);
      });

      const groupId = result.current.groups[0].groupId;

      // Set primary to index 1
      act(() => {
        result.current.setCover(groupId, 1);
      });

      // Remove the primary photo
      act(() => {
        result.current.removePhoto(groupId, 'photo-2');
      });

      expect(result.current.groups[0].primaryPhotoIndex).toBe(0);
    });
  });

  describe('Reordering photos', () => {
    it('should reorder photos within group', () => {
      const { result } = renderHook(() => usePhotoGroups());

      const photos = createMockPhotos(3);

      act(() => {
        result.current.addPhotos(photos);
      });

      const groupId = result.current.groups[0].groupId;

      act(() => {
        result.current.reorderPhotos(groupId, 0, 2);
      });

      expect(result.current.groups[0].photos[0].id).toBe('photo-2');
      expect(result.current.groups[0].photos[1].id).toBe('photo-3');
      expect(result.current.groups[0].photos[2].id).toBe('photo-1');
    });

    it('should adjust primary photo index when reordering', () => {
      const { result } = renderHook(() => usePhotoGroups());

      const photos = createMockPhotos(3);

      act(() => {
        result.current.addPhotos(photos);
      });

      const groupId = result.current.groups[0].groupId;

      // Set primary to index 0
      expect(result.current.groups[0].primaryPhotoIndex).toBe(0);

      // Move primary photo to index 2
      act(() => {
        result.current.reorderPhotos(groupId, 0, 2);
      });

      expect(result.current.groups[0].primaryPhotoIndex).toBe(2);
    });
  });

  describe('Regrouping photos', () => {
    it('should move photo between groups', () => {
      const { result } = renderHook(() => usePhotoGroups());

      // Create two groups
      act(() => {
        result.current.addPhotos(createMockPhotos(10, 'g1')); // Group 1 (full)
        result.current.addPhotos(createMockPhotos(5, 'g2')); // Group 2
      });

      const fromGroupId = result.current.groups[0].groupId;
      const toGroupId = result.current.groups[1].groupId;

      act(() => {
        result.current.regroup('g1-1', fromGroupId, toGroupId);
      });

      expect(result.current.groups[0].photos).toHaveLength(9);
      expect(result.current.groups[1].photos).toHaveLength(6);
      expect(result.current.groups[1].photos.find((p) => p.id === 'g1-1')).toBeDefined();
    });

    it('should remove empty group after regrouping last photo', () => {
      const { result } = renderHook(() => usePhotoGroups());

      // Create two groups
      act(() => {
        result.current.addPhotos(createMockPhotos(9, 'g1')); // Group 1
        result.current.createGroup(); // Group 2 (empty)
        result.current.addPhotos(createMockPhotos(1, 'g2')); // Group 2 now has one photo
      });

      const fromGroupId = result.current.groups[0].groupId;
      const toGroupId = result.current.groups[1].groupId;

      act(() => {
        result.current.regroup('g2-1', toGroupId, fromGroupId);
      });

      // First group should be removed
      expect(result.current.groups).toHaveLength(1);
      expect(result.current.groups[0].groupId).toBe(fromGroupId);
    });

    it('should enforce max photos per group when regrouping', () => {
      const initialGroups: PhotoGroup[] = [
        {
          groupId: 'group-1',
          photos: createMockPhotos(5, 'g1'),
          primaryPhotoIndex: 0,
        },
        {
          groupId: 'group-2',
          photos: createMockPhotos(10, 'g2'),
          primaryPhotoIndex: 0,
        },
      ];

      const { result } = renderHook(() => usePhotoGroups(initialGroups));

      const fromGroupId = result.current.groups[0].groupId;
      const toGroupId = result.current.groups[1].groupId;

      act(() => {
        result.current.regroup('g1-1', fromGroupId, toGroupId);
      });

      // Regroup should fail
      expect(result.current.groups[0].photos).toHaveLength(5);
      expect(result.current.groups[1].photos).toHaveLength(10);
      expect(result.current.errors).toHaveLength(1);
      expect(result.current.errors[0].type).toBe('max_photos_per_group');
    });
  });

  describe('Setting cover photo', () => {
    it('should set primary photo index', () => {
      const { result } = renderHook(() => usePhotoGroups());

      const photos = createMockPhotos(3);

      act(() => {
        result.current.addPhotos(photos);
      });

      const groupId = result.current.groups[0].groupId;

      act(() => {
        result.current.setCover(groupId, 2);
      });

      expect(result.current.groups[0].primaryPhotoIndex).toBe(2);
    });

    it('should reject invalid photo index', () => {
      const { result } = renderHook(() => usePhotoGroups());

      const photos = createMockPhotos(3);

      act(() => {
        result.current.addPhotos(photos);
      });

      const groupId = result.current.groups[0].groupId;

      act(() => {
        result.current.setCover(groupId, 10);
      });

      expect(result.current.groups[0].primaryPhotoIndex).toBe(0); // Unchanged
      expect(result.current.errors).toHaveLength(1);
      expect(result.current.errors[0].type).toBe('invalid_operation');
    });
  });

  describe('Group management', () => {
    it('should create empty group', () => {
      const { result } = renderHook(() => usePhotoGroups());

      act(() => {
        result.current.createGroup();
      });

      expect(result.current.groups).toHaveLength(1);
      expect(result.current.groups[0].photos).toHaveLength(0);
    });

    it('should remove entire group', () => {
      const { result } = renderHook(() => usePhotoGroups());

      act(() => {
        result.current.addPhotos(createMockPhotos(3));
      });

      const groupId = result.current.groups[0].groupId;

      act(() => {
        result.current.removeGroup(groupId);
      });

      expect(result.current.groups).toHaveLength(0);
    });

    it('should enforce max 15 groups when creating', () => {
      const { result } = renderHook(() => usePhotoGroups());

      // Create 15 groups
      for (let i = 0; i < 15; i++) {
        act(() => {
          result.current.createGroup();
        });
      }

      expect(result.current.groups).toHaveLength(15);

      // Try to create 16th group
      act(() => {
        result.current.createGroup();
      });

      expect(result.current.groups).toHaveLength(15);
      expect(result.current.errors).toHaveLength(1);
      expect(result.current.errors[0].type).toBe('max_groups');
    });
  });

  describe('Error management', () => {
    it('should clear errors', () => {
      const { result } = renderHook(() => usePhotoGroups());

      // Trigger error
      act(() => {
        result.current.addPhotos(createMockPhotos(35)); // Exceeds max
      });

      expect(result.current.errors).toHaveLength(1);

      act(() => {
        result.current.clearErrors();
      });

      expect(result.current.errors).toHaveLength(0);
    });

    it('should clear errors before each operation', () => {
      const { result } = renderHook(() => usePhotoGroups());

      // Trigger error
      act(() => {
        result.current.addPhotos(createMockPhotos(35));
      });

      expect(result.current.errors).toHaveLength(1);

      // Valid operation should clear errors
      act(() => {
        result.current.addPhotos(createMockPhotos(5));
      });

      // Old error should be cleared
      expect(result.current.errors).toHaveLength(0);
    });
  });

  describe('Total photos calculation', () => {
    it('should calculate total photos across all groups', () => {
      const { result } = renderHook(() => usePhotoGroups());

      act(() => {
        result.current.addPhotos(createMockPhotos(5));
        result.current.addPhotos(createMockPhotos(10));
        result.current.addPhotos(createMockPhotos(3));
      });

      expect(result.current.totalPhotos).toBe(18);
    });

    it('should update total after removing photos', () => {
      const { result } = renderHook(() => usePhotoGroups());

      act(() => {
        result.current.addPhotos(createMockPhotos(10));
      });

      expect(result.current.totalPhotos).toBe(10);

      const groupId = result.current.groups[0].groupId;

      act(() => {
        result.current.removePhoto(groupId, 'photo-1');
      });

      expect(result.current.totalPhotos).toBe(9);
    });
  });
});
