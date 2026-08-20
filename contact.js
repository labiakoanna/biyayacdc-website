const { sendEmail } = require("./_shared/resend");

const CONTACT_TO = process.env.CONTACT_TO_EMAIL || "info@biyayacdc.org";
const SEND_FROM = process.env.SEND_FROM_EMAIL || "Biyaya CDC Website <noreply@biyayacdc.org>";

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

  const name = (payload.name || "").trim();
  const email = (payload.email || "").trim();
  const reason = (payload.reason || "General enquiry").trim();
  const message = (payload.message || "").trim();
  // Honeypot field: real users never fill this in; bots that auto-fill every
  // field will trip it. Silently pretend success so bots don't learn to adapt.
  const honeypot = (payload.company || "").trim();

  if (honeypot) {
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  if (!name || !email || !message) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Name, email and message are required." }),
    };
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return { statusCode: 400, body: JSON.stringify({ error: "Please provide a valid email address." }) };
  }

  try {
    await sendEmail({
      to: CONTACT_TO,
      from: SEND_FROM,
      replyTo: email,
      subject: `[Website Contact] ${reason} — ${name}`,
      html: `
        <div style="font-family:Arial,sans-serif;font-size:14px;color:#171712;">
          <p><strong>From:</strong> ${escapeHtml(name)} (${escapeHtml(email)})</p>
          <p><strong>Reason:</strong> ${escapeHtml(reason)}</p>
          <p><strong>Message:</strong></p>
          <p style="white-space:pre-wrap;">${escapeHtml(message)}</p>
        </div>
      `,
      text: `From: ${name} (${email})\nReason: ${reason}\n\n${message}`,
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error("contact function error:", err);
    return {
      statusCode: 502,
      body: JSON.stringify({ error: "We couldn't send your message right now. Please try again shortly." }),
    };
  }
};
