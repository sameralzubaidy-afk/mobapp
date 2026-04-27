/**
 * Unit tests for photoService merge/split/manipulation helpers
 * (LISTING-V3-006 V3.1 — Decisions 1, 4, 6, 7, 10).
 */
import {
  mergeGroups,
  splitGroup,
  addEmptyGroup,
  removeGroup,
  removePhotoFromGroups,
  appendPhotosAsGroups,
  addPhotosToGroup,
  reorderPhotoInGroup,
  PHOTO_LIMITS,
} from '../photoService';
import type { PhotoAsset, PhotoGroup } from '../../types/listing';

function makePhoto(id: string): PhotoAsset {
  return { id, uri: `file://${id}.jpg`, width: 100, height: 100 };
}

function makeGroup(id: string, photoIds: string[], primary = 0): PhotoGroup {
  return {
    groupId: id,
    photos: photoIds.map(makePhoto),
    primaryPhotoIndex: primary,
  };
}

describe('mergeGroups', () => {
  it('returns input unchanged when fewer than 2 source ids', () => {
    const groups = [makeGroup('a', ['p1'])];
    expect(mergeGroups(groups, ['a'])).toEqual({ groups, overflow: 0 });
  });

  it('merges two groups into one with combined photos', () => {
    const groups = [makeGroup('a', ['p1', 'p2']), makeGroup('b', ['p3'])];
    const result = mergeGroups(groups, ['a', 'b']);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].photos.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
    expect(result.overflow).toBe(0);
  });

  it('caps at MAX_PHOTOS_PER_GROUP and reports overflow', () => {
    const cap = PHOTO_LIMITS.MAX_PHOTOS_PER_GROUP;
    const groups = [
      makeGroup(
        'a',
        Array.from({ length: cap }, (_, i) => `p${i}`)
      ),
      makeGroup('b', ['extra1', 'extra2']),
    ];
    const result = mergeGroups(groups, ['a', 'b']);
    expect(result.groups[0].photos).toHaveLength(cap);
    expect(result.overflow).toBe(2);
  });

  it('generates unique merged group ids across consecutive merges', () => {
    const firstGroups = [makeGroup('a', ['p1']), makeGroup('b', ['p2'])];
    const secondGroups = [makeGroup('c', ['p3']), makeGroup('d', ['p4'])];

    const first = mergeGroups(firstGroups, ['a', 'b']);
    const second = mergeGroups(secondGroups, ['c', 'd']);

    expect(first.groups[0].groupId).not.toBe(second.groups[0].groupId);
  });
});

describe('splitGroup', () => {
  it('splits a 3-photo group into three 1-photo groups', () => {
    const groups = [makeGroup('a', ['p1', 'p2', 'p3'])];
    const result = splitGroup(groups, 'a');
    expect(result).toHaveLength(3);
    expect(result.every((g) => g.photos.length === 1)).toBe(true);
  });

  it('does nothing when group has 1 photo', () => {
    const groups = [makeGroup('a', ['p1'])];
    expect(splitGroup(groups, 'a')).toEqual(groups);
  });

  it('respects MAX_GROUPS cap', () => {
    const cap = PHOTO_LIMITS.MAX_GROUPS;
    const filler: PhotoGroup[] = Array.from({ length: cap - 1 }, (_, i) =>
      makeGroup(`fill_${i}`, [`fp${i}`])
    );
    const target = makeGroup('big', ['p1', 'p2', 'p3']);
    const groups = [...filler, target];
    const result = splitGroup(groups, 'big');
    expect(result.length).toBeLessThanOrEqual(cap + 1);
  });
});

describe('removePhotoFromGroups', () => {
  it('removes the photo from its group', () => {
    const groups = [makeGroup('a', ['p1', 'p2'])];
    const result = removePhotoFromGroups(groups, 'p1');
    expect(result[0].photos.map((p) => p.id)).toEqual(['p2']);
  });

  it('drops the group when its last photo is removed', () => {
    const groups = [makeGroup('a', ['p1']), makeGroup('b', ['p2'])];
    const result = removePhotoFromGroups(groups, 'p1');
    expect(result).toHaveLength(1);
    expect(result[0].groupId).toBe('b');
  });

  it('clamps primaryPhotoIndex when removed photo was the cover', () => {
    const groups = [makeGroup('a', ['p1', 'p2', 'p3'], 2)];
    const result = removePhotoFromGroups(groups, 'p3');
    expect(result[0].primaryPhotoIndex).toBe(1);
  });
});

describe('appendPhotosAsGroups + addPhotosToGroup', () => {
  it('appends each new photo as its own group', () => {
    const groups = [makeGroup('a', ['p1'])];
    const result = appendPhotosAsGroups(groups, [makePhoto('p2'), makePhoto('p3')]);
    expect(result).toHaveLength(3);
    expect(result.slice(1).every((g) => g.photos.length === 1)).toBe(true);
  });

  it('addPhotosToGroup respects MAX_PHOTOS_PER_GROUP', () => {
    const cap = PHOTO_LIMITS.MAX_PHOTOS_PER_GROUP;
    const groups = [
      makeGroup(
        'a',
        Array.from({ length: cap }, (_, i) => `p${i}`)
      ),
    ];
    const result = addPhotosToGroup(groups, 'a', [makePhoto('extra')]);
    expect(result[0].photos).toHaveLength(cap);
  });
});

describe('addEmptyGroup / removeGroup', () => {
  it('addEmptyGroup creates a group with no photos', () => {
    const groups: PhotoGroup[] = [];
    const result = addEmptyGroup(groups);
    expect(result).toHaveLength(1);
    expect(result[0].photos).toHaveLength(0);
  });

  it('removeGroup deletes by id', () => {
    const groups = [makeGroup('a', ['p1']), makeGroup('b', ['p2'])];
    const result = removeGroup(groups, 'a');
    expect(result).toHaveLength(1);
    expect(result[0].groupId).toBe('b');
  });
});

describe('reorderPhotoInGroup', () => {
  it('moves photo from index to new index', () => {
    const groups = [makeGroup('a', ['p1', 'p2', 'p3'])];
    const result = reorderPhotoInGroup(groups, 'a', 0, 2);
    expect(result[0].photos.map((p) => p.id)).toEqual(['p2', 'p3', 'p1']);
  });

  it('updates primaryPhotoIndex when cover is moved', () => {
    const groups = [makeGroup('a', ['p1', 'p2', 'p3'], 0)];
    const result = reorderPhotoInGroup(groups, 'a', 0, 2);
    expect(result[0].primaryPhotoIndex).toBe(2);
  });

  it('returns input unchanged when indices invalid', () => {
    const groups = [makeGroup('a', ['p1', 'p2'])];
    expect(reorderPhotoInGroup(groups, 'a', 0, 0)).toEqual(groups);
    expect(reorderPhotoInGroup(groups, 'a', 5, 0)).toEqual(groups);
  });
});
