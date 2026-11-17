# Buyers-agent workspace — working brief

Updated 7 November 2026. This is the starting context for further ideation with James, including a session in VS Code. The work remains active. The hybrid demonstrates a direction to challenge and refine; it does not settle the final product design or architecture.

The [north star](north-star.md) owns agreed product direction, [GLOSSARY.md](../../GLOSSARY.md) owns vocabulary, and the [GitHub map](https://github.com/Jp8617465-sys/real-estate-app/issues/47) owns live decisions, dependencies and status. Follow [AGENTS.md](../../AGENTS.md) and the [host adapters](../process/agent-adapters.md).

## Product context

Help Australian buyers agents connect their client work, buyer requirements, property search/assessment and their relationships with professionals. The broader direction includes opportunities from enquiry to agreement, service delivery, checks and aftercare, with property intelligence/mapping and a documented product API backed by replaceable provider connectors. The first useful workflow should prove value before building the wider suite.

Keep a lasting buyer/household profile separate from each buying engagement. A client can return for another purchase. Property decisions, tags, assessment notes and follow-up belong to the relevant engagement; passing on a property for one engagement must not overwrite another's view.

James named [Buywell's Brisbane buyers agency](https://www.buywellgroup.com.au/locations/buyers-agency-brisbane) as the business he is modelling for. Buywell does not know about this project and has not participated. James believes it uses HighLevel; this is unverified. No real pilot walkthrough, internal tools/process evidence or adoption feedback has been captured. Public workflow research and assumptions are recorded on [Observe a real buyer engagement](https://github.com/Jp8617465-sys/real-estate-app/issues/48).

## The strongest opportunity identified so far

James sees potentially significant value in **using a conversation transcript to detect relevant details and populate client/engagement fields**, reducing manual work. The prototype journey evolved toward:

1. Upload or paste a buyer consultation/conversation.
2. Produce suggested client and engagement details, linked to the words that support them.
3. Review, correct and apply the suggestions.
4. Assess candidate properties against the engagement's buyer brief.
5. Shortlist, hold, pass or record a missed property, retaining reasons, next actions and history.

On 7 November James agreed the intake and review design, test approach and first tracer-bullet route in [Decide how consultation transcripts become reviewed records](https://github.com/Jp8617465-sys/real-estate-app/issues/54). In short: start with the initial buyer consultation; extraction only suggests; each suggestion carries a verbatim quote, speaker and stated/inferred mark that code verifies; the person who was on the call reviews, with conflicts always shown; precision beats recall. The initial five-field demo is not the agreed field list; that ticket holds it.

**Real model-backed extraction is still unbuilt.** Real client conversations are to be processed only in Australia (Claude on AWS Bedrock Australian profiles or a local model, agreed as future state). For now the tracer bullet uses Anthropic's Claude API with synthetic and role-play material only, measuring Claude Opus 5.5, Sonnet 5.5 and Haiku 5.5 plus a local Qwen3.5-9B against the agreed pass bar, under an approved US$50 cap. The API account, credits and key are not yet set up. A normal product subscription must not be treated as API access.

## Feedback and UI direction

- The initial logic demo exposed state, but James found it clunky, unintuitive, difficult to navigate and lacking a clear journey/visual hierarchy.
- James requested structurally different A/B/C variants. A offered a guided client workspace; B a conversation inbox and property board/drawer; C a client dossier and comparison desk.
- James preferred **A's overall UI with useful later-stage B elements**. The hybrid combines A's green client rail/guided intake with B's property board and detail drawer. This is a useful starting point for further ideation.
- James reported that only prefilled examples appeared functional. Inspection confirmed narrow sample-shaped parsing, a few recognised speaker labels/three suburbs, and missing own-client/property creation. Those limitations must not become hidden assumptions in a real extraction implementation.
- The latest hybrid starts empty and accepts own records. Its brief entry is explicitly manual until extraction is built.

## What the current artifacts actually do

| Artifact | Use |
| --- | --- |
| [Working A+B hybrid](../../prototypes/buyers-desk-hybrid.html) | Latest starting point. Own clients/engagements, text upload/paste, manual brief, own property records, board/drawer, outcomes/history and workspace file export/import. |
| [A/B/C exploration](../../prototypes/property-review-variants.html) | Compare the three UI structures with `?variant=A`, `B` or `C`. Preserves working state while switching. Its historical extraction is a local demo parser, not ML. |
| [Logic demo](../../prototypes/engagement-property-review.html) | Synthetic guided scenarios for evidence gaps/conflicts, assessment/outcomes and engagement isolation. |
| [Transcript suggestion review](../../prototypes/transcript-suggestion-review.html) | Synthetic transcript 03 with hand-written suggestions (no model): speaker matching, quote-checked review, applied result and a comparison with the approved key. Awaiting James's verdict on [Prototype the transcript suggestion review](https://github.com/Jp8617465-sys/real-estate-app/issues/55). |

All source is on `prototype/engagement-property-review`. The latest hybrid was captured at `5c3e0747b4bbfcd5c76f7d40c8207a9dce42a185`; earlier UI variants at `fe5991b6baaa2bcefa56611639fa03b4c98705fc`, and logic demo at `a1568ccb73fe46e2f0ad8bbe7bd89615a4752817`. Detailed feedback and verification live on [Test the first workspace prototype with the pilot agent](https://github.com/Jp8617465-sys/real-estate-app/issues/51).

The hybrid accepts `.txt`, `.md`, `.vtt` and `.srt` transcripts up to 1 MB. Actual text is retained with the engagement. Users can manually enter unrestricted names/suburbs, leave unknown brief requirements blank, add/edit property facts and source notes, link a property into another engagement, and record assessments, shortlist/hold/pass/missed outcomes, reasons, actions and tags. Assessment notes and decision reasons are separate. Non-structured brief notes are retained but not scored.

Records live in memory until the user exports a versioned JSON workspace. Open workspace file restores it. There is no automatic persistence, backend/authentication, connected CRM, live listing feed or independent property verification. Do not imply the prototype has these capabilities.

Working interpretations to validate: an opportunity is an engagement before its agreement is signed, and a buying engagement exists from first enquiry (see the glossary); "assessed" describes review progress; "passed" means choosing not to pursue; "missed" means unavailable/lost out. Fit evidence and the engagement's decision are separate dimensions.

## Status of the ideation questions

- What is the highest-value conversation to start with: initial buyer consultation, an ongoing client call, a selling-agent conversation, or another interaction? How should multiple speakers and professional relationships map to records?
- Which details belong to the lasting client, which to an engagement, and which to a property/assessment? How do sales opportunities relate to buying engagements in the agency's language?
- How should suggestions show source quotes, uncertainty, conflicting statements and later corrections? What review experience prevents an inference from quietly overwriting an agreed fact?
- What does a useful first extraction deliver, and what examples would demonstrate a material failure? Consider invented details, omitted must-haves, revised budgets, speaker attribution and attachment to the wrong record.
- What should the agent see immediately after ingestion? Which next action should dominate the UI, and which parts of A/B need refinement?
- What should the first live tracer bullet prove across ingestion, review, record updates and a useful agent outcome? Keep live property-data integration as an explicit dependency if that slice actually needs it.
- When James is ready, what model route, access, processing/privacy expectations and spend are acceptable? What pilot evidence would validate usefulness?

The questions above were answered on [Decide how consultation transcripts become reviewed records](https://github.com/Jp8617465-sys/real-estate-app/issues/54), except pilot evidence of usefulness (a role-played consultation with a real buyers agent is likely but not arranged). New open items: AML/CTF-driven customer identification checks, and moving extraction to AWS in Australia before any real transcript. The [synthetic consultation test set](https://github.com/Jp8617465-sys/real-estate-app/issues/56) is done. [Prototype the transcript suggestion review](https://github.com/Jp8617465-sys/real-estate-app/issues/55) is built and awaits James's verdict; it is the remaining gate on [Agree the first live tracer bullet](https://github.com/Jp8617465-sys/real-estate-app/issues/52). [Property-data research](https://github.com/Jp8617465-sys/real-estate-app/issues/49) has a separate claim; check current results before duplicating research.

## Running and verification

Open the nested repository in VS Code: `/Users/jpcino/Documents/ChatGPT/Sell Well/repository`, not the outer Sell Well folder's empty Git repository.

```sh
make prototype
# http://127.0.0.1:8765/buyers-desk-hybrid.html

make check
```

The HTML also opens directly. The preview is local and may need restarting in a new session.

Hybrid Chrome verification used independently written fictional inputs without optional examples: actual file upload, new names/suburbs, manual brief, own-property creation/editing, validation, outcomes/tags, retained history and engagement isolation. An actual workspace download/reopen round-trip restored the records. Desktop and all five phone screens were checked without page overflow/browser exceptions; phone engagement/history controls were reachable. Script parsing, factory and diff checks passed. Temporary QA files were removed; no permanent prototype tests were added.

This is technical walkthrough evidence and James's design feedback. Actual agency workflow accuracy and pilot usefulness remain unvalidated. Main and the foundation draft PR remain unchanged/unmerged. No production stack, deployment or external contact has been selected; a US$50 Claude API spend cap is approved but not set up. GitHub connector discovery reported administrator-disabled/unavailable; the authenticated `gh` CLI was the available fallback.

## Suggested VS Code session opener

> Read AGENTS.md, docs/product/working-brief.md, docs/product/north-star.md, GLOSSARY.md and the latest docs/handoffs/ brief. Recheck the live GitHub map. Claim and resolve one frontier ticket: Prototype the transcript suggestion review (committed prototype skill) or Draft the synthetic consultation test set (drafted by a fresh-context agent that never sees the extraction design). Follow the decisions on Decide how consultation transcripts become reviewed records. Send no real client conversation to any model. Preserve the buyer-profile/engagement distinction and do not restore the retired RealFlow stack.
