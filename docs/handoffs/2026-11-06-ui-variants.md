# Conversation-to-shortlist UI variants — 6 November 2026

## Objective and feedback

Repo: /Users/jpcino/Documents/ChatGPT/Sell Well/repository.
Branch: prototype/engagement-property-review. Map: https://github.com/Jp8617465-sys/real-estate-app/issues/47. Owning prototype: https://github.com/Jp8617465-sys/real-estate-app/issues/51 (open, same owner codex-walkthrough-2026-11-06).

James disliked the initial logic prototype's presentation: clunky, unintuitive, poor visual direction/navigation, unclear journey. He explicitly requested A/B/C UI variants, then identified NLP/ML ingestion of conversation transcripts into client/engagement fields as a potential major benefit. This is exploration, not approval of a production extraction model.

## Completed

New standalone artifact: prototypes/property-review-variants.html, switchable with ?variant=A/B/C or the fixed bottom bar/arrow keys. State survives variant switches; arrows do not intercept editing or dialogs. Reload resets session data. Previous logic prototype remains intact for comparison.

- A: guided workspace, client rail and one property at a time.
- B: transcript/suggestions inbox followed by an engagement status board and property drawer.
- C: client dossier with conversation/brief alongside each other, followed by a property comparison table.

Shared journey: upload/paste text → inspect source-backed suggestions → edit/check every field → apply reviewed brief → assess candidates → shortlist/hold/pass/missed with reasons and next actions. Also includes engagement-specific property attachment/tags/history and client history across engagements.

Text upload supports .txt/.md/.vtt/.srt under 500 KB. Extraction is explicitly local rule-based simulation, not ML. Buyer-labelled sample statements produce name, budget, bedrooms, suburbs and access suggestions. Unknowns stay empty; multiple budgets flag ambiguity. Human review is mandatory; editing the transcript invalidates old suggestions. No model/provider/CRM selected; no information is uploaded to a service or persisted.

Run make prototype; local server started at http://127.0.0.1:8765/property-review-variants.html and returned HTTP 200. Or double-click the HTML. Server may need restarting in a fresh session.

## Verification

Chrome exercised all three journeys, review gate, reason/follow-up validation, retained decisions across variants, text-file ingest, unknown identity, stale-transcript refusal, keyboard/URL switching and engagement-specific attachments. Desktop and 390px phone layouts inspected; no page overflow or browser exceptions. make check, JS parsing and git diff checks pass. Temporary browser tooling is removed; no permanent prototype tests.

## Standing context and next action

Buywell is James's reference agency and is unaware of the project, not a participating pilot. HighLevel remains his unverified belief. Real observation remains open on ticket 48; separately claimed provider research remains on ticket 49. No pilot feedback or successful prototype verdict is claimed.

GitHub connector lookup reported DISABLED_BY_ADMIN / NOT_AVAILABLE / not installed; authenticated gh CLI is the available fallback. Foundation draft PR 53 remains unmerged; main unchanged. No deployment, production infrastructure or spend.

Next: James compares A/B/C (try the example conversation), selects a structure or combination, and clarifies the desired intake/review behaviour. Keep ticket 51 open until actual feedback/validation. Context: unavailable; no reliable loaded-context/capacity counter. Continue the next bounded phase in a fresh chat using this handoff and standing instructions.
