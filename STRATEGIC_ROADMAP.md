# RealFlow Strategic Roadmap

**Date:** 2026-03-01
**Version:** 1.0
**Status:** Draft for Review

---

## 1. Market Positioning & Beachhead Strategy

### Why Buyers Agents First

The Australian PropTech market is valued at ~AUD $1.83B (14.2% CAGR). The CRM landscape is dominated by selling-agent tools (Rex, Agentbox, VaultRE, MyDesktop), leaving **buyers agents completely underserved**. This is our wedge.

| Factor | Selling Agent CRMs | RealFlow (Buyers Agent) |
|--------|-------------------|------------------------|
| Market saturation | High (~65% adoption) | Low (<10% purpose-built) |
| Pipeline complexity | 6 linear stages | 8 stages with parallel workflows |
| Key differentiator | Portal syndication | Client brief matching, DD tracking |
| Revenue model | Per-seat/listing | Per-seat + portal access fees |
| Switching cost | High (data lock-in) | Low (greenfield market) |

**Beachhead:** 3,000-4,000 buyers agents in AU, growing 15-25% annually. Most use generic CRMs (Salesforce, HubSpot) or spreadsheets. Purpose-built tooling = immediate product-market fit.

**Seller pipeline stays maintained** — it's already functional and keeps the door open for full-service agencies, but marketing and development focus goes to buyers-agent features.

### Competitive Moat

1. **AI-powered property matching** — no competitor does this for buyers agents
2. **Client brief system** — 60+ field structured requirements, no equivalent exists
3. **Due diligence engine** — state-specific templates (NSW, QLD, VIC), automated checklists
4. **Client portal** — transparency that builds trust and justifies fees
5. **End-to-end workflow** — from lead capture to post-settlement nurture in one platform

---

## 2. Current State Assessment

### What's Built (Production-Ready)

| Component | Status | Files | Tests |
|-----------|--------|-------|-------|
| CRM (contacts, leads, scoring) | ✅ Complete | 15+ | 50+ |
| Buyer pipeline (8 stages) | ✅ Complete | 8 | 40+ |
| Seller pipeline (6 stages) | ✅ Complete | 6 | 30+ |
| Buyers-agent pipeline (8 specialized) | ✅ Complete | 8 | 40+ |
| Client brief transformer | ✅ Complete | 4 | 23 |
| Pipeline migration engine | ✅ Complete | 8 | 18 |
| Property match engine (5-factor) | ✅ Complete | 3 | 30+ |
| Workflow engine (trigger/condition/action) | ✅ Complete | 5 | 40+ |
| 10 buyers-agent workflow templates | ✅ Complete | 2 | — |
| Due diligence engine + state templates | ✅ Complete | 5 | 30+ |
| Key dates engine | ✅ Complete | 2 | 20+ |
| Fee calculator | ✅ Complete | 2 | 15+ |
| Contact scoring & duplicate detection | ✅ Complete | 4 | 25+ |
| Email parser & message normaliser | ✅ Complete | 4 | 20+ |
| REST API (33 route files, incl. `/ai`) | ✅ Complete | 33 | 50+ |
| **AI Integration Layer** | ✅ Complete (Sprint 1) | 8 | 60 |
| **Total** | | **110+** | **616** *(606 passing, 10 pre-existing failures)* |

### What's Not Built Yet

- ~~AI Integration Layer~~ ✅ **DONE (Sprint 1)**
- Research Consolidation (suburb reports, agent intelligence)
- AI-powered workflow templates (smart triggers/actions)
- Claude Code agents and slash commands (.claude/agents/, .claude/commands/)
- Domain.com.au / REA portal sync
- Social media integration (Meta, LinkedIn)
- Client portal (web-accessible buyer dashboard)
- AML/KYC compliance module
- Off-market property network
- Analytics & reporting dashboard

---

## 3. Architectural Decisions

Eight key trade-offs were debated. Here are the resolved decisions:

### Decision 1: AI Architecture
**Choice:** Separate AI gateway service (thin Fastify microservice)

**Rationale:** Isolates LLM costs, enables rate limiting, allows model swapping (Claude → GPT → local), prevents LLM latency from affecting core API. The gateway exposes typed endpoints that the main API calls.

```
[Mobile/Web] → [Main API (Fastify)] → [AI Gateway (Fastify)]
                                              ↓
                                        [Claude API]
```

### Decision 2: Property Data Source
**Choice:** Domain API for v1; CoreLogic as premium add-on later

