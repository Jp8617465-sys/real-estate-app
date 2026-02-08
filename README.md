# RealFlow

The frictionless CRM and workflow platform for Australian real estate agents and buyers agents.

## Quick Start

```bash
# Install dependencies
npm install

# Run all apps in development mode
npm run dev

# Run specific apps
cd apps/web && npm run dev    # Next.js web app on :3000
cd apps/api && npm run dev    # API server on :3001
cd apps/mobile && npm start   # Expo mobile app
```

## Project Structure

```
realflow/
├── apps/
│   ├── web/                    # Next.js 14 web application
│   ├── mobile/                 # React Native (Expo) mobile app
│   └── api/                    # Fastify API server
├── packages/
│   ├── shared/                 # Shared types, Zod schemas, constants
│   ├── ui/                     # Shared UI component interfaces
│   ├── business-logic/         # Pipeline engine, scoring, duplicate detection
│   └── integrations/           # Domain.com.au, Meta API clients
├── supabase/
│   ├── migrations/             # PostgreSQL database migrations
│   ├── functions/              # Supabase Edge Functions
│   └── seed.sql                # Development seed data
└── CLAUDE.md                   # AI assistant context
```

## Tech Stack

- **Web:** Next.js 14 (App Router), Tailwind CSS, React Query, Zustand
- **Mobile:** React Native (Expo), NativeWind, Expo Router
- **API:** Fastify, Supabase client
- **Database:** PostgreSQL via Supabase with Row Level Security
- **Auth:** Supabase Auth
- **Monorepo:** Turborepo with npm workspaces

## Environment Variables

Copy `.env.example` files and fill in your values:

```bash
cp apps/web/.env.example apps/web/.env.local
```

Required:
- `NEXT_PUBLIC_SUPABASE_URL` — Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Your Supabase anon key

## Database

Migrations are in `supabase/migrations/`. To apply:

```bash
npm run db:migrate
```

To seed development data:

```bash
npm run db:reset   # Applies migrations + seed data
```
