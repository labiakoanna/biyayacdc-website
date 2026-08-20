// Renders the "Automated Email Receipt Template" from the Biyaya CDC
// constitution (Articles 10–12) as an email-safe HTML document. Email
// clients strip external stylesheets and custom fonts, so everything here
// is inline and uses web-safe fonts only.

function receiptEmailHtml(data) {
  const {
    donorName,
    receiptId,
    donationDate,
    amount,
    paymentMethod,
    designatedActivity,
    receiptPdfUrl,
  } = data;

  return `
  <div style="background:#F4EDDD;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;color:#171712;">
    <div style="max-width:560px;margin:0 auto;background:#FFFEFB;border-radius:12px;overflow:hidden;border:1px solid #dbe4f2;">
      <div style="background:#0B1D3A;padding:28px 32px;">
        <p style="margin:0;color:#E4A72A;font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-family:Arial,sans-serif;">Official Donation Receipt</p>
        <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;">Your Impact at Biyaya CDC</h1>
        <p style="margin:6px 0 0;color:#cfd6e6;font-size:13px;font-family:Arial,sans-serif;">Receipt ID: #${receiptId}</p>
      </div>
      <div style="padding:32px;">
        <p>Dear ${donorName},</p>
        <p>Thank you for your generous financial contribution to Biyaya Child Development Centre (Biyaya CDC). We have safely received your gift, and a formal breakdown of your transaction is provided below.</p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border-collapse:collapse;font-family:'Courier New',monospace;font-size:13px;">
          <tr><td style="padding:9px 0;border-bottom:1px dashed #dbe4f2;color:#6b6858;">Donor name</td><td style="padding:9px 0;border-bottom:1px dashed #dbe4f2;text-align:right;font-weight:bold;">${donorName}</td></tr>
          <tr><td style="padding:9px 0;border-bottom:1px dashed #dbe4f2;color:#6b6858;">Receipt ID</td><td style="padding:9px 0;border-bottom:1px dashed #dbe4f2;text-align:right;font-weight:bold;">#${receiptId}</td></tr>
          <tr><td style="padding:9px 0;border-bottom:1px dashed #dbe4f2;color:#6b6858;">Date received</td><td style="padding:9px 0;border-bottom:1px dashed #dbe4f2;text-align:right;font-weight:bold;">${donationDate}</td></tr>
          <tr><td style="padding:9px 0;border-bottom:1px dashed #dbe4f2;color:#6b6858;">Contribution amount</td><td style="padding:9px 0;border-bottom:1px dashed #dbe4f2;text-align:right;font-weight:bold;">${amount}</td></tr>
          <tr><td style="padding:9px 0;border-bottom:1px dashed #dbe4f2;color:#6b6858;">Payment method</td><td style="padding:9px 0;border-bottom:1px dashed #dbe4f2;text-align:right;font-weight:bold;">${paymentMethod}</td></tr>
          <tr><td style="padding:9px 0;color:#6b6858;">Designated activity</td><td style="padding:9px 0;text-align:right;font-weight:bold;">${designatedActivity}</td></tr>
        </table>

        <h3 style="font-size:16px;margin:24px 0 8px;">Financial Accountability &amp; Custody Declaration</h3>
        <p style="font-family:Arial,sans-serif;font-size:13px;color:#3f3d35;">In strict adherence to Article 12 (Fund Security) and Article 13 (Auditing) of the Biyaya CDC Constitution:</p>
        <ul style="font-family:Arial,sans-serif;font-size:13px;color:#3f3d35;padding-left:20px;">
          <li>Your funds have been deposited directly into our official project account at Equity Bank (Adjumani Branch).</li>
          <li>No funds can be withdrawn without the joint authorization and signatures of our Chairperson, Secretary and Treasurer.</li>
          <li>Our Overseer (the serving Parish Priest of St. Luke Church of Uganda) retains physical charge of all cheque booklets.</li>
          <li>This transaction will be recorded in our books of account, externally audited annually by the Madi and West Nile Diocese.</li>
        </ul>

        <h3 style="font-size:16px;margin:24px 0 8px;">Your Grassroots Impact in Adjumani District</h3>
        <p>Because of your obedience to God&rsquo;s work, a vulnerable child living within the 3&nbsp;km radius of our centre in Biyaya Village will receive holistic, Christ-centred transformation (John 15:16).</p>

        ${
          receiptPdfUrl
            ? `<div style="text-align:center;margin:28px 0;"><a href="${receiptPdfUrl}" style="background:#EF6350;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-family:Arial,sans-serif;font-weight:bold;font-size:14px;display:inline-block;">Download Official Signed Receipt (PDF)</a></div>`
            : ""
        }

        <p style="font-family:Arial,sans-serif;font-size:12px;color:#6b6858;">If you have any questions regarding your contribution or wish to receive updates from our Donor Relations team, please reply directly to this email or contact our treasurer at <a href="mailto:finance@biyayacdc.org" style="color:#EF6350;">finance@biyayacdc.org</a>.</p>

        <p style="margin-top:24px;font-style:italic;color:#0B1D3A;">May the Lord bless you abundantly for your kindness.<br>In His Service,<br>The Executive Committee &mdash; Biyaya Child Development Centre<br>St. Luke Church of Uganda, Adjumani</p>
      </div>
    </div>
  </div>`;
}

function receiptEmailText(data) {
  const { donorName, receiptId, donationDate, amount, paymentMethod, designatedActivity } = data;
  return `Official Donation Receipt — Biyaya CDC (Receipt ID: #${receiptId})

Dear ${donorName},

Thank you for your generous financial contribution to Biyaya Child Development Centre (Biyaya CDC). We have safely received your gift.

Donor name: ${donorName}
Receipt ID: #${receiptId}
Date received: ${donationDate}
Contribution amount: ${amount}
Payment method: ${paymentMethod}
Designated activity: ${designatedActivity}

Financial Accountability & Custody Declaration
- Funds deposited directly into our official project account at Equity Bank (Adjumani Branch).
- No funds can be withdrawn without joint authorization from the Chairperson, Secretary and Treasurer.
- Our Overseer (serving Parish Priest of St. Luke Church of Uganda) retains cheque-booklet custody.
- Annual external audit by the Madi and West Nile Diocese.

Because of your obedience to God's work, a vulnerable child within the 3km radius of Biyaya Village will receive holistic, Christ-centred transformation (John 15:16).

Questions? Reply to this email or contact finance@biyayacdc.org.

In His Service,
The Executive Committee — Biyaya Child Development Centre`;
}

module.exports = { receiptEmailHtml, receiptEmailText };