**Rationale:** Domain has public API, lower cost, good listing data. CoreLogic has better historical/valuation data but requires enterprise contract. Ship with Domain, add CoreLogic when revenue justifies cost.

### Decision 3: Portal vs Social Media Priority
**Choice:** Client portal first

**Rationale:** Portal directly enables revenue (buyers agents charge $10-25K per engagement; transparency justifies fees). Social media is marketing — important but not revenue-critical for buyers agents.

### Decision 4: Property Matching Strategy
**Choice:** Hybrid — real-time webhooks for new listings + nightly batch sweep

**Rationale:** New listings need instant alerts (competitive advantage). Nightly batch catches listings that were updated or briefs that changed. Best of both worlds without overloading the system.

### Decision 5: AML/KYC Compliance
**Choice:** Schema and hooks now; full integration in v1.5

**Rationale:** Buyers agents in AU have AML obligations. Ship with the data model and manual verification workflow. Integrate with electronic verification (e.g., GreenID, Frankie) when we have paying customers to fund it.

### Decision 6: Mobile vs Web Priority
**Choice:** Parallel development — mobile for field ops, web for desk work

**Rationale:** Buyers agents split time: 40% in field (inspections, meetings), 60% at desk (research, offers, DD). Mobile is primary for notifications, quick updates, inspection logging. Web is primary for brief creation, DD management, offers, reporting.

### Decision 7: Off-Market Properties
**Choice:** Track as CRM feature in v1; defer network to v2

**Rationale:** Off-market deals are ~30% of buyers agent transactions. v1 lets agents manually add off-market properties and match them. v2 builds a network where agents share off-market listings (huge competitive moat, but complex to build).

### Decision 8: Workflow Automation Depth
**Choice:** Template-first with customization

**Rationale:** Ship with 10+ opinionated best-practice templates (already built). Allow agents to customize triggers/conditions/actions. Don't build a visual workflow builder for v1 — it's expensive to build and most agents won't use it.

---

## 4. Feature Roadmap

### Sprint Overview

| Sprint | Weeks | Theme | Key Deliverables |
|--------|-------|-------|-----------------|
| **Sprint 1** | 1-3 | AI Foundation | AI gateway, enhanced matching, lead scoring |
| **Sprint 2** | 4-6 | Smart Communication | AI drafting, brief refinement, email parsing |
| **Sprint 3** | 7-9 | Automation & Intelligence | Daily action list, follow-up sequences, smart notifications |
| **Sprint 4** | 10-12 | Data & Integration | Domain API sync, analytics dashboard, AML schema |
| **Sprint 5** | 13-15 | Client Experience | Client portal, document sharing, progress tracking |
| **Sprint 6** | 16-18 | Growth & Scale | Social media, off-market tracking, team features |

---

### Sprint 1: AI Foundation (Weeks 1-3) ✅ COMPLETE

**Goal:** Stand up the AI infrastructure and upgrade the two highest-impact features.

> **Architecture note:** Original plan called for a separate AI gateway microservice. Decision reversed during implementation — AI client lives in `packages/integrations/src/ai/` following the existing DomainClient/MetaSocialClient pattern. Rationale: simpler deployment, no cross-service latency, easy to extract later. AI routes exposed at `GET|POST /api/v1/ai/*`.

#### 1.1 AI Integration Layer ✅
- `packages/integrations/src/ai/client.ts` — `AnthropicClient` class using raw `fetch()` (no SDK)
- `packages/integrations/src/ai/prompts.ts` — typed prompt builders for property analysis, lead scoring, brief refinement
- `packages/integrations/src/ai/cache.ts` — `AICache` (in-memory, TTL, LRU eviction, token savings tracking)
- `packages/shared/src/types/ai.ts` — Zod schemas: `AITokenUsage`, `AIFeatureMatchDetail`, `AIEnhancedMatchResult`, `AILeadScoreEnhancement`, `AIBriefRefinement`
- `apps/api/src/services/ai-service-factory.ts` — singleton factory, `isAIEnabled()`, graceful degradation
- Rate limiting (sliding window), exponential backoff retry (429/529), AUD cost tracking per model
- **60 new tests passing** (20 client, 14 cache, 11 property matching, 14 lead scoring, 1 route file)

