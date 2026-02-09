# BuyerPilot Integration Plan

> Integrating buyers-agent-specific workflows into RealFlow based on
> BuyerPilot research documentation.

---

## Executive Summary

RealFlow currently has a solid foundation: monorepo architecture, typed schemas, 8-stage buyer pipeline, CRM with buyer profiles, property CRUD, and integration clients for Domain/Meta. However, the existing system is designed around **listing agents** — the buyer pipeline is a simplified linear flow that doesn't reflect how buyers agents actually work.

The BuyerPilot research describes a **purpose-built buyers agent platform** with significantly deeper buyer-journey modelling. This plan maps every BuyerPilot concept to the existing RealFlow codebase, identifies gaps, and proposes a phased implementation strategy.

---

## Gap Analysis

### 1. Pipeline Stages — REDESIGN REQUIRED

| # | RealFlow (Current)       | BuyerPilot (Target)       | Status        |
|---|--------------------------|---------------------------|---------------|
| 1 | `new-enquiry`            | `enquiry`                 | Rename only   |
| 2 | `qualified-lead`         | `consult-qualify`         | Rename + redefine |
| 3 | —                        | `engaged`                 | **NEW** (agreement signed, retainer paid) |
| 4 | —                        | `strategy-brief`          | **NEW** (brief finalized, matching activated) |
| 5 | `active-search`          | `active-search`           | Keep, expand behavior |
| 6 | `property-shortlisted`   | _(folded into active-search)_ | Remove as standalone stage |
| 7 | `due-diligence`          | _(folded into under-contract)_ | Move to under-contract sub-process |
| 8 | `offer-made`             | `offer-negotiate`         | Rename, expand with multi-round offers |
| 9 | `under-contract`         | `under-contract`          | Keep, add due diligence engine |
| 10| `settled`                | `settled-nurture`         | Rename, add post-settlement automations |

**Impact:** The buyer pipeline changes from 8 generic stages to 8 buyers-agent-specific stages. This requires:
- New DB migration to update `buyer_stage` enum
- Updated `PipelineEngine` transitions and requirements
- Updated pipeline UI (web + mobile)
- Migration script for any existing transaction data

**Proposed new buyer stages:**
```
enquiry → consult-qualify → engaged → strategy-brief → active-search → offer-negotiate → under-contract → settled-nurture
```

**Key behavioral differences:**
- `engaged` is gated by agreement signed + retainer paid
- `strategy-brief` is gated by full client brief completion + finance verification
- `active-search` now contains internal sub-states (property tracker board)
- `offer-negotiate` supports multiple concurrent offer rounds
- `under-contract` integrates the due diligence engine
- `settled-nurture` triggers post-settlement automation sequences

---

### 2. Client Brief — MAJOR ENHANCEMENT

**Current state:** `BuyerProfileSchema` in `packages/shared/src/types/contact.ts` has basic fields: budgetMin/Max, preApproved, preApprovalAmount/Expiry, propertyTypes, bedrooms/bathrooms/carSpaces (min/max), suburbs, mustHaves, dealBreakers.

**BuyerPilot requires:** A dramatically richer `ClientBrief` as a first-class entity, not just a JSONB field on contacts.

**New fields needed (grouped):**

#### a) Finance (partially exists)
- `preApprovalAmount` — exists
- `preApprovalExpiry` — exists
- `lender` — **NEW**
- `brokerName`, `brokerPhone`, `brokerEmail` — **NEW**
- `depositAvailable` — **NEW**
- `firstHomeBuyer` — **NEW**
- `stampDutyBudgeted` — **NEW**
- `absoluteMaxBudget` — **NEW** (distinct from budgetMax — the hard ceiling)

#### b) Requirements (partially exists)
- `landSize.min/max` — **NEW**
- `buildingAge.min/max` (year built range) — **NEW**
- `maxCommute` (destination, maxMinutes, mode) — **NEW**
- `schoolZones` — **NEW**
- `niceToHaves` — **NEW** (currently only mustHaves + dealBreakers)
- `investorCriteria` (targetYield, growthPriority, acceptTenanted, newBuildPreference) — **NEW**

