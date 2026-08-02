// Server-side client for PayHere's Refund API (OAuth-secured, separate from
// the checkout/notify flow in app/api/payments/payhere/*, which only ever
// collects payment). Used by the admin "Refund" action in
// app/api/admin/reservations/[id]/route.ts.
const SANDBOX  = process.env.PAYHERE_SANDBOX !== 'false';
const APP_ID     = process.env.PAYHERE_APP_ID     || '';
const APP_SECRET = process.env.PAYHERE_APP_SECRET || '';

const OAUTH_URL = SANDBOX
  ? 'https://sandbox.payhere.lk/merchant/v1/oauth/token'
  : 'https://www.payhere.lk/merchant/v1/oauth/token';
const REFUND_URL = SANDBOX
  ? 'https://sandbox.payhere.lk/merchant/v1/payment/refund'
  : 'https://www.payhere.lk/merchant/v1/payment/refund';

export function payhereRefundConfigured(): boolean {
  return Boolean(APP_ID && APP_SECRET);
}

// Cached in module scope — tokens are valid ~599s, so most refund calls
// within that window reuse the same one instead of re-authenticating.
let cachedToken: { token: string; expiresAt: number } | null = null;

async function fetchAccessToken(): Promise<string> {
  const auth = Buffer.from(`${APP_ID}:${APP_SECRET}`).toString('base64');
  const res = await fetch(OAUTH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || 'Failed to get PayHere access token');
  }
  // Subtract a small buffer (30s) so we refresh slightly before actual expiry.
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 30) * 1000 };
  return cachedToken.token;
}

async function getAccessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }
  return fetchAccessToken();
}

export interface RefundResult {
  ok: boolean;
  message: string;
  refundId?: string | number;
}

// Refunds a PayHere payment. `paymentId` is PayHere's own payment id
// (Payment.payhereId), not our internal bookingNumber. Omitting `amount`
// refunds the full payment; providing it makes a PARTIAL refund — per
// PayHere's Refund API, the presence of the "amount" field in the body is
// what switches the call to a partial refund.
export async function refundPayHerePayment({ paymentId, reason, amount }: { paymentId: string; reason: string; amount?: number }): Promise<RefundResult> {
  if (!payhereRefundConfigured()) {
    return { ok: false, message: 'PayHere refund credentials are not configured. Add PAYHERE_APP_ID and PAYHERE_APP_SECRET to .env' };
  }

  const body: Record<string, string> = { payment_id: paymentId, description: reason };
  if (amount != null && amount > 0) {
    body.amount = amount.toFixed(2);
  }

  const call = async (token: string) => fetch(REFUND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  let token = await getAccessToken();
  let res = await call(token);
  let data = await res.json();

  // Token expired/invalid mid-flight — refresh once and retry.
  if (data.error === 'invalid_token') {
    token = await getAccessToken(true);
    res = await call(token);
    data = await res.json();
  }

  if (data.error) {
    return { ok: false, message: data.error_description || 'PayHere authorization error' };
  }
  if (data.status === 1) {
    return { ok: true, message: data.msg || 'Refund processed', refundId: data.data };
  }
  return { ok: false, message: data.msg || 'Refund failed' };
}
