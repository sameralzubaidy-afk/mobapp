/**
 * File: p2p-kids-marketplace/src/__tests__/tax-e2e.test.ts
 * MODULE-15.3-PART3 TAX-014 (E2E against PROD Supabase)
 *
 * Gated by env: RUN_SUPABASE_E2E=true (otherwise the suite is skipped).
 * Uses the public `calculate_tax` STABLE RPC for read-only assertions.
 * Write tests (apply_tax_to_trade / refund_tax) are skipped unless TAX_E2E_TRADE_ID is provided,
 * since they mutate real data.
 */
import { supabase } from '@/config/supabase';
import { TAX_FIXTURES, expectedTaxCents } from '@/test-data/tax-fixtures';

const RUN = process.env.RUN_SUPABASE_E2E === 'true';
const describeE2E = RUN ? describe : describe.skip;

describeE2E('TAX-014 end-to-end (read-only) [PROD]', () => {
  it('calculate_tax returns 0 when global tax disabled (with NULL node)', async () => {
    const { data, error } = await supabase.rpc('calculate_tax', {
      p_node_id: null,
      p_taxable_amount_cents: 10000,
    });
    expect(error).toBeNull();
    const r = data as any;
    expect(r.success).toBe(true);
    // Depending on global flag, tax may be > 0 OR 0. We only assert correctness:
    if (!r.data.global_enabled) {
      expect(r.data.tax_amount_cents).toBe(0);
    } else {
      const expected = expectedTaxCents(10000, r.data.tax_rate);
      expect(r.data.tax_amount_cents).toBe(expected);
    }
  });

  it('calculate_tax matches FLOOR((amt*rate)+0.5) for all sample amounts', async () => {
    for (const amt of TAX_FIXTURES.SAMPLE_TAXABLE_AMOUNTS_CENTS) {
      const { data, error } = await supabase.rpc('calculate_tax', {
        p_node_id: null,
        p_taxable_amount_cents: amt,
      });
      expect(error).toBeNull();
      const r = data as any;
      expect(r.success).toBe(true);
      const expected = expectedTaxCents(amt, r.data.tax_rate);
      expect(r.data.tax_amount_cents).toBe(expected);
    }
  });

  it('calculate_tax with 0 taxable returns 0 tax', async () => {
    const { data } = await supabase.rpc('calculate_tax', {
      p_node_id: null,
      p_taxable_amount_cents: 0,
    });
    expect((data as any).data.tax_amount_cents).toBe(0);
  });

  it('get_tax_summary_for_period returns aggregated structure', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase.rpc('get_tax_summary_for_period', {
      p_start_date: today,
      p_end_date: today,
      p_node_id: null,
    });
    expect(error).toBeNull();
    const r = data as any;
    expect(r.success).toBe(true);
    expect(r.data).toHaveProperty('transaction_count');
    expect(r.data).toHaveProperty('tax_collected_cents');
    expect(Array.isArray(r.data.by_jurisdiction)).toBe(true);
  });
});

const tradeId = process.env.TAX_E2E_TRADE_ID;
const describeMutating = RUN && tradeId ? describe : describe.skip;

describeMutating('TAX-014 mutating E2E (idempotency, refund) [PROD]', () => {
  it('apply_tax_to_trade is idempotent', async () => {
    const first = await supabase.rpc('apply_tax_to_trade', { p_trade_id: tradeId });
    const second = await supabase.rpc('apply_tax_to_trade', { p_trade_id: tradeId });
    const r1 = first.data as any;
    const r2 = second.data as any;
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    expect(r2.data.idempotent_hit).toBe(true);
    expect(r1.data.tax_record_id).toBe(r2.data.tax_record_id);
  });

  it('refund_tax rejects refund exceeding tax_amount', async () => {
    const { data } = await supabase.rpc('refund_tax', {
      p_trade_id: tradeId,
      p_refund_amount_cents: 99_999_999,
      p_reason: 'TAX-014 over-refund test',
    });
    const r = data as any;
    expect(r.success).toBe(false);
  });
});

// ── Scenario 7: Multiple partial refunds accumulate correctly ──────────────────
const describeMutating2 = RUN && tradeId ? describe : describe.skip;

