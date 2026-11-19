# Market teardown: legislation and regulation roadmap (issue #85)

Condensed from a public-source research pass, 2026-11-19. **Not legal advice; everything is for a lawyer to confirm.** Primary sites (AUSTRAC, OAIC) could not be fetched (proxy DNS). **Every claim rests on a search excerpt; no statute or Rules text was read.** Tiers: T1 regulator/legislation page, T2 law firm/professional body, T3 vendor/trade press/blog.

## Summary table

| Item | Status | Date | Confidence |
|---|---|---|---|
| AML/CTF tranche 2 (real estate, including buyers agents) | In force | 1 Jul 2026; enrolment opened 31 Mar 2026; enrol by 29 Jul 2026 | High in force; medium-high dates |
| AML/CTF Rules 2025 (F2025L01026) and technical amendments | In force | amendments registered 24 Mar 2026 | High |
| Small-business privacy exemption does not cover AML/CTF handling | In force | 1 Jul 2026 | Medium-high |
| Statutory privacy tort | In force | 10 Jun 2025 | Medium-high |
| Automated-decision transparency (APP 1.7-1.9) | Passed, not commenced | 10 Dec 2026; OAIC final guidance 30 Sep 2026 | High |
| Children's Online Privacy Code | Draft; register by 10 Dec 2026; start not set | | Medium-high (low relevance) |
| Privacy tranche 2 (fair and reasonable test, controller/processor, 72-hour breach notice) | Exposure draft only | draft 31 Aug 2026; no commencement | High that it is a draft |
| Notifiable data breaches (current) | In force | | Medium-high |
| Call recording / surveillance consent | In force, state law; sources conflict | NSW public-interest amendment assented 7 Apr 2026 (not relevant to private calls) | Medium-low on state differences |
| Mandatory AI guardrails | Dropped; National AI Plan, existing laws apply | 2 Dec 2025 | Medium-high |
| Guidance for AI Adoption | Voluntary | 21 Oct 2025 | High |
| State buyers-agent licensing | In force, varies; record-retention periods not found | | Medium (NSW, Vic), low (Qld, WA), ACT/SA/Tas/NT not found |
| Buyers-agent reform | Calls only (Dashdot collapse, 28 May 2026); no government action found | | Low |
| Consumer Data Right for property | None found | | Medium |
| Spam Act, Do Not Call | In force; no change found | | Medium |
| ACCC undertaking, REA | Accepted | 11 Sep 2026 to 2029 | Medium on fact, low on terms |
| CoStar / Domain | Completed; divestments pending | 27 Aug 2025; divestments by end 2026 | Medium-low |

## Points that shape the product

