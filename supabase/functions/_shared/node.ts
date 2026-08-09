// File: supabase/functions/_shared/node.ts
// N6 — Node Tagging: canonical node-resolution helpers for Edge Functions.
//
// WHY THIS EXISTS:
//   Every write-path Edge Function that needs to tag a row with its node
//   (listing / trade / payment / ledger) resolves the node from the acting
//   seller/user's profile. These helpers centralize that lookup so every EF
//   uses the SAME source of truth (profiles.node_id → nodes.id, UUID).
//
//   Server-side DB triggers (migration 20260809000005_n6_node_tagging.sql) are
//   the enforcement layer (fill-only-when-NULL). These helpers are the explicit
//   EF layer: `create-trade-offer` uses resolveSellerProfile() so the trade's
//   node + tax node are resolved in the same code path that writes them.
//
// SECURITY NOTE:
//   EFs run with the service role, so profiles RLS does not hide the row here.
//   These helpers never write — they only read node_id for tagging.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

export interface SellerProfile {
  user_id: string | null;
  node_id: string | null;
}

/**
 * Resolve a user's node id (profiles.node_id) by auth user id.
 * Returns null when the profile is missing or has no node assigned yet
 * (e.g. pre-node legacy users or users still on the waitlist).
 *
 * @param client  A Supabase client (service role for writes).
 * @param userId  The auth.users.id of the user whose node to resolve.
 */
export async function resolveUserNodeId(
  client: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await client
    .from('profiles')
    .select('node_id')
    .eq('user_id', userId)
    .maybeSingle();

  return (data as { node_id?: string | null } | null)?.node_id ?? null;
}

/**
 * Resolve the seller's profile (user_id + node_id) for a trade/listing write.
 *
 * Mirrors the exact lookup create-trade-offer used before N6: matches the seller
 * by profiles.user_id OR profiles.id (legacy profiles where user_id was not
 * populated), returns user_id + node_id. Behavior is identical to the inline
 * query — this is a pure consolidation, not a behavior change.
 *
 * Returns null when no profile resolves (the caller then rejects with
 * SELLER_NOT_FOUND).
 */
export async function resolveSellerProfile(
  client: SupabaseClient,
  sellerId: string,
): Promise<SellerProfile | null> {
  const { data } = await client
    .from('profiles')
    .select('user_id, node_id')
    .or(`user_id.eq.${sellerId},id.eq.${sellerId}`)
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    user_id: (data as { user_id?: string | null }).user_id ?? null,
    node_id: (data as { node_id?: string | null }).node_id ?? null,
  };
}
