import { supabase } from './client';

export const getPublicUrl = (bucket: string, path: string) => {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl ?? null;
};

export const uploadImage = async (bucket: string, path: string, file: any) => {
  const { data, error } = await supabase.storage.from(bucket).upload(path, file);
  return { data, error };
};
