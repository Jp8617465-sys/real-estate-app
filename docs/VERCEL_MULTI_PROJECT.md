# Vercel Multi-Project Deployment Guide

> One repo, three Vercel projects — each serving a different product mode.

---

## Overview

RealFlow uses a single monorepo with three Vercel deployments, each configured with a different `NEXT_PUBLIC_PRODUCT_MODE` environment variable. This provides build-time route exclusion that complements the runtime middleware product guard.

| Vercel Project     | Product Mode    | Domain                      |
| ------------------ | --------------- | --------------------------- |
| `realflow-ba`      | `buyers_agent`  | `ba.realflow.com.au`        |
| `realflow-selling` | `selling_agent` | `app.realflow.com.au`       |
| `realflow-full`    | `both`          | `platform.realflow.com.au`  |

All three frontends connect to the **same** Render API (`realflow-api.onrender.com`). Product gating is enforced at three layers:

1. **Build-time redirects** — `next.config.js` conditionally redirects excluded routes to `/dashboard`
2. **Runtime middleware** — product-aware middleware from A4 hides unavailable navigation
3. **API product guard** — A5 API plugin rejects requests for features outside the user's product scope

---

## Setup Steps (per Vercel project)

### 1. Import from GitHub

- Repository: `Jp8617465-sys/real-estate-app`
- Framework Preset: Next.js
- Root Directory: `apps/web`
- Build Command: (leave default — `next build`)
- Output Directory: (leave default — `.next`)

### 2. Environment Variables

Set the following in the Vercel project settings (Settings > Environment Variables):

| Variable                         | Value                                        | Notes                           |
| -------------------------------- | -------------------------------------------- | ------------------------------- |
| `NEXT_PUBLIC_PRODUCT_MODE`       | `buyers_agent` / `selling_agent` / `both`    | Determines which routes to include |
| `NEXT_PUBLIC_SUPABASE_URL`       | `https://hfwgymqjnwlewmbskuim.supabase.co`  | Same across all projects        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | *(from Supabase dashboard)*                  | Same across all projects        |
| `API_URL`                        | `https://realflow-api.onrender.com`          | Same across all — single API    |

### 3. Custom Domains

Configure in Vercel project Settings > Domains:

- **realflow-ba**: `ba.realflow.com.au`
- **realflow-selling**: `app.realflow.com.au`
- **realflow-full**: `platform.realflow.com.au`

DNS: Add CNAME records pointing each subdomain to `cname.vercel-dns.com`.

---

## Architecture Notes

- **Shared API**: All three frontends talk to one Render-hosted Fastify API. The API uses its own product guard plugin to enforce feature access regardless of which frontend makes the request.
- **Shared Database**: Single Supabase instance with RLS. The `product_type` column on the office/subscription determines which features are accessible.
- **Build Caching**: Turbo caches builds per `NEXT_PUBLIC_PRODUCT_MODE` value (configured in `turbo.json` `env` array), so switching modes triggers a fresh build.

---

## Local Development

Use the convenience scripts in the root `package.json`:

```bash
npm run build:ba       # Build with buyers_agent mode
npm run build:selling  # Build with selling_agent mode
npm run build:full     # Build with both mode (default)
```

For local dev, set `NEXT_PUBLIC_PRODUCT_MODE` in `apps/web/.env.local`:

```env
NEXT_PUBLIC_PRODUCT_MODE=buyers_agent
```

---

## When to Set This Up

This multi-project setup can be configured **later** once there are customers who need product-specific deployments. For development and demos, the single `both` deployment covers all features. The build-time gating and runtime middleware are already functional — Vercel project separation is the final deployment layer.
