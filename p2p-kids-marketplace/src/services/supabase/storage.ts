import { supabase } from './client';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';

export type StorageBucket = 'item-images' | 'chat-images' | 'user-avatars';

export interface UploadResult {
  url: string | null;
  cdnUrl?: string | null;
  path: string | null;
  error: Error | null;
}

/**
 * Reads an image file URI and converts it to ArrayBuffer for React Native uploads.
 * Falls back to image normalization when direct file reading fails on Android.
 */
const readImageAsArrayBuffer = async (
  fileUri: string,
  path: string
): Promise<{ data: ArrayBuffer; contentType: string }> => {
  if (fileUri.startsWith('data:')) {
    const dataUriMatch = fileUri.match(/^data:([^;]+);base64,(.+)$/);
    if (!dataUriMatch) {
      throw new Error('Invalid data URI image format');
    }

    return {
      data: decode(dataUriMatch[2]),
      contentType: dataUriMatch[1],
    };
  }

  try {
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return {
      data: decode(base64),
      contentType: detectContentType(fileUri, path),
    };
  } catch (readError) {
    console.warn(
      '[storage] Direct file read failed, falling back to image normalization:',
      readError
    );

    const manipulated = await ImageManipulator.manipulateAsync(fileUri, [], {
      compress: 0.85,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });

    if (!manipulated.base64) {
      throw new Error('Unable to read image data for upload (missing base64)');
    }

    return {
      data: decode(manipulated.base64),
      contentType: 'image/jpeg',
    };
  }
};

const detectContentType = (fileUri: string, path: string): string => {
  const lower = `${fileUri} ${path}`.toLowerCase();
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  if (lower.includes('.gif')) return 'image/gif';
  return 'image/jpeg';
};

/**
 * Uploads a single image to Supabase Storage from an image URI.
 * Note: In React Native we upload ArrayBuffer and retry transient network failures.
 */
export const uploadImage = async (
  bucket: StorageBucket,
  path: string,
  fileUri: string,
  options?: { upsert?: boolean }
): Promise<UploadResult> => {
  try {
    console.log(
      `[storage] 📤 Converting file URI to upload buffer: ${fileUri.substring(0, 70)}...`
    );

    const { data: fileData, contentType } = await readImageAsArrayBuffer(fileUri, path);

    console.log(
      `[storage] ✅ Upload buffer created, bytes: ${fileData.byteLength}, contentType: ${contentType}`
    );
    console.log(`[storage] 📤 Uploading to ${bucket}/${path}...`);

    const maxAttempts = 3;
    let data: { path: string } | null = null;
    let error: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const uploadResult = await supabase.storage.from(bucket).upload(path, fileData, {
        cacheControl: '3600',
        upsert: options?.upsert ?? false,
        contentType,
      });

      data = uploadResult.data;
      error = (uploadResult.error as Error | null) ?? null;

      if (!error) {
        break;
      }

      const message = error.message?.toLowerCase() ?? '';
      const isTransient =
        message.includes('network request failed') || message.includes('fetch failed');

      console.warn(
        `[storage] ⚠️ Upload attempt ${attempt}/${maxAttempts} failed: ${error.message}`
      );

      if (!isTransient || attempt === maxAttempts) {
        console.error('[storage] ❌ Upload failed (final):', error);
        return { url: null, path: null, error };
      }

      const waitMs = attempt * 600;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    if (!data) {
      return {
        url: null,
        path: null,
        error: error ?? new Error('Upload failed: no storage path returned'),
      };
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
    const cdnUrl = getCdnUrl(bucket, data.path);

    console.log(`[storage] ✅ Upload successful, public URL: ${urlData.publicUrl}`);

    return { url: urlData.publicUrl, cdnUrl, path: data.path, error: null };
  } catch (e: any) {
    console.error('[storage] ❌ uploadImage error:', e);
    return { url: null, path: null, error: e as Error };
  }
};

export const uploadMultipleImages = async (
  bucket: StorageBucket,
  files: { path: string; fileUri: string }[]
): Promise<UploadResult[]> => {
  const promises = files.map(({ path, fileUri }) =>
    uploadImage(bucket, path, fileUri, { upsert: true })
  );
  return Promise.all(promises);
};

export const deleteImage = async (
  bucket: StorageBucket,
  path: string
): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    // Purge CDN cache if configured
    try {
      const purgeEndpoint = process.env.SUPABASE_PURGE_ENDPOINT;
      const purgeKey = process.env.SUPABASE_PURGE_X_API_KEY;
      if (purgeEndpoint && purgeKey) {
        const cdnUrl = getCdnUrl(bucket, path);
        const targetUrl = cdnUrl ?? getPublicUrl(bucket, path) ?? '';
        if (targetUrl) {
          await fetch(purgeEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': purgeKey },
            body: JSON.stringify({ urls: [targetUrl] }),
          });
        }
      }
    } catch (e) {
      // Log but don't fail deletion flow
      console.warn('Cache purge failed', e);
    }
    return { error: error ?? null };
  } catch (e: any) {
    return { error: e as Error };
  }
};

export const deleteMultipleImages = async (
  bucket: StorageBucket,
  paths: string[]
): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    // Purge CDN cache if configured
    try {
      const purgeEndpoint = process.env.SUPABASE_PURGE_ENDPOINT;
      const purgeKey = process.env.SUPABASE_PURGE_X_API_KEY;
      if (purgeEndpoint && purgeKey) {
        const urlsToPurge = paths
          .map((p) => getCdnUrl(bucket, p) ?? getPublicUrl(bucket, p))
          .filter(Boolean) as string[];
        if (urlsToPurge.length) {
          await fetch(purgeEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': purgeKey },
            body: JSON.stringify({ urls: urlsToPurge }),
          });
        }
      }
    } catch (e) {
      console.warn('Cache purge failed', e);
    }
    return { error: error ?? null };
  } catch (e: any) {
    return { error: e as Error };
  }
};

export const getPublicUrl = (bucket: StorageBucket, path: string): string | null => {
  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl ?? null;
  } catch {
    return null;
  }
};

/**
 * Returns a CDN proxied URL for a Supabase public URL when `EXPO_PUBLIC_CDN_URL` is set.
 * If the CDN env is not configured, returns the original public URL.
 */
export const getCdnUrl = (bucket: StorageBucket, path: string): string | null => {
  const publicUrl = getPublicUrl(bucket, path);
  if (!publicUrl) return null;

  const cdn = process.env.EXPO_PUBLIC_CDN_URL;
  if (!cdn) return publicUrl;

  try {
    const u = new URL(publicUrl);
    // find the suffix after /storage/v1/object/public
    const idx = u.pathname.indexOf('/storage/v1/object/public');
    if (idx === -1) return publicUrl;
    const suffix = u.pathname.substring(idx + '/storage/v1/object/public'.length);
    // ensure suffix starts with '/'
    const pathSuffix = suffix.startsWith('/') ? suffix : `/${suffix}`;
    return `${cdn}${pathSuffix}`;
  } catch {
    return publicUrl;
  }
};

export const listFiles = async ($bucket: StorageBucket, path?: string) => {
  try {
    const { data, error } = await supabase.storage.from($bucket).list(path ?? '', { limit: 100 });
    return { files: data ?? null, error: error ?? null };
  } catch (e: any) {
    return { files: null, error: e as Error };
  }
};
