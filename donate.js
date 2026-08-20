/* Biyaya CDC — Donation form + automated receipt (PesaPal)
   --------------------------------------------------------------------------
   HOW THIS FLOW WORKS
   1) Donor fills the form and picks "Pay Online via PesaPal" or
      "Direct Bank Transfer".
   2a) PesaPal route: we POST the donation details to /api/create-payment,
       which asks PesaPal for a hosted checkout URL, then we redirect the
       donor's whole browser there (PesaPal itself lets them choose Mobile
       Money or Card — there's no inline modal for this gateway).
   2b) Bank route: no redirect — we just scroll to the bank transfer card
       further down this page.
   3) PesaPal redirects the donor back to this same page with
      ?OrderTrackingId=...&OrderMerchantReference=... in the URL. On load,
      if those params are present, we call /api/verify-transaction, which
      re-checks the payment server-side (never trust the URL alone) and
      returns receipt data if it truly succeeded.
   4) A Netlify Function (pesapal-ipn.js) is also registered directly with
      PesaPal as a webhook — a durable backup in case the donor's browser
      closes before step 3 finishes. See netlify/functions/pesapal-ipn.js
      and scripts/register-ipn.js for one-time setup.
*/
(function () {
  "use strict";

  var form = document.getElementById("donationForm");
  if (!form) return;

  var tierInputs = form.querySelectorAll('input[name="tier"]');
  var customAmount = document.getElementById("customAmount");
  var frequencyInputs = form.querySelectorAll('input[name="frequency"]');
  var routeInputs = form.querySelectorAll('input[name="route"]');
  var activityInputs = form.querySelectorAll('input[name="activity"]');

  var sumAmount = document.getElementById("summaryAmount");
  var sumFrequency = document.getElementById("summaryFrequency");
  var sumRoute = document.getElementById("summaryRoute");
  var sumActivity = document.getElementById("summaryActivity");

  var TIER_LABELS = {
    "35000": "UGX 35,000 / $10",
    "105000": "UGX 105,000 / $30",
    "250000": "UGX 250,000 / $70"
  };
  var ROUTE_LABELS = {
    pesapal: "Online via PesaPal (Mobile Money / Card)",
    bank: "Direct Bank Transfer — Equity Bank"
  };

  function selectedValue(nodeList) {
    for (var i = 0; i < nodeList.length; i++) {
      if (nodeList[i].checked) return nodeList[i].value;
    }
    return null;
  }

  function currentAmountValue() {
    if (customAmount && customAmount.value && document.activeElement === customAmount) {
      return Number(customAmount.value);
    }
    var tier = selectedValue(tierInputs);
    if (tier) return Number(tier);
    if (customAmount && customAmount.value) return Number(customAmount.value);
    return null;
  }

  function currentAmountLabel() {
    var tier = selectedValue(tierInputs);
    if (tier && !(customAmount && customAmount.value && document.activeElement === customAmount)) {
      return TIER_LABELS[tier] || tier;
    }
    var amt = currentAmountValue();
    return amt ? "UGX " + amt.toLocaleString() : "—";
  }

  function updateSummary() {
    if (sumAmount) sumAmount.textContent = currentAmountLabel();
    if (sumFrequency) {
      var freq = selectedValue(frequencyInputs);
      sumFrequency.textContent = freq === "monthly" ? "Monthly Partner Circle" : "One-time Gift";
    }
    if (sumRoute) {
      var route = selectedValue(routeInputs);
      sumRoute.textContent = route ? ROUTE_LABELS[route] : "—";
    }
    if (sumActivity) {
      var activity = selectedValue(activityInputs);
      sumActivity.textContent = activity || "Where most needed";
    }
  }

  tierInputs.forEach(function (el) {
    el.addEventListener("change", function () {
      if (customAmount) customAmount.value = "";
      updateSummary();
    });
  });
  if (customAmount) {
    customAmount.addEventListener("input", function () {
      tierInputs.forEach(function (t) { t.checked = false; });
      updateSummary();
    });
  }
  frequencyInputs.forEach(function (el) { el.addEventListener("change", updateSummary); });
  routeInputs.forEach(function (el) { el.addEventListener("change", updateSummary); });
  activityInputs.forEach(function (el) { el.addEventListener("change", updateSummary); });
  updateSummary();

  /* ---------- Receipt modal ---------- */
  var overlay = document.getElementById("receiptOverlay");
  var receiptBody = document.getElementById("receiptBody");
  var closeBtn = document.getElementById("receiptClose");
  var downloadBtn = document.getElementById("receiptDownload");

  function receiptTemplate(data) {
    return (
      '<div class="receipt-head">' +
        '<div class="stamp-check">&#10003;</div>' +
        '<h3>Official Donation Receipt</h3>' +
        '<p class="receipt-id">Receipt ID: #' + data.receiptId + '</p>' +
      '</div>' +
      '<p>Dear ' + data.donorName + ',</p>' +
      '<p>Thank you for your generous financial contribution to Biyaya Child Development Centre (Biyaya CDC). We have safely received your gift, and a formal breakdown of your transaction is below.</p>' +
      '<div class="ledger" style="margin:20px 0;">' +
        '<div class="ledger-row"><dt>Donor name</dt><dd>' + data.donorName + '</dd></div>' +
        '<div class="ledger-row"><dt>Receipt ID</dt><dd>#' + data.receiptId + '</dd></div>' +
        '<div class="ledger-row"><dt>Date received</dt><dd>' + data.donationDate + '</dd></div>' +
        '<div class="ledger-row"><dt>Contribution amount</dt><dd>' + data.amount + '</dd></div>' +
        '<div class="ledger-row"><dt>Payment method</dt><dd>' + data.paymentMethod + '</dd></div>' +
        '<div class="ledger-row"><dt>Designated activity</dt><dd>' + data.designatedActivity + '</dd></div>' +
      '</div>' +
      '<h4 style="margin-bottom:8px;">Financial Accountability &amp; Custody Declaration</h4>' +
      '<ul style="padding-left:1.2em; color:var(--ink-700); font-size:.92rem;">' +
        '<li>Funds are deposited directly into our official project account at Equity Bank, Adjumani Branch.</li>' +
        '<li>No funds are withdrawn without joint authorization from our Chairperson, Secretary and Treasurer.</li>' +
        '<li>Our Overseer, the serving Parish Priest of St. Luke Church of Uganda, retains cheque-booklet custody.</li>' +
        '<li>Accounts are audited annually, and externally by the Madi and West Nile Diocese.</li>' +
      '</ul>' +
      '<p style="font-size:.92rem; color:var(--ink-700);">Because of your obedience to God\u2019s work, a vulnerable child within the 3&nbsp;km radius of Biyaya Village will receive holistic, Christ-centred support toward education, health and life skills.</p>' +
      '<p style="font-size:.85rem; color:var(--ink-500);">A signed PDF copy has been generated for your records and emailed to you. Questions? Reply to that email or write to <a href="mailto:finance@biyayacdc.org">finance@biyayacdc.org</a>.</p>' +
      '<p style="font-family:var(--font-display); font-style:italic; color:var(--navy-900);">May the Lord bless you abundantly for your kindness.<br>In His Service, The Executive Committee — Biyaya CDC</p>'
    );
  }

  function showReceipt(data) {
    if (receiptBody) receiptBody.innerHTML = receiptTemplate(data);
    if (overlay) {
      overlay.classList.add("is-open");
      overlay.setAttribute("aria-hidden", "false");
      if (closeBtn) closeBtn.focus();
    }
  }

  function closeReceipt() {
    if (!overlay) return;
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
  }
  if (closeBtn) closeBtn.addEventListener("click", closeReceipt);
  if (overlay) {
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeReceipt();
    });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlay && overlay.classList.contains("is-open")) closeReceipt();
  });
  if (downloadBtn) {
    downloadBtn.addEventListener("click", function () { window.print(); });
  }

  /* ---------- Submit: start a PesaPal checkout, or jump to bank details ---------- */
  form.addEventListener("submit", function (e) {
    e.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    var amount = currentAmountValue();
    var route = selectedValue(routeInputs);
    if (!amount || !route) {
      alert("Please choose a gift amount and a payment routing option.");
      return;
    }

    if (route === "bank") {
      var bankSection = document.getElementById("bank-transfer");
      if (bankSection) bankSection.scrollIntoView({ behavior: "smooth" });
      return;
    }

    var submitBtn = form.querySelector('button[type="submit"]');
    var originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Redirecting to PesaPal…";

    fetch("/api/create-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: amount,
        currency: "UGX",
        donorName: document.getElementById("donorName").value,
        donorEmail: document.getElementById("donorEmail").value,
        donorPhone: document.getElementById("donorPhone").value,
        designatedActivity: selectedValue(activityInputs) || "Where most needed",
        sponsorChildId: document.getElementById("sponsorChildId").value || null
      })
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || "Could not start payment.");
          return data;
        });
      })
      .then(function (data) {
        // Full-page redirect to PesaPal's hosted checkout — donor chooses
        // Mobile Money or Card there, then gets redirected back to us.
        window.location.href = data.redirectUrl;
      })
      .catch(function (err) {
        console.error(err);
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
        alert(err.message || "We couldn't start your payment right now. Please try again shortly.");
      });
  });

  /* ---------- Handle the return trip from PesaPal ---------- */
  var params = new URLSearchParams(window.location.search);
  var orderTrackingId = params.get("OrderTrackingId") || params.get("orderTrackingId");

  if (orderTrackingId) {
    var pendingNotice = document.createElement("div");
    pendingNotice.className = "callout";
    pendingNotice.style.marginBottom = "24px";
    pendingNotice.innerHTML = "<p>Confirming your payment with PesaPal&hellip;</p>";
    form.parentNode.insertBefore(pendingNotice, form);

    fetch("/api/verify-transaction?orderTrackingId=" + encodeURIComponent(orderTrackingId))
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || "Payment could not be confirmed.");
          return data;
        });
      })
      .then(function (data) {
        pendingNotice.remove();
        showReceipt(data.receipt);
        // Clean the tracking params out of the URL so a refresh doesn't
        // re-trigger verification.
        window.history.replaceState({}, document.title, window.location.pathname);
      })
      .catch(function (err) {
        console.error(err);
        pendingNotice.innerHTML =
          "<p>We couldn't automatically confirm your payment. If you completed checkout, your receipt will still be emailed shortly — or contact <a href=\"mailto:finance@biyayacdc.org\">finance@biyayacdc.org</a> with your order reference.</p>";
      });
  }

  /* Pre-select a designated activity or child if arriving from the catalog */
  var childId = params.get("child");
  if (childId) {
    var childField = document.getElementById("sponsorChildId");
    if (childField) childField.value = childId;
    var note = document.getElementById("childNote");
    if (note) {
      note.hidden = false;
      note.querySelector("strong").textContent = childId;
    }
  }
})();
