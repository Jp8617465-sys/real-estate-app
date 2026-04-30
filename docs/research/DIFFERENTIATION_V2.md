# RealFlow — Differentiation Strategy v2

**Status:** Draft — post-competitor-discovery re-think
**Date:** 2026-04-05
**Supersedes:** `STRATEGIC_ROADMAP.md` §1.2 (greenfield thesis invalidated)

---

## 1. TL;DR

- **The 5-pillar differentiation thesis is dead.** AgentHub 360, BA-ICON and Stash already ship AI-matching, briefs, DD engines and brief distribution. Three of RealFlow's five pillars are now table-stakes in this niche. Head-on wedge competition is a losing posture for a solo founder with no GTM runway.
- **RealFlow's real defensibility is depth-of-workflow, not feature novelty.** The codebase contains a deal-health calculator, research consolidation engine, daily-action engine, state-aware key-dates engine, AML/KYC 100-point tracker, team/round-robin assignment, and portal feedback loop that together make it the only BA tool that operates *after the brief is matched* — through DD, settlement and compliance. Competitors stop at matching; RealFlow continues through to settlement.
- **Recommended path: Path B — narrow to "post-match operating system for buyers agents."** Re-position away from matching (commoditised) and toward the 90-day window from offer-accepted to settlement, where RealFlow has 3× the feature depth of any competitor and agents have clear, recurring, billable pain (DD blow-ups, missed cooling-off, AML compliance, solicitor coordination).

---

## 2. Original Thesis Audit — Pillar by Pillar

| # | Original Pillar | Status | Evidence |
|---|---|---|---|
| 1 | AI-powered property matching | **Table-stakes** | AgentHub 360 and Stash lead with AI matching. `property-match-engine.ts` is a solid 5-factor weighted scorer (price 30 / location 25 / size 20 / features 15 / investor 10) but not distinctive. |
| 2 | Client brief system (60+ fields) | **Table-stakes** | BA-ICON markets "automated client briefs"; Stash has brief→listings flow. Depth of RealFlow's schema (`packages/shared/src/types/client-brief.ts` — Investor, Finance, Solicitor, Commute, Suburb rank) is above average but not visibly unique from the outside. |
| 3 | Due-diligence engine with state templates | **Defensible (partial)** | AgentHub 360 leads with "DD engine" but scope unclear. RealFlow's NSW/QLD/VIC templates (`packages/business-logic/src/ba/dd-templates/`) are concrete, per-role-assigned (`solicitor`, `inspector`, `agent`), and include state-specific items (e.g. NSW `s66W certificate`, cooling-off variants). This is a sub-pillar worth doubling down on. |
| 4 | Client portal | **Defensible (positioning, not feature)** | Pain Corpus P4 notes portals are consumer-want, not agent-want. Agents will pay for a portal *if it reduces their inbound load*. Shipped feature exists (`portal-engine.ts`) with structured feedback ingestion — that's the angle, not "transparency." |
| 5 | End-to-end workflow (lead to settlement) | **Strongest surviving pillar** | Competitors stop at match. RealFlow has: pipelines, DD, key-dates, AML, offers, inspections, consolidation reports, team assignment. This is the actual moat. |

**Net:** Two pillars survive (DD engine, end-to-end workflow). Three are commoditised. The original narrative must be rewritten around depth, not breadth.

---

## 3. Hidden Differentiators in the Codebase

Found by reading the actual shipped code, not the roadmap:

### 3.1 Deal Health Calculator (unique angle — "is this deal in trouble?")
`packages/business-logic/src/core/deal-health-calculator.ts`
Weighted 5-factor grade (engagement recency 25, communication frequency 20, pipeline velocity 20, qualification 20, activity completeness 15) with stage-aware benchmarks (`STAGE_WEEKLY_BENCHMARKS` — early 2/wk, active 3/wk, deal 5/wk). No competitor advertises deal-health scoring. This is a *pipeline-hygiene* tool that surfaces cold deals before they're lost — a clear "money-on-the-table" narrative.