#### 1.2 AI-Enhanced Property Matching ✅ (Impact Score: 9.45)
- `apps/api/src/services/ai-property-matching.ts` — `AIPropertyMatchingService`
- Replaces hardcoded `featureMatch = 50` with AI semantic score from listing description NLP
- Merges AI deal-breaker flags, recalculates weighted overall score
- Gracefully falls back to base engine when AI unavailable or no listing description
- `supabase/migrations/00008_add_listing_description.sql` — `listing_description TEXT` + GIN full-text index

#### 1.3 AI Lead Scoring ✅ (Impact Score: 8.15)
- `apps/api/src/services/ai-lead-scoring.ts` — `AILeadScoringService`
- AI adjustment ±50 (capped) on top of rule-based `ContactScoring` base score
- Returns signals, urgency level (`immediate/high/medium/low/none`), budget confidence, estimated timeline
- `apps/api/src/routes/ai.ts` — 4 endpoints: `GET /status`, `POST /analyze-match`, `POST /score-lead`, `POST /refine-brief`

**Test Results:** 606 / 616 tests passing across all packages. 10 pre-existing failures tracked below.

**Dependencies:** None (greenfield AI layer)
**Risk:** Claude API costs — mitigated with 24h property cache, 1h lead scoring cache, cost-per-request tracking

---

---

### Pre-Sprint 2: Fix Pre-Existing Test Failures (10 tests)

These failures existed before Sprint 1 and are unrelated to the AI work. Fix before Sprint 2 to keep the test baseline clean.

| File | Count | Root Cause | Fix |
|------|-------|------------|-----|
| `apps/api/src/routes/pipeline-migration.test.ts` | 7 | Supabase mock not intercepting calls correctly in route tests — responses returning 400/500 instead of 200 | Audit mock setup; align with pattern in `contacts.test.ts` and `pipeline.test.ts` |
| `apps/api/src/services/integration-registry.test.ts` | 2 | `GmailClient` and `TwilioClient` mocked with arrow functions (`vi.fn(() => ({...}))`) — not valid class constructors in Vitest | Change mocks to `vi.fn().mockImplementation(function(cfg) { this.config = cfg; ... })` or use `vi.spyOn` |
| `apps/api/src/routes/social-posts.test.ts` | 1 | `MetaSocialClient` same arrow-function mock constructor issue as above | Same fix as integration-registry |

**Priority:** High — must clear before Sprint 2 so each sprint starts from a green baseline.

---

### Sprint 2: Smart Communication (Weeks 4-6)

**Goal:** AI-assisted communication that saves agents 2+ hours/day.

#### 2.1 AI Email/SMS Drafting (Impact Score: 8.20)
- Context-aware message drafting given contact history, pipeline stage, recent activity
- Tone matching (formal for solicitors, friendly for clients, professional for selling agents)
- Template suggestions based on trigger events
- One-tap send from mobile, edit-and-send from web

#### 2.2 AI Brief Refinement (Impact Score: 8.10)
- Analyse search history and client feedback to suggest brief updates
- "You've rejected 3 properties for being too far from the CBD — should we tighten the suburb list?"
- Post-inspection feedback analysis → automatic brief adjustment suggestions
- Confidence scoring on brief completeness

#### 2.3 Smart Email Parsing Enhancement
- Upgrade `email-parser.ts` with AI extraction
- Auto-detect: new listing alerts, price changes, auction results, solicitor correspondence
- Auto-create activities, update property records, trigger workflows
- Parse Domain/REA alert emails into structured property data

**Dependencies:** Sprint 1 (AI gateway must be running)

---

### Sprint 3: Automation & Intelligence (Weeks 7-9)

**Goal:** Proactive intelligence that tells agents what to do, not just what happened.

#### 3.1 Intelligent Daily Action List (Impact Score: 8.20)
- AI-generated prioritized task list each morning
- Considers: pipeline stage deadlines, client responsiveness, market conditions, DD due dates
- "Call Jane Smith — pre-approval expires in 5 days, she has 2 active inspections"
- Push notification to mobile at 7am

#### 3.2 Automated Follow-Up Sequences (Impact Score: 8.25)
- Activate the 10 existing workflow templates with real triggers
- Add AI-generated follow-up content (not just template fill)
- Multi-channel sequences: email → wait 2 days → SMS → wait 3 days → task to call
- Smart timing: learn when each client is most responsive

#### 3.3 Smart Notifications
- AI-filtered notifications — suppress noise, surface what matters
- "New listing in Paddington matches 3 active briefs" > "Contact updated their phone number"
- Mobile push with actionable buttons (View Match, Dismiss, Snooze)
- Digest mode: batch low-priority notifications into daily summary

