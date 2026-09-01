// File: p2p-kids-marketplace/src/components/QaForceTradeSuccessDeepLinkHandler.tsx
// QA-ONLY deep link handler (Dev Task 51 item 5) — force-renders the
// TradeSuccess screen with explicit params, so completion-CTAs that only appear
// on a realtime status transition (while the seller has the timeline open) can
// be verified directly on a single simulator.
//
//   p2pkidsmarketplace://qa-trade-success?role=seller&listingType=cash_only&tradeStatus=completed[&tradeId=<uuid>]
//
// This is what unblocks TRD-TC-H04 (seller "Sold for cash!" completion CTA),
// which was previously impossible on one device because it required being
// logged in as both buyer and seller simultaneously.
//
// Params (all optional):
//   role         buyer|seller          (default: seller)
//   listingType  cash_only|accept_sp|donate  (default: cash_only)
//   tradeStatus  initiated|completed   (default: completed)
//   tradeId      a real trade uuid (optional — the fee-savings fetch fails soft
//                to $0 for a placeholder, which is fine for CTA verification)
//   spUsed               SP count used by the buyer (drives the buyer-leg condition)
//   spAmountDollars      dollar figure for H02 "Got it! You saved $X using SP!"
//   remainingSP          buyer's remaining SP ("You have N SP available")
//   totalSpToSeller      SP total shown to the seller (H03 pending-wallet copy)
//   spPendingReleaseDays release window ("releasing in N days")
//   feeSavingsCents      free-buyer savings in cents for H01 ("would've saved
//                        you $X") — set this (or pass a real tradeId) to verify
//                        the real-figure upsell; otherwise H01 falls back to
//                        the generic upsell (FIX-PARAMS, QA Task 16)
//
// SECURITY GATE: identical to the other QA handlers — registered only in dev /
// staging builds; a production build never registers the listener. Requires an
// authenticated session (log in first via `qa-login-as?persona=<name>`).

import { useEffect, useRef } from 'react';
import * as Linking from 'expo-linking';
import { useAuth } from '@/hooks/useAuth';
import { navigationRef } from '@/navigation/navigationRef';

/**
 * Enables the QA force-trade-success deep link in dev / staging builds only.
 */
const QA_FORCE_TRADE_SUCCESS_DEEP_LINK_ENABLED: boolean =
  __DEV__ ||
  process.env.EXPO_PUBLIC_ENVIRONMENT === 'development' ||
  process.env.EXPO_PUBLIC_ENVIRONMENT === 'staging';

/** The deep link path this handler reacts to (e.g. p2pkidsmarketplace://qa-trade-success). */
const QA_FORCE_TRADE_SUCCESS_PATH = 'qa-trade-success';

/** Max time to wait for the navigation container before giving up. */
const MAX_READY_ATTEMPTS = 20; // 20 × 250ms = 5s
const READY_RETRY_MS = 250;

function isQaTradeSuccessUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    const parsed = Linking.parse(url);
    const firstSegment = (parsed.path || parsed.hostname || '')
      .replace(/^\/+/, '')
      .split('?')[0];
    return firstSegment === QA_FORCE_TRADE_SUCCESS_PATH;
  } catch {
    return false;
  }
}

function toNumber(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Waits (with retries) for the navigation container to become ready. */
async function waitForNavigationReady(): Promise<boolean> {
  for (let i = 0; i < MAX_READY_ATTEMPTS; i += 1) {
    if (navigationRef.isReady()) return true;
    await new Promise((r) => setTimeout(r, READY_RETRY_MS));
  }
  return false;
}

async function forceTradeSuccess(url: string, hasSession: boolean): Promise<void> {
  if (!hasSession) {
    // eslint-disable-next-line no-console
    console.warn('[QaForceTradeSuccessDeepLink] No session — log in first via qa-login-as?persona=<name>');
    return;
  }

  const parsed = Linking.parse(url);
  const q = (parsed.queryParams ?? {}) as Record<string, string | undefined>;

  const role: 'buyer' | 'seller' = q.role === 'buyer' ? 'buyer' : 'seller';
  const listingType: 'cash_only' | 'accept_sp' | 'donate' =
    q.listingType === 'accept_sp' || q.listingType === 'donate' ? q.listingType : 'cash_only';
  const tradeStatus: 'initiated' | 'completed' =
    q.tradeStatus === 'initiated' ? 'initiated' : 'completed';
  const tradeId = q.tradeId || '00000000-0000-0000-0000-000000000000';

  const ready = await waitForNavigationReady();
  if (!ready) {
    // eslint-disable-next-line no-console
    console.warn('[QaForceTradeSuccessDeepLink] Navigation not ready — skipping');
    return;
  }

  // TradeSuccess derives the subscription tier from the session (test-seller =
  // subscriber → Permutation 5 "Sold for cash!" for role=seller+cash_only).
  navigationRef.navigate(
    'TradeSuccess',
    {
      tradeId,
      success: true,
      role,
      tradeStatus,
      listingType,
      spUsed: toNumber(q.spUsed, 0),
      totalSpToSeller: toNumber(q.totalSpToSeller, 0),
      spPendingReleaseDays: toNumber(q.spPendingReleaseDays, 3),
      remainingSP: toNumber(q.remainingSP, 0),
      spAmountDollars: toNumber(q.spAmountDollars, 0),
      feeSavingsCents: toNumber(q.feeSavingsCents, 0),
    } as never
  );
  // eslint-disable-next-line no-console
  console.log(
    `[QaForceTradeSuccessDeepLink] Navigating TradeSuccess role=${role} listingType=${listingType} tradeStatus=${tradeStatus}`
  );
}

/**
 * Renders nothing. Listens for the qa-trade-success deep link and force-navigates
 * to the TradeSuccess screen with the requested params.
 *
 * Must be mounted INSIDE AuthProvider (uses useAuth to check the session).
 */
export default function QaForceTradeSuccessDeepLinkHandler() {
  const { session } = useAuth();
  const enabled = QA_FORCE_TRADE_SUCCESS_DEEP_LINK_ENABLED;

  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    if (!enabled) return;

    const handleUrl = (event: { url: string }) => {
      if (isQaTradeSuccessUrl(event.url)) {
        void forceTradeSuccess(event.url, Boolean(sessionRef.current));
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);

    // Cold start: the app may have been launched via the deep link URL.
    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl && isQaTradeSuccessUrl(initialUrl)) {
        void forceTradeSuccess(initialUrl, Boolean(sessionRef.current));
      }
    });

    return () => subscription.remove();
  }, [enabled]);

  return null;
}
