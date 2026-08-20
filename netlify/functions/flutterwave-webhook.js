// Configure this URL in your Flutterwave Dashboard → Settings → Webhooks:
//   https://YOUR-SITE.netlify.app/.netlify/functions/flutterwave-webhook
// and set the same "Secret Hash" value there as the FLW_WEBHOOK_SECRET_HASH
// environment variable in Netlify.
//
// This exists as a durable backup to verify-transaction.js: if a donor's
// browser closes right after paying (before verify-transaction finishes),
// this webhook still fires from Flutterwave's side and completes the
// receipt email. It shares the same Netlify Blobs dedupe key so a donor
// never gets two receipt emails for one gift.

const { verifyTransaction, isValidWebhookSignature } = require("./_shared/flutterwave");
const { sendEmail } = require("./_shared/resend");
const { receiptEmailHtml, receiptEmailText } = require("./_shared/receipt-email");
const { alreadyProcessed, markProcessed } = require("./_shared/store");

const SEND_FROM = process.env.SEND_FROM_EMAIL || "Biyaya CDC <receipts@biyayacdc.org>";
const FINANCE_BCC = process.env.FINANCE_BCC_EMAIL || "finance@biyayacdc.org";

function generateReceiptId(txRef) {
  const year = new Date().getFullYear();
  const suffix = String(txRef).replace(/\D/g, "").slice(-4).padStart(4, "0");
  return `BCDC${year}-${suffix}`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const providedHash = event.headers["verif-hash"] || event.headers["Verif-Hash"];
  if (!isValidWebhookSignature(providedHash)) {
    console.warn("flutterwave-webhook: invalid or missing verif-hash header.");
    return { statusCode: 401, body: "Unauthorized" };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  // Flutterwave sends various event types; we only act on successful charges.
  const eventType = body.event || (body.data && body.data.status);
  const txId = body.data && body.data.id;
  if (!txId) {
    return { statusCode: 200, body: "Ignored (no transaction id)" };
  }

  try {
    // Always re-verify with the API rather than trusting the webhook body
    // directly — this is the same rule as the fast-path endpoint.
    const verification = await verifyTransaction(txId);
    const tx = verification && verification.data;

    if (!tx || verification.status !== "success" || tx.status !== "successful") {
      return { statusCode: 200, body: "Ignored (not a verified successful charge)" };
    }

    const txRef = tx.tx_ref;
    const wasAlreadyProcessed = await alreadyProcessed(txRef);
    if (wasAlreadyProcessed) {
      return { statusCode: 200, body: "Already processed" };
    }

    const receiptId = generateReceiptId(txRef);
    const donorName = (tx.customer && tx.customer.name) || "Friend of Biyaya";
    const donorEmail = tx.customer && tx.customer.email;
    const amount = `${tx.currency} ${Number(tx.amount).toLocaleString()}`;
    const paymentMethod = tx.payment_type
      ? tx.payment_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : "Flutterwave";
    const donationDate = new Date(tx.created_at || Date.now()).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    if (donorEmail) {
      await sendEmail({
        to: donorEmail,
        from: SEND_FROM,
        bcc: FINANCE_BCC,
        subject: `Official Donation Receipt: Your Impact at Biyaya CDC (Receipt ID: #${receiptId})`,
        html: receiptEmailHtml({
          donorName,
          receiptId,
          donationDate,
          amount,
          paymentMethod,
          designatedActivity: "Where most needed",
        }),
        text: receiptEmailText({
          donorName,
          receiptId,
          donationDate,
          amount,
          paymentMethod,
          designatedActivity: "Where most needed",
        }),
      });
    }

    await markProcessed(txRef, { receiptId, donorEmail, amount, source: "webhook" });
    return { statusCode: 200, body: "Processed" };
  } catch (err) {
    console.error("flutterwave-webhook error:", err);
    // Return 200 anyway so Flutterwave doesn't hammer retries for an error
    // on our side that a human needs to look at — but log loudly.
    return { statusCode: 200, body: "Logged error" };
  }
};
