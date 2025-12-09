import { supabase } from './client';

export const query = (table: string) => supabase.from(table);

export const insert = async (table: string, data: any) => {
  const { data: result, error } = await supabase.from(table).insert(data).select().single();
  return { data: result, error };
};

export const updateById = async (table: string, id: string, data: any) => {
  const { data: result, error } = await supabase.from(table).update(data).eq('id', id).select().single();
  return { data: result, error };
};

export const deleteById = async (table: string, id: string) => {
  const { error } = await supabase.from(table).delete().eq('id', id);
  return { error };
};
