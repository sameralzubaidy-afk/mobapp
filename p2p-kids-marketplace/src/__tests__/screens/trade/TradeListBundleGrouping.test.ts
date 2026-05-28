/**
 * File: p2p-kids-marketplace/src/__tests__/screens/trade/TradeListBundleGrouping.test.ts
 * MODULE-15.1.2 Addendum D – Unit tests for bundle grouping memos in TradeListScreen
 * Run: npm run test:unit
 *
 * These tests exercise the pure grouping logic extracted from TradeListScreen's
 * useMemo hooks without mounting the full screen (avoids heavy dependency chains).
 */

// ─── Types mirrored from TradeListScreen ─────────────────────────────────────

interface PendingOffer {
  id: string;
  item_id: string;
  item_title: string;
  item_price: number;
  buyer_id: string;
  status: string;
  created_at: string;
  bundle_id?: string | null;
}

interface Trade {
  id: string;
  item_id: string;
  item_title: string;
  item_price: number;
  status: string;
  buyer_id: string;
  seller_id: string;
  created_at: string;
  bundle_id?: string | null;
}

// ─── Pure grouping functions (mirrors TradeListScreen useMemo logic) ──────────

type BundleRow = { type: 'bundle'; bundleId: string; offers: PendingOffer[] };
type SingleRow = { type: 'single'; offer: PendingOffer };
type OfferRow = BundleRow | SingleRow;

function groupReceivedOffers(receivedOffers: PendingOffer[]): OfferRow[] {
  const bundleMap = new Map<string, PendingOffer[]>();
  const result: OfferRow[] = [];

  for (const offer of receivedOffers) {
    if (offer.bundle_id) {
      const existing = bundleMap.get(offer.bundle_id);
      if (existing) {
        existing.push(offer);
      } else {
        bundleMap.set(offer.bundle_id, [offer]);
        // Reserve a slot in result for this bundle
        result.push({ type: 'bundle', bundleId: offer.bundle_id, offers: bundleMap.get(offer.bundle_id)! });
      }
    } else {
      result.push({ type: 'single', offer });
    }
  }

  return result;
}

interface InProgressBundle {
  bundleId: string;
  trades: Trade[];
}

