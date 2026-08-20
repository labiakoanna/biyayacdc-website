// Called by the browser when PesaPal redirects the donor back to
// donate.html with ?OrderTrackingId=...&OrderMerchantReference=... in the
// URL. We NEVER trust those query params on their own — we re-check the
// transaction status directly with PesaPal using the secret-backed access
// token before sending a receipt or telling the donor their gift was
// received.
//
// This is the fast path (donor sees their receipt within a second or two
// of landing back on the site). pesapal-ipn.js is the durable backup path
// in case the donor closes their browser mid-redirect.

const { getTransactionStatus } = require("./_shared/pesapal");
const { sendEmail } = require("./_shared/resend");
const { receiptEmailHtml, receiptEmailText } = require("./_shared/receipt-email");
const { alreadyProcessed, markProcessed } = require("./_shared/store");

const SEND_FROM = process.env.SEND_FROM_EMAIL || "Biyaya CDC <receipts@biyayacdc.org>";
const FINANCE_BCC = process.env.FINANCE_BCC_EMAIL || "finance@biyayacdc.org";

function generateReceiptId(merchantRef) {
  const year = new Date().getFullYear();
  const suffix = String(merchantRef).replace(/\D/g, "").slice(-4).padStart(4, "0");
  return `BCDC${year}-${suffix}`;
}

exports.handler = async (event) => {
  const orderTrackingId =
    event.httpMethod === "POST"
      ? JSON.parse(event.body || "{}").orderTrackingId
      : event.queryStringParameters && event.queryStringParameters.orderTrackingId;

  if (!orderTrackingId) {
    return { statusCode: 400, body: JSON.stringify({ error: "orderTrackingId is required." }) };
  }

  try {
    const status = await getTransactionStatus(orderTrackingId);

    const isCompleted =
      status &&
      (status.payment_status_description === "Completed" ||
        status.status_code === 1); // 1 = COMPLETED in PesaPal's numeric status codes

    if (!isCompleted) {
      return {
        statusCode: 402,
        body: JSON.stringify({
          error: "Payment has not completed yet.",
          status: status && status.payment_status_description,
        }),
      };
    }

    const merchantRef = status.merchant_reference || orderTrackingId;
    const receiptId = generateReceiptId(merchantRef);
    const donorEmail = status.billing_address && status.billing_address.email_address;
    const donorName =
      (status.billing_address &&
        [status.billing_address.first_name, status.billing_address.last_name].filter(Boolean).join(" ")) ||
      "Friend of Biyaya";
    const amount = `${status.currency || "UGX"} ${Number(status.amount || 0).toLocaleString()}`;
    const paymentMethod = status.payment_method || "PesaPal (Mobile Money / Card)";
    const donationDate = new Date(status.created_date || Date.now()).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const receiptData = {
      donorName,
      receiptId,
      donationDate,
      amount,
      paymentMethod,
      designatedActivity: "Where most needed",
    };

    const wasAlreadyProcessed = await alreadyProcessed(merchantRef);
    if (!wasAlreadyProcessed && donorEmail) {
      await sendEmail({
        to: donorEmail,
        from: SEND_FROM,
        bcc: FINANCE_BCC,
        subject: `Official Donation Receipt: Your Impact at Biyaya CDC (Receipt ID: #${receiptId})`,
        html: receiptEmailHtml(receiptData),
        text: receiptEmailText(receiptData),
      });
      await markProcessed(merchantRef, { receiptId, donorEmail, amount, source: "verify-transaction" });
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, receipt: receiptData }) };
  } catch (err) {
    console.error("verify-transaction error:", err);
    return {
      statusCode: 502,
      body: JSON.stringify({
        error:
          "We couldn't confirm your payment right now. If you were charged, contact finance@biyayacdc.org with your order reference.",
      }),
    };
  }
};
