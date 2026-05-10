/**
 * File: p2p-kids-marketplace/src/components/__tests__/listing/PhotoUploadManager.test.tsx
 * MODULE-04 LISTING-V3-008: Unit tests for PhotoUploadManager
 *
 * Test Coverage:
 * - Rendering with 0, 1, 5, 10 photos
 * - Cover badge on first photo
 * - Add button visibility (< 10 photos)
 * - Remove photo functionality
 * - Max photos enforcement
 * - Accessibility labels
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PhotoUploadManager } from '../../listing/PhotoUploadManager';
import { PhotoAsset } from '../../../types/listing';

const mockPhotos: PhotoAsset[] = [
  { id: '1', uri: 'https://example.com/photo1.jpg', fileName: 'photo1.jpg', fileSize: 1024 },
  { id: '2', uri: 'https://example.com/photo2.jpg', fileName: 'photo2.jpg', fileSize: 2048 },
  { id: '3', uri: 'https://example.com/photo3.jpg', fileName: 'photo3.jpg', fileSize: 3072 },
];

describe('PhotoUploadManager', () => {
  const mockOnAddPhotos = jest.fn();
  const mockOnRemovePhoto = jest.fn();
  const mockOnReorder = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders with no photos', () => {
      const { getByTestId, getByText } = render(
        <PhotoUploadManager
          photos={[]}
          onAddPhotos={mockOnAddPhotos}
          onRemovePhoto={mockOnRemovePhoto}
          onReorder={mockOnReorder}
        />
      );

      expect(getByTestId('photo-upload-manager')).toBeTruthy();
      expect(getByText('Photos *')).toBeTruthy();
      expect(getByTestId('add-photos-button')).toBeTruthy();
      expect(getByTestId('camera-icon-photo-slot')).toBeTruthy();
    });

    it('renders with photos', () => {
      const { getAllByTestId } = render(
        <PhotoUploadManager
          photos={mockPhotos}
          onAddPhotos={mockOnAddPhotos}
          onRemovePhoto={mockOnRemovePhoto}
          onReorder={mockOnReorder}
        />
      );

      expect(getAllByTestId(/remove-photo-/).length).toBe(3);
    });

    it('displays (0/10 photos) count when empty', () => {
      const { getByText } = render(
        <PhotoUploadManager
          photos={[]}
          onAddPhotos={mockOnAddPhotos}
          onRemovePhoto={mockOnRemovePhoto}
          onReorder={mockOnReorder}
        />
      );

      expect(getByText('(0/10 photos)')).toBeTruthy();
    });

    it('displays correct count with photos', () => {
      const { getByText } = render(
        <PhotoUploadManager
          photos={mockPhotos}
          onAddPhotos={mockOnAddPhotos}
          onRemovePhoto={mockOnRemovePhoto}
          onReorder={mockOnReorder}
        />
      );

      expect(getByText('(3/10 photos)')).toBeTruthy();
    });

    it('renders at least one empty dashed slot while under max', () => {
      const { getByTestId } = render(
        <PhotoUploadManager
          photos={mockPhotos}
          onAddPhotos={mockOnAddPhotos}
          onRemovePhoto={mockOnRemovePhoto}
          onReorder={mockOnReorder}
        />
      );

      expect(getByTestId('add-photos-button')).toBeTruthy();
    });
  });

  describe('Cover Badge', () => {
    it('marks first photo as "Cover"', () => {
      const { getByText } = render(
        <PhotoUploadManager
          photos={mockPhotos}
          onAddPhotos={mockOnAddPhotos}
          onRemovePhoto={mockOnRemovePhoto}
          onReorder={mockOnReorder}
        />
      );

      expect(getByText('Cover')).toBeTruthy();
    });

    it('only shows Cover badge once', () => {
      const { getAllByText } = render(
        <PhotoUploadManager
          photos={mockPhotos}
          onAddPhotos={mockOnAddPhotos}
          onRemovePhoto={mockOnRemovePhoto}
          onReorder={mockOnReorder}
        />
      );

      const coverBadges = getAllByText('Cover');
      expect(coverBadges.length).toBe(1);
    });
  });

  describe('Add Photos', () => {
    it('shows Add Photos button when under limit', () => {
      const { getByTestId } = render(
        <PhotoUploadManager
          photos={mockPhotos}
          onAddPhotos={mockOnAddPhotos}
          onRemovePhoto={mockOnRemovePhoto}
          onReorder={mockOnReorder}
        />
      );

      expect(getByTestId('add-photos-button')).toBeTruthy();
    });

    it('calls onAddPhotos when Add button is pressed', () => {
      const { getByTestId } = render(
        <PhotoUploadManager
          photos={mockPhotos}
          onAddPhotos={mockOnAddPhotos}
          onRemovePhoto={mockOnRemovePhoto}
          onReorder={mockOnReorder}
        />
      );

      fireEvent.press(getByTestId('add-photos-button'));
      expect(mockOnAddPhotos).toHaveBeenCalledTimes(1);
    });

    it('hides Add Photos button when at max (10 photos)', () => {
      const tenPhotos: PhotoAsset[] = Array.from({ length: 10 }, (_, i) => ({
        id: String(i + 1),
        uri: `https://example.com/photo${i + 1}.jpg`,
        fileName: `photo${i + 1}.jpg`,
        fileSize: 1024,
      }));

      const { queryByTestId, getByText } = render(
        <PhotoUploadManager
          photos={tenPhotos}
          onAddPhotos={mockOnAddPhotos}
          onRemovePhoto={mockOnRemovePhoto}
          onReorder={mockOnReorder}
        />
      );

      expect(queryByTestId('add-photos-button')).toBeNull();
      expect(getByText('Maximum 10 photos reached')).toBeTruthy();
    });
  });

  describe('Remove Photos', () => {
    it('calls onRemovePhoto with correct photo ID', () => {
      const { getByTestId } = render(
        <PhotoUploadManager
          photos={mockPhotos}
          onAddPhotos={mockOnAddPhotos}
          onRemovePhoto={mockOnRemovePhoto}
          onReorder={mockOnReorder}
        />
      );

      fireEvent.press(getByTestId('remove-photo-1'));
      expect(mockOnRemovePhoto).toHaveBeenCalledWith('1');
    });

    it('shows remove button for all photos', () => {
      const { getByTestId } = render(
        <PhotoUploadManager
          photos={mockPhotos}
          onAddPhotos={mockOnAddPhotos}
          onRemovePhoto={mockOnRemovePhoto}
          onReorder={mockOnReorder}
        />
      );

      expect(getByTestId('remove-photo-1')).toBeTruthy();
      expect(getByTestId('remove-photo-2')).toBeTruthy();
      expect(getByTestId('remove-photo-3')).toBeTruthy();
    });
  });

  describe('Custom Max Photos', () => {
    it('respects custom maxPhotos prop', () => {
      const { getByText } = render(
        <PhotoUploadManager
          photos={mockPhotos}
          onAddPhotos={mockOnAddPhotos}
          onRemovePhoto={mockOnRemovePhoto}
          onReorder={mockOnReorder}
          maxPhotos={5}
        />
      );

      expect(getByText('(3/5 photos)')).toBeTruthy();
    });

    it('shows max limit message for custom max', () => {
      const fivePhotos: PhotoAsset[] = Array.from({ length: 5 }, (_, i) => ({
        id: String(i + 1),
        uri: `https://example.com/photo${i + 1}.jpg`,
        fileName: `photo${i + 1}.jpg`,
        fileSize: 1024,
      }));

      const { getByText } = render(
        <PhotoUploadManager
          photos={fivePhotos}
          onAddPhotos={mockOnAddPhotos}
          onRemovePhoto={mockOnRemovePhoto}
          onReorder={mockOnReorder}
          maxPhotos={5}
        />
      );

      expect(getByText('Maximum 5 photos reached')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('has accessible label for Add Photos button', () => {
      const { getByLabelText } = render(
        <PhotoUploadManager
          photos={mockPhotos}
          onAddPhotos={mockOnAddPhotos}
          onRemovePhoto={mockOnRemovePhoto}
          onReorder={mockOnReorder}
        />
      );

      expect(getByLabelText('Add photos')).toBeTruthy();
    });

    it('has accessible hints for photos remaining', () => {
      const { getByA11yHint } = render(
        <PhotoUploadManager
          photos={mockPhotos}
          onAddPhotos={mockOnAddPhotos}
          onRemovePhoto={mockOnRemovePhoto}
          onReorder={mockOnReorder}
        />
      );

      expect(getByA11yHint('You can add 7 more photos')).toBeTruthy();
    });

    it('has accessible labels for remove buttons', () => {
      const { getByLabelText } = render(
        <PhotoUploadManager
          photos={mockPhotos}
          onAddPhotos={mockOnAddPhotos}
          onRemovePhoto={mockOnRemovePhoto}
          onReorder={mockOnReorder}
        />
      );

      expect(getByLabelText('Remove photo 1')).toBeTruthy();
      expect(getByLabelText('Remove photo 2')).toBeTruthy();
      expect(getByLabelText('Remove photo 3')).toBeTruthy();
    });
  });

  describe('Custom testID', () => {
    it('uses custom testID when provided', () => {
      const { getByTestId } = render(
        <PhotoUploadManager
          photos={mockPhotos}
          onAddPhotos={mockOnAddPhotos}
          onRemovePhoto={mockOnRemovePhoto}
          onReorder={mockOnReorder}
          testID="custom-test-id"
        />
      );

      expect(getByTestId('custom-test-id')).toBeTruthy();
    });
  });
});