function groupInProgressBundles(trades: Trade[], activeTab: string): InProgressBundle[] {
  if (activeTab !== 'buying') return [];

  const bundleMap = new Map<string, Trade[]>();

  for (const trade of trades) {
    if (trade.status === 'in_progress' && trade.bundle_id) {
      const existing = bundleMap.get(trade.bundle_id);
      if (existing) {
        existing.push(trade);
      } else {
        bundleMap.set(trade.bundle_id, [trade]);
      }
    }
  }

  // Only return bundles with 2+ items
  const result: InProgressBundle[] = [];
  for (const [bundleId, trades] of bundleMap.entries()) {
    if (trades.length >= 2) {
      result.push({ bundleId, trades });
    }
  }
  return result;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TradeListScreen – Addendum D: Bundle grouping logic', () => {

  // ── groupReceivedOffers ─────────────────────────────────────────────────────
  describe('groupReceivedOffers', () => {
    it('groups offers sharing the same bundle_id into a single bundle row', () => {
      const offers: PendingOffer[] = [
        { id: 'o1', item_id: 'i1', item_title: 'Toy A', item_price: 10, buyer_id: 'b1', status: 'pending', created_at: '2026-01-01', bundle_id: 'bundle-001' },
        { id: 'o2', item_id: 'i2', item_title: 'Toy B', item_price: 15, buyer_id: 'b1', status: 'pending', created_at: '2026-01-01', bundle_id: 'bundle-001' },
      ];

      const result = groupReceivedOffers(offers);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('bundle');
      const bundleRow = result[0] as BundleRow;
      expect(bundleRow.bundleId).toBe('bundle-001');
      expect(bundleRow.offers).toHaveLength(2);
    });

    it('returns single rows for offers without bundle_id', () => {
      const offers: PendingOffer[] = [
        { id: 'o1', item_id: 'i1', item_title: 'Toy A', item_price: 10, buyer_id: 'b1', status: 'pending', created_at: '2026-01-01', bundle_id: null },
        { id: 'o2', item_id: 'i2', item_title: 'Toy B', item_price: 15, buyer_id: 'b1', status: 'pending', created_at: '2026-01-01', bundle_id: undefined },
      ];

      const result = groupReceivedOffers(offers);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('single');
      expect(result[1].type).toBe('single');
    });

    it('returns mixed rows for bundled + non-bundled offers', () => {
      const offers: PendingOffer[] = [
        { id: 'o1', item_id: 'i1', item_title: 'Toy A', item_price: 10, buyer_id: 'b1', status: 'pending', created_at: '2026-01-01', bundle_id: 'bundle-001' },
        { id: 'o2', item_id: 'i2', item_title: 'Toy B', item_price: 15, buyer_id: 'b1', status: 'pending', created_at: '2026-01-01', bundle_id: 'bundle-001' },
        { id: 'o3', item_id: 'i3', item_title: 'Toy C', item_price: 5, buyer_id: 'b2', status: 'pending', created_at: '2026-01-01', bundle_id: null },
      ];

      const result = groupReceivedOffers(offers);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('bundle');
      expect(result[1].type).toBe('single');
    });

    it('creates separate bundle rows for different bundle_ids', () => {
      const offers: PendingOffer[] = [
        { id: 'o1', item_id: 'i1', item_title: 'A', item_price: 10, buyer_id: 'b1', status: 'pending', created_at: '2026-01-01', bundle_id: 'bundle-001' },
        { id: 'o2', item_id: 'i2', item_title: 'B', item_price: 15, buyer_id: 'b1', status: 'pending', created_at: '2026-01-01', bundle_id: 'bundle-001' },
        { id: 'o3', item_id: 'i3', item_title: 'C', item_price: 8, buyer_id: 'b2', status: 'pending', created_at: '2026-01-01', bundle_id: 'bundle-002' },
        { id: 'o4', item_id: 'i4', item_title: 'D', item_price: 12, buyer_id: 'b2', status: 'pending', created_at: '2026-01-01', bundle_id: 'bundle-002' },
      ];

      const result = groupReceivedOffers(offers);

      expect(result).toHaveLength(2);
      const b1 = result[0] as BundleRow;
      const b2 = result[1] as BundleRow;
      expect(b1.bundleId).toBe('bundle-001');
      expect(b2.bundleId).toBe('bundle-002');
    });

    it('returns empty array when no offers', () => {
      expect(groupReceivedOffers([])).toHaveLength(0);
    });

    it('collects all offers belonging to a bundle (3 items)', () => {
      const offers: PendingOffer[] = Array.from({ length: 3 }, (_, i) => ({
        id: `o${i + 1}`,
        item_id: `i${i + 1}`,
        item_title: `Item ${i + 1}`,
        item_price: 10 + i,
        buyer_id: 'b1',
        status: 'pending',
        created_at: '2026-01-01',
        bundle_id: 'bundle-big',
      }));

      const result = groupReceivedOffers(offers);
      expect(result).toHaveLength(1);
      const bundleRow = result[0] as BundleRow;
      expect(bundleRow.offers).toHaveLength(3);
    });
  });

  // ── groupInProgressBundles ──────────────────────────────────────────────────
  describe('groupInProgressBundles', () => {
    const inProgressTrades: Trade[] = [
      { id: 't1', item_id: 'i1', item_title: 'Toy A', item_price: 10, status: 'in_progress', buyer_id: 'b1', seller_id: 's1', created_at: '2026-01-01', bundle_id: 'bundle-001' },
      { id: 't2', item_id: 'i2', item_title: 'Toy B', item_price: 15, status: 'in_progress', buyer_id: 'b1', seller_id: 's1', created_at: '2026-01-01', bundle_id: 'bundle-001' },
      { id: 't3', item_id: 'i3', item_title: 'Toy C', item_price: 8, status: 'in_progress', buyer_id: 'b1', seller_id: 's1', created_at: '2026-01-01', bundle_id: null },
    ];

    it('groups in_progress bundled trades when tab is "buying"', () => {
      const result = groupInProgressBundles(inProgressTrades, 'buying');
      expect(result).toHaveLength(1);
      expect(result[0].bundleId).toBe('bundle-001');
      expect(result[0].trades).toHaveLength(2);
    });

    it('returns empty when activeTab is not "buying"', () => {
      expect(groupInProgressBundles(inProgressTrades, 'all')).toHaveLength(0);
      expect(groupInProgressBundles(inProgressTrades, 'selling')).toHaveLength(0);
      expect(groupInProgressBundles(inProgressTrades, 'offers')).toHaveLength(0);
    });

    it('excludes single-item bundles (only 1 in_progress trade with that bundle_id)', () => {
      const singleBundleTrade: Trade[] = [
        { id: 't1', item_id: 'i1', item_title: 'Toy A', item_price: 10, status: 'in_progress', buyer_id: 'b1', seller_id: 's1', created_at: '2026-01-01', bundle_id: 'bundle-solo' },
      ];
      const result = groupInProgressBundles(singleBundleTrade, 'buying');
      expect(result).toHaveLength(0);
    });

    it('excludes trades with status other than in_progress', () => {
      const mixedStatusTrades: Trade[] = [
        { id: 't1', item_id: 'i1', item_title: 'Toy A', item_price: 10, status: 'in_progress', buyer_id: 'b1', seller_id: 's1', created_at: '2026-01-01', bundle_id: 'bundle-mixed' },
        { id: 't2', item_id: 'i2', item_title: 'Toy B', item_price: 15, status: 'completed', buyer_id: 'b1', seller_id: 's1', created_at: '2026-01-01', bundle_id: 'bundle-mixed' },
      ];
      const result = groupInProgressBundles(mixedStatusTrades, 'buying');
      // Only 1 in_progress → below 2-item threshold
      expect(result).toHaveLength(0);
    });

    it('returns empty array when no trades provided', () => {
      expect(groupInProgressBundles([], 'buying')).toHaveLength(0);
    });
  });
});
