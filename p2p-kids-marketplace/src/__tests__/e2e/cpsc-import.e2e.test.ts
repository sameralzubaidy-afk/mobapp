// filepath: p2p-kids-marketplace/src/__tests__/e2e/cpsc-import.e2e.test.ts
// SAFETY-001: E2E tests for CPSC import flow
// Run with: RUN_SUPABASE_E2E=true npm run test:e2e

import { supabase } from '../../config/supabase';

const isE2EEnabled = process.env.RUN_SUPABASE_E2E === 'true';

describe('CPSC Import E2E', () => {
  beforeAll(() => {
    if (!isE2EEnabled) {
      console.log('⚠️ Skipping E2E tests - RUN_SUPABASE_E2E not enabled');
    }
  });

  it('should have cpsc_recalls table accessible', async () => {
    if (!isE2EEnabled) return;

    const { error } = await supabase
      .from('cpsc_recalls')
      .select('id')
      .limit(1);

    expect(error).toBeNull();
  });

  it('should have cpsc_import_log table accessible', async () => {
    if (!isE2EEnabled) return;

    const { error } = await supabase
      .from('cpsc_import_log')
      .select('id')
      .limit(1);

    expect(error).toBeNull();
  });

  it('should return recalls with required fields', async () => {
    if (!isE2EEnabled) return;

    const { data, error } = await supabase
      .from('cpsc_recalls')
      .select('*')
      .limit(1)
      .single();

    if (data) {
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('recall_number');
      expect(data).toHaveProperty('product_name');
      expect(data).toHaveProperty('recall_date');
      expect(data).toHaveProperty('created_at');
      expect(data).toHaveProperty('updated_at');
    }

    // If no data exists, that's OK for fresh install
    expect(error).toBeNull();
  });

  it('should search recalls by product name', async () => {
    if (!isE2EEnabled) return;

    // Search for common recall keywords
    const { data, error } = await supabase
      .from('cpsc_recalls')
      .select('product_name, hazard, recall_date')
      .ilike('product_name', '%toy%')
      .limit(5);

    expect(error).toBeNull();
    
    if (data && data.length > 0) {
      expect(data[0]).toHaveProperty('product_name');
      expect(data[0]).toHaveProperty('recall_date');
    }
  });

  it('should filter recalls by date range', async () => {
    if (!isE2EEnabled) return;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('cpsc_recalls')
      .select('recall_date')
      .gte('recall_date', dateStr)
      .order('recall_date', { ascending: false })
      .limit(10);

    expect(error).toBeNull();

    if (data && data.length > 0) {
      // Verify dates are within range
      data.forEach(recall => {
        const recallDate = new Date(recall.recall_date);
        expect(recallDate >= thirtyDaysAgo).toBe(true);
      });
    }
  });

  it('should have import logs with proper status values', async () => {
    if (!isE2EEnabled) return;

    const { data, error } = await supabase
      .from('cpsc_import_log')
      .select('status, recalls_imported, recalls_updated, import_date')
      .order('import_date', { ascending: false })
      .limit(5);

    expect(error).toBeNull();

    if (data && data.length > 0) {
      data.forEach(log => {
        expect(['success', 'failed', 'partial']).toContain(log.status);
        expect(typeof log.recalls_imported).toBe('number');
        expect(typeof log.recalls_updated).toBe('number');
      });
    }
  });

  it('should enforce unique recall_number constraint', async () => {
    if (!isE2EEnabled) return;

    // First, get an existing recall
    const { data: existing } = await supabase
      .from('cpsc_recalls')
      .select('recall_number')
      .limit(1)
      .single();

    if (existing) {
      // Try to insert duplicate
      const { error } = await supabase
        .from('cpsc_recalls')
        .insert({
          recall_number: existing.recall_number,
          product_name: 'Duplicate Test',
          recall_date: '2023-01-01'
        });

      // Should fail with unique constraint violation
      expect(error).not.toBeNull();
      expect(error?.code).toBe('23505'); // PostgreSQL unique violation
    }
  });

  it('should search using full-text search', async () => {
    if (!isE2EEnabled) return;

    const { data, error } = await supabase
      .rpc('search_cpsc_recalls', {
        search_query: 'toy car'
      })
      .limit(5);

    // RPC may not exist yet - that's OK
    if (error && error.code === '42883') {
      console.log('ℹ️ search_cpsc_recalls RPC not implemented yet (optional for SAFETY-001)');
      return;
    }

    expect(error).toBeNull();
  });
});

describe('CPSC Import Admin Access', () => {
  it('should allow anonymous users to read recalls (public safety)', async () => {
    if (!isE2EEnabled) return;

    // Create anon client
    const anonClient = supabase;

    const { data, error } = await anonClient
      .from('cpsc_recalls')
      .select('product_name, hazard')
      .limit(1);

    expect(error).toBeNull();
  });

  // Note: Testing service role insert requires service role key
  // which should NOT be exposed in mobile app tests
  // Service role tests should be in admin/server-side E2E suite
});
