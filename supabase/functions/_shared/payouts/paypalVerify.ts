// File: supabase/functions/_shared/payouts/paypalVerify.ts

type PayPalEnv = {
  clientId: string;
  clientSecret: string;
  webhookId: string;
  baseUrl: string;
};

type PayPalVerifyHeaders = {
  transmissionId: string;
  transmissionTime: string;
  transmissionSig: string;
  certUrl: string;
  authAlgo: string;
};

function requireEnv(name: string): string {
  const value = (Deno.env.get(name) ?? '').trim();
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export function getPayPalEnv(): PayPalEnv {
  return {
    clientId: requireEnv('PAYPAL_CLIENT_ID'),
    clientSecret: requireEnv('PAYPAL_CLIENT_SECRET'),
    webhookId: requireEnv('PAYPAL_WEBHOOK_ID'),
    baseUrl: (Deno.env.get('PAYPAL_BASE_URL') ?? 'https://api-m.paypal.com').trim(),
  };
}

async function getAccessToken(env: PayPalEnv): Promise<string> {
  const url = `${env.baseUrl.replace(/\/$/, '')}/v1/oauth2/token`;
  const basic = btoa(`${env.clientId}:${env.clientSecret}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`PayPal token request failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  const token = json?.access_token;
  if (!token) throw new Error('PayPal token response missing access_token');
  return String(token);
}

export async function verifyPayPalWebhookSignature(params: {
  env: PayPalEnv;
  headers: PayPalVerifyHeaders;
  webhookEvent: unknown;
}): Promise<boolean> {
  const url = `${params.env.baseUrl.replace(/\/$/, '')}/v1/notifications/verify-webhook-signature`;
  const accessToken = await getAccessToken(params.env);

  const payload = {
    auth_algo: params.headers.authAlgo,
    cert_url: params.headers.certUrl,
    transmission_id: params.headers.transmissionId,
    transmission_sig: params.headers.transmissionSig,
    transmission_time: params.headers.transmissionTime,
    webhook_id: params.env.webhookId,
    webhook_event: params.webhookEvent,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`PayPal verify request failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  return String(json?.verification_status || '').toUpperCase() === 'SUCCESS';
}

export function readPayPalVerifyHeaders(req: Request): PayPalVerifyHeaders {
  return {
    transmissionId: (req.headers.get('paypal-transmission-id') ?? '').trim(),
    transmissionTime: (req.headers.get('paypal-transmission-time') ?? '').trim(),
    transmissionSig: (req.headers.get('paypal-transmission-sig') ?? '').trim(),
    certUrl: (req.headers.get('paypal-cert-url') ?? '').trim(),
    authAlgo: (req.headers.get('paypal-auth-algo') ?? '').trim(),
  };
}

export function hasAllPayPalVerifyHeaders(headers: PayPalVerifyHeaders): boolean {
  return Boolean(
    headers.transmissionId &&
      headers.transmissionTime &&
      headers.transmissionSig &&
      headers.certUrl &&
      headers.authAlgo
  );
}
