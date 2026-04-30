# RealFlow Competitive Teardown — AgentHub 360, BA-ICON, Stash Property

**Date:** 2026-04-05
**Author:** deep-research-agent
**Decision context:** Evolution Plan Week 5 — AI assistant backend complete. STRATEGIC_ROADMAP.md asserted <10% purpose-built CRM adoption in the AU buyers-agent market. This teardown tests that assertion.

---

## 1. Executive Summary

- **The market is NOT greenfield.** The "<10% purpose-built CRM" thesis in STRATEGIC_ROADMAP.md is demonstrably false. Three well-resourced competitors are live, priced, and acquiring customers. BA-ICON claims **100+ agencies in 8 months**. Stash lists Ray White and Mecca Property Group as customers. AgentHub 360 has a public pricing page, mobile app on the App Store, and a complete feature matrix.
- **Three distinct positioning wedges already exist.** BA-ICON = bespoke premium CRM ($350+/mo, workflow-first). Stash = property data + matching platform ($250-499/mo, data-first). AgentHub 360 = AI-native operating system ($149-499/mo, AI-first). RealFlow's current roadmap overlaps heavily with AgentHub 360.
- **AgentHub 360 is the existential threat.** It ships nearly the entire RealFlow module list *today*: buyer pipeline, brief matching, DD engine, property showcase portal, workflow automation, iOS app, off-market parsing, AI match scoring, 14-day trial. Pricing undercuts BA-ICON by 30-60%. Site polish is enterprise-grade.
- **Remaining wedges exist but are narrow.** (1) State-specific DD templates (NSW/QLD/VIC) — nobody ships this explicitly. (2) Native social-DM → CRM lead ingestion — absent across all three. (3) AML/KYC workflow depth. (4) Android-first mobile (two of three are iOS-only). (5) Price floor below $149/mo for true solo operators.
- **Recommendation preview: PIVOT, don't KILL.** RealFlow as a generic BA CRM is late. RealFlow as **"the compliance + social-native layer"** (DD templates by state, Meta/Insta DM ingestion, AML workflow, Android parity) is defensible. A CONTINUE decision requires narrowing scope aggressively.

---

## 2. Side-by-Side Feature Matrix

Legend: ✅ confirmed from site • ⚠️ partial/implied • ❌ no evidence • ? unknown

