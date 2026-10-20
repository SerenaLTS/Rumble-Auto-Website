# RUMBLE Meta CAPI rollout — 20 October 2026

Status: local implementation + offline checks only. Do not replace the live Worker before the two additive D1 tables exist. The existing email Secret values and DB binding remain in Cloudflare; do not copy them into source files.

## 1. Existing code confirmed

The user's exported live Worker exactly matched the original `deploy/rumble-api.js` before editing. It inserts enquiries into the existing `enquiries` table and sends email via Microsoft Graph. No production Worker/database change has been performed by the coding tools in this CAPI stage.

## 2. D1 preparation

In `rumble-db` -> Console execute the statements in `migrations/0001_lead_idempotency_capi.sql`. These use CREATE TABLE / INDEX IF NOT EXISTS only; no existing table or historical enquiry is altered or deleted.

Read back:

```sql
SELECT name FROM sqlite_master
WHERE type='table' AND name IN ('enquiry_requests','meta_capi_outbox');
```

Expect both table names.

## 3. Cloudflare configuration

Worker `rumble-api`, Production:

| Name | Type | Value |
| --- | --- | --- |
| META_ACCESS_TOKEN | Secret | User-generated Meta token, entered only in Cloudflare |
| META_PIXEL_ID | Variable | 1328602995881864 |
| META_GRAPH_API_VERSION | Variable | v25.0 |
| META_CAPI_ENABLED | Variable | false for initial deployment; true for testing / activation |
| META_TEST_EVENT_CODE | Variable | Code shown in Meta Test Events; optional and temporary |

Keep DB -> rumble-db and all existing MS_*/EMAIL_* bindings. Do not replace or print existing Secret values. `wrangler.local.jsonc` is LOCAL VALIDATION ONLY and must never be deployed to production: its D1 ID is deliberately a placeholder.

Paste the complete updated `rumble-api.js` into the dashboard editor, preserving the existing Worker name and routes. Deploy after migration verification. Add a Cron Trigger `*/5 * * * *` under Worker Settings -> Trigger Events to retry pending CAPI events.

This code continues to accept the current frontend: absent explicit `tracking_consent.version=3` + boolean `marketing=true`, it saves/emails the enquiry without sending CAPI. Setting META_CAPI_ENABLED=false stops outgoing CAPI attempts, while scheduled cleanup still expires old outbox data.

## 4. Frontend rollout

`enquiry.js` now:

- Reuses the same idempotency/event UUID for a retry of unchanged form content after an uncertain API response, held in per-form memory. Changed content or a confirmed success starts a new attempt. Refreshing the page loses this in-memory retry identity; unrelated submissions/tabs are not merged.
- Sends an explicit consent snapshot. Only with marketing consent, includes existing `_fbp` / `_fbc` cookies if available; it never invents a Meta click ID.
- Uses the server-returned event_id for browser Google/Meta conversions. Legacy API responses still use the original client UUID during staged rollout.
- Adds `meta_test=true` only when the page URL has `?meta_test=1` and marketing consent is granted.

Publish frontend only after Worker deployment. Bump the `enquiry.js` script version in all HTML pages for this release. GTM's Meta Lead code and event_id variable stay the same.

## 5. Meta test sequence

Use dataset 1328602995881864 -> Test Events. Choose Website for browser event testing and obtain the server `test_event_code` for CAPI. Temporarily set META_TEST_EVENT_CODE in the Worker and META_CAPI_ENABLED=true.

Connect GTM Preview to `https://www.rumbleauto.com.au/?meta_test=1`, grant marketing consent, and submit ONE clearly marked test enquiry. Existing test names and emails need not be re-used. This test creates a real enquiry and notification email.

Only explicitly marked `meta_test` requests use the test event code; ordinary enquiries remain ordinary events. Test status queries below show no customer contact fields.

Check Meta shows browser + server Lead with the same event ID and successful deduplication. GTM execution alone does not prove Meta reception. Check CAPI_SENT logs and the outbox status:

```sql
SELECT event_id,status,attempts,last_error,sent_at_ms
FROM meta_capi_outbox ORDER BY created_at_ms DESC LIMIT 10;
```

A sent job has matching payload removed. A transient failure remains pending with a bounded backoff; permanent validation errors become failed. Fix the configuration before retrying failed events; do not blindly replay terminal jobs into production or change their IDs.

After testing, remove META_TEST_EVENT_CODE, remove `meta_test=1` from test URLs, and keep META_CAPI_ENABLED=true. The job retains its original test code if already queued, so a retry will not silently turn a test event into production. Publish the reviewed GTM container only after both browser and server validation, and verify ordinary visitor consent behavior on desktop/mobile.

## 6. Guarantees and limits

- D1 batch atomically reserves a request key, inserts the enquiry and enqueues CAPI. Concurrent same-key requests save one enquiry. Same key with different form content returns 409. An insert failure rolls back the reservation so the same request can be retried.
- Email is scheduled once for the winning request, preserving the existing non-durable email delivery behavior. This prevents duplicate sends for a same-key retry; it does NOT guarantee email delivery across a Worker crash after commit. There is no automatic email retry queue.
- CAPI is stored durably and attempted after response. D1 leases avoid concurrent dispatch of the same job. Ambiguous network outcomes may resend an event, always with the same event ID/time/name for Meta deduplication.
- CAPI uses server-normalized SHA-256 em/ph. IP, UA and existing fbp/fbc are not hashed. Source URL excludes query/fragment; no form message/name is sent to Meta.
- Maximum 8 attempts, bounded exponential backoff, event age capped at 24h. Cron scrubs payloads after expiry and on successful delivery. A stopped Cron cannot perform eventual cleanup/retry; monitor its execution.
- Consent is the snapshot at submission. A later browser withdrawal stops future tracking but cannot recall already-sent events; the server has no retrospective browser-consent notification endpoint.
- Historical rows are not merged. Distinct keys (including a new tab/page reload) remain distinct enquiries.

## 7. Verification completed locally

`node tests/capi-worker.cjs` with temporary wrangler/Miniflare tooling uses real local workerd+D1 and mocked Meta/Microsoft requests. It verifies 8 concurrent requests -> one row + one email call; transaction rollback; stable IDs; consent gating; hashed contact and raw technical matching fields; explicit test-code routing; retries/leases; permanent failures and data expiry.

`python3 tests/tracking-smoke.py` intercepts all external requests and verifies desktop/mobile behavior and failed-request retry identity. `node tests/enhanced-conversions.cjs` verifies the Google matching path. Wrangler dry-run validates the Worker bundle without deployment.

Sources consulted: Cloudflare D1 batch transaction documentation and Workers best practices. Meta docs returned HTTP 429; Meta's official facebookincubator ConversionsAPI GTM template was used to confirm API v25.0 and event field conventions. Live Meta Test Events remains required.
