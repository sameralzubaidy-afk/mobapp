import { supabase } from './client';
export const query = (table: string) => (supabase as any).from(table);

export const insert = async (table: string, data: any) => {
  try {
    const { data: resp, error } = await (supabase as any).from(String(table)).insert(data).select().single();
    return { data: resp ?? null, error: error ?? null };
  } catch (e: any) {
    return { data: null, error: e as Error };
  }
};

export const insertMany = async (table: string, data: any[]) => {
  try {
    const { data: resp, error } = await (supabase as any).from(String(table)).insert(data).select();
    return { data: resp ?? null, error: error ?? null };
  } catch (e: any) {
    return { data: null, error: e as Error };
  }
};

export const update = async (table: string, id: string, data: any) => {
  try {
    const { data: resp, error } = await (supabase as any).from(String(table)).update(data).eq('id', id).select().single();
    return { data: resp ?? null, error: error ?? null };
  } catch (e: any) {
    return { data: null, error: e as Error };
  }
};

export const deleteById = async (table: string, id: string) => {
  try {
    const { error } = await (supabase as any).from(String(table)).delete().eq('id', id);
    return { error: error ?? null };
  } catch (e: any) {
    return { error: e as Error };
  }
};

export const getById = async (table: string, id: string) => {
  try {
    const { data, error } = await (supabase as any).from(String(table)).select('*').eq('id', id).single();
    return { data: data ?? null, error: error ?? null };
  } catch (e: any) {
    return { data: null, error: e as Error };
  }
};

export const getAll = async (table: string, opts?: { limit?: number; offset?: number; order?: string }) => {
  try {
    let q: any = (supabase as any).from(String(table)).select('*');
    if (opts?.limit) q = q.limit(opts.limit);
    if (opts?.offset) q = q.range(opts.offset, (opts.offset ?? 0) + (opts.limit ?? 100) - 1);
    if (opts?.order) q = q.order(opts.order, { ascending: false });
    const { data, error } = await q;
    return { data: data ?? null, error: error ?? null };
  } catch (e: any) {
    return { data: null, error: e as Error };
  }
};

