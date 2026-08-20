// Register this URL with PesaPal once (see _shared/pesapal.js registerIPN
// helper, or PesaPal's dashboard):
//   https://YOUR-SITE.netlify.app/.netlify/functions/pesapal-ipn
// Save the returned ipn_id as the PESAPAL_IPN_ID environment variable —
// every order submitted in create-payment.js references it.
//
// PesaPal calls this URL (GET by default) with OrderTrackingId and
// OrderMerchantReference query params whenever a transaction's status
// changes. This exists as a durable backup to verify-transaction.js: if a
// donor's browser closes right after paying (before the redirect-triggered
// verify call finishes), this IPN still fires from PesaPal's side and
// completes the receipt email. It shares the same Netlify Blobs dedupe key
// so a donor never gets two receipt emails for one gift.
//
// PesaPal expects a specific JSON acknowledgement back — see the return
// value below — so it can mark the IPN as delivered.

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

function ipnAck({ orderTrackingId, orderMerchantReference, orderNotificationType, statusCode }) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderNotificationType: orderNotificationType || "IPNCHANGE",
      orderTrackingId,
      orderMerchantReference,
      status: statusCode, // 200 = received OK, 500 = we failed to process it
    }),
  };
}

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  const orderTrackingId = params.OrderTrackingId || params.orderTrackingId;
  const orderMerchantReference = params.OrderMerchantReference || params.orderMerchantReference;
  const orderNotificationType = params.OrderNotificationType || params.orderNotificationType;

  if (!orderTrackingId) {
    return { statusCode: 400, body: "Missing OrderTrackingId" };
  }

  try {
    // Always re-verify with the API rather than trusting the query string —
    // same rule as the fast-path endpoint.
    const status = await getTransactionStatus(orderTrackingId);

    const isCompleted =
      status && (status.payment_status_description === "Completed" || status.status_code === 1);

    if (!isCompleted) {
      return ipnAck({ orderTrackingId, orderMerchantReference, orderNotificationType, statusCode: 200 });
    }

    const merchantRef = status.merchant_reference || orderMerchantReference || orderTrackingId;
    const wasAlreadyProcessed = await alreadyProcessed(merchantRef);
    if (wasAlreadyProcessed) {
      return ipnAck({ orderTrackingId, orderMerchantReference, orderNotificationType, statusCode: 200 });
    }

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

    if (donorEmail) {
      const receiptData = {
        donorName,
        receiptId,
        donationDate,
        amount,
        paymentMethod,
        designatedActivity: "Where most needed",
      };
      await sendEmail({
        to: donorEmail,
        from: SEND_FROM,
        bcc: FINANCE_BCC,
        subject: `Official Donation Receipt: Your Impact at Biyaya CDC (Receipt ID: #${receiptId})`,
        html: receiptEmailHtml(receiptData),
        text: receiptEmailText(receiptData),
      });
    }

    await markProcessed(merchantRef, { receiptId, donorEmail, amount, source: "ipn" });
    return ipnAck({ orderTrackingId, orderMerchantReference, orderNotificationType, statusCode: 200 });
  } catch (err) {
    console.error("pesapal-ipn error:", err);
    // Tell PesaPal we failed to process it so it can retry, but log loudly
    // for a human to investigate.
    return ipnAck({ orderTrackingId, orderMerchantReference, orderNotificationType, statusCode: 500 });
  }
};
