# MEMORY.md — RealFlow Stable Knowledge Base

> Stable facts about the RealFlow codebase. Does not change between sessions unless architecture changes.
> Session-specific state lives in `docs/pm/SPRINT_STATE.md`.
> Last updated: 2026-04-23

---

## Project Identity

**Product:** RealFlow — CRM and workflow platform for Australian real estate agents and buyers agents.
**Repo:** Turborepo monorepo at `Jp8617465-sys/real-estate-app`
**Render service:** `srv-d6logk450q8c73a884pg` (API)
**Supabase project:** Managed via Supabase MCP

---

## Monorepo Structure

```
apps/
  api/       — Fastify 5 / TypeScript backend (117 files, 67 routes)
  web/       — Next.js 16 App Router (207 files, dual product mode)
  portal/    — Next.js 16 App Router (64 files, client-facing)
  mobile/    — React Native / Expo 54 / NativeWind (71 files)

packages/
  shared/         — Domain types, Zod schemas, DB types (65 files)
  business-logic/ — Engines and core domain logic (71 files)
  integrations/   — External service clients (21 files)
  ui/             — Shared component primitives (8 files)

supabase/
  migrations/     — 26 SQL migrations (00001–00026)
```

---

## Test Baseline (as of Sprint 8 + Evolution Weeks)

| Package          | Tests  | Branch Coverage |
| ---------------- | ------ | --------------- |
| shared           | 168    | 99%+            |
| ui               | 5      | —               |
| integrations     | 122    | 94%+            |
| business-logic   | 934    | 80.47% (target: 80%) |
| api              | 638    | 65.24% (target: 65%) |
| mobile           | 65     | —               |
| portal           | 51     | —               |
| **Total**        | **1,978** | —            |

Quality gates: ESLint 0 errors, TypeScript strict 0 errors, Vitest 1,978 passing.

---

## Database Schema — Migration Inventory

| Migration | Description                              |
| --------- | ---------------------------------------- |
| 00001     | Core tables (users, contacts, properties, tasks) |
| 00002     | Pipeline tables (deals, stages)          |
| 00003     | Activity timeline                        |
| 00004     | Documents + storage                      |
| 00005     | Notifications                            |
| 00006     | Workflows (triggers, conditions, actions) |
| 00007     | Social leads + posts                     |
| 00008     | Off-market opportunities                 |
| 00009     | Client briefs (buyers agent)             |
| 00010     | Due diligence + inspection tables        |
| 00011     | Property alerts + subscriptions          |
| 00012     | Market data                              |
| 00013     | (gap — see DEPLOY_CHECK_SPRINT6 warning) |
| 00014     | Portal access + magic links              |
| 00015     | Follow-up sequences                      |
| 00016     | Key dates + compliance (AML/KYC)         |
| 00017     | Offers + auction tables                  |
| 00018     | Analytics events                         |
| 00019     | Team + round-robin assignment            |
| 00020     | Property matches (AI scoring)            |
| 00021     | Push tokens (mobile notifications)       |
| 00022     | Selling agent profiles                   |
| 00023     | Inbox (email threading)                  |
| 00024     | Product segregation (BA vs selling)      |
| 00025     | Subscriptions + Stripe tiers             |
| 00026     | AI conversations (assistant history)     |

Row Level Security is applied on all user-data tables. Soft deletes (`deleted_at TIMESTAMPTZ`) on all tables that hold user data.

---

## Business Logic Engine Inventory

### Core Engines (`packages/business-logic/src/core/`)
| Engine | Purpose |
| ------ | ------- |
| AMLEngine | Anti-money laundering checks, risk scoring |
| AnalyticsEngine | Usage event tracking and aggregation |
| ContactMatcher | Duplicate detection and merge logic |
| ContactScorer | Lead scoring (demographic + behavioural) |
| DailyActionEngine | Daily task queue generation |
| DealHealthCalculator | 5-component weighted deal health score |
| DuplicateDetector | Cross-source duplicate detection |
| EmailParser | Inbound email parsing and thread matching |
| EventBus | Cross-module pub/sub |
| FollowUpSequenceEngine | Automated follow-up scheduling |
| KeyDatesEngine | Critical date tracking and alerts |
| MessageNormaliser | Unify messages across channels |
| PipelineEngine | Stage transition validation and history |
| PipelineMigration | Migrate deals between pipeline types |
| PortalEngine | Client portal data access and visibility |
| PropertyAlertEngine | Alert dispatch for property matches |
| ResearchConsolidationEngine | Multi-source property research merge |
| TeamEngine | Round-robin assignment, performance snapshots |
| WorkflowEngine | Trigger → condition → action execution |
| WorkflowConditionEvaluator | Condition evaluation logic |
| WorkflowErrorRecovery | Retry + dead-letter queue |
| BaseService | Shared service base class |

### Buyers Agent Engines (`packages/business-logic/src/ba/`)
| Engine | Purpose |
| ------ | ------- |
| ClientBriefTransformer | Raw input → structured buyer brief |
| DueDiligenceEngine | DD checklist generation and tracking |
| OffMarketEngine | Private network opportunity matching |
| PropertyMatchEngine | AI-powered property ↔ brief matching |
| PropertyMatcher | Core matching algorithm |
| DDTemplates (NSW/QLD/VIC) | State-specific due diligence templates |

