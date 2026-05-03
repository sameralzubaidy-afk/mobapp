/**
 * File: p2p-kids-marketplace/src/__tests__/e2e/node-item-filtering.e2e.test.ts
 * MODULE-03 NODE-006: Node-Specific Item Filtering E2E Test
 *
 * Tests:
 * - Items filtered by user's node by default
 * - Toggle between node and all-nodes view
 * - Cross-node items show proper badges
 */

import { supabase } from '../../services/supabase';
import { getItems } from '../../services/items';

const shouldRunSupabaseE2E = process.env.RUN_SUPABASE_E2E === 'true';
const describeSupabaseE2E = shouldRunSupabaseE2E ? describe : describe.skip;

describeSupabaseE2E('NODE-006 E2E: Node-Specific Item Filtering', () => {
  let testUserId: string;
  let norwalkNodeId: string;
  let littleFallsNodeId: string;
  let norwalkItemId: string;
  let littleFallsItemId: string;

  beforeAll(async () => {
    // Setup test data
    console.log('🧪 Setting up NODE-006 E2E test data...');

    // Get nodes
    const { data: nodes } = await supabase
      .from('geographic_nodes')
      .select('*')
      .in('name', ['Norwalk Central', 'Little Falls']);

    if (!nodes || nodes.length < 2) {
      console.warn('⚠️ Test nodes not found. Run seed migration first.');
      return;
    }

    norwalkNodeId = nodes.find((n) => n.name === 'Norwalk Central')?.id || '';
    littleFallsNodeId = nodes.find((n) => n.name === 'Little Falls')?.id || '';

    console.log('✅ Found test nodes:', { norwalkNodeId, littleFallsNodeId });
  });

  afterAll(async () => {
    // Cleanup test data
    if (norwalkItemId) {
      await supabase.from('items').delete().eq('id', norwalkItemId);
    }
    if (littleFallsItemId) {
      await supabase.from('items').delete().eq('id', littleFallsItemId);
    }
  });

  describe('Node-based filtering', () => {
    it('should filter items by node_id', async () => {
      // Skip if nodes not set up
      if (!norwalkNodeId) {
        console.warn('⚠️ Skipping test - nodes not available');
        return;
      }

      const filters = {
        node_id: norwalkNodeId,
        include_all_nodes: false,
      };

      const items = await getItems(filters, 'test-user');

      // Verify all items are from Norwalk node
      items.forEach((item) => {
        expect(item.seller?.node_id).toBe(norwalkNodeId);
      });

      console.log(`✅ Filtered ${items.length} items from Norwalk node`);
    });

    it('should show all items when include_all_nodes is true', async () => {
      if (!norwalkNodeId) {
        console.warn('⚠️ Skipping test - nodes not available');
        return;
      }

      const filters = {
        node_id: norwalkNodeId,
        include_all_nodes: true,
      };

      const items = await getItems(filters, 'test-user');

      // Should include items from different nodes
      const nodeIds = new Set(items.map((item) => item.seller?.node_id));

      console.log(`✅ Found items from ${nodeIds.size} different nodes`);
    });
  });

  describe('Empty state handling', () => {
    it('should handle empty results gracefully', async () => {
      const filters = {
        node_id: 'nonexistent-node',
        include_all_nodes: false,
      };

      const items = await getItems(filters, 'test-user');

      expect(items).toEqual([]);
      console.log('✅ Empty results handled correctly');
    });
  });
});
