# RealFlow — Product Roadmap

> Strategic horizon planning. Reviewed at sprint kickoff.
> Last updated: 2026-04-23

---

## Where We Are

**Sprint 9 start.** Eight sprints of backend, 5 evolution weeks of product architecture — RealFlow has never been deployed to production. The backend is production-grade. The frontend is functional but visually behind. The AI assistant exists in the API but has no UI. Stripe subscriptions are built but untested live.

**The single biggest gap is deployment.** Everything else is theoretical until real users are on the system.

---

## Horizon 1 — Sprint 9 (Now, April 2026)

**Theme: Ship & Surface**

| Priority | Item | Why |
| -------- | ---- | --- |
| P0 | Production deployment | Nothing else matters until the app is live |
| P0 | Env var audit | 11 vars were flagged missing in DEPLOY_CHECK_SPRINT6 |
| P1 | AI assistant frontend | Backend is built; surfacing it creates the flagship demo moment |
| P1 | Production monitoring (Sentry) | Can't operate blind in production |
| P2 | Frontend polish MVP | Pipeline DnD + animations on 3 key screens for demos |

**Success:** Users can sign up, authenticate, and use the product. AI assistant is visible. Sentry is capturing errors.

---

## Horizon 2 — Sprint 10 (May 2026)

**Theme: First Users**

Focus shifts from building to learning. The goal is to onboard 5–10 pilot agents and use their feedback to drive the next sprint.

| Item | Rationale |
| ---- | --------- |
| Onboarding flow | New users need guided setup (contact import, pipeline config, first brief) |
| Stripe live mode + billing | Subscriptions need to work with real payment methods |
| Email deliverability | Transactional emails (magic links, alerts) need SPF/DKIM/DMARC |
| Contact import (CSV) | Agents have existing data; manual entry is a barrier to adoption |
| Mobile TestFlight / Play beta | Mobile app needs distribution for pilot agents |
| E2E tests (Playwright) | Confidence gate before marketing push; ops backlog O-2 |

**Success:** 5 pilot agents actively using RealFlow. One real subscription payment processed. Zero critical bugs in first 72 hours.

---

## Horizon 3 — Sprint 11+ (June 2026)

**Theme: Growth Features**

These are features that drive acquisition and retention once the base product is proven.

| Feature | Module | Rationale |
| ------- | ------ | --------- |
| Social one-tap publishing | Social posts | Agents post listings to Instagram/LinkedIn in < 30 seconds |
| AI brief generation | Client briefs | Agents describe a client in plain English; AI structures the brief |
| Off-market network | Off-market | Private listings shared between buyers agents |
| Auction countdown + SMS | Offers + Twilio | Day-of auction workflow with automated bid registration reminders |
| Domain listing analytics | Properties | Clicks, enquiries, days-on-market pulled from Domain.com.au |
| Admin dashboard | Team | Principal sees all agents' pipelines, performance, leads |
| White-label portal | Portal | Agencies can brand the client portal with their own logo/colours |
| API webhooks (outbound) | Integrations | Let agencies connect RealFlow to their own tools |

---

## Strategic Bets

### 1. AI-first CRM
The AI assistant (10 CRM tools, SSE streaming) is the core differentiator. No other Australian real estate CRM has a conversational interface. Investment in assistant UI quality pays outsized returns in demos and retention.

### 2. Buyers agent focus
The buyers agent vertical is underserved. Vendor CRMs exist (Rex, VaultRE) but nothing is built for buyers agents specifically. The BA product mode, client brief engine, off-market network, and due diligence templates are a moat.

### 3. Portal as a retention mechanism
The client portal gives buyers a window into their deal. Agents who use it get fewer "where are we?" calls. This drives NPS and referrals. Portal quality should increase with every sprint.

---

## What We Are Not Building (Yet)

| Item | Reason deferred |
| ---- | --------------- |
| GraphQL layer | REST API is sufficient; added complexity not justified |
| Redis cache | Supabase query perf is adequate at current scale |
| Multi-region deploy | Single Render region is fine until 1000+ users |
| Native iOS/Android store release | TestFlight pilot first; store review after product-market fit |
| Email template builder | Transactional templates are sufficient for now |

---

## Viability Assessment (April 2026)

| Dimension | Status | Note |
| --------- | ------ | ---- |
| Backend completeness | ✅ Production-grade | 45+ engines, 67 routes, 1,978 tests, 80%+ coverage |
| Frontend completeness | ⚠️ Functional | All pages exist; visually dated, needs polish |
| Mobile completeness | ✅ Solid | Offline-first, real-time, 8 screens |
| AI capability | ✅ Built, not surfaced | Full tool-calling backend; no frontend yet |
| Subscriptions | ⚠️ Built, untested live | Stripe service exists; needs live key + validation |
| Deployment | ❌ Never happened | 0 production users; single biggest gap |
| Test coverage | ✅ At target | 65% API, 80% BL, all quality gates green |
| Security | ✅ Hardened | All Sprint 8 CRITICAL findings resolved |
| Market timing | ✅ Now | Australian prop market active; competitor gap exists |

**Verdict:** The product is ready to deploy. The risk of waiting outweighs the risk of shipping. Ship Sprint 9.
