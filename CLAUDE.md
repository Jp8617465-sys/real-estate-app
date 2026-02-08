# CLAUDE.md — Master Prompt for RealFlow

## Project Identity

**Project Name:** RealFlow
**Tagline:** The frictionless CRM and workflow platform for Australian real estate agents and buyers agents.

## Architecture

- **Monorepo:** Turborepo with npm workspaces
- **Web:** Next.js 14+ (App Router) with Tailwind CSS, React Query, Zustand
- **Mobile:** React Native (Expo) with NativeWind, Expo Router
- **API:** Fastify with typed Supabase client
- **Database:** PostgreSQL via Supabase with Row Level Security
- **Auth:** Supabase Auth (email/password, Google, Apple)
- **Real-time:** Supabase Realtime
- **Shared packages:** `@realflow/shared` (types/schemas), `@realflow/business-logic`, `@realflow/integrations`, `@realflow/ui`

## Coding Standards

- TypeScript strict mode — no `any` types
- Zod schemas for all API inputs and database types (defined in `packages/shared/`)
- Shared types in `packages/shared/` — never duplicate type definitions
- Components: small, composable, single-responsibility
- Custom hooks for all data fetching (prefixed with `use`)
- Optimistic updates for all mutations
- Soft deletes everywhere — never hard delete
- Conventional commits (feat:, fix:, chore:, etc.)
- Mobile-first design — every feature must work on phones

## Key Commands

```bash
npm run dev          # Run all apps
npm run build        # Build all
npm run lint         # Lint all
npm run test         # Test all
npm run db:migrate   # Apply Supabase migrations
npm run db:reset     # Reset + seed database
```

## Key Modules

1. **CRM** — Contacts with buyer/seller profiles, duplicate detection, lead scoring, activity timeline
2. **Pipeline** — Buyer (8 stages) and Seller (6 stages) pipelines with validated transitions
3. **Properties** — Listings with portal sync (Domain, REA), media, analytics
4. **Workflows** — Trigger → condition → action automation engine
5. **Integrations** — Domain.com.au, Meta (Facebook/Instagram), LinkedIn
6. **Communication Hub** — Email, SMS, phone, social DMs in one place

## Design Principles

1. Mobile-first — agents live on their phones
2. Speed over features — pages load < 200ms
3. Zero-friction lead capture — < 60s from enquiry to agent notification
4. Opinionated workflows — ship with best-practice templates
5. Social-native — one-tap listing posts, DM → CRM ingestion
6. Never lose data — soft deletes, full audit trail
7. Australian market first — AUD, AU addresses, AU portal integrations
