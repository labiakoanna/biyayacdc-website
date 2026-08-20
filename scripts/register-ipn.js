#!/usr/bin/env node
/**
 * One-time setup: registers your deployed site's IPN (webhook) URL with
 * PesaPal and prints the ipn_id you need to save as the PESAPAL_IPN_ID
 * environment variable in Netlify.
 *
 * Run this ONCE, after your site is deployed and PESAPAL_CONSUMER_KEY /
 * PESAPAL_CONSUMER_SECRET are set locally (or passed inline), e.g.:
 *
 *   PESAPAL_CONSUMER_KEY=xxx PESAPAL_CONSUMER_SECRET=yyy \
 *   SITE_URL=https://biyayacdc.netlify.app \
 *   node scripts/register-ipn.js
 *
 * Re-run it if your site URL ever changes (custom domain, etc.) and update
 * PESAPAL_IPN_ID afterward.
 */

const { registerIPN } = require("../netlify/functions/_shared/pesapal");

async function main() {
  const siteUrl = process.env.SITE_URL;
  if (!siteUrl) {
    console.error("Set SITE_URL to your deployed site, e.g. https://biyayacdc.netlify.app");
    process.exit(1);
  }

  const ipnUrl = `${siteUrl.replace(/\/$/, "")}/.netlify/functions/pesapal-ipn`;
  console.log("Registering IPN URL:", ipnUrl);

  const result = await registerIPN(ipnUrl);
  console.log("\nPesaPal response:", result);
  console.log(`\nSave this in Netlify as PESAPAL_IPN_ID = ${result.ipn_id}`);
}

main().catch((err) => {
  console.error("Failed to register IPN:", err);
  process.exit(1);
});