#### c) Purchase context — **ALL NEW**
- `purchaseType`: owner_occupier | investor | development | smsf
- `enquiryType`: home_buyer | investor | both | unsure

#### d) Timeline — **ALL NEW**
- `urgency`: asap | 1_3_months | 3_6_months | 6_12_months | no_rush
- `mustSettleBefore`: Date
- `idealSettlement`: string (free text)

#### e) Communication preferences — **PARTIALLY NEW**
- `preferredMethod` — exists as `communicationPreference` on Contact
- `updateFrequency`: daily | twice_weekly | weekly — **NEW**
- `bestTimeToCall` — **NEW**
- `partnerName`, `partnerPhone`, `partnerEmail` — **NEW**

#### f) Legal team — **ALL NEW**
- `solicitor`: firmName, contactName, phone, email

#### g) Brief metadata — **NEW**
- `briefVersion` — track changes over time
- `clientSignedOff` — boolean, date

**Decision:** Promote `ClientBrief` to its own database table (not just JSONB on contacts). This enables:
- Versioning (track brief changes over time)
- Client portal access (query brief directly)
- Brief sign-off workflow
- Auditing (who changed what, when)

---

### 3. Property Match Engine — NEW MODULE

**Current state:** Nothing. Properties exist but there's no matching/scoring system.

**Required:**

New `packages/business-logic/src/property-match-engine.ts`:
- Score listings (0-100) against a `ClientBrief`
- Breakdown: priceMatch, locationMatch, sizeMatch, featureMatch, investorMatch
- Auto-run when new listings arrive (Domain/REA feed)
- Auto-run when brief changes

New DB table: `property_matches`
- `id`, `property_id`, `client_brief_id`, `client_id`
- `overall_score`, `score_breakdown` (JSONB)
- `status`: new | sent_to_client | client_interested | inspection_booked | rejected | under_review
- `rejection_reason`, `agent_notes`
- `matched_at`, `updated_at`

New Zod schemas in `packages/shared/src/types/property-match.ts`

---

### 4. Due Diligence Engine — NEW MODULE

**Current state:** Nothing. No checklists, no tracking.

**Required:**

New package: `packages/dd-templates/` (state-specific checklist definitions)

New DB tables:
- `due_diligence_checklists` — per transaction, state-aware
- `due_diligence_items` — individual checklist items with status, assignment, dates, documents

New business logic: `packages/business-logic/src/due-diligence-engine.ts`
- Generate checklist from template based on state + property type
- Track item status transitions
- Calculate completion percentage
- Identify blocking/critical items
- Auto-reminders for overdue items

State-specific templates (initial):
- QLD (most detailed in research — 24 items across 6 categories)
- NSW
- VIC

Categories: legal, physical, financial, environmental, council, strata

---

### 5. Offer Tracker — ENHANCE EXISTING

**Current state:** Transaction has single `offerAmount`, `offerConditions`, `offerStatus`. No support for multiple rounds or auction details.

**Required enhancements:**

New DB table: `offers` (separate from transactions — one transaction can have many offers)
- `id`, `transaction_id`, `property_id`, `client_id`
- `sale_method`: private_treaty | auction | eoi | tender
- `status`: preparing | submitted | countered | accepted | rejected | withdrawn
- `strategy_notes`, `client_max_price`, `recommended_offer`, `walk_away_price`
- `settlement_period`, `deposit_amount`, `deposit_type`

New DB table: `offer_rounds` (individual offer attempts)
- `id`, `offer_id`
- `amount`, `conditions`, `response`, `counter_amount`, `notes`, `created_at`

New DB table: `auction_events`
- `id`, `offer_id`
- `auction_date`, `registration_number`, `bidding_strategy`
- `result`: won | passed_in | outbid
- `final_price`, `number_of_bidders`

---

### 6. Selling Agent Relationship Manager — NEW MODULE

**Current state:** Contacts can be any type but there's no "selling agent" contact type or relationship-specific tracking.

**Required:**

Add `selling-agent` to `ContactTypeSchema` enum (both Zod + DB).

