/**
 * File: p2p-kids-marketplace/src/utils/nodeScope.ts
 * P4 (2026-08-17): Node-scope resolution for hyperlocal discovery.
 *
 * Determines which node ids the Discover search/count RPCs should be scoped to,
 * based on the signed-in user's node status and the active UI controls.
 *
 * State machine (in priority order):
 *  1. WAITLISTED user        → global (null) — intentional fallback-browse path
 *                               used for demand-signal generation (PRESERVED).
 *  2. ZIP+radius filter      → the radius-resolved node ids (existing location
 *                               filter, now actually honored by the RPCs).
 *  3. "Show All Nodes" ON    → global (null) — deliberate widening.
 *  4. Active-node user       → [userNodeId] — "My Node" default (the fix).
 *  5. Edge: no node id       → global (null) — avoid false-empty for legacy users.
 *
 * "Strict" rule (product decision): node-scoped results exclude NULL-node items
 * server-side (i.node_id = ANY(p_node_ids) never matches NULL). Untagged items
 * surface only when scope is global (Show All Nodes / waitlist / no node).
 */

export type NodeScopeMode = 'own_node' | 'all' | 'radius' | 'global';

export interface NodeScopeInput {
  /** The signed-in user's own node id (from profiles.node_id / session.user.node?.id). Null when they have no node. */
  userNodeId: string | null;
  /** True when the user is on the waitlist (zip_waitlist row exists) → global-browse fallback is preserved. */
  isWaitlisted: boolean;
  /** True when the "Show All Nodes" toggle is ON. */
  showAllNodes: boolean;
  /** True when a valid 5-digit ZIP + radius location filter is applied (and usable). */
  hasActiveLocationFilter: boolean;
  /** Node ids resolved from the applied location filter (radius search). */
  locationScopeNodeIds: string[];
}

export interface NodeScopeResult {
  /** Human-readable mode (useful for UI labels/tests). */
  mode: NodeScopeMode;
  /** Node ids to pass as p_node_ids. null = no node scope (global). */
  nodeIds: string[] | null;
}

export function computeEffectiveNodeScope(input: NodeScopeInput): NodeScopeResult {
  // 1. Waitlisted users keep the intentional global-browse fallback (demand signal).
  if (input.isWaitlisted) {
    return { mode: 'global', nodeIds: null };
  }

  // 2. A user-applied ZIP+radius location filter overrides the default scope.
  if (input.hasActiveLocationFilter) {
    return {
      mode: 'radius',
      nodeIds: input.locationScopeNodeIds.length > 0 ? input.locationScopeNodeIds : null,
    };
  }

  // 3. "Show All Nodes" toggle → global (deliberate widening).
  if (input.showAllNodes) {
    return { mode: 'all', nodeIds: null };
  }

  // 4. Active-node user default → "My Node" (own node only).
  if (input.userNodeId) {
    return { mode: 'own_node', nodeIds: [input.userNodeId] };
  }

  // 5. Edge: active (not waitlisted) but no node id → global (avoid false-empty).
  return { mode: 'global', nodeIds: null };
}