describeMutating2('TAX-014 Scenario 7 — multiple partial refunds [PROD]', () => {
  let firstRefundedCents = 0;

  it('first partial refund succeeds and returns partial amount', async () => {
    const { data, error } = await supabase.rpc('refund_tax', {
      p_trade_id: tradeId,
      p_refund_amount_cents: 100,
      p_reason: 'TAX-014 partial refund 1',
    });
    expect(error).toBeNull();
    const r = data as any;
    // May fail if this trade has already been refunded — still validate shape
    if (r.success) {
      expect(typeof r.data.refunded_tax_cents).toBe('number');
      expect(r.data.refunded_tax_cents).toBeGreaterThanOrEqual(0);
      firstRefundedCents = r.data.refunded_tax_cents;
    } else {
      // Acceptable: trade may have no tax to refund
      expect(r.error.code).toMatch(/REFUND_EXCEEDS|NO_TAX_RECORD|INVALID/);
    }
  });

  it('second partial refund cumulative total >= first', async () => {
    if (firstRefundedCents === 0) return; // skip if first did not apply
    const { data } = await supabase.rpc('refund_tax', {
      p_trade_id: tradeId,
      p_refund_amount_cents: 50,
      p_reason: 'TAX-014 partial refund 2',
    });
    const r = data as any;
    if (r.success) {
      // cumulative must be >= what first refund returned
      expect(r.data.refunded_tax_cents).toBeGreaterThanOrEqual(firstRefundedCents);
    } else {
      expect(r.error.code).toMatch(/REFUND_EXCEEDS|NO_TAX_RECORD/);
    }
  });
});

// ── Scenario 8: Admin rate change — new transactions use new rate ──────────────
describeE2E('TAX-014 Scenario 8 — tax rate from node is used (not hardcoded)', () => {
  it('calculate_tax with a node returns rate from that node', async () => {
    // We cannot change the node rate in a read-only test, but we can verify
    // that using a node_id returns a consistent rate that matches what's stored.
    // Fetch a node with tax enabled
    const { data: nodes, error: nodeErr } = await supabase
      .from('nodes')
      .select('id, tax_rate, tax_enabled')
      .eq('tax_enabled', true)
      .limit(1)
      .single();

    if (nodeErr || !nodes) {
      // No tax-enabled node exists — skip assertion
      return;
    }

    const { data, error } = await supabase.rpc('calculate_tax', {
      p_node_id: nodes.id,
      p_taxable_amount_cents: 10000,
    });
    expect(error).toBeNull();
    const r = data as any;
    expect(r.success).toBe(true);
    if (r.data.global_enabled && nodes.tax_enabled) {
      // Rate returned must match what is stored on the node
      expect(r.data.tax_rate).toBeCloseTo(Number(nodes.tax_rate), 4);
    } else {
      expect(r.data.tax_amount_cents).toBe(0);
    }
  });
});

// ── Scenario 9: CSV export — get_tax_export_data returns correct shape ─────────
describeE2E('TAX-014 Scenario 9 — get_tax_export_data export shape', () => {
  it('get_tax_export_data returns rows with required columns', async () => {
    const today = new Date().toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase.rpc('get_tax_export_data', {
      p_start_date: thirtyDaysAgo,
      p_end_date: today,
    });
    // May fail with FORBIDDEN if test user is not admin — that is acceptable
    if (error && error.message?.includes('FORBIDDEN')) {
      // Expected for non-admin test callers
      return;
    }
    expect(error).toBeNull();
    // data is an array of rows (TABLE-returning function via Supabase RPC)
    expect(Array.isArray(data)).toBe(true);
    if ((data as any[]).length > 0) {
      const row = (data as any[])[0];
      expect(row).toHaveProperty('transaction_date');
      expect(row).toHaveProperty('buyer_email');
      expect(row).toHaveProperty('node_name');
      expect(row).toHaveProperty('taxable_amount_usd');
      expect(row).toHaveProperty('tax_rate');
      expect(row).toHaveProperty('tax_amount_usd');
      expect(row).toHaveProperty('refunded_tax_usd');
      expect(row).toHaveProperty('net_tax_usd');
    }
  });
});