### 3.2 Research Consolidation Engine
`packages/business-logic/src/core/research-consolidation-engine.ts`
Aggregates brief + matches + inspections + DD checklists + key-dates + offers + market data into a structured report (`ConsolidationDataInput`) that can be AI-narrated. This is *the artefact a BA sends a client every Monday* — and it is automated via `ai-powered-workflows.ts → Weekly Client Search Report`. Competitors ship matching; RealFlow ships the *reporting output* that BAs currently assemble manually in Word.

### 3.3 Daily Action Engine
`packages/business-logic/src/core/daily-action-engine.ts`
Queries overdue tasks + upcoming key-dates + stale contacts in parallel, scores them with a priority matrix, then sends top-20 to Claude for "why now" subtitles. This is a *home-screen-of-the-day* feature — directly addresses Pain Corpus P1 (spreadsheet hell). AgentHub 360/BA-ICON marketing does not mention anything equivalent.

### 3.4 AML/KYC 100-Point ID Tracker
`supabase/migrations/00011_aml_kyc.sql`
Full enum of AU ID document types with AUSTRAC point values (passport 70, driver's licence 40, medicare 25, etc). BAs are AUSTRAC reporting entities under the AML/CTF Act 2006 — this is a *licence-risk* feature. Competitors do not appear to ship this. Combined with state-specific DD, RealFlow is the only tool that treats BAs as regulated professionals, not salespeople.

### 3.5 State-aware Key Dates Engine
`packages/business-logic/src/core/key-dates-engine.ts`
Auto-generates cooling-off, B&P, finance, deposit, settlement dates from exchange date, with state-specific defaults and `addBusinessDays` handling. Missing a cooling-off deadline is a liability event for a BA. This is adjacent to DD and should be bundled into the "post-match" narrative.

### 3.6 Team/Agency Layer (shipped but un-marketed)
`supabase/migrations/00022_team_agency_features.sql` + `00023_round_robin_function.sql`
Lead assignment rules (round-robin / geographic / specialisation), shared workflow templates, daily team performance snapshots. Competitors target solo BAs; RealFlow can serve 3–20 seat boutique BA agencies where the principal needs oversight. This opens a pricing tier competitors may not reach.

### 3.7 Structured Portal Feedback Loop
`portal-engine.ts` ingests `PortalPropertyFeedbackSchema` + `PortalInspectionFeedbackSchema` — client feedback comes back *structured*, not as email replies. This turns the portal from a "transparency dashboard" into a *brief-refinement mechanism* that auto-updates matching weights.

### 3.8 API Surface Signals Depth
`apps/api/src/routes/` has 40+ route modules including `fees`, `offers`, `inspections`, `key-dates`, `selling-agents`, `off-market`, `consolidation-reports`, `daily-actions`, `compliance`, `follow-up-sequences`. No competitor markets this surface area — they all appear to be matching-layer tools.

---

## 4. Three Strategic Paths

### Path A — Head-on compete on the same wedge (matching + DD)
**Case for:** RealFlow ships today, feature parity exists, sunk investment is maximum.
**Case against:** AgentHub 360 has GTM polish, marketing site, probable capital. RealFlow founder has no known GTM edge, no BA network, no pricing leverage. Competing on AI-matching against a funded competitor is a losing unit-economics story for a solo founder. Pain Corpus P1 is real but already being sold into.
**Next 30 days:** Try to out-feature incumbents on matching UX + faster onboarding. Unlikely to move the needle; incumbents copy in 60 days.
**Verdict: Reject.**

### Path B — Narrow to "post-match operating system" for BAs
**Case for:** Strongest codebase evidence. DD engine (§3), key-dates (§3.5), AML (§3.4), deal-health (§3.1), consolidation reports (§3.2), fees + offers + inspections routes. Competitors stop at brief-match. The 90-day offer→settlement window is where BA liability sits, where REBAA training gaps exist (Pain Corpus P3), and where agents lose fees if deals fall over. Positioning becomes: *"your matching tool gets them to a property; RealFlow gets them to settlement."* Complements rather than replaces incumbents — possible partnership/integration play.
**Case against:** Requires a narrative reset and a demo that doesn't lead with matching. Portal and matching features become supporting actors, not headliners. May compress TAM in messaging.
**Next 30 days:**
- Days 1–7: Validate post-match pain in 10 BA conversations. Specifically probe: DD blow-ups, missed cooling-off, AUSTRAC compliance anxiety, solicitor coordination overhead.
- Days 8–14: Rebuild landing page around "from offer to settlement, nothing falls through." Record a 3-minute demo walking through DD → key-dates → AML → consolidation report.
- Days 15–21: Reach out to 5 REBAA members; offer free DD-engine access in exchange for feedback and a migration interview.
- Days 22–30: Price-discover at $149–199/seat (premium positioning: liability-reduction tool, not productivity tool).
**Verdict: Recommend.**

### Path C — Adjacent market pivot (boutique BA agencies / AML-first / state-specialist)
**Case for:** Team/agency layer (§3.6) is shipped and unexploited. AML (§3.4) is a regulated wedge incumbents may not touch. State-specific DD (NSW s66W, QLD/VIC variants) creates credibility with one-state boutiques.
**Case against:** Smaller TAM per segment. Requires picking one (boutique principals OR AML-first OR NSW-only) — can't fight three fronts as a solo founder. AML-first alone is probably too narrow to be a product.
**Next 30 days:** Only worth pursuing if Path B validation fails. If pursued, narrow to *NSW boutique BA agencies (2–10 seats)* as the single ICP — largest sub-segment, deepest codebase coverage, natural expansion to QLD/VIC.
**Verdict: Hold as fallback.**

---

## 5. Recommended Path: B

**Rationale:**
1. Codebase evidence is overwhelming — RealFlow has 8+ post-match engines that no competitor advertises.
2. The pain is concrete and billable: missed cooling-off = BA liability, failed DD = lost fee + reputation.
3. "Post-match OS" is a complement narrative, not a replacement — agents can keep AgentHub 360/Stash for matching and add RealFlow for settlement. Easier sale, lower switching cost.
4. The AUSTRAC/AML angle creates a compliance moat incumbents are unlikely to rapidly copy (requires legal research per state).
5. Pricing leverage: liability-reduction tools price 2–3× productivity tools.

**What to de-emphasise (not remove):**
- "AI-powered matching" as headline → becomes supporting feature ("matches feed the pipeline")
- "60-field client brief" → becomes footnote ("feeds DD and key-dates automatically")

**What to double down on:**
- DD engine state coverage: add SA/WA within 60 days
- AML workflow UX: make 100-point ID capture the onboarding moment for every new client
- Consolidation report: make the Monday-morning email the artefact BAs demo to prospects
- Deal-health score: surface on dashboard as the #1 widget

---

## 6. Positioning Statement Candidates

Each tied to shipped code evidence:

1. **"From accepted offer to settled keys — the operating system for Australian buyers agents."**
   *Evidence:* `due-diligence-engine.ts`, `key-dates-engine.ts`, `aml-engine.ts`, `fees.ts`, `offers.ts`.

2. **"The only BA tool built for AUSTRAC, REBAA, and the 90 days between contract and settlement."**
   *Evidence:* `00011_aml_kyc.sql` (100-point ID), NSW/QLD/VIC DD templates, state-aware cooling-off.

3. **"Your matching tool finds the property. RealFlow stops the deal from falling over."**
   *Evidence:* `deal-health-calculator.ts`, blocking-item detection in `due-diligence-engine.ts`, key-dates reminder chains.

4. **"The post-match OS for buyers agencies — DD, compliance, settlement, reporting."**
   *Evidence:* `research-consolidation-engine.ts`, `daily-action-engine.ts`, team/round-robin layer.

5. **"Stop losing fees to missed deadlines. State-aware DD, AML, and settlement tracking for Australian BAs."**
   *Evidence:* `key-dates-engine.ts` + `addBusinessDays`, state-templated DD, AUSTRAC-aligned AML.

**Recommended lead: #3** — it is complement-not-replacement, names the fear (deal falling over), and implies the ROI (saved fees).

---

## 7. Validation Questions (Day 5–7, 10 BA Conversations)

Must confirm:

1. **Deal-fall-over frequency:** "In the last 12 months, how many deals fell over between offer-accepted and settlement? What caused it?" (Targets: DD issues, finance, cooling-off, B&P.) — If <20% of deals have a fall-over event, post-match pain is not acute enough.
2. **AUSTRAC anxiety:** "How do you currently handle 100-point ID verification and AML record-keeping? Do you feel exposed?" — If BAs delegate to solicitors or ignore, AML-as-wedge dies.
3. **DD tooling gap:** "Walk me through your last DD. What tool/template did you use? Was it state-specific?" — If they all use a solicitor's checklist, DD-engine is not theirs to buy.
4. **Settlement-coordination pain:** "Who chases the solicitor, broker, inspector when a deadline approaches? How?" — Tests key-dates engine value.
5. **Willingness to stack:** "Would you run two tools — one for matching, one for post-offer — if the second reduced liability?" — Core to complement-narrative.
6. **Price anchor:** "If a tool reduced one fall-over per year, what's that worth?" (BA fee AUD 15–25k per deal.) — Justifies $149–199 price.
7. **Consolidation-report love:** Show prototype of Monday search-progress report. "Is this what you currently send clients? How long does it take you?" — If >2hr/week per client, strong pull.
8. **Boutique principal signal:** "If you have 2+ agents, who tracks team performance? How?" — Tests team tier.
9. **State specificity:** "Do you work across states? Does your DD change by state?" — Validates state-template premium.
10. **Competitor awareness:** "Do you use AgentHub 360 / BA-ICON / Stash? What's missing?" — Direct competitor-weakness elicitation.

**Kill criteria for Path B:**
- <4/10 report a fall-over in last 12 months, AND
- <3/10 feel any AUSTRAC anxiety, AND
- <3/10 would pay premium for settlement-coordination

If 2+ of those fire → pivot to Path C (NSW boutique BA agencies, team-first).

---

## Appendix — Key File References

| Concern | File |
|---|---|
| 5-factor match engine | `packages/business-logic/src/ba/property-match-engine.ts` |
| DD state templates | `packages/business-logic/src/ba/dd-templates/{nsw,qld,vic}.ts` |
| DD engine | `packages/business-logic/src/ba/due-diligence-engine.ts` |
| Key dates (state-aware) | `packages/business-logic/src/core/key-dates-engine.ts` |
| Deal health | `packages/business-logic/src/core/deal-health-calculator.ts` |
| Daily actions (AI-narrated) | `packages/business-logic/src/core/daily-action-engine.ts` |
| Research consolidation | `packages/business-logic/src/core/research-consolidation-engine.ts` |
| AML engine | `packages/business-logic/src/core/aml-engine.ts` |
| Portal feedback loop | `packages/business-logic/src/core/portal-engine.ts` |
| Team/agency | `packages/business-logic/src/core/team-engine.ts` |
| AML schema | `supabase/migrations/00011_aml_kyc.sql` |
| Team features | `supabase/migrations/00022_team_agency_features.sql` |
| AI workflow templates | `packages/business-logic/src/workflow-templates/ai-powered-workflows.ts` |
| Client brief schema (60+ fields) | `packages/shared/src/types/client-brief.ts` |