### Selling Agent Engines (`packages/business-logic/src/selling/`)
| Engine | Purpose |
| ------ | ------- |
| DomainSyncEngine | Domain.com.au webhook → property sync |
| FeeCalculator | Commission + fee breakdown |
| SocialLeadEngine | DM → CRM lead ingestion |

---

## API Surface — Route Groups

67 routes across these domains:

`ai`, `alerts`, `analytics`, `assistant` (SSE streaming), `client-briefs`, `compliance`, `consolidation-reports`, `contacts`, `daily-actions`, `documents`, `domain-webhooks`, `due-diligence`, `fees`, `follow-up-sequences`, `inbox`, `inspections`, `key-dates`, `market-data`, `notifications`, `off-market`, `offers`, `pipeline`, `portal`, `properties`, `property-matches`, `push-tokens`, `selling-agents`, `settings`, `social-leads`, `social-posts`, `subscriptions`, `team`, `webhooks`, `workflows`

Base URL: `https://realflow-api.onrender.com`
Staging URL: `https://realflow-api-staging.onrender.com`
Auth: Supabase JWT in `Authorization: Bearer <token>` header on all protected routes.

---

## AI Integration

### Existing AnthropicClient (`packages/integrations/src/ai/client.ts`)
- `generate()` — single-turn completions
- `chat()` — multi-turn with tool-calling loop
- `streamChat()` — SSE streaming with tool-calling
- Model: defaults to claude-sonnet-4-6 (configurable)

### AI Assistant (`apps/api/src/services/ai-assistant/`)
- `AssistantService` — orchestrates tool-calling loop, manages conversation store
- `ConversationStore` — in-memory (backed by migration 00026 for persistence)
- `ToolRegistry` — 10 registered tools:
  - Contact tools: search contacts, get contact detail
  - Pipeline tools: list deals, update deal stage
  - Task tools: list tasks, create task
  - Property tools: search properties, get property detail
  - Daily action tools: get today's actions
  - Health tools: get deal health score
- Route: `POST /api/v1/assistant` (JSON) and `GET /api/v1/assistant/stream` (SSE)
- **Frontend: NOT YET BUILT** — backend is complete, no web UI exists yet.

---

## Authentication Model

- Provider: Supabase Auth
- Methods: email/password, OTP (magic link), Google OAuth, Apple OAuth
- Web auth page: `apps/web/src/app/auth/page.tsx` (rewritten in Evolution Week 5)
- Portal auth: magic link only (client-facing, no password)
- Mobile auth: Supabase session tokens stored in SecureStore
- API auth: `getUser()` from Supabase JWT on every protected handler

---

## Product Modes

RealFlow ships as two products from one codebase:

| Mode | Build command | Routes available |
| ---- | ------------- | ---------------- |
| `buyers_agent` | `npm run build:ba` | BA-specific + shared |
| `selling_agent` | `npm run build:selling` | Selling-specific + shared |
| Both | `npm run build:full` | All routes |

Gating: `NEXT_PUBLIC_PRODUCT_MODE` env var at build time. Runtime check via `useProductAccess()` hook and Fastify `productGuard` plugin.

---

## External Integrations

| Service | Package | Status |
| ------- | ------- | ------ |
| Domain.com.au | `integrations/domain/` | Full sync + webhooks |
| Gmail | `integrations/gmail/` | Inbound parsing |
| LinkedIn | `integrations/linkedin/` | Social publishing |
| Meta / Facebook | `integrations/meta/` | DM ingestion + ads |
| Twilio | `integrations/twilio/` | SMS + voice |
| WhatsApp | `integrations/whatsapp/` | Messaging |
| Stripe | `api/services/subscription-service.ts` | Tiers + limits |
| Supabase Realtime | Throughout | Live updates |
| Anthropic | `integrations/ai/client.ts` | AI assistant + matching |

---

## Key Conventions

| Convention | Rule |
| ---------- | ---- |
| Commits | `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `perf:`, `security:` |
| Branches | `feature/name`, `fix/name`, `sprint/sprint-N` |
| Shared types | Define in `packages/shared/src/types/` — never duplicate |
| Input validation | Zod schemas on all API inputs |
| Soft deletes | `deleted_at TIMESTAMPTZ` — never `DELETE FROM` user data |
| Test fixtures | Proper UUIDs — never `'user-1'` shorthand |
| Session end | Always update `docs/pm/SPRINT_STATE.md` handoff section |
| No `any` | TypeScript strict mode — zero `any` types |

---

## Subscription Tiers (Migration 00025)

Three tiers with feature limits enforced at the API layer:

| Tier | Key Limits |
| ---- | ---------- |
| Starter | Limited contacts, 1 pipeline, no AI features |
| Professional | Full contacts, both pipelines, AI matching |
| Agency | Unlimited, all features, team management |

Enforcement: `productGuard` plugin checks subscription tier on BA/selling-specific routes.

---

## Mobile App Screens

8 tab screens in `apps/mobile/src/app/(tabs)/`:
`alerts`, `brief`, `inspection`, `matches`, `notifications`, `property`, `contact`, `auction`

Dynamic routes: `/property/[id]`, `/contact/[id]`, `/auction/[offerId]`, `/alerts/`

Offline: `useOfflineData` and `useOfflinePipeline` hooks with local sync queue.