New DB table: `selling_agent_profiles` (extends contact)
- `contact_id` (FK to contacts)
- `agency`, `suburbs[]`
- `relationship_score` (1-5)
- `total_interactions`, `last_contact_date`
- `properties_sent` (off-market count)
- `deals_closed_with`, `average_response_time`
- `tags[]`

New Zod schema: `packages/shared/src/types/selling-agent.ts`

---

### 7. Inspection Logger — NEW MODULE

**Current state:** `inspection` exists as an activity type and task type, but no structured inspection data capture.

**Required:**

New DB table: `inspections`
- `id`, `property_id`, `client_id`, `transaction_id`
- `inspection_date`, `time_spent_minutes`
- `overall_impression`: positive | negative | neutral
- `condition_notes`, `area_feel_notes`
- `client_suitability`: match | maybe | no
- `selling_agent_id` (FK to contacts where type = selling-agent)
- `photos` (JSONB array — captured from mobile camera)
- `voice_note_url` (transcribed to text)
- `voice_note_transcript`
- `agent_notes`
- `created_by`, `created_at`

Mobile-first UI requirements:
- Quick capture form (2-3 taps to log)
- Camera integration (Expo Camera already in deps)
- Voice note recording (Expo Audio already in deps)
- Auto-fill property address from linked listing

---

### 8. Key Dates Timeline — ENHANCE EXISTING

**Current state:** Transaction has `exchangeDate`, `coolingOffExpiry`, `financeApprovalDate`, `settlementDate`, `depositPaid`. Basic fields but no timeline view or reminders.

**Required:**

New DB table: `key_dates`
- `id`, `transaction_id`
- `label` (e.g., "Finance approval deadline", "Pre-settlement inspection")
- `date`, `is_critical`
- `reminder_days_before[]` (e.g., [7, 3, 1])
- `status`: upcoming | due_soon | overdue | completed
- `completed_at`, `notes`

Auto-generation: When a transaction moves to `under-contract`, auto-create key dates based on contract details and state-specific rules.

---

### 9. Client Portal — NEW APP

**Current state:** No portal app exists in the monorepo.

**Required:**

New app: `apps/portal/` (Next.js)
- Separate auth (client login, not agent login)
- Read-only views: brief, search progress, shortlisted properties, due diligence status, key dates
- Document upload (pre-approval letters, ID)
- Messaging (client ↔ agent)
- Client outcome report (post-settlement)

New DB tables:
- `portal_users` — client-specific auth records
- `portal_messages` — client ↔ agent messaging
- `portal_documents` — uploaded files with metadata

---

### 10. Fee & Commission Tracking — NEW MODULE

**Current state:** Transaction has `commissionRate` and `commissionAmount` — designed for selling-side commission only.

**Required:**

New DB table: `fee_structures`
- `id`, `client_id`, `transaction_id`
- `retainer_fee`, `retainer_paid_date`
- `success_fee_type`: flat | percentage | tiered
- `success_fee_flat_amount`, `success_fee_percentage`
- `success_fee_tiers` (JSONB)
- `success_fee_due_date`, `success_fee_paid`, `success_fee_amount`
- `gst_included`

New DB table: `invoices`
- `id`, `fee_structure_id`, `client_id`
- `type`: retainer | success_fee | referral_fee
- `amount`, `gst_amount`
- `status`: draft | sent | paid | overdue
- `due_date`, `paid_date`
- `stripe_invoice_id`

New DB table: `referral_fees`
- `id`, `fee_structure_id`
- `referrer_name`, `referrer_contact_id`
- `amount`, `type`: flat | percentage_of_success
- `paid`, `paid_date`

---

### 11. Reporting & Analytics — NEW MODULE

**Current state:** Dashboard has hardcoded stats. No real analytics.

**Required (agent dashboard):**
- Active clients by stage (pipeline value)
- Properties reviewed / inspections attended (this week/month)
- Offers made / success rate
- Average engagement-to-settlement duration
- Revenue: collected, pending, forecast
- Lead source breakdown

**Required (per-client report):**
- Properties matched, presented, inspected
- Offers made, outcome
- Duration of search
- Final outcome report (auto-generated, lives in client portal)

---

### 12. Social Media Enhancements — ENHANCE EXISTING