- **AML/CTF.** AUSTRAC guidance (excerpt) says the brokering service generally includes buyer's agents. The licence holder or entity providing the service enrols, not individual agents. Needs a program, compliance officer, identification and verification before the service, ongoing CDD, suspicious matter reporting. CDD records kept 7 years from end of relationship. Reliance on another reporting entity needs a written agreement allocating record-keeping. The compliance-officer notification deadline and the CDD start trigger conflict across sources; check AUSTRAC. The workspace is infrastructure for customers who are reporting entities; whether the software vendor itself has any obligation is a lawyer question.
- **Privacy.** ID documents and CDD records make even a small agency an APP entity for that information. Retention then destruction under APP 11. Automated-decision transparency from 10 Dec 2026: privacy policies must disclose a computer program substantially and directly related to a decision that could significantly affect rights or interests. Reported OAIC positions: human-in-the-loop does not exclude; generative-AI outputs in significant decisions generally captured unless extensive human oversight. Pure note-taking is likelier outside scope. A single source reports penalties up to $66,000 (low-medium).
- **Recording and AI transcription.** NSW and WA reported all-party consent; Vic/NT participant exception with a publication restriction; Qld under the Invasion of Privacy Act 1971; federal interception law for telecommunications. Interstate calls: sources conflict on which state's law governs. HSF Kramer (Oct 2026): consent should cover recording, transcription and onward communication; no separate regime for AI note-takers. Transcripts are personal information and may be sensitive. OAIC guidance on commercially available AI products recommends caution entering personal information into public generative-AI tools. Offshore AI provider: APP 8 applies.
- **AI regulation.** No mandatory regime; binding duties come from the Privacy Act, consumer law and sector duties. Human review and an audit trail are the sensible pattern; the six voluntary practices give vocabulary.
- **State rules.** NSW: licence or certificate of registration under a licensee; conflict-of-interest declaration; fees not set by law; new laws reported from 29 Jun 2026 (contents unread). Vic: falls under the estate agent licence; must keep the purchaser informed. Qld, WA unclear. The Dashdot collapse (695 customers owed about $10.59m in prepaid fees per the liquidator's report) puts fees and prepayments in focus.
- **Outreach.** Spam Act consent, identification and unsubscribe; Do Not Call and telemarketing standard. Contact details copied from portals are a risk.
- **Data licensing.** Scraping is prohibited by portal terms (vendor claims); REA v Domain scraping suit (Dec 2024) outcome unconfirmed. Keep the data layer swappable.

## Consolidated lawyer list

1. Software vendor's own AML/CTF or privacy-processor status.
2. CDD timing, e-verification and reliance for real estate (Part 6).
3. Automated-decision scope for AI extraction feeding risk ratings, suitability or shortlists.
4. Call-recording and AI-transcription consent by state, including interstate calls and the Vic/Qld publication restriction.
5. Small-business exemption and the statutory tort.
6. Per-state licensing, agency-agreement content, fee/rebate disclosure, trust money and record retention.
7. Spam Act and Do Not Call for outbound outreach.
8. Licence terms for any portal data feed and scraping exposure.

## Gaps

Allow `www.austrac.gov.au`, `www.oaic.gov.au`, `www.legislation.gov.au`, `consultations.ag.gov.au` to confirm: AUSTRAC transitional rules, Part 6 text, OAIC ADM guidance and reporting-entity guide, exposure-draft text on the 30-day assessment window. Not found: state record-retention periods, Qld and WA licence categories, ACT/SA/Tas/NT, contents of NSW 29 Jun 2026 changes.

## Key sources (as returned by the research pass)

[AUSTRAC new AML/CTF Rules](https://austrac.gov.au/about-us/amlctf-reform/new-amlctf-rules); [AUSTRAC transitional rules update](https://www.austrac.gov.au/reforms/amlctf-transitional-rules-update); [AUSTRAC real estate services reform](https://www.austrac.gov.au/amlctf-reform/reforms-guidance/before-you-start/new-industries-and-services-be-regulated-reform/real-estate-services-reform); [AUSTRAC record keeping checklist](https://www.austrac.gov.au/industry-and-business/obligations-and-guidance/your-amlctf-program/develop-your-amlctf-programs/record-keeping/record-keeping-checklist); [AML/CTF Rules 2025](https://www.legislation.gov.au/F2025L01026/latest/text); [OAIC guidance for reporting entities](https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/organisations/privacy-guidance-for-reporting-entities-under-the-anti-money-laundering-and-counter-terrorism-financing-act); [OAIC ADM transparency resources](https://www.oaic.gov.au/news/media-centre/new-resources-on-transparency-for-use-of-ai-and-automated-decision-making); [OAIC commercially available AI products](https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/guidance-on-privacy-and-the-use-of-commercially-available-ai-products); [AGD exposure draft Bill 2026](https://consultations.ag.gov.au/rights-and-protections/privacy-reform/user_uploads/exposure-draft-bill-2026.pdf); [DISR Guidance for AI Adoption](https://www.industry.gov.au/publications/guidance-ai-adoption); [NSW Fair Trading: using an agent to buy property](https://www.fairtrading.nsw.gov.au/housing-and-property/buying-and-selling-property/buying-a-property/using-an-agent-to-buy-property); [Consumer Affairs Victoria: estate agent licence](https://www.consumer.vic.gov.au/licensing-and-registration/estate-agents/licensing/apply-for-a-licence/individual); [Allens: ADM guidance takeaways](https://www.allens.com.au/insights-news/insights/2026/10/mandatory-automated-decision-making-disclosure-requirements-are-coming-key-takeaways-from-the-oaic-guidance/); [Holding Redlich: KYC reliance for real estate](https://www.holdingredlich.com/updated-aml-ctf-rules-bring-fresh-approach-to-kyc-reliance-on-third-parties-for-real-estate-professionals); [HSF Kramer: AI notetaker tools](https://www.hsfkramer.com/insights/2026-10/ai-notetaker-tools-in-australian-workforces-the-hidden-legal-risks-organisations-cannot-ignore); [Hamilton Locke: recording private conversations](https://hamiltonlocke.com.au/recording-private-conversations-the-law-in-australia/); [Clayton Utz: draft PDP Bill 2026](https://www.claytonutz.com/insights/2026/september/the-next-wave-of-australian-privacy-reform-key-proposals-in-the-draft-personal-data-protection-bill-2026); [Real Estate Business: Dashdot collapse](https://www.realestatebusiness.com.au/buyers-agent1/32046-dashdot-inside-the-collapse-that-sparked-calls-for-buyer-s-agent-reform); [Digital Policy Alert: ACCC accepts REA undertaking](https://digitalpolicyalert.org/event/43638-australian-competition-and-consumer-commission-accepts-undertaking-from-rea-group-to-remove-mandatory-listing-requirements); [CoStar completes Domain acquisition](https://www.businesswire.com/news/home/20250827738439/en/CoStar-Group-Completes-Acquisition-of-Domain-Ushering-in-a-New-Era-of-Innovation-for-Australias-Property-Market).
