// Server-side PesaPal (API v3) helpers. The Consumer Key/Secret must NEVER
// be exposed to the browser — they only ever live in Netlify environment
// variables and are used here, inside serverless functions.
//
// PesaPal has two environments with different base URLs:
//   Sandbox: https://cybqa.pesapal.com/pesapalv3
//   Live:    https://pay.pesapal.com/v3
// Set PESAPAL_ENV=sandbox while testing, then switch to "live" (or just set
// PESAPAL_BASE_URL directly) when you're ready to accept real payments.

const BASE_URL =
  process.env.PESAPAL_BASE_URL ||
  (process.env.PESAPAL_ENV === "live"
    ? "https://pay.pesapal.com/v3"
    : "https://cybqa.pesapal.com/pesapalv3");

let cachedToken = null;
let cachedTokenExpiry = 0;

/**
 * PesaPal access tokens are short-lived (~5 minutes). We cache in-memory
 * for the lifetime of the function instance to avoid a token request on
 * every single call within the same warm invocation.
 */
async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiry) {
    return cachedToken;
  }

  const consumerKey = process.env.PESAPAL_CONSUMER_KEY;
  const consumerSecret = process.env.PESAPAL_CONSUMER_SECRET;
  if (!consumerKey || !consumerSecret) {
    throw new Error("PESAPAL_CONSUMER_KEY / PESAPAL_CONSUMER_SECRET are not set in the environment.");
  }

  const res = await fetch(`${BASE_URL}/api/Auth/RequestToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ consumer_key: consumerKey, consumer_secret: consumerSecret }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`PesaPal auth error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  if (!data.token) {
    throw new Error(`PesaPal auth did not return a token: ${JSON.stringify(data)}`);
  }

  cachedToken = data.token;
  // PesaPal tokens expire in 5 minutes; refresh a little early to be safe.
  cachedTokenExpiry = now + 4 * 60 * 1000;
  return cachedToken;
}

/**
 * One-time setup: registers your IPN (webhook) URL with PesaPal and returns
 * an ipn_id. Run this once (e.g. via a local script or the Netlify CLI) and
 * store the resulting ID in the PESAPAL_IPN_ID environment variable — every
 * order submission after that references the same registered IPN.
 */
async function registerIPN(url) {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}/api/URLSetup/RegisterIPN`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ url, ipn_notification_type: "GET" }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`PesaPal RegisterIPN error (${res.status}): ${errText}`);
  }
  return res.json(); // { ipn_id, url, ... }
}

/**
 * Submits a donation as a PesaPal order. Returns a redirect_url — send the
 * donor's browser there (a full-page redirect, not a modal) to complete
 * payment on PesaPal's hosted checkout, where they choose Mobile Money or
 * Card themselves.
 */
async function submitOrder({
  merchantReference,
  amount,
  currency,
  description,
  callbackUrl,
  notificationId,
  billing,
}) {
  const token = await getAccessToken();

  const payload = {
    id: merchantReference,
    currency: currency || "UGX",
    amount,
    description,
    callback_url: callbackUrl,
    notification_id: notificationId,
    billing_address: {
      email_address: billing.email,
      phone_number: billing.phone || "",
      first_name: billing.firstName || billing.name || "Friend",
      last_name: billing.lastName || "of Biyaya",
    },
  };

  const res = await fetch(`${BASE_URL}/api/Transactions/SubmitOrderRequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`PesaPal SubmitOrderRequest error (${res.status}): ${errText}`);
  }

  return res.json(); // { order_tracking_id, redirect_url, merchant_reference, status }
}

/**
 * The source of truth for whether a donation actually completed. Always
 * re-check here server-side before sending a receipt — never trust a
 * redirect query string or client-reported status on its own.
 */
async function getTransactionStatus(orderTrackingId) {
  const token = await getAccessToken();
  const res = await fetch(
    `${BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`,
    {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`PesaPal GetTransactionStatus error (${res.status}): ${errText}`);
  }

  return res.json();
  // Notable fields: payment_status_description ("Completed" | "Failed" | "Invalid" | "Reversed"),
  // amount, currency, payment_method, confirmation_code, created_date, merchant_reference
}

module.exports = { getAccessToken, registerIPN, submitOrder, getTransactionStatus };
