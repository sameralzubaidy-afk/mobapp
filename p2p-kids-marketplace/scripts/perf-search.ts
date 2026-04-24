/**
 * Performance Integration Test for search_listings RPC
 * MODULE-05-DISCOVERY-V3: TASK DISCOVERY-V3-008
 * 
 * Tests p95 latency of search_listings with random filters against staging Supabase
 * 
 * Usage:
 *   npm run test:perf:search
 * 
 * Requirements:
 *   - Staging Supabase must have ≥ 10k rows in items table
 *   - SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env
 *   - Target: p95 < 200ms
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.staging' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env.staging');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Sample filter combinations
const FILTER_COMBINATIONS = [
  { p_query: 'toy', p_category_ids: null, p_condition: null, p_min_price: null, p_max_price: null },
  { p_query: 'LEGO', p_category_ids: null, p_condition: 'like_new', p_min_price: 10, p_max_price: 50 },
  { p_query: 'bicycle', p_category_ids: null, p_condition: null, p_min_price: null, p_max_price: 100 },
  { p_query: null, p_category_ids: null, p_condition: 'used_good', p_min_price: null, p_max_price: null },
  { p_query: 'book', p_category_ids: null, p_condition: null, p_min_price: 5, p_max_price: 25 },
  { p_query: null, p_category_ids: null, p_condition: 'like_new', p_min_price: null, p_max_price: null },
  { p_query: 'game', p_category_ids: null, p_condition: null, p_min_price: null, p_max_price: null },
  { p_query: null, p_category_ids: null, p_condition: null, p_min_price: 20, p_max_price: 80 },
];

interface SearchParams {
  p_query: string | null;
  p_sp_eligible_only?: boolean;
  p_limit?: number;
  p_offset?: number;
  p_category_ids?: string[] | null;
  p_condition?: string | null;
  p_min_price?: number | null;
  p_max_price?: number | null;
  p_age_group?: string | null;
  p_gender?: string | null;
  p_brand?: string | null;
  p_colors?: string[] | null;
  p_sort_by?: string;
}

async function runSearch(params: SearchParams): Promise<number> {
  const start = Date.now();
  
  const { data, error } = await supabase.rpc('search_listings', {
    ...params,
    p_sp_eligible_only: params.p_sp_eligible_only ?? false,
    p_limit: params.p_limit ?? 20,
    p_offset: params.p_offset ?? 0,
    p_sort_by: params.p_sort_by ?? 'relevance',
    p_age_group: params.p_age_group ?? null,
    p_gender: params.p_gender ?? null,
    p_brand: params.p_brand ?? null,
    p_colors: params.p_colors ?? null,
  });

  const duration = Date.now() - start;

  if (error) {
    console.error(`❌ Search failed: ${error.message}`);
    throw error;
  }

  return duration;
}

function calculatePercentile(values: number[], percentile: number): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

async function main() {
  console.log('🚀 Starting search_listings performance test...\n');

  // Check database has enough rows
  const { count, error: countError } = await supabase
    .from('items')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'available');

  if (countError) {
    console.error('❌ Failed to count items:', countError.message);
    process.exit(1);
  }

  console.log(`📊 Database has ${count} available items`);
  
  if ((count ?? 0) < 10000) {
    console.warn('⚠️  Warning: Database has < 10k items. Performance target may not be representative.');
  }

  console.log('\n🔍 Running 20 searches with random filters...\n');

  const durations: number[] = [];

  for (let i = 0; i < 20; i++) {
    // Pick random filter combination
    const randomFilters = FILTER_COMBINATIONS[i % FILTER_COMBINATIONS.length];
    
    // Randomly add additional filters
    const params: SearchParams = {
      ...randomFilters,
      p_age_group: Math.random() > 0.7 ? ['3-5', '6-8', '9-12'][Math.floor(Math.random() * 3)] : null,
      p_gender: Math.random() > 0.7 ? ['boy', 'girl', 'unisex'][Math.floor(Math.random() * 3)] : null,
      p_colors: Math.random() > 0.7 ? [['red', 'blue', 'green'][Math.floor(Math.random() * 3)]] : null,
    };

    try {
      const duration = await runSearch(params);
      durations.push(duration);
      
      const filters = Object.entries(params)
        .filter(([_, v]) => v !== null && v !== undefined)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(', ');
      
      console.log(`  ${i + 1}/20: ${duration}ms (${filters.slice(0, 60)}...)`);
    } catch (error) {
      console.error(`  ${i + 1}/20: FAILED`);
      process.exit(1);
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  console.log('\n📈 Performance Results:\n');

  const p50 = calculatePercentile(durations, 50);
  const p95 = calculatePercentile(durations, 95);
  const p99 = calculatePercentile(durations, 99);
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  const min = Math.min(...durations);
  const max = Math.max(...durations);

  console.log(`  Min:    ${min}ms`);
  console.log(`  Avg:    ${avg.toFixed(1)}ms`);
  console.log(`  p50:    ${p50}ms`);
  console.log(`  p95:    ${p95}ms`);
  console.log(`  p99:    ${p99}ms`);
  console.log(`  Max:    ${max}ms`);

  console.log('\n🎯 Performance Target: p95 < 200ms\n');

  if (p95 < 200) {
    console.log(`✅ PASS: p95 (${p95}ms) is below target (200ms)`);
    process.exit(0);
  } else {
    console.log(`❌ FAIL: p95 (${p95}ms) exceeds target (200ms)`);
    console.log('\n💡 Suggestions:');
    console.log('  - Check if indexes exist on items table');
    console.log('  - Run VACUUM ANALYZE on items table');
    console.log('  - Check search_listings RPC query plan');
    console.log('  - Verify partial indexes on status=\'available\'');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
