/**
 * File: p2p-kids-marketplace/src/__tests__/unit/schema/filter-columns.test.ts
 * Module: MODULE-05-DISCOVERY-V3-FILTERS
 * Task: DISCOVERY-V3-001
 * Description: Unit tests for filter columns migration structure validation
 */

import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

describe('DISCOVERY-V3-001: Filter Columns Migration', () => {
  const migrationPath = path.join(
    __dirname,
    '../../../../../supabase/migrations/20260420000001_add_item_filter_columns.sql'
  );

  it('migration file exists', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  it('migration contains all 4 column additions', () => {
    const content = fs.readFileSync(migrationPath, 'utf-8');
    
    // Check for age_group column
    expect(content).toContain('age_group TEXT');
    expect(content).toContain("age_group IN ('0-2', '3-5', '6-8', '9-12', '13+')");
    
    // Check for gender column
    expect(content).toContain('gender TEXT');
    expect(content).toContain("gender IN ('boy', 'girl', 'unisex')");
    
    // Check for brand column
    expect(content).toContain('brand TEXT');
    expect(content).toContain('LENGTH(brand) <= 100');
    
    // Check for color column (array type, no CHECK)
    expect(content).toContain('color TEXT[]');
  });

  it('migration contains all required CHECK constraints', () => {
    const content = fs.readFileSync(migrationPath, 'utf-8');
    
    // Age group CHECK
    expect(content).toMatch(/CHECK.*age_group.*IN.*'0-2'.*'3-5'.*'6-8'.*'9-12'.*'13\+'/s);
    
    // Gender CHECK
    expect(content).toMatch(/CHECK.*gender.*IN.*'boy'.*'girl'.*'unisex'/s);
    
    // Brand length CHECK
    expect(content).toMatch(/CHECK.*LENGTH\(brand\).*<=.*100/s);
    
    // Color should NOT have CHECK constraint
    expect(content).not.toMatch(/CHECK.*color/);
  });

  it('migration creates 6 indexes', () => {
    const content = fs.readFileSync(migrationPath, 'utf-8');
    
    const expectedIndexes = [
      'idx_items_age_group',
      'idx_items_gender',
      'idx_items_brand',
      'idx_items_color',
      'idx_items_price',
      'idx_items_category_price'
    ];
    
    expectedIndexes.forEach(indexName => {
      expect(content).toContain(indexName);
    });
  });

  it('all indexes are partial on status=available except where noted', () => {
    const content = fs.readFileSync(migrationPath, 'utf-8');
    
    // All 6 indexes should have WHERE status = 'available'
    const partialIndexCount = (content.match(/WHERE status = 'available'/g) || []).length;
    expect(partialIndexCount).toBeGreaterThanOrEqual(6);
  });

  it('color index uses GIN indexing for array operations', () => {
    const content = fs.readFileSync(migrationPath, 'utf-8');
    
    // Color index should use GIN for array overlap queries
    expect(content).toMatch(/idx_items_color.*USING GIN\(color\)/s);
  });

  it('migration is idempotent (uses IF NOT EXISTS or DO blocks)', () => {
    const content = fs.readFileSync(migrationPath, 'utf-8');
    
    // Check for idempotency patterns
    const hasDoBlocks = content.includes('DO $$') || content.includes('DO $');
    const hasIfNotExists = content.includes('IF NOT EXISTS');
    const hasCreateIndexIfNotExists = content.includes('CREATE INDEX IF NOT EXISTS');
    
    expect(hasDoBlocks || hasIfNotExists || hasCreateIndexIfNotExists).toBe(true);
  });

  it('migration includes column comments', () => {
    const content = fs.readFileSync(migrationPath, 'utf-8');
    
    // All 4 columns should have COMMENT ON COLUMN
    expect(content).toContain("COMMENT ON COLUMN items.age_group IS");
    expect(content).toContain("COMMENT ON COLUMN items.gender IS");
    expect(content).toContain("COMMENT ON COLUMN items.brand IS");
    expect(content).toContain("COMMENT ON COLUMN items.color IS");
  });

  it('migration includes verification query (commented)', () => {
    const content = fs.readFileSync(migrationPath, 'utf-8');
    
    // Should have commented verification query
    expect(content).toMatch(/--.*SELECT.*information_schema\.columns/s);
    expect(content).toMatch(/--.*age_group.*gender.*brand.*color/s);
  });

  it('migration file naming follows convention', () => {
    const filename = path.basename(migrationPath);
    
    // Should match pattern: YYYYMMDDNNNNNN_descriptive_name.sql
    expect(filename).toMatch(/^\d{14}_[a-z_]+\.sql$/);
    expect(filename).toBe('20260420000001_add_item_filter_columns.sql');
  });
});

describe('Filter Column Data Type Validation', () => {
  it('age_group values match requirements spec', () => {
    const validValues = ['0-2', '3-5', '6-8', '9-12', '13+'];
    const migrationContent = fs.readFileSync(
      path.join(
        __dirname,
        '../../../../../supabase/migrations/20260420000001_add_item_filter_columns.sql'
      ),
      'utf-8'
    );
    
    validValues.forEach(value => {
      expect(migrationContent).toContain(`'${value}'`);
    });
  });

  it('gender values match requirements spec', () => {
    const validValues = ['boy', 'girl', 'unisex'];
    const migrationContent = fs.readFileSync(
      path.join(
        __dirname,
        '../../../../../supabase/migrations/20260420000001_add_item_filter_columns.sql'
      ),
      'utf-8'
    );
    
    validValues.forEach(value => {
      expect(migrationContent).toContain(`'${value}'`);
    });
  });

  it('brand max length is 100 characters', () => {
    const migrationContent = fs.readFileSync(
      path.join(
        __dirname,
        '../../../../../supabase/migrations/20260420000001_add_item_filter_columns.sql'
      ),
      'utf-8'
    );
    
    expect(migrationContent).toMatch(/LENGTH\(brand\)\s*<=\s*100/);
  });
});
