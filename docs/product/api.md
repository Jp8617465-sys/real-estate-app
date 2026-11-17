# Product API, version 1

The documented API the app itself uses. The machine-readable contract is `web/openapi.json` (served live at `/openapi.json`, interactive at `/docs`); a front-end type check fails if the app drifts from it. Public third-party access is a separate future decision (north star): today this is for the app, tests and trusted integrations.

## Basics

- **Base path and version:** `/api/v1`. `GET /api/v1` describes the API; `GET /api/v1/health` is an open health check. A breaking change gets a new prefix.
- **Agency scoping:** every resource belongs to an agency, enforced in the database (ADR 0002). One local agency exists today; there is no login yet (decided on the spec issue).
- **Authentication:** none by default. Set `BUYERS_DESK_API_TOKENS` (comma-separated) and every call except `/api/v1` and `/api/v1/health` needs `Authorization: Bearer <token>`; otherwise `401` with `code: unauthorized`. The bundled web app does not send a token, so token mode is for an API-only deployment until logins exist.
- **Errors:** always `{ "detail": ..., "code": ... }`. Codes: `bad_request`, `unauthorized`, `forbidden`, `not_found`, `conflict`, `validation_error`, `idempotency_key_reuse`. A `409` that is a possible duplicate carries `detail.matches`.
- **Paging:** list endpoints take `limit` (1 to 200, default 50) and `offset`, and return the full match count in `X-Total-Count`.
- **Idempotent creates:** send `Idempotency-Key: <unique>` on a `POST`. The same key with the same request replays the first response with `Idempotent-Replay: true`; the same key with a different request is `422 idempotency_key_reuse`. Keys are kept per agency.
- **History:** every created or changed value writes an append-only change-log entry (field, new value, earlier value, source, who, when). Nothing is deleted through the API; removals retire a value and stay in the history.
- **Duplicates are never merged silently:** creating or editing a person, professional or property that matches an existing one by email, mobile or address returns `409` with the matches until the caller resends with `confirm_duplicate: true`.

## Resources

| Area | Paths |
|---|---|
| Clients and households | `/people`, `/people/{id}`, `/people/{id}/relationships`, `/households`, `/households/{id}/members`, `/households/{id}/opportunities` |
| Engagements and pipeline | `/engagements`, `/engagements/{id}`, `/engagements/{id}/stage`, `/pipeline`, `/pipeline/stages` |
| Brief | `/engagements/{id}/brief`, `/engagements/{id}/brief/{field}` |
| Properties and shortlist | `/properties`, `/engagements/{id}/properties`, `.../checks` |
| Professionals | `/professionals`, `/engagements/{id}/professionals` |
| Tasks and timeline | `/tasks`, `/tasks/summary`, `/engagements/{id}/timeline` |
| Discovery calls | `/engagements/{id}/intakes`, `/intakes/{id}` and its speaker, decision and finish actions |
| Integrations | `/integrations` and the property, mail and calendar, maps and identity ports (slice 8) |

## Known limits

Provisional pipeline stages; list endpoints count and slice in memory (prototype scale); no rate limiting; no webhooks; no per-user permissions. Real client data stays out of scope until Australian hosting and the AML/CTF rules are decided.
