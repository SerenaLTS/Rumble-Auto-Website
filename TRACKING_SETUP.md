# RUMBLE tracking setup — staged implementation

Updated 20 October 2026. These are local changes, not a live installation.
Browser tracking is deployed; CAPI is now in the rollout/testing stage. See deploy/CAPI_SETUP.md for the additive D1 migration, Worker configuration, testing and activation sequence.

## 1. Prepared locally

- `consent-init.js`: consent defaults run before existing GTM. Analytics and marketing are separate booleans. v2 choices do not grant marketing consent; visitors see the updated notice again.
- `cookie-consent.js`: Reject optional / Analytics only / Accept all; footer Cookie settings allows changing or withdrawing permission. If local storage is blocked, the current page retains the choice in memory, and another page asks again.
- `enquiry.js`: only HTTP success with JSON `ok: true` creates a success event. Tracking errors cannot change a saved enquiry into a visible failure. Existing 30-second browser duplicate protection remains.
- Consent and privacy text updated on desktop and mobile pages.
- `_headers` and `deploy/cloudflare-worker.js`: Google Ads and Meta CSP origins prepared. This only permits requests; it does not install tags.
- No Google Ads or Meta base scripts or conversions have been newly activated. No form backend changes.

## 2. Review the local website first

From the repository directory:

```sh
python3 -m http.server 8052
```

Open `http://localhost:8052/index.html` and `http://localhost:8052/index_mobile.html`.
Review the banner, policy text, and footer Cookie settings. Do not submit the form from this preview: the frontend still points to the real form API.

Automated tests are offline and intercept all requests, including the form API:

```sh
python3 tests/tracking-smoke.py
```

Requires Python Playwright and its Chromium browser. Tests cover desktop/mobile choices and persistence, legacy consent, API failures, malformed responses, successful submissions, duplicates, rejection, and broken tracking scripts.

## 3. GTM workspace status

The user accessed `GTM-PNNGPS4B`; the initial workspace tag list was empty. The user has now saved four draft tags: Google Ads base, Google Ads Lead Conversion, Meta Pixel Base, and Meta Pixel Lead. Screenshots show the expected trigger assignments. The latest screenshot shows `user_data -> {{UPD - Lead Contact}}` on the Google Ads conversion tag, with `JS - Lead User Data` configured to read JavaScript global `rumbleAdsUserData`. Save of that final edit and actual Preview behavior remain to be confirmed.

The user also showed Google Ads customer-data terms as accepted and selected the GTM Enhanced Conversions setup path. Verify the saved account setting. User-provided data capabilities should remain on, with automatic page scanning and CSS/JS discovery off; explicit event-level data supplies matching.

No GTM container has been published in this session. Local Preview has now confirmed default denied consent, grant on Accept all, Google/Meta base tags executing, both Lead tags executing only on the success event, transaction UUID and enquiry type, and a SHA-256 email object passed to the Google conversion tag. Google base firing was corrected from Once per page to Once per event so an initially consent-blocked load can run after grant.

The user checked D1: `TEST - Tracking validation` has exactly one saved record. Two observed Google requests target different endpoints, `/pagead/conversion/` and `/ccm/conversion/`; that alone does not establish duplicate enquiry storage or conversion counting. Local HTTP requests show `em=tv.1~ec.e3`; Google documents e3 as an insecure page error. Enhanced Conversions delivery still needs HTTPS Preview validation, followed by account diagnostics. Meta request reception still needs validation.

Homepage redirects now preserve query parameters, including GTM debug signals and ad click identifiers. HTML script URLs carry a tracking version to avoid mixing cached old and new scripts during rollout.

## 4. Event contract for GTM

### `rumble_consent_update`

Pushed after the Google consent update, with booleans `analytics_consent` and `marketing_consent`.
For first page load use Consent Mode defaults / `window.rumbleConsent.getChoice()`, not these data-layer variables alone: the update event only occurs when someone makes a choice.

### `rumble_lead_submit`

Only after a confirmed successful enquiry and where at least analytics or marketing is allowed:

| Field | Meaning |
| --- | --- |
| `event_id` | UUID for this submission attempt |
| `transaction_id` | Same UUID; use for Google Ads transaction ID |
| `enquiry_type` / `lead_type` | Selected enquiry type, e.g. New Truck Sales / Parts / Servicing / General Enquiry |
| `page_path` | Path only; no query string or fragment |
| `analytics_consent` | Explicit boolean |
| `marketing_consent` | Explicit boolean |

No name, contact details, message, or free-text model/topic are included. Bind analytics tags only when `analytics_consent === true`, advertising tags only when `marketing_consent === true`, plus the appropriate Consent Mode checks. Do not infer permission merely from the existence of the event.

The old optional `rumbleAnalytics.trackLead` hook is no longer called. Check whether any GTM tags relied on the old `page` or `preferred_model` event fields; they are deliberately omitted to avoid sending potentially personal free text / URL parameters.