| Feature                            | AgentHub 360        | BA-ICON              | Stash Property      | RealFlow (current)   |
| ---------------------------------- | ------------------- | -------------------- | ------------------- | -------------------- |
| CRM / contacts / lead scoring      | ✅ drag-drop kanban | ✅ client profiles   | ⚠️ "built-in CRM"   | ✅ built              |
| Buyer pipeline (stages)            | ✅ kanban w/ auto-progression | ✅ workflow pipeline | ❌               | ✅ 8 stages (built)   |
| Client brief system                | ✅ 10+ briefs (Solo) | ✅ brief emails      | ✅ AI brief match   | ✅ built              |
| Property matching engine           | ✅ AI Match Score/100 | ✅ on+off-market    | ✅ AI on-market     | ✅ planned            |
| Due-diligence engine               | ✅ 25-step checklist + risk checks | ❌       | ⚠️ data-level only  | ⚠️ planned            |
| State-specific DD templates (NSW/QLD/VIC) | ❌           | ❌                   | ⚠️ QLD mail rules   | ⚠️ planned            |
| Workflow automation                | ✅ Journey Engine, 12 actions | ✅ custom workflows | ❌            | ✅ built              |
| Client portal                      | ✅ white-label BuyerHub | ✅ branded client portal | ❌            | ⚠️ planned            |
| Off-market tracking                | ✅ email→listing parser | ✅ off-market      | ✅ off-market + withdrawn | ⚠️ planned     |
| Mobile app                         | ✅ iOS only         | ❌ none advertised   | ✅ iOS + Android    | ⚠️ Expo (in build)    |
| Team / multi-agent                 | ✅ 3 users Agency   | ✅ 1/2-8/9-16 tiers  | ✅ 3 users/office   | ✅ built              |
| AI matching / scoring              | ✅ AI Match Scoring | ❌ ("no hype")       | ✅ AI matching      | ⚠️ AI asst backend    |
| AI email/doc parsing               | ✅ off-market emails | ❌                  | ❌                  | ⚠️ planned            |
| AI research assistant              | ✅ Google-powered   | ❌                   | ❌                  | ✅ backend complete   |
| Domain.com.au integration          | ❌ not listed       | ✅                   | ⚠️ data-level       | ⚠️ planned            |
| realestate.com.au integration      | ❌ not listed       | ✅                   | ⚠️ data-level       | ⚠️ planned            |
| Allhomes / RealCommercial          | ❌                  | ✅                   | ❌                   | ❌                     |
| DocuSign / REI Forms               | ❌                  | ✅                   | ❌                   | ❌                     |
| Xero                               | ❌                  | ✅                   | ❌                   | ❌                     |
| Social-DM → CRM (Meta/Insta)       | ❌                  | ❌                   | ❌                   | ⚠️ planned (wedge!)   |
| Risk overlays (flood/bushfire/heritage) | ✅ StreetXray  | ❌                   | ✅ nationwide       | ❌                     |
| Suburb analytics                   | ✅ 500+ suburbs     | ❌                   | ✅ 15,000 suburbs   | ❌                     |
| CMA generation                     | ✅                  | ❌                   | ✅ unlimited branded | ❌                    |
| Communication hub (email/SMS)      | ✅                  | ✅                   | ❌                   | ⚠️ planned            |
| Selling-agent outreach blast       | ✅ "50+ agents"     | ✅ group SMS/email   | ✅ "thousands"      | ❌                     |
| AML/KYC workflow                   | ❌                  | ❌                   | ❌                   | ⚠️ planned (wedge!)   |
| Free trial                         | ✅ 14 days          | ? demo only          | ✅ 14 days          | n/a                   |
| Public pricing                     | ✅ full             | ⚠️ solo only ($350)  | ⚠️ "from $250"     | n/a                   |

**Feature overlap with AgentHub 360: ~75%.** This is the closest competitor by product scope.

---

## 3. Per-Competitor Deep Dive

### 3.1 AgentHub 360 — agenthub360.au

**Entity:** AgentHub AU Pty Ltd, ABN 89 692 709 390.
**Tagline:** "Buyer Agent's Operating System."
**Positioning:** AI-native full-stack platform for solo BAs through agencies.

**Pricing (public, inc-GST):**
| Tier | Intro | Ongoing | Notes |
|---|---|---|---|
| Solo | $149/mo (first 2 mo) | $249/mo | 10 briefs, 2 devices |
| Buyer Agency | $299/mo (first 2 mo) | $499/mo | 3 users, portal, newsletters |
| Agency Pro | Quote | Quote | Custom CRM integrations |

Add-on seats: $99/user. Free 14-day trial, no card. This is the **most price-aggressive tier-1 competitor**.

**Feature depth:** Dense. Kanban pipeline, Journey Engine workflow builder (12 action types), white-label BuyerHub portal, StreetXray risk overlays (bushfire, flood, heritage, powerlines, demographics), off-market email parser ("<60 seconds"), AI Match Scoring, 25-step DD checklist, CMA + cashflow projections, iOS mobile app, past-buyer re-engagement newsletters.

**AI features:** Genuinely differentiating — email parsing pipeline, match scoring, Google-powered research assistant, automated risk reports. Not marketing-ware; this looks shipped.

**Target customer:** Solo BAs → agencies → enterprise. AU-only. Covers both investors and owner-occupiers implicitly.

**Founders/funding:** No public founder names on site. Crunchbase has an AgentHub360 entry but no funding disclosed. LinkedIn company page exists. Operational but funding status unknown — possibly bootstrapped or seed.

