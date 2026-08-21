// Server-side Flutterwave helpers. The Secret Key must NEVER be exposed to
// the browser — it only ever lives in Netlify environment variables and is
// used here, inside a serverless function.

const crypto = require("crypto");

/**
 * Verify a transaction directly with Flutterwave using its transaction ID.
 * This is the source of truth — never trust the "successful" status a
 * browser reports on its own, always re-check server-side before sending a
 * receipt or treating a donation as received.
 */
async function verifyTransaction(transactionId) {
  const secretKey = process.env.FLW_SECRET_KEY;
  if (!secretKey) {
    throw new Error("FLW_SECRET_KEY is not set in the environment.");
  }

  const res = await fetch(
    `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
    {
      headers: { Authorization: `Bearer ${secretKey}` },
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Flutterwave verify API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data; // { status, data: { status, amount, currency, tx_ref, customer, ... } }
}

/**
 * Compare the `verif-hash` header Flutterwave sends on webhook requests
 * against the Secret Hash you configure in your Flutterwave dashboard
 * (Settings → Webhooks). This proves the request really came from
 * Flutterwave and wasn't forged.
 */
function isValidWebhookSignature(providedHash) {
  const expected = process.env.FLW_WEBHOOK_SECRET_HASH;
  if (!expected || !providedHash) return false;
  const a = Buffer.from(String(providedHash));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { verifyTransaction, isValidWebhookSignature };