**Current state:** Meta client exists for posting. Social posts/messages tables exist. No content calendar, no DM-to-lead pipeline.

**Required:**
- Content calendar (schedule posts across platforms)
- Post templates: "Just Secured", "Market Update", "Suburb Spotlight", "Client Testimonial"
- DM monitoring → auto-create leads (Instagram, Facebook, LinkedIn)
- Lead capture from link-in-bio integration

---

### 13. Lead Source Additions — MINOR ENHANCEMENT

**Current LeadSource enum:** domain, rea, instagram, facebook, linkedin, referral, walk-in, cold-call, website, open-home, signboard, print, other

**BuyerPilot adds:** `google_ads` — add to enum.

---

## Implementation Phases

### Phase 1: Data Model & Pipeline Redesign (Foundation)

**Goal:** Establish the buyers-agent-specific data model without breaking existing functionality.

| # | Task | Files Affected | Complexity |
|---|------|---------------|------------|
| 1.1 | Create new DB migration for buyer stage enum update | `supabase/migrations/00003_buyer_agent_stages.sql` | Medium |
| 1.2 | Add `client_briefs` table | Same migration | Medium |
| 1.3 | Add `property_matches` table | Same migration | Low |
| 1.4 | Add `selling_agent_profiles` table | Same migration | Low |
| 1.5 | Add `inspections` table | Same migration | Low |
| 1.6 | Add `offers` + `offer_rounds` + `auction_events` tables | Same migration | Medium |
| 1.7 | Add `due_diligence_checklists` + `due_diligence_items` tables | Same migration | Medium |
| 1.8 | Add `key_dates` table | Same migration | Low |
| 1.9 | Add `fee_structures` + `invoices` + `referral_fees` tables | Same migration | Medium |
| 1.10 | Update `buyer_stage` enum (DB + TypeScript + Zod) | Multiple shared types | High |
| 1.11 | Create `ClientBriefSchema` Zod type | `packages/shared/src/types/client-brief.ts` | Medium |
| 1.12 | Create `PropertyMatchSchema` Zod type | `packages/shared/src/types/property-match.ts` | Low |
| 1.13 | Create `SellingAgentProfileSchema` Zod type | `packages/shared/src/types/selling-agent.ts` | Low |
| 1.14 | Create `InspectionSchema` Zod type | `packages/shared/src/types/inspection.ts` | Low |
| 1.15 | Create `OfferSchema` + `OfferRoundSchema` + `AuctionEventSchema` Zod types | `packages/shared/src/types/offer.ts` | Medium |
| 1.16 | Create `DueDiligenceSchema` Zod types | `packages/shared/src/types/due-diligence.ts` | Medium |
| 1.17 | Create `KeyDateSchema` Zod type | `packages/shared/src/types/key-date.ts` | Low |
| 1.18 | Create `FeeStructureSchema` + `InvoiceSchema` Zod types | `packages/shared/src/types/fee.ts` | Medium |
| 1.19 | Update `PipelineEngine` with new buyer stages + transitions + requirements | `packages/business-logic/src/pipeline-engine.ts` | High |
| 1.20 | Update all pipeline engine tests | `packages/business-logic/src/pipeline-engine.test.ts` | High |
| 1.21 | Add `selling-agent` to contact type enum | `packages/shared/src/types/contact.ts`, migration | Low |
| 1.22 | Add `google_ads` to lead source enum | `packages/shared/src/types/common.ts`, migration | Low |
| 1.23 | Add RLS policies for new tables | `supabase/migrations/00003_*.sql` | Medium |

**Dependencies:** None — this is the foundation.

---

### Phase 2: Core Business Logic

**Goal:** Implement the buyers-agent-specific engines.

