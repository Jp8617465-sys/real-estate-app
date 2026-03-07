# RealFlow Production Deployment Guide

**Version:** 1.0.0
**Date:** 2026-03-02
**Architecture:** Turborepo monorepo (Node.js >= 20, npm)

---

## Table of Contents

1. [Render — Fastify API Deployment](#1-render--fastify-api-deployment)
2. [Vercel — Next.js Apps Deployment](#2-vercel--nextjs-apps-deployment)
3. [Resend — Transactional Email](#3-resend--transactional-email)
4. [Supabase Production Setup](#4-supabase-production-setup)
5. [Environment Variables Reference](#5-environment-variables-reference)
6. [Deployment Workflow](#6-deployment-workflow)

---

## 1. Render — Fastify API Deployment

### Architecture Decision

**Recommended Approach:** Root directory with `buildFilter`

- **Why:** Render's monorepo support works best with `rootDir: .` (repository root) combined with `buildFilter` to control when builds trigger
- **Benefit:** Access to all workspace packages during build time
- **Trade-off:** Slightly larger build context, but necessary for Turborepo's dependency resolution

### render.yaml Configuration

Create `/Users/jamespcino/real-estate-app/render.yaml`:

```yaml
services:
  - type: web
    name: realflow-api
    runtime: node
    region: oregon  # Choose closest to your Supabase region
    plan: starter   # Free tier for alpha; upgrade to Starter ($7/mo) for custom domain + better resources

    # Root directory approach (required for Turborepo)
    rootDir: .

    # Build configuration
    buildCommand: |
      npm install &&
      npm run build --filter=@realflow/api...

    startCommand: npm run start --workspace=@realflow/api

    # Build filters (glob patterns relative to repo root)
    buildFilter:
      paths:
        - apps/api/**
        - packages/shared/**
        - packages/business-logic/**
        - packages/integrations/**
        - package.json
        - package-lock.json
        - turbo.json
      ignoredPaths:
        - apps/web/**
        - apps/mobile/**
        - apps/portal/**
        - "**/*.md"
        - "**/*.test.ts"
        - "**/*.test.tsx"

    # Health check
    healthCheckPath: /health

    # Environment variables (set these in Render Dashboard or via render.yaml envVarGroups)
    envVars:
      - key: NODE_ENV
        value: production

      - key: PORT
        value: 10000  # Render default

      - key: SUPABASE_URL
        sync: false  # Set in dashboard

      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false  # Set in dashboard (secret)

      - key: SUPABASE_ANON_KEY
        sync: false

      - key: DATABASE_URL
        sync: false  # Supabase pooler connection (transaction mode)

      - key: DOMAIN_API_BASE_URL
        value: https://api.domain.com.au

      - key: DOMAIN_CLIENT_ID
        sync: false

      - key: DOMAIN_CLIENT_SECRET
        sync: false

      - key: ANTHROPIC_API_KEY
        sync: false

      - key: RESEND_API_KEY
        sync: false

      - key: META_APP_ID
        sync: false

      - key: META_APP_SECRET
        sync: false

      - key: TWILIO_ACCOUNT_SID
        sync: false

      - key: TWILIO_AUTH_TOKEN
        sync: false

      - key: WHATSAPP_PHONE_NUMBER_ID
        sync: false

      - key: GMAIL_CLIENT_ID
        sync: false

      - key: GMAIL_CLIENT_SECRET
        sync: false

# Optional: Add background workers, cron jobs, or private services here
# - type: cron
#   name: realflow-workflow-scheduler
#   runtime: node
#   schedule: "*/5 * * * *"  # Every 5 minutes
#   buildCommand: npm install && npm run build --filter=@realflow/api...
#   startCommand: curl https://realflow-api.onrender.com/api/v1/scheduler/tick
```

### Health Check Implementation

Your API already implements the standard pattern:

```typescript
// /Users/jamespcino/real-estate-app/apps/api/src/index.ts:88
fastify.get('/health', async () => ({
  status: 'ok',
  service: 'realflow-api'
}));
```

**Production Enhancement (Optional):**

For deep health checks (database connectivity, external services), consider using `fastify-healthcheck` plugin:

```bash
npm install fastify-healthcheck --workspace=@realflow/api
```

```typescript
import healthcheck from 'fastify-healthcheck';

await fastify.register(healthcheck, {
  healthcheckUrl: '/health',
  healthcheckUrlDisable: false,
  exposeUptime: true,
  underPressureOptions: {
    maxEventLoopDelay: 1000,
    maxHeapUsedBytes: 100000000,
    maxRssBytes: 100000000,
    maxEventLoopUtilization: 0.98
  }
});

// Custom deep health check
fastify.get('/health/deep', async (request, reply) => {
  try {
    // Check Supabase connection
    const { error } = await supabase.from('users').select('id').limit(1);
    if (error) throw error;

    return {
      status: 'ok',
      service: 'realflow-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected'
    };
  } catch (err) {
    reply.code(503);
    return {
      status: 'degraded',
      service: 'realflow-api',
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
});
```

### Connection Pooling Strategy

**Recommendation for Render:**

- **Use Supabase Transaction Mode Pooler** (`port 6543`) for the API
- **Why:** Render runs ephemeral containers that spawn multiple processes. Transaction mode allows connection sharing and prevents hitting Postgres connection limits

**Environment Variable:**

```bash
# Format: postgresql://postgres.{ref}:${PASSWORD}@aws-0-{region}.pooler.supabase.com:6543/postgres
DATABASE_URL=postgresql://postgres.xxxxxxxxxxxxx:password@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres
```

**When to Use Direct Connection:**
- Local development
- Long-running admin tasks
- Database migrations (see Supabase section)

### Free Tier vs Paid Tier

**Free Tier ($0/mo):**
- ✅ Good for: Alpha testing, proof of concept
- ✅ 750 hours/month (always-on for 1 service)
- ✅ 512 MB RAM, shared CPU
- ❌ No custom domains (uses `*.onrender.com`)
- ❌ Services spin down after 15 minutes of inactivity (cold starts)
- ❌ No deployment protection

**Starter Tier ($7/mo):**
- ✅ Custom domains
- ✅ Always-on (no cold starts)
- ✅ 512 MB RAM (same as free, but dedicated)
- ✅ Deployment protection (health check before routing traffic)
- ✅ Priority support

**Recommendation:** Start with Free tier for alpha, upgrade to Starter before beta launch to eliminate cold starts.

### Deployment Commands

```bash
# Manual deploy via Render CLI (optional)
npm install -g render

render deploy --service realflow-api --branch main

# Or use Git-based auto-deploy (recommended)
git push origin main  # Auto-deploys if connected in Render Dashboard
```

### Monitoring

Render provides built-in logs and metrics:

```bash
# View logs (real-time)
render logs --service realflow-api --tail

# View metrics in dashboard
# https://dashboard.render.com/web/realflow-api
```

---

## 2. Vercel — Next.js Apps Deployment

### Architecture Decision

**Recommended Approach:** Separate Vercel projects for each Next.js app

- **Why:** Vercel's billing, domain management, and environment variables are project-scoped
- **Benefit:** Independent deployments, separate domains, isolated preview URLs
- **Trade-off:** Must configure 3 projects (vs 1 project with multiple apps, which Vercel doesn't officially support)

**Projects to Create:**
1. `realflow-web` (main agent dashboard)
2. `realflow-portal` (client portal)
3. *(Mobile app deploys via EAS, not Vercel)*

### vercel.json Configuration

**Option 1: Root-level vercel.json (for multi-app routing — not recommended)**

If you want a single Vercel project with multi-zone routing, create `/Users/jamespcino/real-estate-app/vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "version": 2,
  "builds": [
    {
      "src": "apps/web/package.json",
      "use": "@vercel/next"
    },
    {
      "src": "apps/portal/package.json",
      "use": "@vercel/next"
    }
  ],
  "routes": [
    {
      "src": "/portal/(.*)",
      "dest": "apps/portal/$1"
    },
    {
      "src": "/(.*)",
      "dest": "apps/web/$1"
    }
  ]
}
```

**⚠️ Warning:** Multi-zone routing has edge-case bugs with App Router. Not recommended for production.

**Option 2: Separate Vercel Projects (recommended)**

Create per-app configuration:

**File:** `/Users/jamespcino/real-estate-app/apps/web/vercel.json`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "cd ../.. && npm install && npx turbo run build --filter=@realflow/web",
  "installCommand": "npm install",
  "framework": "nextjs",
  "outputDirectory": "apps/web/.next"
}
```

**File:** `/Users/jamespcino/real-estate-app/apps/portal/vercel.json`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "cd ../.. && npm install && npx turbo run build --filter=@realflow/portal",
  "installCommand": "npm install",
  "framework": "nextjs",
  "outputDirectory": "apps/portal/.next"
}
```

### Vercel Dashboard Configuration

**Project Setup (for each app):**

1. **Import Repository:** Connect GitHub repo `jamespcino/real-estate-app`
2. **Root Directory:** Set to `apps/web` or `apps/portal` (respectively)
3. **Framework Preset:** Next.js (auto-detected)
4. **Build Command:** Override with:
   ```bash
   cd ../.. && npm install && npx turbo run build --filter=@realflow/web
   ```
5. **Output Directory:** `apps/web/.next` (or `apps/portal/.next`)
6. **Install Command:** `npm install` (runs at root due to `cd ../..`)

**Environment Variables (set per project):**

```bash
# Production
NEXT_PUBLIC_API_URL=https://realflow-api.onrender.com
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Preview (branch deployments)
NEXT_PUBLIC_API_URL=https://realflow-api-preview.onrender.com
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Domain Configuration:**

- **Production (web):** `app.realflow.com.au`
- **Production (portal):** `portal.realflow.com.au`
- **Preview:** Auto-generated (e.g., `realflow-web-git-main-jamespcino.vercel.app`)

### Turborepo Remote Caching (Optional)

Enable Vercel's Remote Cache for faster CI/CD builds:

```bash
# Link Turborepo to Vercel
npx turbo login
npx turbo link

# Add to package.json scripts (already using turbo)
{
  "build": "turbo build",  # Automatically uses remote cache
}
```

**Benefits:**
- Share build cache across team members
- Faster CI/CD (skip rebuilding unchanged packages)
- Free for Vercel projects

### Build Output Directory

Next.js 14 App Router uses `.next` directory (no change from Pages Router):

- **Static exports:** `.next/static`
- **Server components:** `.next/server`
- **Build manifest:** `.next/build-manifest.json`

Vercel automatically detects this structure. No custom configuration needed.

### Deployment Commands

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to preview (from any branch)
vercel

# Deploy to production (from main branch)
vercel --prod

# Or use Git-based auto-deploy (recommended)
git push origin main  # Auto-deploys to production
git push origin feature/xyz  # Auto-deploys to preview
```

---

## 3. Resend — Transactional Email

### Integration Strategy

**Recommendation:** Call Resend directly from Fastify API (not via Supabase SMTP)

**Why:**
- ✅ Full API control (templates, batch sends, webhooks)
- ✅ Programmatic email tracking (opened, clicked, bounced)
- ✅ Easier to test in development (no SMTP config)
- ❌ Supabase SMTP integration only supports auth emails (not custom transactional emails)

**When to Use Supabase SMTP:**
- Supabase Auth emails (password reset, magic links, email confirmation)
- You want Supabase to send emails on your behalf without code

**Solution:** Use **both** approaches:
1. **Resend SMTP for Supabase Auth** (configured in Supabase Dashboard)
2. **Resend API for custom emails** (invitations, notifications, digests)

### Resend API Setup

**Install Resend SDK:**

```bash
npm install resend --workspace=@realflow/api
```

**Create Email Client:**

**File:** `/Users/jamespcino/real-estate-app/apps/api/src/services/email.ts`

```typescript
import { Resend } from 'resend';
import { env } from '../config/env';

const resend = new Resend(env.RESEND_API_KEY);

export async function sendInvitationEmail(params: {
  to: string;
  inviterName: string;
  officeName: string;
  inviteLink: string;
}) {
  const { data, error } = await resend.emails.send({
    from: 'RealFlow <noreply@realflow.com.au>',
    to: params.to,
    subject: `${params.inviterName} invited you to ${params.officeName}`,
    html: `
      <h1>You've been invited to RealFlow</h1>
      <p>${params.inviterName} has invited you to join ${params.officeName} on RealFlow.</p>
      <a href="${params.inviteLink}">Accept Invitation</a>
    `,
  });

  if (error) {
    throw new Error(`Failed to send invitation email: ${error.message}`);
  }

  return data;
}

export async function sendPasswordResetEmail(params: {
  to: string;
  resetLink: string;
}) {
  const { data, error } = await resend.emails.send({
    from: 'RealFlow <noreply@realflow.com.au>',
    to: params.to,
    subject: 'Reset your RealFlow password',
    html: `
      <h1>Reset your password</h1>
      <p>Click the link below to reset your password:</p>
      <a href="${params.resetLink}">Reset Password</a>
      <p>This link expires in 1 hour.</p>
    `,
  });

  if (error) {
    throw new Error(`Failed to send password reset email: ${error.message}`);
  }

  return data;
}

export async function sendNotificationEmail(params: {
  to: string;
  subject: string;
  html: string;
}) {
  const { data, error } = await resend.emails.send({
    from: 'RealFlow Notifications <notifications@realflow.com.au>',
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  if (error) {
    throw new Error(`Failed to send notification email: ${error.message}`);
  }

  return data;
}
```

**Add to API Routes:**

```typescript
// Example: User invitation endpoint
import { sendInvitationEmail } from '../services/email';

fastify.post('/api/v1/users/invite', async (request, reply) => {
  const { email, office_id } = request.body;

  // Create invitation in database
  const invitation = await createInvitation({ email, office_id });

  // Send email
  await sendInvitationEmail({
    to: email,
    inviterName: request.user.name,
    officeName: request.user.office.name,
    inviteLink: `https://app.realflow.com.au/accept-invite?token=${invitation.token}`,
  });

  return { data: invitation };
});
```

### Supabase SMTP Configuration

**Step 1: Configure Resend SMTP in Supabase Dashboard**

1. Go to **Project Settings > Auth > SMTP Settings**
2. Enable custom SMTP
3. Enter Resend credentials:

```
Host: smtp.resend.com
Port: 587
Username: resend
Password: re_xxxxxxxxxxxxxxxxxxxxxxxxxx  (Your Resend API key)
Sender email: noreply@realflow.com.au
Sender name: RealFlow
```

4. Test by sending a test email

**Step 2: Customize Auth Email Templates**

1. Go to **Auth > Email Templates**
2. Customize templates:
   - **Confirm signup:** Welcome email with email confirmation link
   - **Invite user:** Team invitation email
   - **Magic link:** Passwordless login
   - **Reset password:** Password reset link

**Example Template (Reset Password):**

```html
<h2>Reset your password</h2>
<p>Click the link below to reset your password:</p>
<p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
<p>This link expires in 1 hour.</p>
<p>If you didn't request this, you can safely ignore this email.</p>
```

### DNS Records Setup

**Requirement:** You must verify your domain with Resend to send emails from `@realflow.com.au`

**Step 1: Add Domain in Resend Dashboard**

1. Go to **Resend Dashboard > Domains**
2. Click **Add Domain**
3. Enter `realflow.com.au`

**Step 2: Add DNS Records to Your Domain Registrar**

Resend will provide 3 DNS records to add:

**SPF Record (TXT):**

```
Type: TXT
Name: @
Value: v=spf1 include:_spf.resend.com ~all
TTL: 3600
```

**DKIM Records (TXT):**

```
Type: TXT
Name: resend._domainkey
Value: p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC... (provided by Resend)
TTL: 3600

Type: TXT
Name: resend2._domainkey
Value: p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC... (provided by Resend)
TTL: 3600
```

**DMARC Record (TXT):**

```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc@realflow.com.au
TTL: 3600
```

**Step 3: Verify Domain**

1. Wait 5-10 minutes for DNS propagation
2. Click **Verify** in Resend Dashboard
3. Status should change to **Verified**

**Testing:**

```bash
# Check SPF record
dig TXT realflow.com.au +short

# Check DKIM record
dig TXT resend._domainkey.realflow.com.au +short

# Check DMARC record
dig TXT _dmarc.realflow.com.au +short
```

### Environment Variables

**Resend API Key:**

```bash
# Get from Resend Dashboard > API Keys
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Add to:**
- `apps/api/.env` (local development)
- Render Dashboard (production)

### Email Sending Limits

**Resend Free Tier:**
- 100 emails/day
- 3,000 emails/month
- All features included

**Paid Plans:**
- $20/mo: 50,000 emails/month
- $80/mo: 100,000 emails/month
- Custom: Volume pricing

**Recommendation:** Free tier is sufficient for alpha (< 20 testers). Upgrade before beta.

---

## 4. Supabase Production Setup

### Project Setup

**Current Status:** Using Supabase cloud (development project)

**Production Checklist:**

1. Create new Supabase project for production
2. Configure production-grade settings
3. Run migrations
4. Set up connection pooling
5. Configure OAuth providers

### Running Migrations

**Approach 1: `supabase db push` (Recommended for CI/CD)**

```bash
# From repository root
cd supabase

# Set production project (one-time setup)
supabase link --project-ref xxxxxxxxxxxxx

# Push all migrations to production
supabase db push

# Or push specific migration
supabase db push --include-all
```

**Pros:**
- Simple one command
- Automatically detects new migrations
- Idempotent (safe to run multiple times)

**Cons:**
- Requires Supabase CLI installed in CI environment

**Approach 2: SQL Migrations via Supabase Dashboard**

1. Go to **SQL Editor** in Supabase Dashboard
2. Copy contents of migration files from `supabase/migrations/*.sql`
3. Run each migration in order (00001 → 00012)

**Pros:**
- No CLI required
- Manual review before executing

**Cons:**
- Error-prone (easy to miss migrations)
- No version tracking

**Approach 3: Programmatic Migration (not recommended)**

```typescript
// Using @supabase/supabase-js (not officially supported)
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runMigrations() {
  const migrationsDir = path.join(__dirname, '../../supabase/migrations');
  const files = fs.readdirSync(migrationsDir).sort();

  for (const file of files) {
    if (!file.endsWith('.sql')) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    const { error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      console.error(`Failed to run migration ${file}:`, error);
      process.exit(1);
    }

    console.log(`✓ Ran migration ${file}`);
  }
}

runMigrations();
```

**⚠️ Not Recommended:** Supabase doesn't officially support this. Use `supabase db push` instead.

**Recommendation:** Use `supabase db push` in CI/CD pipeline:

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install Supabase CLI
        run: npm install -g supabase

      - name: Run migrations
        run: |
          cd supabase
          supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
          supabase db push
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

### Connection String Formats

**Direct Connection (Port 5432):**

```bash
# Format
postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres

# Use for:
# - Database migrations (supabase db push)
# - Long-running admin tasks
# - Local development
# - Prisma migrations
```

**Pooler (Session Mode, Port 5432):**

```bash
# Format
postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres?pgbouncer=true

# Use for:
# - Persistent connections (e.g., long-lived Node.js processes)
# - Applications that need prepared statements
# - WebSocket connections
# - Supports all PostgreSQL features
```

**Pooler (Transaction Mode, Port 6543):**

```bash
# Format
postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres

# Use for:
# - Serverless functions (Vercel, Cloudflare Workers)
# - Ephemeral containers (Render, Railway)
# - High-concurrency APIs
# - Short-lived connections
# - DOES NOT support prepared statements
```

**Which to Use for RealFlow:**

| Service | Connection Type | Reason |
|---------|----------------|--------|
| **Fastify API (Render)** | Transaction Mode (6543) | Ephemeral containers, high concurrency |
| **Next.js API Routes (Vercel)** | Transaction Mode (6543) | Serverless functions |
| **Supabase Client (Browser)** | Direct (via REST API) | supabase-js handles this automatically |
| **Database Migrations** | Direct (5432) | Requires DDL operations |
| **Local Development** | Direct (5432) | Simplest, no pooler needed |

**Environment Variable Setup:**

```bash
# apps/api/.env (Render production)
DATABASE_URL=postgresql://postgres.xxxxxxxxxxxxx:password@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres

# supabase/.env (for migrations)
DATABASE_URL=postgresql://postgres.xxxxxxxxxxxxx:password@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres
```

**Testing Connection:**

```bash
# Test direct connection
psql "postgresql://postgres.xxxxxxxxxxxxx:password@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres" -c "SELECT version();"

# Test pooler (transaction mode)
psql "postgresql://postgres.xxxxxxxxxxxxx:password@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres" -c "SELECT version();"
```

### OAuth Provider Setup

**Google OAuth:**

1. **Create OAuth Client in Google Cloud Console:**
   - Go to **APIs & Services > Credentials**
   - Create **OAuth 2.0 Client ID** (Web application)
   - Add authorized redirect URIs:
     ```
     https://xxxxxxxxxxxxx.supabase.co/auth/v1/callback
     ```

2. **Configure in Supabase Dashboard:**
   - Go to **Authentication > Providers > Google**
   - Enable Google provider
   - Enter **Client ID** and **Client Secret**
   - Save

3. **Add to Next.js Apps:**

```typescript
// apps/web/app/login/page.tsx
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'https://app.realflow.com.au/auth/callback',
    },
  });
}
```

**Apple OAuth:**

1. **Create Sign in with Apple ID:**
   - Go to **Apple Developer > Certificates, Identifiers & Profiles**
   - Create **Services ID**
   - Add authorized domains:
     ```
     xxxxxxxxxxxxx.supabase.co
     ```
   - Add return URLs:
     ```
     https://xxxxxxxxxxxxx.supabase.co/auth/v1/callback
     ```

2. **Configure in Supabase Dashboard:**
   - Go to **Authentication > Providers > Apple**
   - Enable Apple provider
   - Enter **Services ID** and **Team ID**
   - Upload **Private Key** (.p8 file)
   - Save

3. **Add to Mobile App:**

```typescript
// apps/mobile/app/(auth)/login.tsx
import * as AppleAuthentication from 'expo-apple-authentication';

async function signInWithApple() {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken!,
  });
}
```

**Redirect URL Patterns:**

| Environment | Redirect URL |
|-------------|-------------|
| **Production Web** | `https://app.realflow.com.au/auth/callback` |
| **Production Portal** | `https://portal.realflow.com.au/auth/callback` |
| **Production Mobile** | `realflow://auth/callback` |
| **Preview (Vercel)** | `https://realflow-web-git-*.vercel.app/auth/callback` |
| **Local Development** | `http://localhost:3000/auth/callback` |

**⚠️ Important:** You must add **ALL** redirect URLs to OAuth provider configurations (Google Cloud Console, Apple Developer Portal, Supabase Dashboard).

### Key Environment Variables

**Supabase URLs:**

```bash
# Get from Supabase Dashboard > Settings > API
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  (public)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  (secret)
```

**Database Connection:**

```bash
# Transaction mode (6543) for API
DATABASE_URL=postgresql://postgres.xxxxxxxxxxxxx:password@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres

# Direct connection (5432) for migrations
DATABASE_URL_DIRECT=postgresql://postgres.xxxxxxxxxxxxx:password@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres
```

**Security Settings:**

1. **Enable RLS on all tables** (already done in migrations 00012)
2. **Disable public schema access:**
   - Go to **Database > Roles**
   - Revoke `public` role from `anon` and `authenticated` roles
3. **Enable Postgres SSL:**
   - Required for production (enabled by default)
4. **Set connection pooler limits:**
   - Go to **Database > Pooler**
   - Transaction mode: 200 connections (default)
   - Session mode: 15 connections (default)

### Backup Strategy

**Automatic Backups (Supabase Cloud):**
- Free tier: 7 days retention
- Pro tier: 30 days retention
- Enterprise: Custom retention

**Manual Backup:**

```bash
# Export database schema + data
supabase db dump --project-ref xxxxxxxxxxxxx > backup.sql

# Restore from backup
psql "postgresql://..." < backup.sql
```

**Point-in-Time Recovery (Pro/Enterprise only):**
- Go to **Database > Backups**
- Restore to any point in the last 30 days

---

## 5. Environment Variables Reference

### apps/api/.env (Render)

```bash
NODE_ENV=production
PORT=10000

# Supabase
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
DATABASE_URL=postgresql://postgres.xxxxxxxxxxxxx:password@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres

# Domain.com.au API
DOMAIN_API_BASE_URL=https://api.domain.com.au
DOMAIN_CLIENT_ID=your_client_id
DOMAIN_CLIENT_SECRET=your_client_secret

# AI
ANTHROPIC_API_KEY=sk-ant-api03-...

# Email
RESEND_API_KEY=re_...

# Social Media
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret

# SMS
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id

# Email Integration
GMAIL_CLIENT_ID=your_client_id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your_client_secret
```

### apps/web/.env.production (Vercel)

```bash
NEXT_PUBLIC_API_URL=https://realflow-api.onrender.com
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### apps/portal/.env.production (Vercel)

```bash
NEXT_PUBLIC_API_URL=https://realflow-api.onrender.com
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### apps/mobile/.env.production (EAS)

```bash
EXPO_PUBLIC_API_URL=https://realflow-api.onrender.com
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 6. Deployment Workflow

### Initial Setup (One-Time)

```bash
# 1. Create production Supabase project
supabase projects create realflow-prod --region ap-southeast-2

# 2. Run migrations
cd supabase
supabase link --project-ref xxxxxxxxxxxxx
supabase db push

# 3. Create Render service (via render.yaml)
# Commit render.yaml to repo, then connect in Render Dashboard

# 4. Create Vercel projects
vercel link --project=realflow-web
vercel link --project=realflow-portal

# 5. Add environment variables to Render + Vercel dashboards

# 6. Configure DNS for Resend
# Add SPF, DKIM, DMARC records to realflow.com.au

# 7. Configure OAuth providers
# Add redirect URLs to Google Cloud Console + Apple Developer Portal
```

### Continuous Deployment

**Git-based deployment (recommended):**

```bash
# Deploy to production
git checkout main
git push origin main

# Automatic deployments:
# - Render: Deploys API (if files in apps/api/** changed)
# - Vercel: Deploys web + portal (all pushes to main)

# Deploy preview (branch deployments)
git checkout -b feature/new-feature
git push origin feature/new-feature

# Automatic preview deployments:
# - Vercel: Creates preview URL (e.g., realflow-web-git-feature-new-feature-*.vercel.app)
# - Render: No preview (only main branch deploys by default)
```

**Manual deployment:**

```bash
# Deploy API to Render
render deploy --service realflow-api --branch main

# Deploy web app to Vercel
vercel --prod --cwd apps/web

# Deploy portal to Vercel
vercel --prod --cwd apps/portal
```

### Pre-Deployment Checklist

- [ ] All tests pass (`npm run test`)
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] No ESLint errors (`npm run lint`)
- [ ] Database migrations tested locally (`supabase db reset`)
- [ ] Environment variables set in Render + Vercel dashboards
- [ ] OAuth redirect URLs configured for production domains
- [ ] DNS records verified for Resend (SPF, DKIM, DMARC)
- [ ] Supabase RLS policies enabled (migration 00012)

### Monitoring & Rollback

**Render:**
- View logs: `render logs --service realflow-api --tail`
- Rollback: Render Dashboard > Deploys > Redeploy previous version

**Vercel:**
- View logs: Vercel Dashboard > Deployments > Select deployment > Logs
- Rollback: Vercel Dashboard > Deployments > Select previous deployment > Promote to Production

**Supabase:**
- View logs: Supabase Dashboard > Logs > Postgres logs
- Rollback migrations: Create new migration that reverts changes (never delete migrations)

---

## Additional Resources

### Documentation Links

- [Render Monorepo Support](https://render.com/docs/monorepo-support)
- [Render Blueprint YAML Reference](https://render.com/docs/blueprint-spec)
- [Render Health Checks](https://render.com/docs/health-checks)
- [Vercel Turborepo](https://vercel.com/solutions/turborepo)
- [Vercel Production Monorepos Academy](https://vercel.com/academy/production-monorepos)
- [Resend Supabase Integration](https://resend.com/supabase)
- [Resend Custom SMTP with Supabase](https://resend.com/docs/send-with-supabase-smtp)
- [Supabase Database Migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase Connection Pooling (Supavisor)](https://supabase.com/docs/guides/troubleshooting/supavisor-and-connection-terminology-explained-9pr_ZO)
- [Supabase OAuth Server Setup](https://supabase.com/docs/guides/auth/oauth-server/getting-started)
- [Fastify Health Check Plugin](https://www.npmjs.com/package/fastify-healthcheck)

### Cost Estimates (Alpha Phase)

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| **Render (API)** | Free | $0 |
| **Vercel (web + portal)** | Hobby | $0 |
| **Supabase** | Free | $0 |
| **Resend** | Free | $0 |
| **Total** | | **$0** |

**Notes:**
- Free tiers support ~20-50 alpha testers
- Upgrade to paid tiers before beta launch:
  - Render Starter: $7/mo
  - Vercel Pro: $20/mo (per team member)
  - Supabase Pro: $25/mo
  - Resend Pro: $20/mo
  - **Total:** ~$72/mo for beta

---

**Document Version:** 1.0.0
**Last Updated:** 2026-03-02
**Maintained By:** Backend Architecture Team
**Next Review:** Before beta launch
