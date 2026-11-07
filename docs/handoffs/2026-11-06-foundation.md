# Buyers-agent rebuild handoff — 6 November 2026

## Objective

Rebuild Jp8617465-sys/real-estate-app from scratch, preserving recovery, and port the reusable ASXOS factory/Matt Pocock skills for Claude Code and Codex. This phase creates the foundation and decision map; it does not complete the product.

## Completed

Checkout: /Users/jpcino/Documents/ChatGPT/Sell Well/repository.
Branch: codex/rebuild-foundation.
Draft PR: https://github.com/Jp8617465-sys/real-estate-app/pull/53.
Archive tag: archive/realflow-pre-rebuild-2026-11-06 at original main 09303565dfed8cf3b667e91a8ec2273f603c2848. Verified full-history bundle is one directory above the checkout. Main, databases and external deployments were not modified.

Retired all old tracked code/config/docs on the rebuild branch. Ported 12 exact upstream skills (22 manifest files), licence, hashes and verifier; shared Codex symlinks, Claude import, tracker/tool adapters, delivery instructions, templates and CI. Product brief: docs/product/north-star.md. Vocabulary: GLOSSARY.md. No application stack is selected. Scheduled factory builders/authority hooks/closure tooling remain separate work.

## Decisions

Australian buyers agents; one pilot agency. Lasting buyer/household profiles separate from engagements. Connected property data/mapping, private knowledge, finance brokers/other professional relationships, sales/intake, buying service, checks and aftercare. Documented product API with replaceable provider connectors; public data redistribution is not implied. Agents own routine approved delivery through release/observed acceptance; James retains authority changes, unapproved spend/external commitments and destructive production actions. This bootstrap remains on its branch for review.

## Live map and next phase

Map: https://github.com/Jp8617465-sys/real-estate-app/issues/47.
Native children: real engagement walkthrough (48), provider research (49), first workflow/prototype question (50), pilot prototype (51), first live tracer bullet (52). Native blockers are wired.

Provider research runs separately on research/property-data-options; check live ticket/branch state. No real walkthrough or specific pilot agency has yet been supplied despite agreement to use one. Do not invent interviews or pilot feedback. Next human step: capture an anonymised engagement, then resolve the first workflow decision. Wayfinder's destination is a tested prototype and agreed first live tracer bullet.

## Verification and limitations

make check passes locally; initial factory CI passed on GitHub. Check current-head CI after the final documentation/Action-pin commit. Archive bundle and remote tag verified; map hierarchy/dependencies read back. Legacy Vercel preview reports failure; integration remains attached and new hosting is undecided. New-session skill discovery in Claude/Codex needs a runtime smoke check. Older unrelated app PRs remain open.

Context: unavailable; no reliable loaded-context/capacity counter exposed. Finish this bounded foundation phase, then use a fresh chat with only this handoff and standing AGENTS.md instructions. Recheck live Git/Issue/PR state before continuing.
