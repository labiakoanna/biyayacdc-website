// Called by the browser when the donor clicks "Secure My Donation" and has
// chosen to pay online (Mobile Money or Card via PesaPal). We submit the
// order to PesaPal and hand back a redirect_url — the front end then does a
// full-page redirect there. PesaPal's hosted page lets the donor pick
// Mobile Money or Card themselves, so we don't need to split that choice
// on our own form.

const crypto = require("crypto");
const { submitOrder } = require("./_shared/pesapal");

function generateMerchantReference() {
  return "BCDC-" + Date.now() + "-" + crypto.randomBytes(3).toString("hex").toUpperCase();
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body." }) };
  }

  const { amount, currency, donorName, donorEmail, donorPhone, designatedActivity, sponsorChildId } = payload;

  const numericAmount = Number(amount);
  if (!numericAmount || numericAmount <= 0) {
    return { statusCode: 400, body: JSON.stringify({ error: "A valid donation amount is required." }) };
  }
  if (!donorEmail) {
    return { statusCode: 400, body: JSON.stringify({ error: "An email address is required so we can send your receipt." }) };
  }

  const siteUrl = process.env.URL || process.env.SITE_URL || "";
  const notificationId = process.env.PESAPAL_IPN_ID;
  if (!notificationId) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "PESAPAL_IPN_ID is not configured. Register your IPN URL with PesaPal first." }),
    };
  }

  const merchantReference = generateMerchantReference();

  try {
    const order = await submitOrder({
      merchantReference,
      amount: numericAmount,
      currency: currency || "UGX",
      description: `Donation to Biyaya CDC${designatedActivity ? " — " + designatedActivity : ""}`.slice(0, 100),
      callbackUrl: `${siteUrl}/donate.html`,
      notificationId,
      billing: {
        email: donorEmail,
        phone: donorPhone,
        name: donorName,
      },
    });

    if (!order.redirect_url) {
      return { statusCode: 502, body: JSON.stringify({ error: "PesaPal did not return a checkout URL." }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        redirectUrl: order.redirect_url,
        orderTrackingId: order.order_tracking_id,
        merchantReference,
      }),
    };
  } catch (err) {
    console.error("create-payment error:", err);
    return {
      statusCode: 502,
      body: JSON.stringify({ error: "We couldn't start your payment right now. Please try again shortly." }),
    };
  }
};
