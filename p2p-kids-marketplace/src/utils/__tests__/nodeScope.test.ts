/**
 * File: p2p-kids-marketplace/src/utils/__tests__/nodeScope.test.ts
 * P4 (2026-08-17): Unit tests for the hyperlocal node-scope state machine.
 */
import { computeEffectiveNodeScope, NodeScopeInput } from '../nodeScope';

const baseInput: NodeScopeInput = {
  userNodeId: 'node-norwalk',
  isWaitlisted: false,
  showAllNodes: false,
  hasActiveLocationFilter: false,
  locationScopeNodeIds: [],
};

describe('computeEffectiveNodeScope', () => {
  test('active-node user defaults to "My Node" (own node only)', () => {
    const result = computeEffectiveNodeScope(baseInput);
    expect(result.mode).toBe('own_node');
    expect(result.nodeIds).toEqual(['node-norwalk']);
  });

  test('waitlisted user keeps global-browse fallback (preserved), never scoped', () => {
    const result = computeEffectiveNodeScope({
      ...baseInput,
      isWaitlisted: true,
      userNodeId: 'node-norwalk', // fallback node may still be assigned
      showAllNodes: false,
      hasActiveLocationFilter: false,
    });
    expect(result.mode).toBe('global');
    expect(result.nodeIds).toBeNull();
  });

  test('waitlisted user stays global even when toggle is on (fallback wins)', () => {
    const result = computeEffectiveNodeScope({
      ...baseInput,
      isWaitlisted: true,
      showAllNodes: true,
    });
    expect(result.mode).toBe('global');
    expect(result.nodeIds).toBeNull();
  });

  test('"Show All Nodes" toggle widens to global', () => {
    const result = computeEffectiveNodeScope({ ...baseInput, showAllNodes: true });
    expect(result.mode).toBe('all');
    expect(result.nodeIds).toBeNull();
  });

  test('applied ZIP+radius location filter overrides the default scope', () => {
    const result = computeEffectiveNodeScope({
      ...baseInput,
      hasActiveLocationFilter: true,
      locationScopeNodeIds: ['node-a', 'node-b'],
    });
    expect(result.mode).toBe('radius');
    expect(result.nodeIds).toEqual(['node-a', 'node-b']);
  });

  test('location filter with no resolved nodes → no node scope (global fallback)', () => {
    const result = computeEffectiveNodeScope({
      ...baseInput,
      hasActiveLocationFilter: true,
      locationScopeNodeIds: [],
    });
    expect(result.mode).toBe('radius');
    expect(result.nodeIds).toBeNull();
  });

  test('active user with no node id → global (avoid false-empty for legacy users)', () => {
    const result = computeEffectiveNodeScope({ ...baseInput, userNodeId: null });
    expect(result.mode).toBe('global');
    expect(result.nodeIds).toBeNull();
  });
});
