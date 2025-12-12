import { supabase } from './client';

export type StorageBucket = 'item-images' | 'chat-images' | 'user-avatars';

export interface UploadResult {
  url: string | null;
  cdnUrl?: string | null;
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
    const cdnUrl = getCdnUrl(bucket, data.path);
    return { url: urlData.publicUrl, cdnUrl, path: data.path, error: null };
  } catch (e: any) {
    return { url: null, path: null, error: e as Error };
  }
};

export const uploadMultipleImages = async (
  bucket: StorageBucket,
  files: { path: string; fileUri: string }[]
): Promise<UploadResult[]> => {
  const promises = files.map(({ path, fileUri }) => uploadImage(bucket, path, fileUri, { upsert: true }));
  return Promise.all(promises);
};

export const deleteImage = async (bucket: StorageBucket, path: string): Promise<{ error: Error | null }> => {
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

export const deleteMultipleImages = async (bucket: StorageBucket, paths: string[]): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    // Purge CDN cache if configured
    try {
      const purgeEndpoint = process.env.SUPABASE_PURGE_ENDPOINT;
      const purgeKey = process.env.SUPABASE_PURGE_X_API_KEY;
      if (purgeEndpoint && purgeKey) {
        const urlsToPurge = paths.map((p) => getCdnUrl(bucket, p) ?? getPublicUrl(bucket, p)).filter(Boolean) as string[];
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