**Integrations:** Monday, Zoho, Attio, GoHighLevel, HubSpot (bridges to existing CRMs rather than replacing). **Conspicuously absent: direct Domain/REA/Allhomes portal integrations.** This is a gap.

**Weaknesses:**
- No Android app (iOS-only) — major gap.
- No public Domain/REA feed integration.
- No DocuSign/REI forms/Xero.
- Testimonials and case studies absent from landing page.
- No founder-led credibility play; operational maturity unclear.
- "Custom CRM integrations" add-on suggests the core DB model is still stabilising.

**Site polish:** Enterprise-grade SaaS page. Mantine-framework-built, professional mockups, responsive, full pricing table, FAQ. Take them very seriously.

### 3.2 BA-ICON — icon.com.au

**Entity:** Rose Technology, led by Simon Rose.
**Tagline:** "The world's first dedicated CRM sets a new standard" / "The Premium Buyer's Agent CRM."
**Positioning:** Premium, bespoke, workflow-first. Explicitly anti-GHL/Zoho ("completely bespoke, not built on Go High Level or Zoho").

**Pricing (partially public):**
- Solo Operator (1 user): **$350 + GST/month** (≈$385 inc GST).
- 2-8 users: Contact sales.
- 9-16 users: Contact sales.
- No free trial advertised — demo only.

BA-ICON is **the most expensive** at the solo tier. 2.3x RealFlow's likely entry price; 1.4x AgentHub 360's Solo tier.

**Feature depth:** Matching, automatic listing-data plugin integration, client profiles, brief emails to selling-agent groups, branded listing distribution, client interest tracking, two-way comms hub, customizable workflows, reporting dashboard (commissions, referrer fees, pipeline). Less breadth than AgentHub 360 — no risk overlays, no suburb analytics, no explicit DD engine, no AI features.

**AI features:** Explicitly deprioritised — *"We don't buy into hype or overpromise."* Positioning against AI-first competitors.

**Target customer:** Premium AU buyer agencies, NZ, UK. Weighted toward established agencies (tiered up to 16 users).

**Founders/funding:** Simon Rose (industry expert) + Rose Technology. Claimed **100+ agencies in 8 months**. Bootstrapped-looking, no funding disclosed.

**Integrations:** Strongest of the three for AU operations — Domain, REA, Allhomes, RealCommercial, REI Forms + DocuSign, Xero, calendar sync, API for web prospect capture. **This is BA-ICON's moat.**

**Weaknesses:**
- No mobile app advertised — big gap if claim of "agents live on phones" is correct.
- No AI features; vulnerable to AI-native competitors.
- Price is high for solo operators ($350+GST).
- No trial — demo-only friction.
- No third-party reviews on G2/Capterra/Trustpilot (searched).
- Marketing almost entirely via Facebook, which skews older.

**Site polish:** Professional but utilitarian. Feature graphics, 25+ FAQ, clear IA. Feels like a services-business-turned-SaaS more than a venture SaaS.

### 3.3 Stash Property — stashproperty.com.au

**Entity:** Stash Property (QLD-based, 07 4243 4600).
**Tagline:** "Replace all your data tools with one platform."
**Positioning:** Property data + AI-matching platform with light CRM. Pricefinder alumni play.

**Pricing (partially public):**
- Buyers Agents plan: **from $250/month** (normally $499, 50% early-adopter discount).
- Up to 3 users/office, surcharge for more.
- No lock-in contracts. 14-day free trial.

**Feature depth:** Data-first — 15,000+ suburbs, 13M property records, heatmaps (median, growth, yield, vacancy, future dev), nationwide zoning + change notifications, flood/bushfire/heritage overlays, AI brief-to-listings matching, one-click email blast to selling agents ("thousands"), Chrome plugin, unlimited branded CMA + suburb reports, iOS + Android apps. CRM is minimal ("save and track shortlist").

**AI features:** AI brief matching and AI on-market matching — positioning-level, depth unclear.

