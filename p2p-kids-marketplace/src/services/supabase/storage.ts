import { supabase } from './client';

export type StorageBucket = 'item-images' | 'chat-images' | 'user-avatars';

export interface UploadResult {
  url: string | null;
  path: string | null;
  error: Error | null;
}

/**
 * Uploads a single image to Supabase Storage from an image URI.
 * Note: In React Native we can fetch the file as a blob and upload.
 */
export const uploadImage = async (
  bucket: StorageBucket,
  path: string,
  fileUri: string,
  options?: { upsert?: boolean }
): Promise<UploadResult> => {
  try {
    // Load file
    const resp = await fetch(fileUri);
    const blob = await resp.blob();

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, blob, { cacheControl: '3600', upsert: options?.upsert ?? false });

    if (error) return { url: null, path: null, error };

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return { url: urlData.publicUrl, path: data.path, error: null };
  } catch (e: any) {
    return { url: null, path: null, error: e as Error };
  }
};

export const uploadMultipleImages = async (
  bucket: StorageBucket,
  files: Array<{ path: string; fileUri: string }>
): Promise<UploadResult[]> => {
  const promises = files.map(({ path, fileUri }) => uploadImage(bucket, path, fileUri, { upsert: true }));
  return Promise.all(promises);
};

export const deleteImage = async (bucket: StorageBucket, path: string): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    return { error: error ?? null };
  } catch (e: any) {
    return { error: e as Error };
  }
};

export const deleteMultipleImages = async (bucket: StorageBucket, paths: string[]): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    return { error: error ?? null };
  } catch (e: any) {
    return { error: e as Error };
  }
};

export const getPublicUrl = (bucket: StorageBucket, path: string): string | null => {
  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl ?? null;
  } catch (e) {
    return null;
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