The event ID is preparation for future CAPI, not server idempotency. The current API does not persist or deduplicate it. A failed response followed by a manual retry can still save a second enquiry; durable backend idempotency and CAPI retries belong to the later backend stage.

## 5. Configure the platform tags together once GTM is available

1. Google tag: `AW-18069786332`. Reuse existing Google tag installation where possible.
2. Google Ads conversion: conversion ID `18069786332`, label `42pLCOeAz5IdENydrKhD`, success custom event trigger, marketing consent true, transaction ID from the event. No submit-click or all-page conversion trigger.
3. Meta Pixel: `1328602995881864`. Initialise only with marketing consent; send PageView once per eligible page load, including a visitor granting consent after load. Prevent reinitialisation / duplicate PageView when settings are reopened.
4. Meta Lead: trigger on the successful event with marketing consent; map `lead_type`, and use browser option `eventID` from `event_id`. Future server Lead must use the same dataset, event name and ID.
5. Gate Meta tags explicitly: Google Consent Mode does not automatically control every Meta tag. Include withdrawal handling for an already loaded Pixel, and do not insert an unconditional noscript tracking image.
6. Verify enquiry-type reporting with Richard. Passing a parameter alone does not create segmented reports; custom conversions or reporting configuration may be needed.

## 6. Enhanced Conversions — local code prepared, live validation pending

On an explicitly successful form API response, `enquiry.js` prepares SHA-256 matching data only when marketing permission existed at submission and remains granted at dispatch. It normalizes email (lowercase, trim, remove Gmail/Googlemail local-part dots) or phone (E.164; +61 inferred only for supported Australian formats). Ambiguous numbers are skipped. Google's current GTM guidance supports phone as a standalone match key, correcting the older Google tag guidance quoted in the first plan.

`window.rumbleAdsUserData` is a consent-checked getter returning `sha256_email_address` or `sha256_phone_number`. The GTM JavaScript Variable reads it without requiring Custom JavaScript / unsafe-eval. It is referenced only by the event-level `user_data` on Google Ads Lead Conversion, not by the base Google tag, Meta tags, or general analytics events.

No raw or hashed contact fields are added to dataLayer events, URLs, or matching storage. Matching data is cleared by the GTM event callback, a 10-second maximum lifetime, or consent withdrawal. A delayed callback cannot clear a different lead's data. Consent withdrawal during hashing invalidates the result. A digest error or 1.5-second digest timeout skips matching while preserving ordinary conversion tracking. A tag error cannot make the saved customer enquiry fail.

The existing duplicate guard still stores its pre-existing form fingerprint in session storage; the new enhanced-matching code does not add contact storage. Existing form/API retention behavior is separate from enhanced matching.

Tests:

```sh
node tests/enhanced-conversions.cjs
python3 tests/tracking-smoke.py
```

CAPI implementation is available in deploy/rumble-api.js and its rollout is documented in deploy/CAPI_SETUP.md. The browser Meta implementation does not send customer contact matching data; the consented server event hashes contact data separately.

Reference: https://support.google.com/google-ads/answer/13262500?hl=en-AU

## 7. Publish and verify together

- Review local diffs and privacy wording first.
- Local Preview successfully submitted one test enquiry through the live form API and generated the success event. D1 count confirmed one saved row for that test name.
- Publish the frontend through the existing GitHub Pages workflow after GTM behavior is confirmed. The frontend is hosted on GitHub Pages per README; the form API runs on Cloudflare.
- In Cloudflare, locate the Worker serving headers for the main website, inspect its current code, and merge only the required CSP changes. Do not overwrite an unknown live Worker wholesale. Do not update the separate `api.rumbleauto.com.au` form Worker in this stage.
- `_headers` is ignored by GitHub Pages. A public HTTPS header read on 20 October returned GitHub Pages headers with no CSP; no edge Worker CSP deployment is currently needed for this host. Keep the matching CSP source prepared for a future edge deployment; do not deploy an edge Worker just for this tracking rollout.
- Use GTM Preview / Tag Assistant and Meta Test Events. Test every consent choice, desktop/mobile, enquiry types, API errors, successful leads and double clicks. Confirm no duplicate pre-existing tags.
- Live tests may create real lead emails/database records and advertising test events; use clearly marked test submissions and coordinate with the team.
- CAPI and browser/server deduplication are now implemented locally and the user has deployed the Worker and created the two helper tables. OPTIONS readback confirms the new production API headers. Meta reception/deduplication and activation remain pending; see deploy/CAPI_SETUP.md.

References:
- https://developers.google.com/tag-platform/security/guides/consent
- https://developers.google.com/tag-platform/security/guides/csp
- https://developers.google.com/tag-platform/tag-manager/datalayer
