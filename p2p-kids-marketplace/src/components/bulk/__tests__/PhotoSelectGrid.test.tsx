/**
 * File: p2p-kids-marketplace/src/components/bulk/__tests__/PhotoSelectGrid.test.tsx
 * Component tests for PhotoSelectGrid — the K02 reorder affordance (arrow
 * buttons to move a photo within the same item's group).
 *
 * The wiring-level cover correctness (cover follows the moved photo) is
 * exercised end-to-end in the screen test
 * (src/screens/__tests__/BulkListingCreateScreen.test.tsx) and by the
 * existing reorderPhotoInGroup unit tests
 * (src/services/__tests__/photoService.merge-split.test.ts).
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PhotoSelectGrid } from '../PhotoSelectGrid';
import { PhotoAsset, PhotoGroup } from '../../../types/listing';

function makePhoto(id: string): PhotoAsset {
  return { id, uri: `file:///dev/${id}.jpg`, width: 100, height: 100 };
}

function makeGroup(photos: PhotoAsset[], primary = 0, groupId = 'g1'): PhotoGroup {
  return { groupId, photos, primaryPhotoIndex: primary };
}

const baseProps = {
  selectedPhotoIds: [] as string[],
  duplicatePhotoIds: [],
  onTogglePhotoSelection: jest.fn(),
  onLongPressPhoto: jest.fn(),
  onSetCover: jest.fn(),
  onReorderPhoto: jest.fn(),
  onDeletePhoto: jest.fn(),
  onDeleteGroup: jest.fn(),
  onSplitGroup: jest.fn(),
  onAddPhotosToGroup: jest.fn(),
};

function renderGrid(groups: PhotoGroup[], overrides: Partial<typeof baseProps> = {}) {
  return render(<PhotoSelectGrid groups={groups} {...baseProps} {...overrides} />);
}

describe('PhotoSelectGrid reorder (K02)', () => {
  const threePhotos = [makePhoto('p1'), makePhoto('p2'), makePhoto('p3')];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls onReorderPhoto with swapped indices when a move-right arrow is pressed', () => {
    const onReorderPhoto = jest.fn();
    const { getByTestId } = renderGrid([makeGroup(threePhotos)], { onReorderPhoto });

    fireEvent.press(getByTestId('photo-tile-0-0-move-right'));

    expect(onReorderPhoto).toHaveBeenCalledWith('g1', 0, 1);
  });

  it('calls onReorderPhoto with swapped indices when a move-left arrow is pressed', () => {
    const onReorderPhoto = jest.fn();
    const { getByTestId } = renderGrid([makeGroup(threePhotos)], { onReorderPhoto });

    fireEvent.press(getByTestId('photo-tile-0-2-move-left'));

    expect(onReorderPhoto).toHaveBeenCalledWith('g1', 2, 1);
  });

  it('does not render a move-left arrow on the first photo or a move-right arrow on the last', () => {
    const { queryByTestId } = renderGrid([makeGroup(threePhotos)]);

    expect(queryByTestId('photo-tile-0-0-move-left')).toBeNull();
    expect(queryByTestId('photo-tile-0-2-move-right')).toBeNull();
    // Middle photo can move both ways.
    expect(queryByTestId('photo-tile-0-1-move-left')).toBeTruthy();
    expect(queryByTestId('photo-tile-0-1-move-right')).toBeTruthy();
  });

  it('hides reorder arrows while in selection mode so selection stays unambiguous', () => {
    const { queryByTestId } = renderGrid([makeGroup(threePhotos)], {
      selectedPhotoIds: ['p2'],
    });

    expect(queryByTestId('photo-tile-0-0-move-right')).toBeNull();
    expect(queryByTestId('photo-tile-0-1-move-left')).toBeNull();
  });
});
