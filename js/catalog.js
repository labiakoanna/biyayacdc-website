/* Biyaya CDC — Sponsorship catalog
   --------------------------------------------------------------------------
   This renders placeholder beneficiary cards so the layout, pagination and
   photo slots can be reviewed before real, consent-cleared child profiles
   are connected. In production, replace `fetchPage()` with a query to the
   Sanity CMS "child" document type (see /docs/sanity-schema-notes.txt) —
   the card markup below is built to match that schema 1:1.
*/
(function () {
  "use strict";

  var grid = document.getElementById("childGrid");
  if (!grid) return;

  var moreBtn = document.getElementById("loadMoreBtn");
  var countEl = document.getElementById("resultCount");
  var needFilter = document.getElementById("filterNeed");
  var ageFilter = document.getElementById("filterAge");
  var statusFilter = document.getElementById("filterStatus");

  var NEEDS = ["Educational Sponsorship", "Health Campaigns", "Life Skills", "Moral & Spiritual Development"];
  var PAGE_SIZE = 9;
  var nextIndex = 0;
  var totalPlaceholder = 240; // illustrative catalog size; real total comes from the CMS query

  function pad(n) { return String(n).padStart(3, "0"); }

  // Deterministic pseudo-random so re-renders (e.g. after filtering) stay stable per index.
  function seededRand(seed) {
    var x = Math.sin(seed * 999) * 10000;
    return x - Math.floor(x);
  }

  function buildPlaceholderRecord(i) {
    var year = 2026;
    var age = 3 + Math.floor(seededRand(i) * 15); // 3–17
    var need = NEEDS[Math.floor(seededRand(i + 50) * NEEDS.length)];
    var sponsored = seededRand(i + 900) > 0.72;
    return {
      id: "BCDC-" + year + "-" + pad(i + 1),
      age: age,
      need: need,
      sponsored: sponsored
    };
  }

  function cardTemplate(record) {
    var statusClass = record.sponsored ? "status-sponsored" : "status-open";
    var statusLabel = record.sponsored ? "Sponsored" : "Awaiting sponsor";
    var actionLabel = record.sponsored ? "View story" : "Sponsor me today";
    return (
      '<article class="child-card reveal is-visible" data-need="' + record.need + '" data-age="' + record.age + '" data-status="' + (record.sponsored ? "sponsored" : "open") + '">' +
        '<div class="child-photo">' +
          '<span class="child-id">' + record.id + '</span>' +
          '<span class="child-status ' + statusClass + '">' + statusLabel + '</span>' +
          '<div class="ph-placeholder">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="2.2"/><path d="M21 16.5 16.5 12 7 20"/></svg>' +
            '<span>Photo pending upload</span>' +
          '</div>' +
        '</div>' +
        '<div class="child-body">' +
          '<span class="child-need">' + record.need + '</span>' +
          '<h3 class="child-name">Profile ' + record.id.split("-").pop() + '</h3>' +
          '<div class="child-meta"><span>Age ' + record.age + '</span><span>&middot;</span><span>Adjumani District</span></div>' +
          '<p class="field-hint" style="margin:0 0 6px;">Full name, story and photo appear here once local staff complete registration and guardian consent under our <a href="policy.html">Child Protection &amp; Privacy Policy</a>.</p>' +
          '<a class="btn btn-primary btn-sm" href="donate.html?child=' + record.id + '">' + actionLabel + '</a>' +
        '</div>' +
      '</article>'
    );
  }

  function currentFilters() {
    return {
      need: needFilter ? needFilter.value : "all",
      age: ageFilter ? ageFilter.value : "all",
      status: statusFilter ? statusFilter.value : "all"
    };
  }

  function passesFilter(record, f) {
    if (f.need !== "all" && record.need !== f.need) return false;
    if (f.status !== "all" && (f.status === "sponsored") !== record.sponsored) return false;
    if (f.age !== "all") {
      if (f.age === "3-9" && !(record.age >= 3 && record.age <= 9)) return false;
      if (f.age === "10-17" && !(record.age >= 10 && record.age <= 17)) return false;
    }
    return true;
  }

  function renderPage() {
    var f = currentFilters();
    var added = 0;
    var i = nextIndex;
    var scanned = 0;
    var html = "";
    // Scan ahead through the placeholder set applying filters client-side (a CMS query would do this server-side).
    while (added < PAGE_SIZE && scanned < totalPlaceholder) {
      var record = buildPlaceholderRecord(i);
      if (passesFilter(record, f)) {
        html += cardTemplate(record);
        added++;
      }
      i++;
      scanned++;
    }
    grid.insertAdjacentHTML("beforeend", html);
    nextIndex = i;
    if (countEl) {
      countEl.textContent = grid.children.length + " profiles shown";
    }
    if (nextIndex >= totalPlaceholder || added === 0) {
      if (moreBtn) moreBtn.style.display = "none";
    } else if (moreBtn) {
      moreBtn.style.display = "";
    }
  }

  function resetAndRender() {
    grid.innerHTML = "";
    nextIndex = 0;
    if (moreBtn) moreBtn.style.display = "";
    renderPage();
  }

  [needFilter, ageFilter, statusFilter].forEach(function (el) {
    if (el) el.addEventListener("change", resetAndRender);
  });

  if (moreBtn) {
    moreBtn.addEventListener("click", function () {
      renderPage();
    });
  }

  resetAndRender();
})();
