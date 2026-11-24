# Legislation check against primary text (issue #85)

2026-11-24. Not legal advice. Supersedes the matching statements in `market-teardown-2026-11-18.md` and `market-legislation-2026-11-19.md` where they differ.

## What was read, and what was not

- **Read in full text:** Anti-Money Laundering and Counter-Terrorism Financing Rules 2025 (F2025L01026), compilation C01 of 31 March 2026, from legislation.gov.au (about 290,000 characters of text). Sections read: 5-20, 6-32, 6-33.
- **Not read:** the AML/CTF Act 2006 itself, so the wording of the designated services (Table 5 item 1 and Table 6 item 1, section 6) is known only from how the Rules refer to them. AUSTRAC pages timed out. OAIC pages sit behind a bot-check ("Just a moment") and were not retrieved; no workaround was attempted. Every OAIC and AUSTRAC statement in the earlier files therefore remains an unverified search excerpt.

## Findings from the Rules text (high confidence on the wording; legal effect needs a lawyer)

1. **Two designated services are named for real estate.** The Rules refer to Table 5 item 1 of section 6 of the Act, "brokering the sale, purchase or transfer of real estate", and Table 6 item 1, "assisting a person in a transaction to sell, buy or otherwise transfer real estate". Which of these a buyers agent provides, and whether it depends on the kind of engagement, is a question about the Act's wording and needs a lawyer.
2. **Delayed initial CDD (s 6-32) can reach the buyer.** This corrects the first pass, which said the delay concession applied to the counterparty and was unclear for the buyer.
   - Under Table 5 item 1 (brokering): a reporting entity may commence the service to the **buyer** before completing CDD if it has already commenced the service to the **seller** (s 6-32(1)), and the reverse (s 6-32(2)). It must be provided through a permanent establishment in Australia.
   - Under Table 6 item 1 (assisting a person in a transaction to buy): a reporting entity may commence the service where the customer **is or is to be the buyer**, with no seller condition (s 6-32(3)).
   - **Specified period (s 6-32(4)):** the period ends at the earlier of 28 days after exchange of contracts, and 3 days before the initially agreed settlement day.
   - These are permissions subject to section 29 of the Act, which was not read.
3. **Reliance on an arrangement for KYC (s 6-33)** treats a reporting entity as having established the CDD matters on reasonable grounds if, among other conditions: the only services proposed are Table 5 item 1 or Table 6 item 1; the service is provided through an Australian permanent establishment; for an individual customer, reasonable steps were taken to establish the customer is who they claim; the ML/TF risk of the customer was identified from KYC information reasonably available before starting; KYC information appropriate to that risk was collected; and the entity participates in an arrangement under which another participating reporting entity in the same transaction can collect and verify KYC information. Conditions after (f) were not read in full.
4. **AML/CTF policies (s 5-20):** an entity relying on such an arrangement must have policies covering how it will verify the KYC information it collected **before settlement** where it does not obtain verification data from another reporting entity.
5. **No 7-year retention wording appeared in the Rules text** (searches for "7 years" and "seven years" returned nothing). Retention is therefore either in the Act or elsewhere; the earlier 7-year statement is unverified here.

## What this changes for the product (interpretation)

- The workspace should record, per engagement: which designated service applies, the date CDD was completed, the exchange and settlement dates, and whether the delayed-CDD window is being used, with the computed deadline (earlier of exchange + 28 days and settlement - 3 days). This is a deterministic date rule that the product can check and display; the legal choice stays with the agent and their adviser.
- If agents use reliance arrangements, store the arrangement, the counterparty reporting entity and what KYC data was obtained from whom.
- Treat "CDD complete before service starts" and "CDD delayed under s 6-32" as distinct recorded states.

## Still to verify

The Act (designated service wording, s 29, record-keeping); AUSTRAC guidance on when a buyer's agent service starts; OAIC automated-decision guidance and reporting-entity privacy guide (needs a route that is not blocked); retention periods; state rules.

Source: [AML/CTF Rules 2025, F2025L01026](https://www.legislation.gov.au/F2025L01026/latest/text).
