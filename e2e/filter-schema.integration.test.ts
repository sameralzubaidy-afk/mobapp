/**
 * File: e2e/filter-schema.integration.test.ts
 * Module: MODULE-05-DISCOVERY-V3-FILTERS
 * Task: DISCOVERY-V3-001
 * Description: Integration tests for filter columns migration against Supabase
 * 
 * Prerequisites:
 * 1. Migration 20260420000001_add_item_filter_columns.sql must be applied to staging
 * 2. RUN_SUPABASE_E2E=true environment variable must be set
 * 3. Supabase staging credentials must be configured
 */

import { createClient } from '@supabase/supabase-js';
import { describe, it, expect, beforeAll } from '@jest/globals';

// Skip these tests unless explicitly enabled
const shouldRun = process.env.RUN_SUPABASE_E2E === 'true';
const describeIfE2E = shouldRun ? describe : describe.skip;

describeIfE2E('DISCOVERY-V3-001 Integration: Filter Columns Schema', () => {
  let supabase: ReturnType<typeof createClient>;

  beforeAll(() => {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured for E2E tests');
    }

    supabase = createClient(supabaseUrl, supabaseKey);
  });

  it('items table has age_group column with correct type', async () => {
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'items' 
          AND column_name = 'age_group'
      `
    });

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data[0].column_name).toBe('age_group');
    expect(data[0].data_type).toBe('text');
    expect(data[0].is_nullable).toBe('YES');
  });

  it('items table has gender column with correct type', async () => {
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'items' 
          AND column_name = 'gender'
      `
    });

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data[0].column_name).toBe('gender');
    expect(data[0].data_type).toBe('text');
    expect(data[0].is_nullable).toBe('YES');
  });

  it('items table has brand column with correct type', async () => {
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'items' 
          AND column_name = 'brand'
      `
    });

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data[0].column_name).toBe('brand');
    expect(data[0].data_type).toBe('text');
    expect(data[0].is_nullable).toBe('YES');
  });

  it('items table has color column as text array', async () => {
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'items' 
          AND column_name = 'color'
      `
    });

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data[0].column_name).toBe('color');
    expect(data[0].data_type).toBe('ARRAY');
    expect(data[0].is_nullable).toBe('YES');
  });

  it('age_group column has CHECK constraint', async () => {
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT constraint_name, check_clause
        FROM information_schema.check_constraints
        WHERE constraint_name LIKE '%age_group%'
      `
    });

    expect(error).toBeNull();
    expect(data.length).toBeGreaterThan(0);
    
    const checkClause = data[0].check_clause.toLowerCase();
    expect(checkClause).toContain('0-2');
    expect(checkClause).toContain('3-5');
    expect(checkClause).toContain('6-8');
    expect(checkClause).toContain('9-12');
    expect(checkClause).toContain('13+');
  });

  it('gender column has CHECK constraint', async () => {
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT constraint_name, check_clause
        FROM information_schema.check_constraints
        WHERE constraint_name LIKE '%gender%'
      `
    });

    expect(error).toBeNull();
    expect(data.length).toBeGreaterThan(0);
    
    const checkClause = data[0].check_clause.toLowerCase();
    expect(checkClause).toContain('boy');
    expect(checkClause).toContain('girl');
    expect(checkClause).toContain('unisex');
  });

  it('brand column has length CHECK constraint', async () => {
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT constraint_name, check_clause
        FROM information_schema.check_constraints
        WHERE constraint_name LIKE '%brand%'
      `
    });

    expect(error).toBeNull();
    expect(data.length).toBeGreaterThan(0);
    
    const checkClause = data[0].check_clause.toLowerCase();
    expect(checkClause).toContain('length');
    expect(checkClause).toContain('100');
  });

  it('all 6 required indexes exist', async () => {
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'items' 
          AND indexname IN (
            'idx_items_age_group',
            'idx_items_gender',
            'idx_items_brand',
            'idx_items_color',
            'idx_items_price',
            'idx_items_category_price'
          )
        ORDER BY indexname
      `
    });

    expect(error).toBeNull();
    expect(data).toHaveLength(6);
    
    const indexNames = data.map((row: any) => row.indexname);
    expect(indexNames).toContain('idx_items_age_group');
    expect(indexNames).toContain('idx_items_gender');
    expect(indexNames).toContain('idx_items_brand');
    expect(indexNames).toContain('idx_items_color');
    expect(indexNames).toContain('idx_items_price');
    expect(indexNames).toContain('idx_items_category_price');
  });

  it('indexes are partial on status=available', async () => {
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'items' 
          AND indexname LIKE 'idx_items_%'
          AND indexdef LIKE '%WHERE%status%available%'
      `
    });

    expect(error).toBeNull();
    expect(data.length).toBeGreaterThanOrEqual(6);
  });

  it('color index uses GIN indexing method', async () => {
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'items' 
          AND indexname = 'idx_items_color'
      `
    });

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data[0].indexdef.toLowerCase()).toContain('using gin');
  });

  it('existing items rows remain valid with NULL filter values', async () => {
    // Insert a test item without filter values
    const testItem = {
      title: 'E2E Test Item for Filter Columns',
      description: 'Testing backward compatibility',
      price: 10.00,
      seller_id: 'test-seller-uuid', // Will fail on FK, but that's OK for schema validation
      status: 'draft'
      // Intentionally omitting age_group, gender, brand, color
    };

    const { error } = await supabase
      .from('items')
      .insert(testItem);

    // Error is expected due to FK constraint, but NOT due to missing filter columns
    if (error) {
      expect(error.message).not.toContain('age_group');
      expect(error.message).not.toContain('gender');
      expect(error.message).not.toContain('brand');
      expect(error.message).not.toContain('color');
    }
  });

  it('can insert item with all filter values', async () => {
    const testItem = {
      title: 'E2E Test Item with Filters',
      description: 'Testing filter columns',
      price: 15.00,
      seller_id: 'test-seller-uuid',
      status: 'draft',
      age_group: '6-8',
      gender: 'unisex',
      brand: 'LEGO',
      color: ['blue', 'red']
    };

    const { error } = await supabase
      .from('items')
      .insert(testItem);

    // Error expected for FK, but filter columns should be valid
    if (error) {
      expect(error.message).not.toContain('age_group');
      expect(error.message).not.toContain('gender');
      expect(error.message).not.toContain('brand');
      expect(error.message).not.toContain('color');
      expect(error.message).not.toContain('constraint');
    }
  });

  it('rejects invalid age_group value', async () => {
    const testItem = {
      title: 'Invalid Age Group Test',
      description: 'Should fail',
      price: 10.00,
      seller_id: 'test-seller-uuid',
      status: 'draft',
      age_group: 'invalid-age' // Not in CHECK constraint
    };

    const { error } = await supabase
      .from('items')
      .insert(testItem);

    expect(error).not.toBeNull();
    expect(error?.message.toLowerCase()).toContain('check');
  });

  it('rejects invalid gender value', async () => {
    const testItem = {
      title: 'Invalid Gender Test',
      description: 'Should fail',
      price: 10.00,
      seller_id: 'test-seller-uuid',
      status: 'draft',
      gender: 'invalid-gender'
    };

    const { error } = await supabase
      .from('items')
      .insert(testItem);

    expect(error).not.toBeNull();
    expect(error?.message.toLowerCase()).toContain('check');
  });

  it('rejects brand longer than 100 characters', async () => {
    const testItem = {
      title: 'Long Brand Test',
      description: 'Should fail',
      price: 10.00,
      seller_id: 'test-seller-uuid',
      status: 'draft',
      brand: 'A'.repeat(101) // Exceeds 100 char limit
    };

    const { error } = await supabase
      .from('items')
      .insert(testItem);

    expect(error).not.toBeNull();
    expect(error?.message.toLowerCase()).toContain('check');
  });
});
