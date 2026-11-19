# Market teardown: the AI-agent ('harness') era (issue #85)

Condensed from a public-source research pass, 2026-11-19. Findings, not advice. **All claims rest on search excerpts**; direct fetches failed (proxy DNS). Tiers: T1 vendor/regulator primary (proves only that the vendor says it), T2 trade press, T3 blog/directory/marketing. Confidence H/M/L.

## Headline findings

1. Consumer-facing AI is shipped at the large portals; agent-workflow AI is mostly beta or announced (H/M).
2. Agent-native interfaces (MCP) exist at data vendors, not at Australian portals (M; absence of evidence is weak).
3. Portals join assistants on their own terms: limited view, click-through back to the portal (M-H).
4. Evidence that consumers moved from portals to assistants is thin (M).
5. Transcription and summarisation are bundled and commoditising; licensed data, identity/AML evidence and accountable sign-off are scarcer (M, interpretation).

## Shipped vs announced

**REA / PropTrack.** ChatGPT app for logged-in AU users (about Feb 2026; T2, H). Conversational search on site after a 12-month pilot (T2, M-H). realAssist, OpenAI-powered valuation explainer (T2, H). 'NextGen Now' bundle (AI Assistant, AI Search, Campaign Assist, iGUIDE tours; about Aug 2026; T2, M, no primary release found). No standalone PropTrack generative product found.

**Domain (CoStar-owned).** LeadScope predictive prospecting (Aug 2023; T1/T2; technique unknown). Internal staff listing assistant (T2, M). No consumer conversational search, ChatGPT app or MCP found (M). CoStar intends to fold Domain into Homes.com within 12-18 months (announced intent).

**Cotality.** MCP server and AI-ready datasets (31 Mar 2026; T1, H). Claude connector announced 12 Oct 2026, access subject to user licensing (T1, M). Australian coverage unconfirmed (L).

**Agentbox / Reapit, VaultRE, Rex.** Reapit AI announced Aug 2025; only a June 2026 property-management workflow confirmed in AU (M). Agentbox call transcription only via a third-party 3CX integration (T3). VaultRE: no AI announcement found (L). Rex AI Assist: open beta, voice/text CRM updates with an action plan and sign-off before changes; Prospecting, Nurture, Manage announced for later (T1, H beta / M dates).

**Buyers-agent tools.** Open BA (T3, L-M), HTAG AI Copilot (Feb 2026, vendor claim, L-M), Dimek DealBrief (AUSTRAC tier in early access, L), BuyersagentsOS (first pass). No product found combining verbatim-quote provenance with shortlisting (L).

## Agent-native interfaces

Australia: HTAG Analytics MCP (M; launch date and figures conflict), Microburbs MCP with bearer token (M), Cotality (AU unconfirmed). Pricefinder documented API, no MCP found. REA: no public API; scrapers only (not used, likely terms breach). Domain: OpenAPI docs; no MCP found.

Overseas: ChatGPT apps from Zillow (Oct 2025), Redfin (Feb 2026), Realtor.com (Mar 2026), Rightmove (experimental) (H). Data-vendor MCP servers: ATTOM, HouseCanary, Beagel, SourceRE, Rechat (M). Zillow says its app stays inside its MLS agreements; critics disputed that; unresolved in sources.

Direction: portals offer controlled apps; licensed-data vendors offer MCP with licence-bound auth; workflow platforms put AI in front of their own CRM data. No portal exposes its raw listing graph to arbitrary agents.

## Where consumers start

REA self-reports conversational-search behaviour (T2, M, self-interested). Roy Morgan figure on AI as main search tool is not property-specific (T3, L). Rightmove CEO: AI-platform traffic under 0.5% (T2, M). US surveys come from interested parties. Trade view: the contest is for consideration, not search. Buyers-agent angle (clients arriving with AI shortlists) is plausible but unmeasured in Australia.

## Working assumptions, with disproved-if conditions

1. Assistants and agents are clients of the product (MCP is a standard distribution surface). Disproved if major data providers refuse or restrict agent access in their terms.
2. Property data stays licensed and gated. Disproved if REA or Domain publish an open agent-accessible API, or the US IDX dispute resolves toward open syndication.
3. Transcription and summarisation have no lasting differentiation. Disproved if buyers agents pay for standalone transcription at prices that do not collapse toward bundled tiers.
4. Provenance, audit trail and sign-off are the scarcer layer. Disproved if AUSTRAC guidance does not need evidence a workspace can hold, or incumbents ship equivalent verbatim-source features.
5. Portals remain the main discovery channel for now. Disproved if Australian data shows assistants driving a material share of searches.
6. Incumbent CRMs are moving into AI fast. Disproved if their features stay in beta or limited to PM/prospecting through 2027.

## Gaps

Primary REA and Domain statements; REA/Domain AI-use and robots terms; Cotality AU coverage; AUSTRAC start trigger wording; OAIC primary text; VaultRE/Agentbox release notes; HTAG launch date and licensing basis.

## Key sources (links as returned by the research pass)

[Cotality MCP](https://www.cotality.com/press-releases/cotality-launches-a-universal-ai-connector-mcp-server-and-ai-ready-property-intelligence); [Cotality Claude connector](https://www.cotality.com/press-releases/cotality-launches-claude-connector-to-deliver-trusted-property-intelligence-in-ai-workflows); [Mediaweek: REA ChatGPT app](https://www.mediaweek.com.au/agency-news/rea-launches-australias-first-chatgpt-property-search-app); [IT Brief: REA AI suite](https://itbrief.com.au/story/realestate-com-au-launches-ai-property-search-suite); [iTnews: REA conversational search](https://www.itnews.com.au/news/rea-group-brings-conversational-ai-search-to-realestatecomau-623439); [Rex AI Admin](https://support.rexsoftware.com/hc/en-us/articles/56542699591833-AI-Admin-Introduction); [Reapit AU June 2026](https://www.reapit.com.au/post/what-we-launched-in-june-2026); [Microburbs MCP](https://www.microburbs.com.au/blog/connect-claude-to-australian-property-data-mcp); [HTAG MCP](https://www.htag.com.au/htag-model-context-protocol-property-intelligence/); [Zillow ChatGPT app](https://www.zillowgroup.com/news/zillow-becomes-first-real-estate-app-in-chatgpt); [City AM: Rightmove CEO](https://www.cityam.com/?p=2403517); [OnlineMarketplaces: portals vs LLMs](https://www.onlinemarketplaces.com/articles/the-real-portals-vs-llms-battle-isnt-for-search-its-for-consideration/); [AUSTRAC tranche 2 factsheet](https://www.austrac.gov.au/sites/default/files/2025-07/AMLCTF_obligations_factsheet_for_tranche_2_REs.pdf); [Open BA on G2](https://www.g2.com/sellers/open-ba); [HTAG AI Copilot release](https://www.einpresswire.com/article/888404240/htag-launches-first-vertically-integrated-ai-copilot-for-real-estate-investment).
