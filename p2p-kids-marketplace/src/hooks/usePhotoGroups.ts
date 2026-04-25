/**
 * File: p2p-kids-marketplace/src/hooks/usePhotoGroups.ts
 * MODULE-04 LISTING-V3-004: Photo Groups Hook
 * 
 * Provides photo grouping state management for bulk listing with:
 * - Add/remove/reorder photos
 * - Regroup photos between items
 * - Set cover photo
 * - Cap enforcement (10/group, 30 total, 15 groups)
 * - Error state instead of throwing
 */

import { useState, useCallback } from 'react';
import { PhotoAsset, PhotoGroup } from '../types/listing';
import { v4 as uuidv4 } from 'uuid';

const MAX_PHOTOS_PER_GROUP = 10;
const MAX_PHOTOS_TOTAL = 30;
const MAX_GROUPS = 15;

export interface PhotoGroupError {
  type: 'max_photos_total' | 'max_photos_per_group' | 'max_groups' | 'invalid_operation';
  message: string;
}

export interface UsePhotoGroupsResult {
  groups: PhotoGroup[];
  addPhotos: (photos: PhotoAsset[]) => void;
  removePhoto: (groupId: string, photoId: string) => void;
  reorderPhotos: (groupId: string, fromIndex: number, toIndex: number) => void;
  regroup: (photoId: string, fromGroupId: string, toGroupId: string) => void;
  setCover: (groupId: string, photoIndex: number) => void;
  createGroup: () => void;
  removeGroup: (groupId: string) => void;
  errors: PhotoGroupError[];
  clearErrors: () => void;
  totalPhotos: number;
}

/**
 * Hook for managing photo groups in bulk listing
 * 
 * Features:
 * - Enforces caps: 10 photos/group, 30 total, 15 groups
 * - Returns errors array instead of throwing
 * - Immutable operations (returns new state)
 * - Preserves intra-group order on regroup
 * 
 * @param initialGroups - Optional initial groups state
 * @returns Photo groups state and control methods
 */
