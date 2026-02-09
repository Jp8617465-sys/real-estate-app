# Vercel Deployment Setup for RealFlow

## ✅ Local Build Status: WORKING
- All packages build successfully
- Next.js production build completes in ~34s
- Output generates at `apps/web/.next/`

## 🚀 Vercel Configuration (Required Steps)

### The Problem
Vercel's automatic Turborepo detection conflicts with manual `vercel.json` configuration, causing path resolution issues where Vercel looks for output in the wrong directory.

### The Solution: Use Vercel's Root Directory Setting (Official Recommendation)

**Source**: [Vercel Monorepo Documentation](https://vercel.com/docs/monorepos) (Updated Dec 2025)

1. **Go to your Vercel project dashboard**
   - Navigate to: Project Settings → General

2. **Set the Root Directory**
   - Click "Edit" next to "Root Directory"
   - Set value to: `apps/web`
   - Click "Save"

3. **Configure Build Settings (Optional)**
   - Build Command: (leave empty - auto-detected)
   - Output Directory: (leave empty - auto-detected)
   - Install Command: (leave empty - auto-detected)

4. **Environment Variables**
   - Ensure any required env vars are set:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`

### Why This Works (Verified Against Official Docs)

1. **Vercel auto-detects Next.js** in `apps/web/` - zero config needed
2. **Turbo remote caching is automatic** - Vercel enables it by default for Turborepo projects
3. **No path resolution conflicts** - building from app directory avoids monorepo root issues
4. **Prevents unnecessary rebuilds** - setting Root Directory to monorepo root would rebuild ALL apps
5. **Official Vercel + Turborepo pattern** (recommended by Vercel engineering team)

**Official Sources:**
- [Vercel Monorepo Docs](https://vercel.com/docs/monorepos)
- [Vercel Turborepo Integration](https://vercel.com/docs/monorepos/turborepo)
- [Turborepo on Vercel Guide](https://turborepo.dev/docs/guides/ci-vendors/vercel)

### ❌ What NOT to Do (According to Official Docs)

**Don't set Root Directory to monorepo root** - This causes ALL apps to rebuild on every deployment, wasting build minutes and time. [Source: Vercel Monorepo FAQ](https://vercel.com/docs/monorepos/monorepo-faq)

**Don't use `outputDirectory` in vercel.json for Next.js** - Vercel handles Next.js output automatically. This setting is for static builds only. [Source: Vercel Project Configuration](https://vercel.com/docs/project-configuration)

**Don't manually configure build commands** - Vercel's zero-config integration with Turborepo works best when you let it auto-detect. [Source: Vercel Turborepo Docs](https://vercel.com/docs/monorepos/turborepo)

## 📦 Pre-Deploy Checklist

Before pushing to GitHub/Vercel:
- [ ] `npm install` completes successfully
- [ ] `npm run build` completes successfully (or `npx turbo run build --filter=@realflow/web`)
- [ ] `apps/web/.next/` directory exists
- [ ] Vercel Root Directory is set to `apps/web`
- [ ] All environment variables are configured in Vercel

## 🔧 Commands to Test Locally

```bash
# Install dependencies
npm install

# Build the web app
npx turbo run build --filter=@realflow/web

# Verify output exists
ls -la apps/web/.next/

# Run the production build locally
cd apps/web && npm run start
```

## 📝 Summary

**What Changed:**
- ❌ Removed `vercel.json` (was causing path conflicts)
- ✅ Local builds work perfectly
- ✅ Next step: Configure Vercel dashboard Root Directory to `apps/web`

**Expected Result:**
Once Root Directory is set in Vercel dashboard, deployments will succeed without any path resolution issues.