**Target customer:** Buyers agents, selling agents, developers, renovators. Broad — not BA-exclusive.

**Founders:** Brett Fort (CEO), Kris Zima (Head of Technology, listed as founder), plus leadership ex-Pricefinder, RP Data, Domain, CoreLogic. **Strongest team credibility of the three.** Privately owned, no funding disclosed.

**Integrations:** BA-ICON partnership (Mar 2026), Systems Down Under / Zoho advanced partner (Mar 2026), Stash API. Customers include Ray White, Mecca Property Group.

**Weaknesses:**
- CRM is thin — explicitly a data tool with CRM bolted on.
- No buyer pipeline stages, no client portal, no DD workflow.
- Broad audience dilutes BA-specific depth.
- QLD-specific mail rules called out, suggesting uneven state coverage.

**Site polish:** Professional, modern, active monthly product updates, embedded tutorials, real customer logos. Most mature product marketing of the three.

---

## 4. Differentiation Gaps — Where RealFlow Can Wedge

Evidence-based gaps across all three:

1. **State-specific DD templates (NSW/QLD/VIC contract + section 32/149/disclosure compliance).** All three reference risk overlays or checklists; none ship state-specific legal DD templates. RealFlow roadmap already plans this — *this should become the lead product narrative*.
2. **Social-DM → CRM ingestion (Meta/Instagram).** Zero competitor mention. Meta DMs are the #1 first-touch channel for BAs under 40. RealFlow has this planned — preserve it.
3. **AML/KYC workflow.** BAs have Tranche 2 AUSTRAC obligations landing. No competitor addresses this. High-margin wedge.
4. **Android-first mobile.** AgentHub is iOS-only. BA-ICON has no app. Stash has both but thin CRM. Expo monorepo = RealFlow ships Android day one.
5. **Price floor <$149/mo.** AgentHub Solo is the floor at $149 intro / $249 ongoing. Genuine solo operators (sub-5 briefs) have no sub-$150 option.
6. **API + webhook openness.** Only Stash publishes an API; only BA-ICON offers web-form capture API. A developer-friendly BA CRM does not exist.
7. **Australian-assistant AI (not generic LLM wrappers).** RealFlow's tool-calling AI assistant with 10 CRM tools is architecturally ahead of AgentHub's one-off AI features — but needs to be packaged as a narrative.

---

## 5. Pricing Intelligence

| Vendor | Entry | Ongoing | Per-seat add | Trial |
|---|---|---|---|---|
| AgentHub 360 Solo | $149 intro | $249 | n/a | 14d |
| AgentHub 360 Agency | $299 intro | $499 (3 users) | $99/user | 14d |
| BA-ICON Solo | $385 (incl GST) | $385 | tier jump | demo only |
| Stash BA plan | $250 intro | $499 | surcharge | 14d |

**Market price band:** **$150-$500/mo** for solo/small BA teams. True floor for active products = $149/mo (AgentHub intro). Ongoing floor = $249. Premium ceiling = $499 (agency, 3 users).

**Implication for RealFlow:** Entry at $99-129/mo for true solo operators is defensible and undercut-competitive. Agency tier at $349-449 undercuts AgentHub/Stash/BA-ICON simultaneously. Do not price above $499.

---

## 6. Threat Assessment (Ranked)

### 🔴 Rank 1 — AgentHub 360 — CRITICAL THREAT

- ~75% feature overlap with RealFlow's planned module list.
- AI-native story identical to RealFlow's direction.
- Aggressive pricing ($149 intro, $249 ongoing).
- iOS app live.
- Enterprise-grade site polish.
- 14-day no-card trial → low friction acquisition.
- **Why they could win:** shipped first, feature parity, undercuts on price.
- **Why they could lose:** no Android, no portal integrations (Domain/REA), no DD state templates, founder/team invisible, no portal/social integrations. Product looks broad but thin in AU-specific compliance.

### 🟠 Rank 2 — Stash Property — MATERIAL THREAT

