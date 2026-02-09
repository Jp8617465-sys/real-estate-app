# Vercel Deployment Setup for RealFlow

## ✅ Local Build Status: WORKING
- All packages build successfully
- Next.js production build completes in ~34s
- Output generates at `apps/web/.next/`

## 🚀 Vercel Configuration (Required Steps)

### The Problem
Vercel's automatic Turborepo detection conflicts with manual `vercel.json` configuration, causing path resolution issues where Vercel looks for output in the wrong directory.

### The Solution: Use Vercel's Root Directory Setting

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

### Why This Works

1. **Vercel auto-detects Next.js** in `apps/web/`
2. **Turbo caching still works** via Vercel's built-in integration
3. **No path resolution conflicts** because Vercel builds from the app directory
4. **Official Vercel + Turborepo pattern** (most reliable)

### Alternative: Build from Root (Advanced)

If you must build from the monorepo root, you need to:
1. Remove all vercel.json configuration
2. Let Vercel auto-detect Turborepo
3. Configure which app to deploy via Vercel's UI

**Note:** This approach has path resolution issues and is not recommended.

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
