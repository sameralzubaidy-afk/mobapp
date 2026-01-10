// @jest-environment jsdom

import {
  compressImage,
  uploadChatImage,
  sendImageMessage,
} from '../chat';
import { supabase } from '../../config/supabase';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';

// Mock dependencies
jest.mock('../../config/supabase', () => ({
  supabase: {
    storage: {
      from: jest.fn(),
    },
    from: jest.fn(),
  },
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: {
    JPEG: 'jpeg',
  },
}));

jest.mock('base64-arraybuffer', () => ({
  decode: jest.fn(),
}));

describe('Chat Image Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (decode as jest.Mock).mockReturnValue(new ArrayBuffer(8));
  });

  describe('compressImage', () => {
    it('should successfully compress an image', async () => {
      const mockResult = {
        uri: 'compressed-image-uri',
        base64: 'base64-data',
        width: 800,
        height: 600,
      };

      (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValueOnce(mockResult);

      const result = await compressImage('original-image-uri');

      expect(result.success).toBe(true);
      expect(result.uri).toBe(mockResult.uri);
      expect(result.base64).toBe(mockResult.base64);
      expect(result.width).toBe(mockResult.width);
      expect(result.height).toBe(mockResult.height);

      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        'original-image-uri',
        [{ resize: { width: 1200 } }],
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );
    });

    it('should handle compression failure', async () => {
      const error = new Error('Compression failed');
      (ImageManipulator.manipulateAsync as jest.Mock).mockRejectedValueOnce(error);

      const result = await compressImage('original-image-uri');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Compression failed');
    });

    it('should handle missing base64 result', async () => {
      const mockResult = {
        uri: 'compressed-image-uri',
        base64: null, // Missing base64
        width: 800,
        height: 600,
      };

      (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValueOnce(mockResult);

      const result = await compressImage('original-image-uri');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to generate base64 from compressed image');
    });
  });

  describe('uploadChatImage', () => {
    it('should successfully upload an image', async () => {
      const mockUploadData = { path: 'upload-path' };
      const mockPublicUrl = 'https://example.com/image.jpg';

      const mockStorageFrom = {
        upload: jest.fn().mockResolvedValueOnce({ data: mockUploadData, error: null }),
        getPublicUrl: jest.fn().mockReturnValueOnce({ data: { publicUrl: mockPublicUrl } }),
      };

      (supabase.storage.from as jest.Mock).mockReturnValue(mockStorageFrom);

      const result = await uploadChatImage('trade-123', 'user-456', 'base64-data');

      expect(result.success).toBe(true);
      expect(result.publicUrl).toBe(mockPublicUrl);

      expect(supabase.storage.from).toHaveBeenCalledWith('chat-images');
      expect(mockStorageFrom.upload).toHaveBeenCalledWith(
        expect.stringMatching(/^trade-123\/user-456-\d+-[a-z0-9]+\.jpg$/),
        expect.any(ArrayBuffer),
        {
          contentType: 'image/jpeg',
          upsert: false,
        }
      );
    });

    it('should handle upload failure', async () => {
      const mockError = { message: 'Upload failed' };
      const mockStorageFrom = {
        upload: jest.fn().mockResolvedValueOnce({ data: null, error: mockError }),
        getPublicUrl: jest.fn(),
      };

      (supabase.storage.from as jest.Mock).mockReturnValue(mockStorageFrom);

      const result = await uploadChatImage('trade-123', 'user-456', 'base64-data');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Upload failed');
    });

    it('should validate required parameters', async () => {
      const result = await uploadChatImage('', '', '');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required fields: tradeId, senderId, or base64Data');
    });
  });

  describe('sendImageMessage', () => {
    it('should validate required fields', async () => {
      const result = await sendImageMessage({
        tradeId: '',
        senderId: 'user-123',
        imageUri: 'image-uri',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required fields: tradeId, senderId, or imageUri');
    });

    it('should handle compression failure in sendImageMessage', async () => {
      // Mock compression failure
      (ImageManipulator.manipulateAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Compression failed')
      );

      const result = await sendImageMessage({
        tradeId: 'trade-123',
        senderId: 'user-456',
        imageUri: 'image-uri',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Compression failed');
    });

    it('should handle upload failure in sendImageMessage', async () => {
      // Mock successful compression
      (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValueOnce({
        uri: 'compressed-uri',
        base64: 'base64-data',
        width: 800,
        height: 600,
      });

      // Mock upload failure
      const mockStorageFrom = {
        upload: jest.fn().mockResolvedValueOnce({ 
          data: null, 
          error: { message: 'Upload failed' } 
        }),
        getPublicUrl: jest.fn(),
      };
      (supabase.storage.from as jest.Mock).mockReturnValue(mockStorageFrom);

      const result = await sendImageMessage({
        tradeId: 'trade-123',
        senderId: 'user-456',
        imageUri: 'image-uri',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Upload failed');
    });

    it('should successfully send image message', async () => {
      // Mock successful compression
      (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValueOnce({
        uri: 'compressed-uri',
        base64: 'base64-data',
        width: 800,
        height: 600,
      });

      // Mock successful upload
      const mockPublicUrl = 'https://example.com/image.jpg';
      const mockStorageFrom = {
        upload: jest.fn().mockResolvedValueOnce({ 
          data: { path: 'upload-path' }, 
          error: null 
        }),
        getPublicUrl: jest.fn().mockReturnValueOnce({ 
          data: { publicUrl: mockPublicUrl } 
        }),
      };
      (supabase.storage.from as jest.Mock).mockReturnValue(mockStorageFrom);

      // Mock successful database insert
      const mockMessageData = {
        id: 'message-123',
        trade_id: 'trade-123',
        sender_id: 'user-456',
        content: 'Image',
        message_type: 'image',
        image_url: mockPublicUrl,
        created_at: new Date().toISOString(),
      };

      const mockSupabaseFrom = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({ 
          data: mockMessageData, 
          error: null 
        }),
      };
      (supabase.from as jest.Mock).mockReturnValue(mockSupabaseFrom);

      const result = await sendImageMessage({
        tradeId: 'trade-123',
        senderId: 'user-456',
        imageUri: 'image-uri',
      });

      expect(result.success).toBe(true);
      expect(result.message).toEqual(mockMessageData);

      // Verify database insert was called correctly
      expect(mockSupabaseFrom.insert).toHaveBeenCalledWith({
        trade_id: 'trade-123',
        sender_id: 'user-456',
        content: 'Image',
        message_type: 'image',
        image_url: mockPublicUrl,
      });
    });
  });
});