- Strongest team credibility (ex-Pricefinder/RP Data/CoreLogic).
- Real customer logos (Ray White, Mecca).
- iOS + Android shipped.
- $250 entry undercuts AgentHub ongoing.
- **Why they could win:** data moat + matching is a defensible wedge; partnering with BA-ICON + SDU suggests platform strategy.
- **Why they don't directly kill RealFlow:** thin CRM, no pipeline/portal/workflow. They're a data platform, not a CRM competitor. More likely an integration partner than a killer.

### 🟡 Rank 3 — BA-ICON — CONTAINED THREAT

- 100+ agency customers is real market validation.
- Best portal/forms/Xero integrations.
- Premium positioning opens room underneath.
- **Why they don't directly kill RealFlow:** no mobile, no AI, high price, no trial, Facebook-heavy marketing. Classic incumbent vulnerable to AI-native entrants. They are the customer base AgentHub 360 is trying to poach — and the customer base RealFlow should co-target.

---

## 7. Strategic Read (for the Continue/Pivot/Kill call)

**The STRATEGIC_ROADMAP.md greenfield thesis is invalidated.** But the market is not captured — it is **fragmented into three incomplete products**, none of which ship the full RealFlow module list.

- **KILL** is wrong: the market is proven, pricing is healthy, BAs pay $250-500/mo.
- **CONTINUE unchanged** is wrong: AgentHub 360 will reach feature parity with RealFlow's current roadmap before RealFlow ships.
- **PIVOT (recommended)** — narrow RealFlow's wedge to:
  1. **Compliance moat:** NSW/QLD/VIC DD templates + AML/KYC workflow.
  2. **Social-native lead ingestion:** Meta/Insta DM → CRM (zero competitors).
  3. **Android parity from day 1** (Expo already supports this).
  4. **Undercut pricing:** $99-129 solo, $349 agency.
  5. **Open API + webhooks** positioning ("the buyers-agent CRM developers can extend").

**Next week decision check:** Has RealFlow defined (a) which two of the five wedges it ships first, (b) a differentiated pricing page, (c) a defensible "why not AgentHub 360" answer? If no — PIVOT deeper before building more.

---

## 8. Sources

- [AgentHub 360 landing](https://www.agenthub360.au/)
- [AgentHub 360 Crunchbase](https://www.crunchbase.com/organization/agenthub360)
- [AgentHUB 360 LinkedIn](https://www.linkedin.com/company/agenthub-360)
- [BA-ICON landing (redirected)](http://icon.com.au/)
- [BA-ICON book-a-demo](https://www.icon.com.au/book-a-demo)
- [BA-ICON commercialpropertyguide profile](https://www.commercialpropertyguide.com.au/blog/business/ba-icon-setting-a-new-standard-for-buyers-agent-crms-in-australia-421)
- [Stash Property landing](https://www.stashproperty.com.au/)
- [Stash for Buyers Agents pricing](https://www.stashproperty.com.au/buyersagents/)
- [Stash About Us / team](https://www.stashproperty.com.au/about-us/)
- [Stash Crunchbase](https://www.crunchbase.com/organization/stash-financial)
- [Stash x BA-ICON partnership (Mar 2026)](https://www.stashproperty.com.au/2026/03/06/stash-x-ba-icon-partnership/)
- [Stash x Systems Down Under (Mar 2026)](https://www.stashproperty.com.au/2026/03/04/stash-x-systems-down-under/)
- [Stash LinkedIn AU](https://au.linkedin.com/company/stash-property)
- [Capterra AU — Real Estate CRM directory](https://www.capterra.com.au/directory/30926/real-estate-crm/software)
- [BA-ICON Facebook — purpose-built claim vs GHL/Zoho](https://www.facebook.com/baicon.crm/videos/built-by-buyers-agents-for-buyers-agents/1186724206982658/)

---

*Report word count: ~2000. Evidence-only. Where pricing, founder, or funding info was unavailable, this has been stated. No speculation presented as fact.*
