import { createClient, SupabaseClient } from '@supabase/supabase-js';

function getEnv(name: string): string {
  return (process.env[name] ?? '').trim();
}

function getSupabaseUrl(): string {
  return getEnv('SUPABASE_URL') || getEnv('EXPO_PUBLIC_SUPABASE_URL');
}

function getSupabaseAnonKey(): string {
  return getEnv('SUPABASE_ANON_KEY') || getEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

function getSupabaseServiceRoleKey(): string {
  return getEnv('SUPABASE_SERVICE_ROLE_KEY');
}

export function getAnonClient(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!url || !anonKey) return null;
  return createClient(url, anonKey);
}

export function getServiceClient(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const serviceKey = getSupabaseServiceRoleKey();
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

export async function createConfirmedTestUser(params: {
  email: string;
  password: string;
  userMetadata?: Record<string, any>;
}): Promise<{ userId: string } | null> {
  const service = getServiceClient();
  if (service) {
    const { data, error } = await service.auth.admin.createUser({
      email: params.email,
      password: params.password,
      email_confirm: true,
      user_metadata: params.userMetadata ?? {},
    });

    if (!error && data.user?.id) {
      return { userId: data.user.id };
    }
  }

  const anon = getAnonClient();
  if (!anon) return null;

  const { data, error } = await anon.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      data: params.userMetadata ?? {},
    },
  });

  if (error) return null;

  const userId = (data as any)?.user?.id;
  if (!userId) return null;

  return { userId };
}

export async function deleteTestUser(userId: string): Promise<void> {
  const service = getServiceClient();
  if (!service) return;
  await service.auth.admin.deleteUser(userId);
}
