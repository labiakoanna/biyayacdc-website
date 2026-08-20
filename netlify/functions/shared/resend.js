// Thin wrapper around the Resend API (https://resend.com).
// Requires the RESEND_API_KEY environment variable to be set in Netlify.
//
// Why Resend: simplest API for a small nonprofit site (no SMTP server to
// manage), generous free tier, and a single verified sending domain covers
// both the contact form and donation receipts.

async function sendEmail({ to, from, subject, html, text, replyTo, bcc }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set in the environment.");
  }

  const payload = {
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  };
  if (text) payload.text = text;
  if (replyTo) payload.reply_to = replyTo;
  if (bcc) payload.bcc = Array.isArray(bcc) ? bcc : [bcc];

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Resend API error (${res.status}): ${errText}`);
  }

  return res.json();
}

module.exports = { sendEmail };