| # | Task | Files Affected | Complexity |
|---|------|---------------|------------|
| 2.1 | Implement Property Match Engine | `packages/business-logic/src/property-match-engine.ts` | High |
| 2.2 | Tests for match engine | `packages/business-logic/src/property-match-engine.test.ts` | High |
| 2.3 | Implement Due Diligence Engine | `packages/business-logic/src/due-diligence-engine.ts` | High |
| 2.4 | Create QLD due diligence template | `packages/dd-templates/src/qld.ts` | Medium |
| 2.5 | Create NSW due diligence template | `packages/dd-templates/src/nsw.ts` | Medium |
| 2.6 | Create VIC due diligence template | `packages/dd-templates/src/vic.ts` | Medium |
| 2.7 | Tests for DD engine | `packages/business-logic/src/due-diligence-engine.test.ts` | Medium |
| 2.8 | Implement Key Dates auto-generation | `packages/business-logic/src/key-dates-engine.ts` | Medium |
| 2.9 | Implement Fee Calculator | `packages/business-logic/src/fee-calculator.ts` | Medium |
| 2.10 | Tests for fee calculator | `packages/business-logic/src/fee-calculator.test.ts` | Low |

**Dependencies:** Phase 1 (schemas and DB tables).

---

### Phase 3: API Layer

**Goal:** Expose all new functionality through Fastify API routes.

| # | Task | Files Affected | Complexity |
|---|------|---------------|------------|
| 3.1 | Client Brief CRUD endpoints | `apps/api/src/routes/client-briefs.ts` | Medium |
| 3.2 | Property Match endpoints (list, update status, notes) | `apps/api/src/routes/property-matches.ts` | Medium |
| 3.3 | Inspection CRUD endpoints | `apps/api/src/routes/inspections.ts` | Medium |
| 3.4 | Offer CRUD + round management endpoints | `apps/api/src/routes/offers.ts` | High |
| 3.5 | Due Diligence CRUD + item status endpoints | `apps/api/src/routes/due-diligence.ts` | High |
| 3.6 | Key Dates CRUD endpoints | `apps/api/src/routes/key-dates.ts` | Low |
| 3.7 | Selling Agent profile endpoints | `apps/api/src/routes/selling-agents.ts` | Low |
| 3.8 | Fee Structure + Invoice endpoints | `apps/api/src/routes/fees.ts` | Medium |
| 3.9 | Update pipeline route for new stages | `apps/api/src/routes/pipeline.ts` | Medium |
| 3.10 | API route tests for all new endpoints | Multiple test files | High |

**Dependencies:** Phase 1 + Phase 2.

---

### Phase 4: Web Application Features

**Goal:** Build the buyers-agent-specific UI in the web app.

| # | Task | Files Affected | Complexity |
|---|------|---------------|------------|
| 4.1 | Client Brief form + detail view | `apps/web/src/app/clients/[id]/brief/` | High |
| 4.2 | Property Match board (Kanban: To Review → Shortlisted → Inspection Booked → Client Interested → Rejected) | `apps/web/src/app/clients/[id]/matches/` | High |
| 4.3 | Updated Pipeline board with new stages | `apps/web/src/components/pipeline/` | Medium |
| 4.4 | Inspection log list + detail view | `apps/web/src/app/inspections/` | Medium |
| 4.5 | Offer management UI (multi-round, auction mode) | `apps/web/src/app/clients/[id]/offers/` | High |
| 4.6 | Due Diligence checklist UI | `apps/web/src/app/transactions/[id]/due-diligence/` | High |
| 4.7 | Key Dates timeline view | `apps/web/src/app/transactions/[id]/timeline/` | Medium |
| 4.8 | Selling Agent directory + profile | `apps/web/src/app/selling-agents/` | Medium |
| 4.9 | Fee tracking dashboard + invoice list | `apps/web/src/app/fees/` | Medium |
| 4.10 | Analytics dashboard (buyers agent KPIs) | `apps/web/src/app/dashboard/` | High |
| 4.11 | Hooks: useClientBrief, usePropertyMatches, useOffers, useDueDiligence, useKeyDates, useFees | `apps/web/src/hooks/` | Medium |

**Dependencies:** Phase 3 (API routes).

---

### Phase 5: Mobile Application Features

**Goal:** Mobile-first inspection logging, offer tracking, and search management.

