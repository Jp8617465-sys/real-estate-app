# Market teardown synthesis: what to build for today (issue #85)

Analysis for James to decide on. Not legal advice. Built from three public-source research passes (2026-11-18/19): incumbents and data access (`market-teardown-2026-11-18.md`), the AI-agent era (`market-ai-era-2026-11-19.md`), legislation (`market-legislation-2026-11-19.md`).

**Evidence limit that applies to everything below:** vendor and government pages could not be fetched (proxy DNS), so every claim rests on search excerpts. Nothing here was verified against statute, Rules text, vendor terms or a live product. Section 5 lists what to verify before relying on any of it.

Scope rule held throughout: understand the market, do not replicate it. No scraping, no private endpoints, no vendor contact. The `morluto/rea` reverse-engineering toolkit was reviewed (README and disclaimer only) and not used.

## 1. What the market looks like

- Sales-side platforms (Agentbox/Reapit Sales, VaultRE, Rex) are built around the listing and portal feed. None showed a buyers-agent engagement model.
- A small buyers-agent category exists (BA ICON, AgentHub 360, BuyersagentsOS, Open BA, HTAG Copilot, Dimek DealBrief), all known from vendor material. None evidenced quote-level provenance tied to shortlisting (absence of evidence only).
- AI is shipped at the consumer portals (REA: ChatGPT app, conversational search, AI assistant, realAssist). Agent-workflow AI at the CRMs is mostly beta or announced (Rex AI Assist open beta; Reapit AI rolling out).
- Agent-native interfaces (MCP) exist at data vendors (Cotality, HTAG, Microburbs; ATTOM and HouseCanary in the US). No Australian portal offers one. Portals offer controlled ChatGPT apps that send users back to the portal.
- Evidence that buyers have moved from portals to assistants is thin (Rightmove: under 0.5% of traffic from AI platforms; no Australian property survey found).
- Data is licensed and gated: Domain self-serve; Pricefinder not for commercialisation; Cotality, PropTrack, REA by contract.

## 2. What the AI-agent era changes

Commoditising: transcription, meeting summaries, plain-language CRM updates, drafting, listing copy (bundled in Zoom/Teams and vendor CRMs).

Scarce: licensed data, verified identity and AML evidence, an audit trail from source quote to decision, and a named human who signed off.

Implication: do not compete on transcription or summarisation. Compete on what the human can trust and prove.

## 3. What the law forces (or will)

| Item | Status | What it means for the workspace |
|---|---|---|
| AML/CTF tranche 2 | In force 1 Jul 2026; buyers agents in scope (AUSTRAC excerpt) | Customers are reporting entities; CDD before the service; 7-year record retention; reliance arrangements need written records |
| Privacy small-business exemption | Does not cover AML/CTF handling | Even tiny agencies owe privacy duties for ID and CDD records; retention then destruction schedule (APP 11) |
| Automated-decision transparency (APP 1.7-1.9) | Commences 10 Dec 2026; OAIC guidance 30 Sep 2026 | If an AI output feeds a client decision (risk rating, suitability, shortlist) the agency's privacy policy likely needs a disclosure. Human-in-the-loop does not take it out of scope (reported OAIC position) |
| Recording and AI transcription of calls | State/territory law; sources conflict on detail | Consent must cover recording, transcription and any onward communication. Default to all-party consent, log it |
| Statutory privacy tort | In force 10 Jun 2025 | Leaked transcripts or covert recordings are plausible claims |
| Privacy tranche 2 | Exposure draft only (31 Aug 2026); no dates | Controller/processor model and 72-hour breach notice proposed. Track, do not design to it |
| AI regulation | No mandatory regime; voluntary Guidance for AI Adoption (Oct 2025) | Existing law applies. Human control and audit trail are the sensible pattern |
| State buyers-agent rules | Uneven; record retention periods not found | Make engagement/fee records configurable by state |
| Dashdot collapse (28 May 2026) | Calls for reform, no government action found | Fees and prepayments are the live risk. Record fee type, amount, prepaid, delivered, rebates |
| Data licensing | ACCC undertaking on REA (Sep 2026); CoStar/Domain restructuring | Data access will stay contract-based and may shift. Keep the data layer swappable |

## 4. Candidate moat and product direction (for decision)

Best-supported moat candidate, low-to-medium confidence: **provenance and audit-trail data that compounds**, linked to the engagement record, plus an AML evidence trail. AML identity checks alone are table stakes.

What we already have that fits: verbatim-quote provenance on every suggested value, human review before anything is applied, change log per value, swappable property-data ports, onshore storage (ADR 0004).

Candidate additions this research points at (none started; each needs your go-ahead as a ticket):
1. **Call consent record**: capture, timestamp and attach consent to each call/intake, with a no-record mode.
2. **Decision-use tag on AI outputs**: mark whether each AI output feeds a client decision so an agency can generate its automated-decision disclosure.
3. **Retention schedule by record class**: 7 years after relationship end for AML/CDD records, then destroy or de-identify.
4. **Fee and prepayment ledger on the engagement**: fee type, amounts, prepaid, delivered, third-party benefits, configurable by state.
5. **Agent-facing interface (MCP)**: expose the workspace's own data to the agent's assistant, with the same tenancy and audit rules. Candidate only; cheap to build on the existing OpenAPI, but it widens egress and needs a decision.
6. **Bring-your-own-licence data ports**: keep ports provider-neutral so the agent's own Pricefinder or Domain credentials can be used where terms allow.

To check against current design: the Claude extraction adapter sends transcripts to an AI provider. Confirm where that processing happens against ADR 0004 (Australia-only) and APP 8 before any real client data is used. The trial uses synthetic data only.

## 5. Verify before relying on this

- Allow-list `www.austrac.gov.au`, `www.oaic.gov.au`, `www.legislation.gov.au`, `consultations.ag.gov.au` (and Cotality/vendor hosts) so primary pages can be read. This is an environment change and your call.
- Get REA partner terms, Domain API Terms of Service (storage clause), Pricefinder conditions of use, Cotality Parts M and N.
- Lawyer list: vendor's own AML/privacy status; CDD timing and e-verification for real estate; automated-decision scope; call-recording consent by state and interstate; per-state buyers-agent licensing, fee/rebate disclosure, trust money and record retention; Spam Act / Do Not Call for outreach; licence terms for any data feed.
- Provider selection and spend remain yours. No provider is recommended.
