// A donation can get verified twice — once when the donor's browser calls
// verify-transaction right after checkout, and again if Flutterwave's
// webhook also fires. Netlify Blobs gives us a tiny, zero-setup key/value
// store so we only ever send one receipt email per transaction reference.

const { getStore } = require("@netlify/blobs");

function processedDonationsStore() {
  return getStore("processed-donations");
}

async function alreadyProcessed(txRef) {
  const store = processedDonationsStore();
  const existing = await store.get(txRef);
  return Boolean(existing);
}

async function markProcessed(txRef, meta) {
  const store = processedDonationsStore();
  await store.setJSON(txRef, { processedAt: new Date().toISOString(), ...meta });
}

module.exports = { alreadyProcessed, markProcessed };
