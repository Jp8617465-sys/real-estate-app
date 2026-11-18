# Market teardown: incumbent platforms, data connections, moats (issue #85)

Retrieved 2026-11-18 by a research agent from **public web-search excerpts only**. Every direct fetch of a vendor page failed (DNS), so **no primary source was read in full**. Treat every pricing, access, residency or redistribution claim as **unverified** unless a source is a vendor/regulator page quoted below. No vendor was contacted, no account created, no credential used, no private interface or scraper touched.

Scope rule: public sources only. REA/Domain private endpoints and scrapers (for example the Apify GraphQL actor, Scrapfly's ArgonautExchange parser) were deliberately **not** studied or used: likely terms breach, and the north-star does not assume source data is redistributable.

Tier labels: T1 vendor or regulator page, T2 trade press, T3 directory/blog/competitor.

## Answer first

1. Sales-side platforms (Agentbox/Reapit Sales, VaultRE, Rex) are built around the vendor, the listing and the portal feed. Portal links are outbound (publish listings, receive enquiries). A buyers agent mostly needs the read side: search, property data, a client record. No evidence of a buyers-agent engagement model in any of them. Rex has buyer matching and a buyer's-agent feedback flow for the listing agent (confidence medium, T1/T3).
2. A small buyers-agent category already exists: BA ICON, AgentHub 360, BuyersagentsOS (launched 14 Sep 2026). All vendor or press-release material (T3). BA ICON and BuyersagentsOS advertise AML workflows; BuyersagentsOS advertises a Cotality master licence. None describes quote-level provenance or transcript intake. This is absence of evidence from marketing text, not proof.
3. Data access is contract-gated almost everywhere. Domain is the only self-serve route found. Pricefinder's page says its API is "not available for commercialisation" (T1 excerpt). Cotality, PropTrack and REA need contracts; REA partner terms were not found.
4. Best-supported moat candidate: workflow and provenance data that compounds, plus an AML evidence trail. Confidence low to medium. AML identity verification alone is table stakes.

## 1. Feature and workflow matrix (vendor claims, confidence medium to low)

| Platform | Sales-agency use | Buyers-agent use |
|---|---|---|
| Agentbox (now Reapit Sales) | Portal listing push, lead capture, CRM. Reapit Verify does AML identity checks in-platform | Nothing buyer-specific found |
| VaultRE | CRM, listings, marketing, tasks. AML via APLYiD and Tic Company integrations | Nothing buyer-specific found |
| Rex | Listings, portal uploads, buyer matching, inspections, AI buyer filtering | Buyer's agent can record feedback on a listing; not a buyers-agent workspace |
| Reapit/Console | Property management (now Reapit PM) | None |
| BA ICON | n/a | Built for buyers agents; AML flow with compliance-officer role, ID capture, risk score, pending/verified |
| AgentHub 360 | n/a | Buyer briefs, lead forms, automations, Xero invoicing, buyer portal. No AML evidence found |
| BuyersagentsOS | n/a | CRM, compliance module, eSign, marketing, property intelligence; claims 18 products in one subscription |

Not evidenced for buyers agents: an engagement/brief record built around the buyer, a fee/retainer workflow, discovery-call transcript intake, quote-level provenance or per-value history (low confidence).

## 2. Connections and access terms

- **REA / realestate.com.au** (low, T3): Partner Portal plus REAXML push feed (FTP or API partner). No REA-published terms, caching limits or costs found.
- **Domain** (medium, T1 excerpts, some from older doc versions): self-serve sign-up grants Agents & Listings and Properties & Locations. Listings Management needs the agency principal's approval. Display policy: no modifying listing data, attribute to Domain, "Powered by Domain" logo, keep listing pages out of search indexes. Storage/caching clause sits in the Domain APIs Terms of Service, not retrieved. CoStar completed its Domain acquisition 27 Aug 2025; Pricefinder sits in the group.
- **Agentbox/Reapit** (low to medium): Integrator Application with per-agency API key issued by support (T3, unverified). Reapit developer terms dated 1 Dec 2025 are UK-oriented. AU pricing page lists custom API access as an Enterprise feature.
- **VaultRE** (medium to low): public developer docs, keys after integrator-registration review (T3). Pricefinder integration is per user and needs the user's own Pricefinder account.
- **Rex** (medium, T1 excerpts): public API docs; Custom Integrations add-on from Starter up. API terms (last updated 12 Jan 2019) grant a limited, non-transferable licence and bar giving API access to anyone but the contracting entity. Data-use and storage clauses not visible. RP Data/Pricefinder integration is an add-on.
- **Pricefinder** (T1 excerpt): API "not available for commercialisation"; end user usually must be a member; requests use the end user's own credentials. Onshore-only clause claimed only by 13Labs (T3), unverified.
- **Cotality** (T1 excerpts): AU licence has an API part (Part M) and a republishing part (Part N), fair-use limits, flow-down terms from government data suppliers, display guidelines. Contract-only, no public pricing.
- **PropTrack** (REA): docs and trial advertised; access via account manager (T3).
- **Published costs**: none found from a primary source. Unverified third-party figures: BA ICON A$99-299/month, AgentHub 360 A$249/month, Rex $109-199 (one from a competitor).

## 3. Compliance baseline

- AUSTRAC (T1 excerpts): a buyer's agent provides a designated service from when an agreement to find or identify a property is signed; initial CDD on the buyer must be done before the service starts. The delay concession applies to the counterparty, not clearly the buyer. Reliance covers KYC verified by another reporting entity, not outsourced KYC providers; the reliant entity stays responsible. Final-Rules text on real-estate reliance and timing is unconfirmed (only exposure drafts seen). Check the registered instrument and get legal advice.
- Platform identity verification: Reapit Verify claims DVS registration and 200,000+ checks a year (self-reported) but the agency keeps its own AML/CTF program. VaultRE and Rex rely on third-party providers. BA ICON claims built-in verification, risk scoring, retention (T3).
- Residency: BA ICON AU-hosting claim is conflicting across searches, treat as unverified. No residency statements found for Reapit, Rex, VaultRE. OAIC APP 8 does not require onshore storage (T1); the project's Australia-only rule (ADR 0004) is stricter than law and must be checked against each provider's terms.

## 4. Candidate moats, ranked

1. **Provenance data that compounds** (low to medium). Evidence: AUSTRAC requires records and evidence trails; no competitor evidenced quote-level history (absence only); switching cost grows with reviewed records. Disproved if a competitor ships comparable provenance or agents do not value the audit trail. Already built; ongoing cost is usage data and review UX. Tension with the export wedge below.
2. **Trusted-record network with brokers and conveyancers** (high ceiling, low feasibility). Reliance between reporting entities is allowed. Disproved if the final Rules block reuse or counterparties will not adopt. High cost: cold start, legal review.
3. **Provider-neutral ports, bring-your-own-licence** (low to medium). Pricefinder uses the user's own credentials and bars commercialisation; Cotality and Domain restrict redistribution and storage; BuyersagentsOS is tied to one data partner. Disproved if terms bar third-party workspaces from using the agent's credentials. Hygiene more than moat: integrations are copyable.
4. **Australian-resident AI processing** (weak, time-limited). Copyable by anyone hosting onshore.
5. **Portability and export** (adoption wedge, not a moat). Limited to the agent's own authored data because third-party licences bar redistribution.
6. **AML/CTF identity workflow: reject as a moat.** Table stakes across Reapit, BA ICON, BuyersagentsOS, VaultRE, Rex. Keep it, linked to the engagement record.

## 5. Open questions for the owner

- Obtain REA partner terms, Domain APIs Terms of Service (storage clause), Pricefinder conditions of use, Cotality Parts M and N.
- Ask Pricefinder whether a buyers-agent workspace counts as commercialisation and whether bring-your-own credentials are allowed.
- Verify competitor hosting and feature claims (BA ICON, AgentHub 360, BuyersagentsOS, Open BA, Wayscape); any trial is the owner's decision.
- Legal advice on the AUSTRAC final Rules (buyer CDD timing, reliance) and on a shared-record network.
- Provider selection and spend remain the owner's. No provider is recommended here.

## Sources (retrieved via search excerpt, 2026-11-18)

T1: [AUSTRAC real estate designated services](https://www.austrac.gov.au/new-austrac/designated-services-newly-regulated-entities/real-estate-designated-services); [AUSTRAC reliance](https://www.austrac.gov.au/industry-and-business/obligations-and-guidance/your-amlctf-program/customer-due-diligence/reliance-customer-identification-third-party/overview-reliance-customer-identification-third-party); [AUSTRAC real estate starter kit](https://www.austrac.gov.au/industry-and-business/obligations-and-guidance/program-starter-kits/real-estate-program-starter-kit/real-estate-program-starter-kit-examples-dealing-customers); [OAIC APP 8](https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-8-app-8-cross-border-disclosure-of-personal-information); [Domain listings production access](https://developer.domain.com.au/docs/latest/apis/pkg_listing_management/guides/production-access/); [Domain listing data policies](https://developer.domain.com.au/docs/v2/support/policies); [Domain FAQ](https://developer.domain.com.au/docs/v1/support/faq/); [Pricefinder API](https://www.pricefinder.com.au/api-get-started/); [Cotality terms](https://www.cotality.com/au/legal/terms-conditions); [Cotality display guidelines](https://pages.cotality.com/hubfs/CoreLogic%20AU/Legal/Cotality-Display-Guildlines.pdf); [Rex API terms](https://www.rexsoftware.com/legal/rex-crm-api-terms); [Rex custom integrations](https://www.rexsoftware.com/features/custom-integrations); [VaultRE Pricefinder help](https://support.vaultre.com.au/hc/en-au/articles/360004275635); [VaultRE APLYiD](https://support.vaultre.com.au/hc/en-au/articles/16816079161743-Integrate-with-APLYiD-AML); [Reapit developer terms](https://foundations-documentation.reapit.cloud/developer-terms-and-conditions); [Reapit Verify](https://www.reapit.com.au/software/reapit-verify); [Reapit pricing](https://www.reapit.com.au/pricing/reapit-one); [BA ICON](https://icon.com.au/see-how-it-works); [PropTrack APIs](https://proptrack.com.au/products/property-data-and-insights/apis/); [CoStar completion](https://www.businesswire.com/news/home/20250827738439/en/CoStar-Group-Completes-Acquisition-of-Domain-Ushering-in-a-New-Era-of-Innovation-for-Australias-Property-Market).

T2/T3: [Elite Agent: BuyersagentsOS](https://eliteagent.com/buyersagentsos-launches-single-os-for-australian-buyers-agents/); [Elite Agent: Cotality](https://eliteagent.com/buyersagentsos-integrates-cotality-data-for-agents/); [13Labs data APIs](https://www.13labs.au/guides/australian-property-data-apis-compared); [API Evangelist: Agentbox](https://providers.apievangelist.com/providers/agentbox/); [apis.io: REA](https://apis.io/providers/rea-group/); [Arosoftware REAXML](https://arohelp.arosoftware.com/portal/en/kb/articles/reaxml-property-data-feed); [Capterra: AgentHub 360](https://www.capterra.com.au/software/1098265/AgentHub-360); [Collings comparison](https://www.collings.com.au/?p=31945) (competitor); [Birdeye/Agentbox](https://support-test.birdeye.com/en/articles/12654382-birdeye-native-integration-agentbox); [Property Industry Eye (Rex)](https://propertyindustryeye.com/?p=155898).
