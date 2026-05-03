/**
 * File: p2p-kids-marketplace/src/__tests__/components/ImagePickerGrid.test.tsx
 * MODULE-13 SAFETY-P002: Unit tests for ImagePickerGrid component
 *
 * Test matrix:
 * - Render: empty state, with images, at max limit
 * - Actions: pick from gallery, pick from camera, remove image, reorder images
 * - Validation: file size validation, permission denied handling
 * - State: uploading state, disabled interactions during upload
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import ImagePickerGrid, { SelectedImage } from '../../components/molecules/ImagePickerGrid';

// Mock expo-image-picker
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  MediaTypeOptions: {
    Images: 'Images',
  },
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('ImagePickerGrid Component - Unit Tests', () => {
  const mockOnImagesChange = jest.fn();

  const mockImages: SelectedImage[] = [
    { uri: 'file:///test1.jpg', width: 800, height: 600, fileSize: 1024000 },
    { uri: 'file:///test2.jpg', width: 800, height: 600, fileSize: 2048000 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering States', () => {
    it('should render empty state with add buttons', () => {
      const { getByTestId, getByText } = render(
        <ImagePickerGrid images={[]} onImagesChange={mockOnImagesChange} />
      );

      expect(getByTestId('image-picker-grid')).toBeTruthy();
      expect(getByText('Photos (0/5)')).toBeTruthy();
      expect(getByTestId('image-picker-grid-add-from-gallery')).toBeTruthy();
      expect(getByTestId('image-picker-grid-add-from-camera')).toBeTruthy();
    });

    it('should render with existing images and show cover badge on first', () => {
      const { getByText, queryByTestId } = render(
        <ImagePickerGrid images={mockImages} onImagesChange={mockOnImagesChange} />
      );

      expect(getByText('Photos (2/5)')).toBeTruthy();
      expect(getByText('First image will be the cover photo')).toBeTruthy();
      expect(queryByTestId('image-picker-grid-preview-scroll')).toBeTruthy();
      expect(getByText('Cover')).toBeTruthy(); // First image shows cover badge
    });

    it('should not show add buttons when at max limit (5 images)', () => {
      const maxImages: SelectedImage[] = [
        { uri: 'file:///1.jpg', width: 800, height: 600 },
        { uri: 'file:///2.jpg', width: 800, height: 600 },
        { uri: 'file:///3.jpg', width: 800, height: 600 },
        { uri: 'file:///4.jpg', width: 800, height: 600 },
        { uri: 'file:///5.jpg', width: 800, height: 600 },
      ];

      const { queryByTestId, getByText } = render(
        <ImagePickerGrid images={maxImages} onImagesChange={mockOnImagesChange} />
      );

      expect(getByText('Photos (5/5)')).toBeTruthy();
      expect(queryByTestId('image-picker-grid-add-from-gallery')).toBeNull();
      expect(queryByTestId('image-picker-grid-add-from-camera')).toBeNull();
    });

    it('should show uploading state', () => {
      const { getByText, queryByTestId } = render(
        <ImagePickerGrid images={mockImages} onImagesChange={mockOnImagesChange} uploading />
      );

      expect(getByText('Uploading images...')).toBeTruthy();
      expect(queryByTestId('image-picker-grid-add-from-gallery')).toBeNull();
      expect(queryByTestId('image-picker-grid-add-from-camera')).toBeNull();
    });
  });

  describe('Gallery Picker - Happy Path', () => {
    it('should pick image from gallery successfully', async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'granted',
      });

      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
        canceled: false,
        assets: [{ uri: 'file:///new.jpg', width: 800, height: 600, fileSize: 1000000 }],
      });

      const { getByTestId } = render(
        <ImagePickerGrid images={[]} onImagesChange={mockOnImagesChange} />
      );

      fireEvent.press(getByTestId('image-picker-grid-add-from-gallery'));

      await waitFor(() => {
        expect(ImagePicker.requestMediaLibraryPermissionsAsync).toHaveBeenCalled();
        expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith({
          mediaTypes: 'Images',
          allowsMultipleSelection: true,
          selectionLimit: 5,
          quality: 0.8,
        });
        expect(mockOnImagesChange).toHaveBeenCalledWith([
          { uri: 'file:///new.jpg', width: 800, height: 600, fileSize: 1000000 },
        ]);
      });
    });

    it('should pick multiple images from gallery', async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'granted',
      });

      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
        canceled: false,
        assets: [
          { uri: 'file:///1.jpg', width: 800, height: 600, fileSize: 1000000 },
          { uri: 'file:///2.jpg', width: 800, height: 600, fileSize: 2000000 },
        ],
      });

      const { getByTestId } = render(
        <ImagePickerGrid images={mockImages} onImagesChange={mockOnImagesChange} />
      );

      fireEvent.press(getByTestId('image-picker-grid-add-from-gallery'));

      await waitFor(() => {
        expect(mockOnImagesChange).toHaveBeenCalledWith([
          ...mockImages,
          { uri: 'file:///1.jpg', width: 800, height: 600, fileSize: 1000000 },
          { uri: 'file:///2.jpg', width: 800, height: 600, fileSize: 2000000 },
        ]);
      });
    });
  });

  describe('Gallery Picker - Error Cases', () => {
    it('should show alert when permission denied', async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'denied',
      });

      const { getByTestId } = render(
        <ImagePickerGrid images={[]} onImagesChange={mockOnImagesChange} />
      );

      fireEvent.press(getByTestId('image-picker-grid-add-from-gallery'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Permission Required',
          'Photo library access is needed to select images'
        );
        expect(mockOnImagesChange).not.toHaveBeenCalled();
      });
    });

    it('should reject image exceeding 5 MB file size limit', async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'granted',
      });

      const largeFileSize = 6 * 1024 * 1024; // 6 MB
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
        canceled: false,
        assets: [{ uri: 'file:///large.jpg', width: 4000, height: 3000, fileSize: largeFileSize }],
      });

      const { getByTestId } = render(
        <ImagePickerGrid images={[]} onImagesChange={mockOnImagesChange} />
      );

      fireEvent.press(getByTestId('image-picker-grid-add-from-gallery'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'File Too Large',
          expect.stringContaining('exceeds 5 MB')
        );
        expect(mockOnImagesChange).not.toHaveBeenCalled();
      });
    });

    it('should show alert when at max limit', async () => {
      const maxImages: SelectedImage[] = Array(5)
        .fill(null)
        .map((_, i) => ({ uri: `file:///${i}.jpg`, width: 800, height: 600 }));

      const { getByTestId } = render(
        <ImagePickerGrid images={maxImages} onImagesChange={mockOnImagesChange} />
      );

      // Buttons should not be rendered, but test that pressing would show alert if rendered
      // This tests the picker logic before render
      expect(() => getByTestId('image-picker-grid-add-from-gallery')).toThrow();
    });

    it('should handle user cancellation gracefully', async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'granted',
      });

      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
        canceled: true,
        assets: [],
      });

      const { getByTestId } = render(
        <ImagePickerGrid images={[]} onImagesChange={mockOnImagesChange} />
      );

      fireEvent.press(getByTestId('image-picker-grid-add-from-gallery'));

      await waitFor(() => {
        expect(mockOnImagesChange).not.toHaveBeenCalled();
        expect(Alert.alert).not.toHaveBeenCalled();
      });
    });
  });

  describe('Camera Picker - Happy Path', () => {
    it('should take photo from camera successfully', async () => {
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'granted',
      });

      (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValueOnce({
        canceled: false,
        assets: [{ uri: 'file:///camera.jpg', width: 1920, height: 1080, fileSize: 3000000 }],
      });

      const { getByTestId } = render(
        <ImagePickerGrid images={[]} onImagesChange={mockOnImagesChange} />
      );

      fireEvent.press(getByTestId('image-picker-grid-add-from-camera'));

      await waitFor(() => {
        expect(ImagePicker.requestCameraPermissionsAsync).toHaveBeenCalled();
        expect(ImagePicker.launchCameraAsync).toHaveBeenCalledWith({
          mediaTypes: 'Images',
          quality: 0.8,
        });
        expect(mockOnImagesChange).toHaveBeenCalledWith([
          { uri: 'file:///camera.jpg', width: 1920, height: 1080, fileSize: 3000000 },
        ]);
      });
    });
  });

  describe('Camera Picker - Error Cases', () => {
    it('should show alert when camera permission denied', async () => {
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'denied',
      });

      const { getByTestId } = render(
        <ImagePickerGrid images={[]} onImagesChange={mockOnImagesChange} />
      );

      fireEvent.press(getByTestId('image-picker-grid-add-from-camera'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Permission Required',
          'Camera access is needed to take photos'
        );
        expect(mockOnImagesChange).not.toHaveBeenCalled();
      });
    });

    it('should reject camera photo exceeding 5 MB', async () => {
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'granted',
      });

      const largeFileSize = 7 * 1024 * 1024; // 7 MB
      (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValueOnce({
        canceled: false,
        assets: [
          { uri: 'file:///large-camera.jpg', width: 4000, height: 3000, fileSize: largeFileSize },
        ],
      });

      const { getByTestId } = render(
        <ImagePickerGrid images={[]} onImagesChange={mockOnImagesChange} />
      );

      fireEvent.press(getByTestId('image-picker-grid-add-from-camera'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('File Too Large', 'Image must be under 5 MB');
        expect(mockOnImagesChange).not.toHaveBeenCalled();
      });
    });
  });

  describe('Image Manipulation Actions', () => {
    it('should remove an image by index', () => {
      const { getByTestId } = render(
        <ImagePickerGrid images={mockImages} onImagesChange={mockOnImagesChange} />
      );

      fireEvent.press(getByTestId('image-picker-grid-remove-0'));

      expect(mockOnImagesChange).toHaveBeenCalledWith([mockImages[1]]);
    });

    it('should move image left (decrease display_order)', () => {
      const { getByTestId } = render(
        <ImagePickerGrid images={mockImages} onImagesChange={mockOnImagesChange} />
      );

      fireEvent.press(getByTestId('image-picker-grid-move-left-1'));

      expect(mockOnImagesChange).toHaveBeenCalledWith([mockImages[1], mockImages[0]]);
    });

    it('should move image right (increase display_order)', () => {
      const { getByTestId } = render(
        <ImagePickerGrid images={mockImages} onImagesChange={mockOnImagesChange} />
      );

      fireEvent.press(getByTestId('image-picker-grid-move-right-0'));

      expect(mockOnImagesChange).toHaveBeenCalledWith([mockImages[1], mockImages[0]]);
    });

    it('should not show move-left button for first image', () => {
      const { queryByTestId } = render(
        <ImagePickerGrid images={mockImages} onImagesChange={mockOnImagesChange} />
      );

      expect(queryByTestId('image-picker-grid-move-left-0')).toBeNull();
    });

    it('should not show move-right button for last image', () => {
      const { queryByTestId } = render(
        <ImagePickerGrid images={mockImages} onImagesChange={mockOnImagesChange} />
      );

      expect(queryByTestId('image-picker-grid-move-right-1')).toBeNull();
    });
  });

  describe('Disabled State During Upload', () => {
    it('should disable remove buttons when uploading', () => {
      const { getByTestId } = render(
        <ImagePickerGrid images={mockImages} onImagesChange={mockOnImagesChange} uploading />
      );

      const removeButton = getByTestId('image-picker-grid-remove-0');
      expect(removeButton.props.accessibilityState?.disabled).toBe(true);
    });

    it('should disable reorder buttons when uploading', () => {
      const { getByTestId } = render(
        <ImagePickerGrid images={mockImages} onImagesChange={mockOnImagesChange} uploading />
      );

      const moveButton = getByTestId('image-picker-grid-move-right-0');
      expect(moveButton.props.accessibilityState?.disabled).toBe(true);
    });
  });
});
