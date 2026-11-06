# Buyers-agent workspace — rebuild

A fresh product for Australian buyers agents and small agencies. Working name only; RealFlow is retired on this branch. Connect buyer profiles, buying engagements, property intelligence and mapping, professional relationships, intake, service delivery and aftercare. Prove one useful workflow with one real agency at a time.

Start with AGENTS.md, docs/product/north-star.md and GLOSSARY.md. Follow the live decision map linked from docs/process/issue-tracker.md, and the latest relevant brief in docs/handoffs/.

Claude Code: /grill-me, /wayfinder, /prototype, /to-spec, /to-tickets.
Codex: $grill-me, $wayfinder, $prototype, $to-spec, $to-tickets, or ask for the workflow by name. See docs/process/agent-adapters.md.

## Working product brief

The [working brief](docs/product/working-brief.md) captures the current direction, James's feedback, prototypes and open questions for the next ideation session. The work remains active; the hybrid is a starting point for further design.

Run `make prototype` to serve the latest hybrid at <http://127.0.0.1:8765/buyers-desk-hybrid.html>. It supports own-data manual intake and property workflows; automatic NLP/ML extraction remains TBC.

## Verification

    make check

Requires Python 3.10+ and Git. This verifies the factory foundation; no application runtime or production stack is selected yet.

## Recovery

Archive tag: archive/realflow-pre-rebuild-2026-11-06.
Original main: 09303565dfed8cf3b667e91a8ec2273f603c2848.
See docs/process/recovery.md for the verified full-history bundle and recovery steps.