| # | Task | Files Affected | Complexity |
|---|------|---------------|------------|
| 5.1 | Inspection logger (camera + voice notes + quick form) | `apps/mobile/app/inspection/` | High |
| 5.2 | Property match review (swipe-to-action) | `apps/mobile/app/matches/` | High |
| 5.3 | Auction day mode (real-time bid logging) | `apps/mobile/app/auction/` | Medium |
| 5.4 | Client brief quick-view | `apps/mobile/app/client/[id]/brief.tsx` | Low |
| 5.5 | Due diligence checklist (tick-off on the go) | `apps/mobile/app/transaction/[id]/dd.tsx` | Medium |
| 5.6 | Push notifications for property matches | `apps/mobile/app/` (notification handlers) | Medium |
| 5.7 | Updated pipeline view with new stages | `apps/mobile/app/(tabs)/pipeline.tsx` | Low |

**Dependencies:** Phase 3 (API routes).

---

### Phase 6: Client Portal

**Goal:** Client-facing portal for transparency and self-service.

| # | Task | Files Affected | Complexity |
|---|------|---------------|------------|
| 6.1 | Portal app scaffold (Next.js + Supabase auth) | `apps/portal/` | Medium |
| 6.2 | Client brief view (read-only + suggest changes) | `apps/portal/src/app/brief/` | Medium |
| 6.3 | Shortlisted properties view with agent notes | `apps/portal/src/app/properties/` | Medium |
| 6.4 | Due diligence progress tracker | `apps/portal/src/app/due-diligence/` | Medium |
| 6.5 | Key dates timeline | `apps/portal/src/app/timeline/` | Low |
| 6.6 | Document upload | `apps/portal/src/app/documents/` | Medium |
| 6.7 | Agent messaging | `apps/portal/src/app/messages/` | Medium |
| 6.8 | Outcome report (post-settlement) | `apps/portal/src/app/report/` | Medium |

**Dependencies:** Phase 3 (API routes).

---

### Phase 7: Automation & Integration

**Goal:** Workflow templates, email/SMS sending, portal sync.

| # | Task | Files Affected | Complexity |
|---|------|---------------|------------|
| 7.1 | Workflow execution engine | `packages/business-logic/src/workflow-engine.ts` | High |
| 7.2 | BA workflow templates (lead response, follow-up, settlement countdown) | `packages/business-logic/src/workflow-templates/` | Medium |
| 7.3 | Domain API property matching feed | `packages/integrations/src/domain/` | High |
| 7.4 | DM monitoring → lead creation (Instagram/Facebook) | `packages/integrations/src/meta/` | High |
| 7.5 | Email sending (Resend integration) | `packages/integrations/src/resend/` | Medium |
| 7.6 | SMS sending (Twilio integration) | `packages/integrations/src/twilio/` | Medium |
| 7.7 | Content calendar + post templates | `apps/web/src/app/social/` | Medium |
| 7.8 | Pre-approval expiry auto-reminders | Workflow template | Low |
| 7.9 | Settlement countdown automation | Workflow template | Low |
| 7.10 | Post-settlement nurture sequence | Workflow template | Medium |

**Dependencies:** Phases 2 + 3.

---

## Schema Change Summary

### New Tables (13)

| Table | Purpose |
|-------|---------|
| `client_briefs` | Rich buyer brief with finance, requirements, timeline, solicitor |
| `property_matches` | Scored property ↔ client brief matches |
| `selling_agent_profiles` | Relationship tracking for selling agents |
| `inspections` | Structured inspection logs with media |
| `offers` | Multi-round offer tracking with strategy |
| `offer_rounds` | Individual offer/counter-offer attempts |
| `auction_events` | Auction-specific data per offer |
| `due_diligence_checklists` | Per-transaction, state-aware checklists |
| `due_diligence_items` | Individual checklist items with status |
| `key_dates` | Critical date tracking with reminders |
| `fee_structures` | Retainer + success fee tracking |
| `invoices` | Generated invoices for fees |
| `referral_fees` | Referral fee tracking |

### Modified Tables/Enums

| Change | Detail |
|--------|--------|
| `buyer_stage` enum | Replace 8 stages with buyers-agent-specific stages |
| `contact_type` enum | Add `selling-agent` |
| `lead_source` enum | Add `google_ads` |
| `task_type` enum | Add `brief-review`, `due-diligence-check`, `pre-settlement-inspection`, `client-portal-update` |
| `activity_type` enum | Add `inspection-logged`, `property-matched`, `offer-round`, `dd-item-completed`, `brief-updated` |

