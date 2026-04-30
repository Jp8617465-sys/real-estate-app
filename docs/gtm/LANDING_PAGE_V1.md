# RealFlow Landing Page — v1 Copy

**Positioning (locked):** Post-Match Operating System
**Core line:** *Your matching tool finds the property. RealFlow stops the deal from falling over.*
**Target:** AU buyers agents who already use (or are sick of) their current CRM
**CTA:** Free 68-item DD checklist + waitlist

---

## Hero

### Headline (A)
# Your matching tool finds the property.
# RealFlow stops the deal from falling over.

### Subhead
The 90-day window from offer to settlement is where buyers-agent fees are made or lost. RealFlow runs that window — deal-health scoring, state-specific DD, AUSTRAC checks, key-dates, client reporting — so you don't blow a $15-25k fee on a preventable miss.

### Primary CTA
**Get the free 68-item AU DD checklist** — NSW s66W, QLD Form 1, VIC Section 32 covered.
[ email input ] [ Send me the checklist ]

### Secondary CTA
*Already running a CRM you're sick of?* → **Book a 20-min call**

---

## Headline Alternates (test in Day 5-7 calls)

**B — Fear-forward:**
# Every BA has lost a deal to a missed date.
# RealFlow makes sure it's never you.

**C — Compliance-forward:**
# AUSTRAC, s66W, Section 32, Form 1.
# One checklist. Every matter. Every state.

**D — Complement-forward:**
# Keep Stash. Keep AgentHub. Keep your spreadsheet.
# RealFlow runs what happens *after* you find the property.

**E — Founder-authority:**
# Built with NSW, QLD, VIC buyers agents — for the 90 days that actually matter.

Recommend showing A, B, C to interviewees and asking *"Which of these sounds like your Tuesday?"*

---

## Problem Block — "Where deals fall over"

### 3-column layout, icons optional

**1. The date you forgot**
Finance clause on day 14. Cooling-off end on day 5. Pre-settlement inspection 3 days out. State-specific. Different per matter. One missed date = negotiation leverage gone.

**2. The compliance you skipped**
AUSTRAC 100-point ID on new clients. Tranche 2 obligations. Pool certs. HBCF checks. When the regulator asks, "show me" is not a process.

**3. The client who lost trust**
Your client emails at 9pm: *"What's happening?"* You're in bed. You don't have a live status page to send. The trust you built in the pitch erodes in the silence.

---

## Solution Block — "What RealFlow does in that 90-day window"

### 3-column, feature-forward

**Deal Health Score**
Every matter gets a live health score: on-track, at-risk, or critical. Stage-aware. Updates when dates slip, docs miss, or clients go quiet. See the deal about to fall over *before* it does.

**State-Templated DD**
68 items across NSW / QLD / VIC. Auto-assigned to solicitor, broker, inspector, or client. State-specific (s66W, Form 1, Section 32). Per-matter, not per-template.

**AUSTRAC-Ready AML/KYC**
100-point ID workflow. Structured records. Export-ready audit trail. Peace of mind when Tranche 2 lands — and reputation insurance when a client you onboarded turns out dodgy.

**Client Portal**
Your client sees exactly where their matter is. Without emailing you. At 9pm. Again.

**Daily Action List**
AI-narrated priority queue every morning. "Call Smith — finance clause expires Thursday, broker hasn't confirmed." Not a to-do list. A triage list.

---

## How It Fits Block — "Works with what you already have"

### Comparison table

| | Matching tools (Stash, AgentHub, BA-ICON) | RealFlow |
| --- | --- | --- |
| Finds the property | ✅ | — |
| Off-market sourcing | ✅ | — |
| Brief→listing match | ✅ | — |
| **Deal-health scoring** | — | ✅ |
| **State-specific DD assignment** | Partial | ✅ |
| **AUSTRAC-ready AML** | — | ✅ |
| **Stage-aware key dates** | — | ✅ |
| **Client portal with progress** | Partial | ✅ |

*We're a complement, not a replacement. Keep your matching tool. RealFlow runs what happens after.*

---

## Social Proof Block

*Placeholder until we have BAs.* Day 5-7 outreach = proof candidates.

*"I used to lose a deal a year to a missed date. Since RealFlow, zero."* — [placeholder BA]

*"AUSTRAC compliance went from a fear to a checkbox."* — [placeholder BA]

---

## Lead Magnet Block

### The Free 68-Item AU Buyers-Agent DD Checklist

NSW (22), QLD (24), VIC (22). Every item tagged:
- 🚨 BLOCKING vs. optional
- ⚠️ CRITICAL vs. standard
- 👤 Responsible party (solicitor / broker / BA / inspector / client)
- 🏠 Property-type carve-outs (strata, land, etc.)

Includes state-specific gotchas — s66W, Form 1, Section 32, HBCF, pool certs — that trip up BAs running their first out-of-state matter.

**Drop your email → we'll send the PDF and one email a month when new checklists drop. No sales sequence.**

[ email input ] [ Send me the checklist ]

---

## FAQ Block

**Q: I already use [Rex / Agentbox / VaultRE / AgentHub]. Is this a replacement?**
A: No. RealFlow runs the 90 days *after* matching. If your CRM does matching well, keep it. We plug in.

**Q: Pricing?**
A: Public pricing coming Q2 2026. Early-access waitlist = founder pricing locked in.

**Q: Where are you based?**
A: Built for AU — NSW, QLD, VIC state-specific. Sydney-based.

**Q: I'm a REBAA member. Is this REBAA-endorsed?**
A: No (yet). We'd love to earn that.

**Q: AUSTRAC Tranche 2 — do I actually need to worry?**
A: Yes. Tranche 2 is coming. BAs are in scope. Our AML engine is designed for it.

---

## Waitlist CTA — Page Footer

**Early access opens Q2 2026. ~30 BAs on the waitlist today.**
[ email input ] [ Join the waitlist ]

---

## Page Structure Summary

1. Hero (headline + CTA)
2. Problem block (3 columns — where deals fall over)
3. Solution block (5 features for post-match OS)
4. "How it fits" block (complement-not-replacement table)
5. Social proof (placeholder → filled post-Day-7)
6. Lead magnet CTA (DD checklist)
7. FAQ
8. Waitlist CTA

## Tech Implementation (Day 4)

- Route: `apps/web/src/app/page.tsx` (replace existing or nest under `/ba`)
- Email capture → new Supabase table `waitlist_signups` (email, source, created_at, variant)
- Track headline variant in URL param `?v=A|B|C|D|E` for split-testing later
- No auth required
- Lead magnet PDF generation: defer for now, email the markdown inline

## Open Decisions for Founder

1. **Domain:** realflow.com.au? realflow.app? confirm which to point at this page.
2. **Logo/branding:** current web app branding reusable for landing?
3. **Founder name attached?** Landing page feels stronger with a founder voice: "I built this because…" — 2 sentences from you changes conversion.
4. **Do we list Stash / AgentHub by name in the comparison table?** Bold play — calls them out as collaborators, not enemies. Risk: they see the page before we do outreach.
