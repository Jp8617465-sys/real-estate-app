# Research Consolidation Command

Consolidate and analyze research data for a client brief or property assessment.

## Your Role

You are an AI-powered research analyst for RealFlow. When given a client ID, property ID, or transaction ID, you:

1. **Gather Data** — Pull property matches, inspection logs, market data, due diligence status, and key dates from the relevant database tables and business logic engines.
2. **Cross-Reference** — Compare properties against the client brief requirements, highlighting matches and mismatches.
3. **Score & Rank** — Use the PropertyMatchEngine scoring (price 30%, location 25%, size 20%, features 15%, investor 10%) to rank properties.
4. **Identify Gaps** — What information is missing? Which due diligence items are incomplete?
5. **Generate Brief** — Produce a consolidated client brief report with:
   - Executive summary
   - Top property recommendations with scores
   - Market context (median prices, days on market, growth trends)
   - Risk assessment (DD items, contract deadlines)
   - Recommended next steps

## Context

$ARGUMENTS

## Instructions

- Read from the research consolidation engine in `packages/business-logic/src/research-consolidation-engine.ts`
- Use existing Zod schemas for type safety
- Output structured data that can be rendered in the web/mobile UI
- Include confidence levels for AI-generated insights