### New Zod Schemas (8 files)

| File | Schemas |
|------|---------|
| `client-brief.ts` | ClientBriefSchema, SuburbPreferenceSchema, MaxCommuteSchema, InvestorCriteriaSchema, FinanceDetailsSchema, SolicitorSchema |
| `property-match.ts` | PropertyMatchSchema, MatchScoreBreakdownSchema |
| `selling-agent.ts` | SellingAgentProfileSchema |
| `inspection.ts` | InspectionSchema, InspectionPhotoSchema |
| `offer.ts` | OfferSchema, OfferRoundSchema, AuctionEventSchema |
| `due-diligence.ts` | DueDiligenceChecklistSchema, DueDiligenceItemSchema |
| `key-date.ts` | KeyDateSchema |
| `fee.ts` | FeeStructureSchema, InvoiceSchema, ReferralFeeSchema |

---

## Architectural Decisions

### 1. Client Brief as separate table (not JSONB on contacts)

**Rationale:** The brief is the central document in a buyers agent's workflow. It needs:
- Versioning (track changes over time)
- Direct querying (property match engine queries briefs, not contacts)
- Client portal access (client reads/reviews their brief)
- Audit trail (compliance requirement)
- Sign-off workflow (client approves brief before search begins)

The existing `buyer_profile` JSONB on contacts becomes a denormalized summary for quick display, while `client_briefs` holds the authoritative, versioned brief.

### 2. Offers as separate table (not fields on transactions)

**Rationale:** A single transaction can involve multiple offer attempts on different properties before one succeeds. The current model (single offerAmount on transaction) can't represent:
- Multiple rounds of negotiation
- Auction-specific data
- Strategy notes per offer
- Failed offers that led to returning to search

### 3. Due diligence templates as code (not DB)

**Rationale:** State-specific checklists are relatively static legal/compliance requirements. Storing templates in `packages/dd-templates/` means:
- Version controlled with the codebase
- Easy to audit changes
- Type-safe template definitions
- No DB migration needed to update a checklist item's description

Generated checklists (instances) live in the DB for tracking.

### 4. Keep existing seller pipeline unchanged

**Rationale:** The BuyerPilot research is buyers-agent-specific. The existing seller pipeline (6 stages) serves listing agents well and doesn't need modification. Both pipelines coexist via `pipeline_type`.

### 5. Mobile-first for inspections and auction day

**Rationale:** BuyerPilot research emphasizes that buyers agents are in the field. Inspection logging and auction bidding happen on-site. These features should be designed mobile-first with the web app as secondary.

---

## Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Buyer stage enum change breaks existing data | High | Migration script to map old → new stages. Run in transaction with rollback. |
| Client brief complexity overwhelms UI | Medium | Progressive disclosure: start with essentials, expand sections as needed |
| Property match engine performance at scale | Medium | Background job processing, indexed queries, pagination |
| Due diligence templates diverge from legal requirements | High | Clear versioning, legal review flag, easy template updates |
| Portal adds auth complexity | Medium | Separate Supabase auth pool for portal users, distinct from agent auth |

---

## Priority Order (if time-constrained)

If we need to ship incrementally, the highest-impact features for buyers agents are:

1. **Pipeline stage redesign** — This is the foundation. Everything else builds on it.
2. **Client Brief** — The "sacred document" that drives the entire search.
3. **Property Match Engine** — Core differentiator. Without this, agents are manually searching.
4. **Due Diligence Engine** — "Saves careers." Critical compliance tool.
5. **Offer Tracker** — Multi-round negotiation is daily workflow.
6. **Inspection Logger** — High-frequency mobile task.
7. **Selling Agent Manager** — Relationship network management.
8. **Fee Tracking** — Business operations.
9. **Key Dates Timeline** — Important but partially covered by existing fields.
10. **Client Portal** — High value but can be deferred.
11. **Social Media** — Lead gen enhancement, not core workflow.
12. **Analytics** — Important but data accumulates while other features are built.
