import { NextResponse } from 'next/server';

// R7 — Web-first subscription purchase (Option A)
// Server route: calls the Supabase create-checkout-session Edge Function with
// the shared web secret, then returns the hosted Stripe Checkout URL.
// Card data is collected on Stripe's PCI-DSS L1 domain (SAQ-A) — this server
// never touches raw card numbers.

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUBSCRIPTION_WEB_SECRET = process.env.SUBSCRIPTION_WEB_SECRET || '';
// External Provider Dev Mode (MANDATORY): when true, this route does NOT call
// Stripe or the checkout Edge Function — it returns the local success page so
// the web flow is testable without a live Stripe Price / webhook / secret.
// Production must NEVER set SUBSCRIPTION_DEV_MODE=true.
const DEV_MODE = process.env.SUBSCRIPTION_DEV_MODE === 'true';

export async function POST(req: Request) {
  let email = '';
  try {
    const body = await req.json();
    email = (body?.email || '').trim().toLowerCase();
  } catch {
    // fall through to validation below
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { success: false, error: { code: 'EMAIL_REQUIRED', message: 'A valid email address is required.' } },
      { status: 400 },
    );
  }

  // ── DEV fallback: complete the web flow without live Stripe config ──────
  if (DEV_MODE) {
    console.warn('[checkout] DEV_MODE: returning mock checkout success URL (no Stripe call)');
    const origin = new URL(req.url).origin;
    return NextResponse.json({
      success: true,
      url: `${origin}/account/subscription?email=${encodeURIComponent(email)}&session_id=dev_mock_${Date.now()}`,
      bind_token: null,
    });
  }

  if (!SUPABASE_URL || !SUBSCRIPTION_WEB_SECRET) {
    console.error('[checkout] Missing SUPABASE_URL or SUBSCRIPTION_WEB_SECRET');
    return NextResponse.json(
      { success: false, error: { code: 'CONFIG_UNAVAILABLE', message: 'Checkout is not configured yet. Please try again later.' } },
      { status: 500 },
    );
  }

  try {
    const efRes = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-web-secret': SUBSCRIPTION_WEB_SECRET,
      },
      body: JSON.stringify({ email }),
    });

    const efBody = await efRes.json();
    if (!efRes.ok || !efBody?.success) {
      console.error('[checkout] Edge Function error', { status: efRes.status, efBody });
      return NextResponse.json(
        {
          success: false,
          error: {
            code: efBody?.error?.code || 'CHECKOUT_CREATE_FAILED',
            message: efBody?.error?.message || 'We could not start the checkout. Please try again.',
          },
        },
        { status: efRes.ok ? 502 : 500 },
      );
    }

    return NextResponse.json({ success: true, url: efBody.url, bind_token: efBody.bind_token ?? null });
  } catch (err: any) {
    console.error('[checkout] unexpected error', err?.message);
    return NextResponse.json(
      { success: false, error: { code: 'CHECKOUT_CREATE_FAILED', message: 'We could not start the checkout. Please try again.' } },
      { status: 500 },
    );
  }
}