**Dependencies:** Sprint 1 (AI gateway), Sprint 2 (communication layer)

---

### Sprint 4: Data & Integration (Weeks 10-12)

**Goal:** Connect to external data sources and provide business intelligence.

#### 4.1 Domain.com.au API Sync (Impact Score: 8.25)
- Real-time listing webhook integration
- Auto-import new listings → run through property match engine
- Price change tracking and alerts
- Auction result ingestion for market intelligence
- Agent contact data import for selling agent CRM

#### 4.2 Analytics Dashboard (Impact Score: 7.15)
- Pipeline velocity: avg days per stage, conversion rates, bottleneck identification
- Agent performance: deals closed, response times, client satisfaction
- Market insights: median prices by suburb, days on market, auction clearance rates
- Revenue tracking: fees earned, pipeline value, forecast

#### 4.3 AML/KYC Schema & Manual Workflow
- Database tables for identity verification records
- Manual verification checklist (100-point ID check)
- Document upload and storage (driver's licence, passport, utility bill)
- Compliance report generation for AUSTRAC

**Dependencies:** Sprint 1 for AI analytics features

---

### Sprint 5: Client Experience (Weeks 13-15)

**Goal:** Launch the client-facing portal that differentiates RealFlow.

#### 5.1 Client Portal (Impact Score: 8.15)
- Secure client login (Supabase Auth with magic link)
- Brief review and sign-off (read-only view + digital signature)
- Property shortlist with agent notes and match scores
- Inspection calendar and feedback forms
- Document sharing (contracts, DD reports, valuation reports)
- Progress tracker showing pipeline stage with timeline

#### 5.2 Offer Tracker (Web Parity)
- Full offer management on web (currently mobile-focused)
- Multi-round negotiation tracking with history
- Counter-offer workflow with client approval gates
- Selling agent communication log

#### 5.3 Inspection Logger Enhancement
- Photo/video capture during inspections (mobile)
- Structured inspection notes (condition, pros, cons, estimated value)
- AI-generated inspection summary from notes and photos
- Client-visible inspection reports in portal

**Dependencies:** Sprint 4 (portal needs analytics data, document storage)

---

### Sprint 6: Growth & Scale (Weeks 16-18)

**Goal:** Marketing tools and features that drive user acquisition.

#### 6.1 Social Media Integration
- One-tap listing posts to Facebook, Instagram, LinkedIn
- Template-based content with property photos and details
- DM → CRM ingestion (Facebook Messenger, Instagram DMs)
- Lead source tracking from social campaigns

#### 6.2 Off-Market Property Tracking
- Manual off-market listing creation with source tracking
- Match off-market properties against active briefs
- Private notes and agent-only visibility
- Track success rates for off-market vs on-market

#### 6.3 Team & Agency Features
- Multi-agent dashboard for agency principals
- Lead assignment rules (round-robin, geographic, specialisation)
- Team performance comparison
- Shared workflow templates across team

**Dependencies:** All previous sprints

---

## 5. Feature Impact Matrix

Top 25 features scored across 5 dimensions (1-10 scale):

| Rank | Feature | Revenue | Retention | Differentiation | Feasibility | Market Demand | Composite |
|------|---------|---------|-----------|-----------------|-------------|---------------|-----------|
| 1 | AI Property Matching | 9 | 10 | 10 | 7.5 | 10 | **9.45** |
| 2 | Portal Listing Sync | 9 | 8 | 7 | 8.5 | 9 | **8.25** |
| 3 | Automated Follow-Up | 8 | 9 | 7 | 9 | 8.5 | **8.25** |
| 4 | Daily Action List | 7 | 9 | 9 | 8 | 8 | **8.20** |
| 5 | AI Email/SMS Drafting | 7 | 8 | 8 | 9 | 9 | **8.20** |
| 6 | AI Lead Scoring | 8 | 8 | 8 | 8.5 | 8.5 | **8.15** |
| 7 | Client Portal | 9 | 9 | 9 | 6.5 | 7 | **8.15** |
| 8 | AI Brief Refinement | 7 | 9 | 9 | 7.5 | 8 | **8.10** |
| 9 | Document Management | 7 | 8 | 6 | 9 | 8 | **7.55** |
| 10 | Market Insights | 7 | 8 | 8 | 7 | 7.5 | **7.45** |
| 11 | Off-Market Tracking | 8 | 7 | 9 | 6.5 | 7 | **7.40** |
| 12 | Inspection Logger | 6 | 8 | 8 | 8 | 7 | **7.35** |
| 13 | Multi-Channel Comms | 7 | 7 | 6 | 8 | 8 | **7.15** |
| 14 | Analytics Dashboard | 7 | 7 | 6 | 7.5 | 8 | **7.15** |
| 15 | AML/KYC Compliance | 6 | 6 | 7 | 8 | 8 | **6.95** |

---

## 6. Dependency Graph

```
Sprint 1: AI Foundation
    ├── AI Gateway Service (no deps)
    ├── AI Property Matching (← AI Gateway)
    └── AI Lead Scoring (← AI Gateway)
            │
Sprint 2: Smart Communication
    ├── AI Email/SMS Drafting (← AI Gateway)
    ├── AI Brief Refinement (← AI Gateway, Property Match)
    └── Smart Email Parsing (← AI Gateway)
            │
Sprint 3: Automation & Intelligence
    ├── Daily Action List (← AI Gateway, Lead Scoring)
    ├── Follow-Up Sequences (← Email/SMS Drafting, Workflow Engine)
    └── Smart Notifications (← AI Gateway)
            │
Sprint 4: Data & Integration
    ├── Domain API Sync (no deps)
    ├── Analytics Dashboard (← all data sources)
    └── AML/KYC Schema (no deps)
            │
Sprint 5: Client Experience
    ├── Client Portal (← Document Mgmt, Analytics)
    ├── Offer Tracker Web (← existing mobile offers)
    └── Inspection Logger (← AI Gateway for summaries)
            │
Sprint 6: Growth & Scale
    ├── Social Media (← Communication layer)
    ├── Off-Market Tracking (← Property Match)
    └── Team Features (← Analytics, Lead Scoring)
```

---

## 7. Development Workflow

### Using Available Skills

The codebase has skill-based commands that should be used throughout development:

| Skill | When to Use |
|-------|-------------|
| `new-task` | Break down each sprint feature into implementation plan |
| `misc:feature-plan` | Plan each feature with technical specifications |
| `api:api-new` | Create new API routes (AI gateway endpoints, portal API) |
| `api:api-protect` | Add auth/security to all new endpoints |
| `api:api-test` | Test all API endpoints after creation |
| `ui:page-new` | Create new Next.js pages (analytics, portal, admin) |
| `ui:component-new` | Create new React components |
| `supabase:types-gen` | Regenerate types after DB migrations |
| `supabase:edge-function-new` | Create edge functions for webhooks |
| `misc:code-optimize` | Optimize after features are working |
| `misc:lint` | Lint after each feature completion |
| `misc:docs-generate` | Document each new module |
| `misc:code-cleanup` | Refactor at sprint boundaries |
| `claude-developer-platform` | Build AI gateway with Claude API |

### Recommended Feature Build Sequence

For each feature:

1. **Plan** → Use `misc:feature-plan` to design the implementation
2. **Schema** → Define Zod types in `packages/shared/src/types/`
3. **Migration** → Create Supabase migration for new tables
4. **Types** → Use `supabase:types-gen` to sync types
5. **Business Logic** → Implement in `packages/business-logic/src/`
6. **API Routes** → Use `api:api-new` + `api:api-protect`
7. **Tests** → Use `api:api-test` for endpoints
8. **Web UI** → Use `ui:page-new` + `ui:component-new`
9. **Mobile UI** → Parallel mobile implementation
10. **Optimise** → Use `misc:code-optimize`
11. **Document** → Use `misc:docs-generate`

---

## 8. Go-to-Market Considerations

### Pricing Strategy (Recommended)

| Tier | Price/month | Target |
|------|-------------|--------|
| Solo Agent | $99 AUD | Individual buyers agents |
| Small Team (2-5) | $79/seat AUD | Boutique agencies |
| Agency (6+) | $59/seat AUD | Full-service agencies |
| Client Portal Add-on | +$29/seat AUD | Portal access for clients |

### Launch Sequence

1. **Alpha (Sprint 2 complete):** 5-10 buyers agents in Sydney/Melbourne — free, feedback-driven
2. **Beta (Sprint 4 complete):** 50 agents — $49/month introductory pricing
3. **GA (Sprint 6 complete):** Public launch with full pricing
4. **Expansion:** Add seller features to marketing, target full-service agencies

### Key Metrics to Track

- **Activation:** % of signups who create first client brief within 7 days
- **Engagement:** Daily active users / Monthly active users (target >40%)
- **Retention:** Monthly churn rate (target <5%)
- **Revenue:** MRR growth, average revenue per agent
- **Product:** Time saved per agent per day (target >2 hours)

---

## 9. Technical Debt & Risks

### Current Technical Debt

1. **No E2E tests** — unit tests are strong (455+) but no Playwright/Cypress tests
2. **Manual DB type sync** — Supabase types need manual regeneration
3. **Inline type casts** — some `as` casts remain in mobile hooks
4. **No CI/CD pipeline** — need GitHub Actions for PR checks, deployments
5. **No monitoring** — need Sentry, LogRocket, or similar for production

### Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Claude API cost overruns | Medium | High | Cost caps, caching, batch processing, model downgrades |
| Domain API rate limits | Medium | Medium | Request queuing, caching, fallback to manual entry |
| Slow AI response times | Medium | Medium | Async processing, optimistic UI, streaming responses |
| Security breach (client data) | Low | Critical | RLS, encryption, audit trails, penetration testing |
| Competitor launches BA tool | Medium | Medium | Speed to market, deeper feature set, AI moat |

---

## 10. Success Criteria

### Sprint 1 Exit Criteria ✅ MET
- [x] AI integration layer deployed (in-process, not gateway — see architecture note)
- [x] Property matching uses AI for description NLP analysis
- [x] Lead scoring incorporates AI intent analysis
- [x] All existing 455+ tests still passing (now 606/616 — 10 pre-existing failures tracked)
- [x] AI cost tracking per request in AUD (stored in `AITokenUsage.estimatedCostAud`)
- [x] `GET /api/v1/ai/status` returns `{ enabled: bool, cacheStats: {...} }`
- [ ] ~~AI cost tracking dashboard operational~~ → deferred to Sprint 4 Analytics Dashboard

### Sprint 3 Exit Criteria (Alpha-Ready)
- [ ] Daily action list generating for test agents
- [ ] Follow-up sequences executing automatically
- [ ] AI drafting producing usable email/SMS content
- [ ] 5 alpha agents providing weekly feedback

### Sprint 6 Exit Criteria (GA-Ready)
- [ ] Client portal live with 10+ active clients
- [ ] Domain API sync running for 50+ agent accounts
- [ ] Social media posting functional
- [ ] Analytics dashboard showing meaningful insights
- [ ] <5% monthly churn in beta cohort

---

## Appendix A: Existing Codebase Inventory

### Apps (4)
- `apps/api` — Fastify 5 REST API (32 route files)
- `apps/web` — Next.js 16 agent dashboard
- `apps/mobile` — React Native Expo 54 mobile app
- `apps/portal` — Next.js 16 client portal

### Packages (4)
- `packages/shared` — Zod schemas, TypeScript types (23 type modules)
- `packages/business-logic` — Engines, calculators, templates (15+ modules, 455+ tests)
- `packages/integrations` — External API clients (Domain, Meta, LinkedIn)
- `packages/ui` — Shared UI components

### Database (8 migrations)
- 00001: Core tables (contacts, properties, transactions, users)
- 00002: Communication and workflow tables
- 00003: Buyers agent tables (client_briefs, offers, inspections, DD)
- 00004: Social media and template tables
- 00005: Portal and remaining tables
- 00006: Pipeline migration tracking
- 00007: Pipeline migration function
- 00008: `listing_description TEXT` column on properties + GIN full-text index *(Sprint 1)*

### Business Logic Modules
- `pipeline-engine.ts` — Stage validation and transitions
- `pipeline-migration.ts` — Buying → buyers-agent migration
- `property-match-engine.ts` — 5-factor weighted scoring
- `workflow-engine.ts` — Trigger/condition/action execution
- `client-brief-transformer.ts` — Nested ↔ flat schema conversion
- `contact-scoring.ts` — Lead scoring algorithms
- `duplicate-detection.ts` — Contact deduplication
- `due-diligence-engine.ts` — DD checklist management
- `key-dates-engine.ts` — Critical date tracking
- `fee-calculator.ts` — Fee structure calculations
- `email-parser.ts` — Inbound email processing
- `message-normaliser.ts` — Multi-channel message normalisation
- `contact-matcher.ts` — Contact matching across channels
- Workflow templates: 10 buyers-agent workflows
- DD templates: NSW, QLD, VIC state-specific checklists
