# Biyaya Child Development Centre — Website

A responsive, accessible, animated website for Biyaya CDC (an official project of
St. Luke Church of Uganda, Adjumani), built in vanilla HTML/CSS/JS for the front
end, with a small Netlify Functions backend for the contact form and donations.

## Structure

```
site/
  index.html        Home
  about.html         History, vision/mission, welcome letter, leadership, timeline
  activities.html    Photo gallery of programs across all five pillars
  children.html      Sponsorship catalog (filterable, paginated "Load more" grid)
  donate.html        Donation form + automated receipt + bank transfer details
  policy.html        Child Protection & Privacy Policy
  faq.html           FAQ accordion
  contact.html        Contact form
  css/style.css      Full design system (tokens, components, responsive rules)
  js/main.js         Sticky nav, hamburger menu, scroll-reveal animations
  js/catalog.js      Sponsorship profile placeholder data + pagination/filters
  js/donate.js       Donation form logic — PesaPal checkout + receipt display
  netlify.toml       Function routing (/api/... aliases) + security headers
  netlify/functions/ Backend: contact form email, PesaPal payment + receipts
  scripts/register-ipn.js   One-time PesaPal webhook registration script
  robots.txt, sitemap.xml
```

## Deploying

This site needs a small serverless backend (for the contact form and real
donations), so deploy it on **Netlify** rather than plain GitHub Pages:

1. Push this repo to GitHub (or drag-and-drop the `site/` folder into Netlify).
2. In Netlify, set the build settings from `netlify.toml` (publish directory
   `.`, functions directory `netlify/functions` — already configured).
3. Add the environment variables listed below under **Site settings → Environment
   variables**.
4. Deploy, then run the one-time PesaPal IPN registration (see below).

## Backend setup (PesaPal + Resend)

### 1. PesaPal account & API credentials

1. Sign up at [pesapal.com](https://www.pesapal.com) and complete merchant
   verification for Uganda.
2. In your PesaPal dashboard, generate a **Consumer Key** and **Consumer
   Secret** (there are separate sandbox and live credentials — start with
   sandbox for testing).
3. Add these to Netlify's environment variables:
   - `PESAPAL_CONSUMER_KEY`
   - `PESAPAL_CONSUMER_SECRET`
   - `PESAPAL_ENV` — set to `sandbox` while testing, `live` when you're ready
     to accept real payments (this switches which PesaPal base URL is used)

### 2. Register your IPN (webhook) URL — one-time step

PesaPal needs to know where to send payment notifications. After your site
is deployed, run:

```bash
cd site
PESAPAL_CONSUMER_KEY=xxx \
PESAPAL_CONSUMER_SECRET=yyy \
PESAPAL_ENV=sandbox \
SITE_URL=https://YOUR-SITE.netlify.app \
node scripts/register-ipn.js
```

This prints an `ipn_id`. Save it in Netlify as:

- `PESAPAL_IPN_ID`

Re-run this if your site's URL ever changes (e.g. you add a custom domain).

### 3. Resend (for emails)

1. Sign up at [resend.com](https://resend.com), verify a sending domain
   (e.g. `biyayacdc.org`).
2. Create an API key and add it to Netlify as `RESEND_API_KEY`.
3. Optional but recommended, also set:
   - `SEND_FROM_EMAIL` — e.g. `Biyaya CDC <receipts@biyayacdc.org>`
   - `CONTACT_TO_EMAIL` — where contact-form messages land (defaults to
     `info@biyayacdc.org`)
   - `FINANCE_BCC_EMAIL` — bcc'd on every donation receipt (defaults to
     `finance@biyayacdc.org`)

### 4. Test it end-to-end

With `PESAPAL_ENV=sandbox`, use PesaPal's sandbox test credentials (found in
their developer docs) to simulate a Mobile Money or card payment. Confirm:
- The browser redirects to PesaPal, then back to `/donate.html`
- The receipt modal appears automatically
- The receipt email arrives (check the Resend dashboard logs too)

Once that all works, flip `PESAPAL_ENV` to `live` and swap in your live
Consumer Key/Secret (re-run the IPN registration script against the live
credentials too, since sandbox and live IPNs are registered separately).

## How the donation flow works

1. Donor fills the form and picks **Pay Online via PesaPal** or **Direct
   Bank Transfer**.
2. **PesaPal route:** the browser calls `/api/create-payment` (a Netlify
   Function), which asks PesaPal for a hosted checkout URL, then does a
   full-page redirect there. PesaPal's own page lets the donor choose Mobile
   Money or Card — there's no separate toggle needed on our form.
3. PesaPal redirects the donor back to `/donate.html?OrderTrackingId=...`.
   The page calls `/api/verify-transaction`, which **re-checks the payment
   status directly with PesaPal** (never trusts the URL alone) before
   showing the receipt and sending the confirmation email.
4. `/api/pesapal-ipn` is registered directly with PesaPal as a backup
   webhook, in case the donor's browser closes before step 3 finishes. Both
   paths share a dedupe check (Netlify Blobs) so a donor never gets two
   receipt emails for one gift.
5. **Bank transfer route:** no payment gateway involved — the page just
   scrolls to the printable Equity Bank transfer card.

## What's real vs. a placeholder right now

**Fully working today:**
- All 8 pages, sticky/blurred nav with hamburger on mobile, scroll animations
- Donation form UI, live summary, and the **automated receipt** — matches
  the official "Automated Email Receipt Template", with a working
  "Download PDF" button (uses the browser's print dialog)
- Contact form, wired to send real email via `/api/contact` (once
  `RESEND_API_KEY` is set)
- Sponsorship catalog UI with filtering and "Load more" pagination

**Needs your PesaPal + Resend credentials to go fully live** (see setup
above) — the code is already wired for it, it just needs real keys.

**Still a placeholder:**
- **Sanity CMS catalog** — `js/catalog.js` currently generates realistic
  placeholder profiles. The card markup and fields (Profile ID, age, core
  need, photo) are built to match a Sanity `child` document type 1:1, so
  swapping the placeholder generator for a real Sanity query is a drop-in
  change once child profiles (with guardian consent) are registered.

## Accessibility & SEO

- Semantic landmarks, skip-to-content link, visible focus rings throughout
- `prefers-reduced-motion` respected everywhere animation is used
- Colour palette checked for contrast (navy/cream/coral combinations)
- Per-page meta descriptions, canonical tags, Open Graph tags, and a
  homepage NGO JSON-LD block; `sitemap.xml` and `robots.txt` included