export function usePhotoGroups(
  initialGroups: PhotoGroup[] = []
): UsePhotoGroupsResult {
  const [groups, setGroups] = useState<PhotoGroup[]>(initialGroups);
  const [errors, setErrors] = useState<PhotoGroupError[]>([]);

  // Calculate total photos across all groups
  const totalPhotos = groups.reduce((sum, group) => sum + group.photos.length, 0);

  // Add error
  const addError = useCallback((error: PhotoGroupError) => {
    setErrors((prev) => [...prev, error]);
  }, []);

  // Clear all errors
  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  // Add photos to a new or existing group
  const addPhotos = useCallback((photos: PhotoAsset[]) => {
    clearErrors();

    // Check total photos cap
    if (totalPhotos + photos.length > MAX_PHOTOS_TOTAL) {
      addError({
        type: 'max_photos_total',
        message: `Cannot add ${photos.length} photos. Maximum ${MAX_PHOTOS_TOTAL} total photos allowed.`,
      });
      return;
    }

    // Create new group for photos or add to last group if space available
    setGroups((prev) => {
      const newGroups = [...prev];
      const remainingPhotos = [...photos];

      // Try to fill last group first
      if (newGroups.length > 0) {
        const lastGroup = newGroups[newGroups.length - 1];
        const availableSpace = MAX_PHOTOS_PER_GROUP - lastGroup.photos.length;

        if (availableSpace > 0) {
          const photosToAdd = remainingPhotos.splice(0, availableSpace);
          lastGroup.photos = [...lastGroup.photos, ...photosToAdd];
        }
      }

      // Create new groups for remaining photos
      while (remainingPhotos.length > 0) {
        if (newGroups.length >= MAX_GROUPS) {
          addError({
            type: 'max_groups',
            message: `Maximum ${MAX_GROUPS} groups allowed.`,
          });
          break;
        }

        const groupPhotos = remainingPhotos.splice(0, MAX_PHOTOS_PER_GROUP);
        newGroups.push({
          groupId: uuidv4(),
          photos: groupPhotos,
          primaryPhotoIndex: 0,
        });
      }

      return newGroups;
    });
  }, [totalPhotos, addError, clearErrors]);

  // Remove photo from a group
  const removePhoto = useCallback((groupId: string, photoId: string) => {
    clearErrors();

    setGroups((prev) => {
      const newGroups = prev.map((group) => {
        if (group.groupId !== groupId) return group;

        const photoIndex = group.photos.findIndex((p) => p.id === photoId);
        if (photoIndex === -1) return group;

        const newPhotos = group.photos.filter((p) => p.id !== photoId);

        // Adjust primary photo index if needed
        let newPrimaryIndex = group.primaryPhotoIndex;
        if (photoIndex === group.primaryPhotoIndex) {
          newPrimaryIndex = 0; // Reset to first photo
        } else if (photoIndex < group.primaryPhotoIndex) {
          newPrimaryIndex = group.primaryPhotoIndex - 1;
        }

        return {
          ...group,
          photos: newPhotos,
          primaryPhotoIndex: Math.min(newPrimaryIndex, newPhotos.length - 1),
        };
      });

      // Remove empty groups
      return newGroups.filter((g) => g.photos.length > 0);
    });
  }, [clearErrors]);

  // Reorder photos within a group
  const reorderPhotos = useCallback(
    (groupId: string, fromIndex: number, toIndex: number) => {
      clearErrors();

      setGroups((prev) => {
        return prev.map((group) => {
          if (group.groupId !== groupId) return group;

          const newPhotos = [...group.photos];
          const [movedPhoto] = newPhotos.splice(fromIndex, 1);
          newPhotos.splice(toIndex, 0, movedPhoto);

          // Adjust primary photo index if the primary photo was moved
          let newPrimaryIndex = group.primaryPhotoIndex;
          if (fromIndex === group.primaryPhotoIndex) {
            newPrimaryIndex = toIndex;
          } else if (fromIndex < group.primaryPhotoIndex && toIndex >= group.primaryPhotoIndex) {
            newPrimaryIndex = group.primaryPhotoIndex - 1;
          } else if (fromIndex > group.primaryPhotoIndex && toIndex <= group.primaryPhotoIndex) {
            newPrimaryIndex = group.primaryPhotoIndex + 1;
          }

          return {
            ...group,
            photos: newPhotos,
            primaryPhotoIndex: newPrimaryIndex,
          };
        });
      });
    },
    [clearErrors]
  );

  // Move photo from one group to another
  const regroup = useCallback(
    (photoId: string, fromGroupId: string, toGroupId: string) => {
      clearErrors();

      setGroups((prev) => {
        const fromGroup = prev.find((g) => g.groupId === fromGroupId);
        const toGroup = prev.find((g) => g.groupId === toGroupId);

        if (!fromGroup || !toGroup) {
          addError({
            type: 'invalid_operation',
            message: 'Invalid group IDs',
          });
          return prev;
        }

        // Check destination group capacity
        if (toGroup.photos.length >= MAX_PHOTOS_PER_GROUP) {
          addError({
            type: 'max_photos_per_group',
            message: `Group already has maximum ${MAX_PHOTOS_PER_GROUP} photos`,
          });
          return prev;
        }

        const photoIndex = fromGroup.photos.findIndex((p) => p.id === photoId);
        if (photoIndex === -1) {
          addError({
            type: 'invalid_operation',
            message: 'Photo not found in source group',
          });
          return prev;
        }

        return prev.map((group) => {
          if (group.groupId === fromGroupId) {
            // Remove photo from source group
            const newPhotos = group.photos.filter((p) => p.id !== photoId);
            let newPrimaryIndex = group.primaryPhotoIndex;

            if (photoIndex === group.primaryPhotoIndex) {
              newPrimaryIndex = 0;
            } else if (photoIndex < group.primaryPhotoIndex) {
              newPrimaryIndex = group.primaryPhotoIndex - 1;
            }

            return {
              ...group,
              photos: newPhotos,
              primaryPhotoIndex: Math.min(newPrimaryIndex, newPhotos.length - 1),
            };
          } else if (group.groupId === toGroupId) {
            // Add photo to destination group
            const photo = fromGroup.photos[photoIndex];
            return {
              ...group,
              photos: [...group.photos, photo],
            };
          }
          return group;
        }).filter((g) => g.photos.length > 0); // Remove empty groups
      });
    },
    [addError, clearErrors]
  );

  // Set cover photo for a group
  const setCover = useCallback(
    (groupId: string, photoIndex: number) => {
      clearErrors();

      setGroups((prev) => {
        return prev.map((group) => {
          if (group.groupId !== groupId) return group;

          if (photoIndex < 0 || photoIndex >= group.photos.length) {
            addError({
              type: 'invalid_operation',
              message: 'Invalid photo index',
            });
            return group;
          }

          return {
            ...group,
            primaryPhotoIndex: photoIndex,
          };
        });
      });
    },
    [addError, clearErrors]
  );

  // Create empty group
  const createGroup = useCallback(() => {
    clearErrors();

    if (groups.length >= MAX_GROUPS) {
      addError({
        type: 'max_groups',
        message: `Maximum ${MAX_GROUPS} groups allowed`,
      });
      return;
    }

    setGroups((prev) => [
      ...prev,
      {
        groupId: uuidv4(),
        photos: [],
        primaryPhotoIndex: 0,
      },
    ]);
  }, [groups.length, addError, clearErrors]);

  // Remove entire group
  const removeGroup = useCallback(
    (groupId: string) => {
      clearErrors();
      setGroups((prev) => prev.filter((g) => g.groupId !== groupId));
    },
    [clearErrors]
  );

  return {
    groups,
    addPhotos,
    removePhoto,
    reorderPhotos,
    regroup,
    setCover,
    createGroup,
    removeGroup,
    errors,
    clearErrors,
    totalPhotos,
  };
}
