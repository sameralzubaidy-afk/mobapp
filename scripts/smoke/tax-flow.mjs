#!/usr/bin/env node
/**
 * File: scripts/smoke/tax-flow.mjs
 * MODULE-15.3-PART3 TAX-014 — FLOW-21 Sales Tax smoke
 *
 * Exercises all 6 tax RPCs end-to-end against PROD Supabase.
 * Read-only by default. Pass `--trade-id <uuid>` to also test apply/refund.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/smoke/tax-flow.mjs
 *   node scripts/smoke/tax-flow.mjs --trade-id <uuid>
 */
import { createClient } from '@supabase/supabase-js';

const url =
  process.env.SUPABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('FAIL: missing SUPABASE_URL / SUPABASE_ANON_KEY env vars');
  process.exit(1);
}

const supabase = createClient(url, key);

const args = process.argv.slice(2);
const tradeIdIdx = args.indexOf('--trade-id');
const tradeId = tradeIdIdx >= 0 ? args[tradeIdIdx + 1] : null;

function ok(label, cond, info = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}: ${label}${info ? ' — ' + info : ''}`);
  if (!cond) process.exitCode = 1;
}

(async () => {
  console.log('--- TAX-014 smoke (FLOW-21) ---');

  // 1. calculate_tax (NULL node)
  {
    const { data, error } = await supabase.rpc('calculate_tax', {
      p_node_id: null,
      p_taxable_amount_cents: 10000,
    });
    ok('calculate_tax(NULL,10000) no error', !error, error?.message);
    ok('calculate_tax success flag', data?.success === true);
  }

  // 2. calculate_tax (0 amount)
  {
    const { data } = await supabase.rpc('calculate_tax', {
      p_node_id: null,
      p_taxable_amount_cents: 0,
    });
    ok('calculate_tax(0) → tax=0', data?.data?.tax_amount_cents === 0);
  }

  // 3. summary for today
  {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase.rpc('get_tax_summary_for_period', {
      p_start_date: today,
      p_end_date: today,
      p_node_id: null,
    });
    ok('get_tax_summary_for_period no error', !error, error?.message);
    ok('summary has by_jurisdiction array', Array.isArray(data?.data?.by_jurisdiction));
  }

  // 4. update_node_tax_config — expect admin gate failure for anon
  {
    const { data } = await supabase.rpc('update_node_tax_config', {
      p_node_id: '00000000-0000-0000-0000-000000000000',
      p_tax_rate: 0.05,
      p_tax_jurisdiction: 'XX',
      p_tax_enabled: false,
    });
    ok(
      'update_node_tax_config blocked for anon',
      data?.success === false,
      data?.error?.code,
    );
  }

  // 5/6. apply + refund (only if trade id provided)
  if (tradeId) {
    const first = await supabase.rpc('apply_tax_to_trade', { p_trade_id: tradeId });
    ok('apply_tax_to_trade #1 success', first.data?.success === true, first.error?.message);
    const second = await supabase.rpc('apply_tax_to_trade', { p_trade_id: tradeId });
    ok('apply_tax_to_trade #2 idempotent', second.data?.data?.idempotent_hit === true);

    const overRefund = await supabase.rpc('refund_tax', {
      p_trade_id: tradeId,
      p_refund_amount_cents: 99999999,
      p_reason: 'smoke over-refund',
    });
    ok('refund_tax rejects over-refund', overRefund.data?.success === false);
  } else {
    console.log('SKIP: apply/refund (no --trade-id provided)');
  }

  console.log('--- done ---');
})().catch((e) => {
  console.error('UNCAUGHT:', e);
  process.exit(1);
});
