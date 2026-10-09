# Customer wizard implementation checkpoint — 2026-10-09

Base: main `58d5ca71576678216686b698c89ec6422484de63`. Clean new checkout; existing user work was not changed. Source requirements: [functional](https://app.notion.com/p/3f33e8ee0d0481699ed0d5c6f6619538), [architecture](https://app.notion.com/p/3f33e8ee0d048181a5e2faae2e950ac4), [acceptance](https://app.notion.com/p/3f33e8ee0d04816ab097fa717e7b285b), [release](https://app.notion.com/p/3f33e8ee0d04811096cadfdd5158d796), [template](https://app.notion.com/p/3f33e8ee0d0481daa078c16d5f281165). Current owner authorization resumes independent implementation; historical Notion pause text is preserved. Owner Google access already works; it is not a blocker.

## Concrete minimal recommendation

Keep static VDS and the existing Identity entry. Add a customer API under the same deployment, but authorize every operation using SDK-verified subject plus server-owned customer/template assignment. Owner role alone must not grant customer-data access. Keep the existing generic `/brief/` separate. Do not use browser-selected customer IDs, email strings or roles as authority.

Use one transactional durable database for assignments, template versions, drafts, immutable draft/submission versions, upload manifests, catalog versions, before/after audit and an outbox. Use private object storage for photos with short-lived authorized upload/download URLs. A worker reconciles idempotent Notion delivery, then automatically applies eligible validated structured catalog changes and emits one private Daily Desk outcome. Receipt, canonical-update and outcome-post status remain separate. Freeform questions route to Jose as follow-up, never mutations. No manual per-submission approval gate is added.

Compare an approved database/object-storage provider with existing Netlify capabilities before choosing. A new provider would introduce persistent service access, storage/egress/compute costs, retention and backup obligations. No provider was provisioned, credentials read/configured, sharing/security settings changed or cost accepted here. Existing Identity session policy is retained; invite-only customer magic-link flow still needs provider verification and wiring, distinct from working owner Google login.

## Implemented independent pieces

- `src/customer-service.mjs`: injected assignments/templates/store/destination; expiry/revocation and tenant checks; versioned drafts with optimistic concurrency; immutable snapshots; explicit unknown values; integer cents/quantity validation; package references; bounded closing entries; private photo ownership/completion contracts; duplicate-safe submission IDs and payload digests; retained retry payloads and truthful verified receipts.
- Synthetic automatic catalog apply: checks every base version before writing, excludes unknown decisions, records before/after versions, does not touch booked contracts/invoices, and supports conflict-aware audited rollback. Freeform entries never become updates. This is an in-memory contract demonstration, not a business-data adapter.
- `netlify/functions/customer.mjs`: always returns 503/no-store. No real reads/writes, auth bypass or destination wiring is enabled.
- `customer-preview/`: six guided steps, neutral examples, source-dated synthetic catalog, confirm/correct/unknown/add, item/package additions, package composition, photo-disabled state, language, multiple closing entries, unresolved review and edit/back. All customer input renders as text. Failed save/submission leaves answers in memory and never claims receipt.
- Template branding separates client and VDS layers but both are deliberately unset/unapproved. No guessed Pesmera colors/fonts/logo or VDS approved-logo claim. Exact assets and optional personal-review PDF remain implementation gaps.

The preview HTML is intentionally excluded from the production build allowlist and is not linked from customer entry. Local preview: `python -m http.server 8765`, visit `/customer-preview/`. It has no storage and discards answers on closing. Do not enter customer data.

## Evidence

- PASS: 46 Node tests (28 existing plus 18 customer tests), `node --test tests/*.test.cjs`.
- PASS: existing five-page static checks with `PYTHONUTF8=1 python tests/check_site.py`. Windows default cp1252 initially failed to decode existing UTF-8 source; no product defect was inferred.
- PASS: Identity client build, static build and esbuild bundling of disabled customer function. No deployment performed.
- PASS: headless Chromium fixture at 320, 393, 768 and 1280 CSS pixels. Guided flow, back/edit, retained quantities/responsibility, language, freeform review, literal HTML-like input, failed-save recovery and no horizontal overflow. `tests/customer-browser.cjs` serves actual source files by request interception; API calls receive synthetic 503. This is browser emulation, not physical-device, Safari, assistive-technology, WCAG or live-network certification. Screenshot: `evidence/customer-393.png`.
- Contract-only PASS: isolated customers/templates; expired/revoked assignment; stale drafts; two service instances sharing one synthetic store; interrupted/unverified/expired uploads; forbidden file MIME; concurrent duplicate submissions; retry after unknown timeout with unchanged payload; rejected destination receipts; immutable versions; catalog conflicts, booked-contract/invoice preservation, audit and rollback.

There is no tested live cross-device persistence. In-memory Maps are synchronous within one process, not transactional/distributed locks or durable storage. Photo verification is a trusted-adapter contract, not implemented image scanning/storage. The destination test adapter is synthetic, not Notion. Daily Desk and real canonical catalog adapters are absent.

## Smallest decisions for end-to-end staging

1. Approve the same-deployment API boundary, exact persistent database/private-photo provider, budget ceiling, least-privilege server access, retention/backups and a synthetic staging environment. Then implement durable transactions, outbox leases, uniqueness constraints and server SDK principal resolution. Do not use the memory adapter in deployment.
2. Verify Juan's identity and invitation destination, then map the exact verified subject to the customer/template version. No invitation has been sent.
3. Approve exact Notion submission destination/schema, canonical Pesmera inventory/package destination and field rules: currency, quantity meaning, package composition, protected booked-contract/invoice references, effective pricing dates, optimistic versions, update exceptions and rollback. Valid authorized changes must auto-apply without a Jose approval gate; unknown/conflicting values must remain explicit exceptions. Historical catalog and price snapshots must be append-only.
4. Verify source-dated catalog, historical conflicts, final questions and approved client/VDS assets. Confirm optional personal-review PDF requirements and exact footer logo. Wire private Daily Desk destination and producer/subject identity with separate duplicate-safe delivery.

After these decisions and credentials/access approval, implement actual adapters, wire authenticated customer route, test two browsers/devices, real interrupted uploads, destination timeout reconciliation, successful receipt and eligible auto-update/rollback on synthetic staging records. Production deployment and merge require separate authorization. This branch is reviewable groundwork, not ready to send to Juan.
