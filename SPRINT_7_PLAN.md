# Sprint 7: Frontend Modernisation — Full Feature Plan

**Sprint:** 7
**Weeks:** 19–22
**Theme:** Polish the display layer so RealFlow looks as capable as it is
**Status:** Planning (Sprint 6 Growth & Scale in close/handoff)
**Planned:** 2026-03-09

---

## 1. Sprint Overview

### Goal

Sprint 6 shipped the last major backend capability — social leads, off-market properties, and team management. The system is now functionally complete for v1. Sprint 7 makes it worth showing to clients.

Buyers agents (persona: Lachlan) demo RealFlow on their phone during property inspections and compare it directly to Rex CRM and Agentbox. The gap is not features — it is visual maturity. Pipeline cards have no drag satisfaction. Loading states look broken. Portal `/progress` is a static list. Mobile components bypass the theme system entirely with hardcoded hex values.

Sprint 7 closes that gap with zero backend changes. Every file touched is in `apps/web`, `apps/portal`, `apps/mobile`, or `packages/ui`. No new API routes. No migrations. No new Supabase tables.

### Duration

4 weeks (Weeks 19–22), three parallel teams.

### Success Condition

A buyers agent can open RealFlow on their phone and laptop and feel no embarrassment showing it to a vendor principal or buyer client. The portal `/progress` page communicates momentum. The pipeline board is satisfying to use with a mouse and accessible by keyboard. Every mutation fires a toast. Dark mode works end-to-end with no flash of unstyled content.

---

## 2. Features to Deliver

All 11 features come directly from the signed-off discovery document at `docs/discovery/FRONTEND_MODERNISATION.md`.

| ID          | Feature                                                          | Complexity | Business Value                                           | Apps                |
| ----------- | ---------------------------------------------------------------- | ---------- | -------------------------------------------------------- | ------------------- |
| FEAT-UI-001 | Animated page entrance (Framer Motion)                           | Medium     | High — first impression on every navigation              | web                 |
| FEAT-UI-002 | Dark mode toggle (CSS vars + localStorage)                       | Medium     | High — night-time inspections, battery life              | web, portal         |
| FEAT-UI-003 | Pipeline drag-and-drop with animation (@dnd-kit + Framer Motion) | High       | Very High — signature interaction for agents             | web                 |
| FEAT-UI-004 | Skeleton loaders with shimmer entry/exit animation               | Low        | Medium — removes "broken" feeling during load            | web, portal, mobile |
| FEAT-UI-005 | Toast notification system (@radix-ui/react-toast)                | Medium     | Very High — every mutation needs feedback                | web, portal, mobile |
| FEAT-UI-006 | Portal progress timeline animation                               | Medium     | High — trust signal for buyer clients (Mei-Ling persona) | portal              |
| FEAT-UI-007 | Empty states with SVG illustration                               | Low        | Medium — eliminates blank-list confusion                 | web, portal, mobile |
| FEAT-UI-008 | Mobile micro-interactions (haptics + spring)                     | Medium     | High — native feel on Lachlan's iPhone 15                | mobile              |
| FEAT-UI-009 | Consistent typography scale                                      | Low        | Medium — information hierarchy, Grace persona            | web, portal, mobile |
| FEAT-UI-010 | Accessible focus rings                                           | Low        | High — DDA 1992 compliance, Grace (JAWS)                 | web, portal         |
| FEAT-UI-011 | Pipeline keyboard navigation                                     | Medium     | High — DDA 1992 compliance, pairs with FEAT-UI-003       | web                 |

**Complexity definitions:**

- Low: One component or CSS change, no new library, no state management
- Medium: New library integration or cross-component state
- High: New library + interaction model + accessibility requirements simultaneously

---

## 3. Parallel Team Structure

Sprint 7 has **zero inter-team file dependencies**. All three workstreams operate in parallel from Day 1.

File paths were verified against the live repository on 2026-03-09. No file appears in more than one team column.

| Team       | Features                                                                               | App Scope                 | Key Files Owned                                                                                                                                                                                                                                                                                                                           | Est. Effort |
| ---------- | -------------------------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **Team A** | UI-001, UI-002, UI-004, UI-005 (web), UI-007 (web), UI-009 (web), UI-010 (web)         | apps/web only             | `apps/web/src/app/globals.css`, `apps/web/src/lib/theme-context.tsx`, `apps/web/src/components/layout/sidebar.tsx`, `apps/web/src/components/dashboard/stat-card.tsx`, `apps/web/src/components/providers.tsx`                                                                                                                            | 12 dev-days |
| **Team B** | UI-003, UI-011                                                                         | apps/web — pipeline only  | `apps/web/src/components/pipeline/pipeline-board.tsx`, `apps/web/src/components/buyers-agent/ba-pipeline-board.tsx`                                                                                                                                                                                                                       | 8 dev-days  |
| **Team C** | UI-005 (portal+mobile), UI-006, UI-007 (portal+mobile), UI-008, UI-009 (portal+mobile) | apps/portal + apps/mobile | `apps/portal/src/components/timeline-step.tsx`, `apps/portal/src/app/(dashboard)/progress/page.tsx`, `apps/portal/src/components/providers.tsx`, `apps/mobile/src/components/ContactCard.tsx`, `apps/mobile/src/components/DealCard.tsx`, `apps/mobile/src/components/EmptyState.tsx`, `apps/mobile/src/components/QuickActionButton.tsx` | 11 dev-days |

**Total:** ~31 dev-days across 3 parallel tracks = comfortable fit for a 4-week sprint at solo-founder pace or 2-week sprint with a 2-person team.

### Shared-file conflict check

The only potential collision point is `apps/web/src/components/providers.tsx` (Team A) vs `apps/portal/src/components/providers.tsx` (Team C). These are in **separate apps** — different files, different build graphs, no conflict. Team B touches no providers file at all. Conflict check: PASSED.

---

## 4. Interface Contracts — Day 1 Agreement

Because Team A builds the toast system for web and Team C builds the toast system for portal and mobile, the **toast context API shape** must be agreed before either team writes a line of implementation code. Similarly, the `useReducedMotion` hook and `EmptyStateProps` interface must be locked on Day 1 so implementations do not diverge.

These are **not** new shared type files in `packages/shared/` (this is a display-only sprint). They are local contracts — each team implements the agreed interface independently in their own app. The contracts live in `packages/ui/src/` as interface-only exports (types and the single hook), so web, portal, and mobile all import from the same source of truth without the package adding runtime logic.

---

### Contract 1 — `useReducedMotion` hook

**Location:** Two separate implementations — do NOT attempt to unify them. `packages/ui` compiles to CommonJS for Node and has no access to browser globals or React Native APIs.

**⚠️ Architectural coupling risk resolved (Risk 2 from system-architect review):** Portal (Next.js, browser) and mobile (React Native) require different OS APIs. Mixing them causes a runtime crash. Keep them separate.

**Web + Portal implementation** (browser API):

```typescript
// apps/web/src/hooks/use-reduced-motion.ts
// Copy verbatim to apps/portal/src/hooks/use-reduced-motion.ts
'use client';
import { useEffect, useState } from 'react';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}
```

**Mobile implementation** (React Native API — Team C owns this):

```typescript
// apps/mobile/src/hooks/use-reduced-motion.ts
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}
```

**Rule:** Every Framer Motion `animate` prop and every Reanimated worklet must gate on `useReducedMotion()`. If it returns true, skip to final state immediately (duration: 0). Team C must import from `apps/mobile/src/hooks/use-reduced-motion.ts` on mobile — never from a browser-API hook.

---

### Contract 2 — Toast context API

**Location:** `packages/ui/src/types/toast.ts`

**Consumed by:** Team A (`apps/web`), Team C (`apps/portal`, `apps/mobile`)

```typescript
// packages/ui/src/types/toast.ts

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastPayload {
  /** Short message displayed to user. Max 120 chars. */
  message: string;
  /** Visual treatment and icon. Defaults to 'info'. */
  variant: ToastVariant;
  /**
   * Auto-dismiss after this many ms.
   * success: 3000, info: 3000, warning: 5000
   * error: undefined (requires manual dismiss)
   */
  duration?: number;
  /** Optional action label — shows a button inside the toast. */
  actionLabel?: string;
  /** Fires when actionLabel button is pressed. */
  onAction?: () => void;
}

export interface ToastContextValue {
  /** Push a new toast. Returns a unique toastId. */
  toast(payload: ToastPayload): string;
  /** Dismiss a specific toast by id. */
  dismiss(toastId: string): void;
  /** Dismiss all active toasts. */
  dismissAll(): void;
}
```

**Positioning contract:**

- Web (next.js): bottom-right viewport, 16px inset, z-index 9999
- Portal (next.js): bottom-right viewport, 16px inset, z-index 9999
- Mobile (React Native): bottom-center, `bottom: 24` safe-area-inset-aware

**Stack contract:** Toasts stack vertically (newest on top). Maximum 4 visible simultaneously. If a 5th fires, the oldest auto-dismisses regardless of its duration setting.

**Accessibility contract:** The toast container element has `role="status"` and `aria-live="polite"`. Error toasts use `aria-live="assertive"`. Mobile implementation uses `AccessibilityInfo.announceForAccessibility(message)`.

---

### Contract 3 — SVG empty state prop interface

**Location:** `packages/ui/src/types/empty-state.ts`

**Consumed by:** Team A (web empty states), Team C (portal + mobile empty states)

```typescript
// packages/ui/src/types/empty-state.ts

export type EmptyStateIllustration =
  | 'contacts'
  | 'properties'
  | 'pipeline'
  | 'alerts'
  | 'matches'
  | 'documents'
  | 'messages'
  | 'generic';

export interface EmptyStateProps {
  /** Which SVG illustration to render. */
  illustration: EmptyStateIllustration;
  /** Primary heading. E.g. "No contacts yet". */
  heading: string;
  /**
   * Optional supporting line below heading.
   * Legal note: must not imply records exist when they do not (ACL).
   */
  description?: string;
  /** Label for the primary CTA button. Omit to render no button. */
  actionLabel?: string;
  /** Fires when CTA button is pressed. */
  onAction?: () => void;
  /**
   * Width of the SVG illustration.
   * Web default: 180px. Mobile default: 140. Must work at 320px viewport.
   */
  illustrationWidth?: number;
}
```

**SVG source:** All illustrations live at `packages/ui/src/illustrations/` as `.svg` files imported as React components. The same SVG components are usable on web (via SVGR) and React Native (via `react-native-svg`). Team A and Team C both import from `@realflow/ui/illustrations`. Neither team creates their own SVG assets.

---

### Contract 4 — Dark mode class convention

Team A owns the implementation. Team C must not introduce any new hardcoded colour values that break when dark mode is applied. The agreed convention:

- Web/Portal: dark mode is toggled by adding/removing `class="dark"` on the `<html>` element
- All colour values must use CSS variables defined in `apps/web/src/app/globals.css` (Team A) and `apps/portal/src/app/globals.css` (Team C extends the same variable names)
- Tailwind `dark:` variants are permitted only for colours not expressible as CSS variables
- No `style={{ color: '#...' }}` inline hex values anywhere — Tailwind utility classes or CSS variables only

---

## 5. Database Migrations

None. This is a display-only sprint. No migrations required.

The highest existing migration number is `00023_round_robin_function.sql`. Sprint 7 does not add to this sequence.

---

## 6. Per-Team Breakdown

---

### Team A — Web Foundation + Motion Layer

**Features:** FEAT-UI-001, FEAT-UI-002, FEAT-UI-004, FEAT-UI-005 (web), FEAT-UI-007 (web), FEAT-UI-009 (web), FEAT-UI-010 (web)

**Goal:** Eliminate the dated feel of the web app. After Team A's work: dark mode works, toasts fire on every mutation, skeletons shimmer, page entrances animate, all lists have illustrated empty states, and every interactive element has a visible focus ring.

**Package installs (apps/web):**

```bash
npm install framer-motion@^11 @radix-ui/react-toast@^1 @radix-ui/react-dialog@^1 --workspace=apps/web
```

---

#### A.1 Shared UI Types + Illustrations (Day 1 — blocks both Team A and Team C)

Before any animation or toast code is written, Team A is responsible for landing the Day 1 type contracts into `packages/ui`.

**⚠️ packages/ui/src/index.ts ownership rule (Risk 5 from system-architect review):** One engineer (on Team A) owns `packages/ui/src/index.ts` for the entire sprint. Any team that needs a new export creates a tracking note and the owner adds it. This prevents duplicate-export merge conflicts. Team C does not touch this file directly.

**Files to create:**

`packages/ui/src/types/toast.ts` — per Contract 2 above
`packages/ui/src/types/empty-state.ts` — per Contract 3 above
`packages/ui/src/illustrations/` — SVG files for all 8 illustration variants (contacts, properties, pipeline, alerts, matches, documents, messages, generic)

**Note on useReducedMotion:** Per Contract 1 (above), the hook is platform-specific and lives in each app's `src/hooks/` directory, NOT in `packages/ui`. Do not add it to `packages/ui/src/index.ts`. Team A creates `apps/web/src/hooks/use-reduced-motion.ts`; Team C creates `apps/portal/src/hooks/use-reduced-motion.ts` (identical, browser API) and `apps/mobile/src/hooks/use-reduced-motion.ts` (React Native API).

Re-export `ToastVariant`, `ToastPayload`, `ToastContextValue`, `EmptyStateIllustration`, `EmptyStateProps` from `packages/ui/src/index.ts`.

**Team C is unblocked once these land on the shared branch and are merged.**

---

#### A.2 CSS Variable System — `apps/web/src/app/globals.css`

Complete the half-implemented HSL token system. Every colour currently hardcoded in Tailwind must become a CSS variable.

```css
/* apps/web/src/app/globals.css — additions */

:root {
  /* Brand */
  --color-primary-50: 220 100% 97%;
  --color-primary-100: 220 100% 93%;
  --color-primary-500: 220 90% 56%;
  --color-primary-600: 220 90% 48%;
  --color-primary-700: 220 90% 40%;

  /* Neutral */
  --color-neutral-50: 220 20% 98%;
  --color-neutral-100: 220 20% 95%;
  --color-neutral-200: 220 15% 88%;
  --color-neutral-700: 220 15% 30%;
  --color-neutral-900: 220 15% 10%;

  /* Semantic */
  --color-background: var(--color-neutral-50);
  --color-surface: 0 0% 100%;
  --color-text: var(--color-neutral-900);
  --color-text-muted: var(--color-neutral-700);
  --color-border: var(--color-neutral-200);
  --color-focus-ring: var(--color-primary-500);

  /* Status */
  --color-success: 142 72% 29%;
  --color-error: 0 84% 60%;
  --color-warning: 38 92% 50%;
}

.dark {
  --color-background: 220 15% 10%;
  --color-surface: 220 15% 14%;
  --color-text: 220 20% 95%;
  --color-text-muted: 220 15% 65%;
  --color-border: 220 15% 22%;
}

/* Typography scale — enforced globally */
h1 {
  font-size: 1.875rem;
  line-height: 1.2;
} /* 30px */
h2 {
  font-size: 1.5rem;
  line-height: 1.3;
} /* 24px */
h3 {
  font-size: 1.25rem;
  line-height: 1.4;
} /* 20px */
body {
  font-size: 1rem;
  line-height: 1.6;
} /* 16px */
small,
.text-sm {
  font-size: 0.875rem;
  line-height: 1.5;
} /* 14px */

/* Accessible focus rings — applied globally */
*:focus-visible {
  outline: 2px solid hsl(var(--color-focus-ring));
  outline-offset: 2px;
  border-radius: 2px;
}

/* Skeleton shimmer */
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    hsl(var(--color-neutral-200)) 25%,
    hsl(var(--color-neutral-100)) 50%,
    hsl(var(--color-neutral-200)) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

---

#### A.3 Dark Mode — `apps/web/src/lib/theme-context.tsx`

Replace the existing stub with a full implementation.

```typescript
// apps/web/src/lib/theme-context.tsx
'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system')
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    // Read persisted preference — runs before first paint via inline script in layout.tsx
    const stored = localStorage.getItem('realflow-theme') as Theme | null
    if (stored) setThemeState(stored)
  }, [])

  useEffect(() => {
    const apply = (t: Theme) => {
      const isDark =
        t === 'dark' ||
        (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.classList.toggle('dark', isDark)
      setResolvedTheme(isDark ? 'dark' : 'light')
    }
    apply(theme)

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => apply('system')
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [theme])

  const setTheme = (t: Theme) => {
    localStorage.setItem('realflow-theme', t)
    setThemeState(t)
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
```

**FOUC prevention:** Add an inline `<script>` to `apps/web/src/app/layout.tsx` that reads `localStorage.getItem('realflow-theme')` and sets the `dark` class on `<html>` synchronously before React hydrates. This is the standard Next.js pattern — the script runs before the first paint.

---

#### A.4 Sidebar Dark Mode Toggle — `apps/web/src/components/layout/sidebar.tsx`

Add a toggle button at the bottom of the sidebar that calls `setTheme()`. Cycles: light → dark → system. Displays sun icon (light), moon icon (dark), or monitor icon (system). Uses `useTheme()` hook. No new dependencies — icons from existing `lucide-react`.

---

#### A.5 Providers — `apps/web/src/components/providers.tsx`

Wrap the existing provider tree with `ThemeProvider` (outermost) and `ToastProvider` (below query client). Team B's DnD context mounts deeper in the tree on the pipeline page only — no conflict.

```typescript
// apps/web/src/components/providers.tsx — additions
import { ThemeProvider } from '@/lib/theme-context';
import { ToastProvider } from '@/components/ui/toast-provider';

// Wrap children: ThemeProvider > QueryClientProvider > ToastProvider > children
```

---

#### A.6 Toast System — `apps/web/src/components/ui/toast-provider.tsx`

Built on `@radix-ui/react-toast`. Implements `ToastContextValue` from Contract 2. Exports a `useToast()` hook. Every React Query `onSuccess` / `onError` mutation callback in `apps/web` must call `useToast().toast(...)`.

**Files:**

- `apps/web/src/components/ui/toast-provider.tsx` — context + Radix viewport
- `apps/web/src/components/ui/toast.tsx` — styled Radix Toast.Root component

**Mutation hook pattern** (each existing mutation hook in `apps/web/src/hooks/` must be updated):

```typescript
const { toast } = useToast();
const mutation = useMutation({
  mutationFn: createContact,
  onSuccess: () => toast({ message: 'Contact saved', variant: 'success' }),
  onError: (err) => toast({ message: err.message, variant: 'error' }),
});
```

---

#### A.7 Skeleton Loaders — `apps/web/src/components/ui/skeleton.tsx`

Replace any `animate-pulse` usage across `apps/web` with a `<Skeleton>` component that uses the `skeleton-shimmer` CSS class from `globals.css`. Add Framer Motion fade-out when data arrives.

```typescript
// apps/web/src/components/ui/skeleton.tsx
'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { useReducedMotion } from '@realflow/ui'

interface SkeletonProps {
  className?: string
  isLoading: boolean
  children: React.ReactNode
}

export function Skeleton({ className, isLoading, children }: SkeletonProps) {
  const reduced = useReducedMotion()
  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          key="skeleton"
          className={`skeleton-shimmer rounded ${className ?? ''}`}
          exit={reduced ? {} : { opacity: 0, transition: { duration: 0.2 } }}
          aria-hidden
        />
      ) : (
        <motion.div
          key="content"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

**Screens to update:** `apps/web/src/app/dashboard/page.tsx`, `apps/web/src/app/contacts/page.tsx`, `apps/web/src/app/properties/page.tsx`.

---

#### A.8 Page Entrance Animation — `apps/web/src/components/layout/page-motion.tsx`

```typescript
// apps/web/src/components/layout/page-motion.tsx
'use client'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@realflow/ui'

const stagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

export const rowVariants = {
  hidden: { opacity: 0, y: 8 },
  show:  { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
}

export function PageMotion({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion()
  if (reduced) return <>{children}</>
  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      {children}
    </motion.div>
  )
}

export function RowMotion({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion()
  if (reduced) return <>{children}</>
  return <motion.div variants={rowVariants}>{children}</motion.div>
}
```

Wrap list-rendering pages (`/contacts`, `/properties`, `/dashboard`, `/pipeline` column cards) with `<PageMotion>` and individual rows/cards with `<RowMotion>`.

---

#### A.9 Empty States (Web) — `apps/web/src/components/ui/empty-state.tsx`

Implements `EmptyStateProps` from Contract 3. Imports SVG illustrations from `@realflow/ui/illustrations`. Apply to: contacts list, properties list, pipeline columns, alerts list.

---

#### A.10 Focus Rings + Typography (Web)

Focus rings are applied globally via `globals.css` (Section A.2). No per-component changes needed except removing any `outline: none` overrides. Grep `apps/web` for `outline-none` and `outline: none` — remove or replace with `focus-visible:` variants only.

Typography scale applied globally via `globals.css` h1–h3 rules. Audit `apps/web` components for raw `style={{ fontSize: '...' }}` and replace with Tailwind `text-*` utilities.

---

#### A.11 Tests — Team A (Target: 22+ new tests)

| File                                                 | Tests                                                                                                                                                          | Count |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `apps/web/src/lib/theme-context.test.tsx`            | ThemeProvider persists to localStorage, resolves system preference, toggles dark class on html element                                                         | 6     |
| `apps/web/src/components/ui/toast-provider.test.tsx` | toast() returns id, dismiss() removes toast, dismissAll() clears queue, error toasts require manual dismiss, success toasts auto-dismiss after 3s, stack max 4 | 6     |
| `apps/web/src/components/ui/skeleton.test.tsx`       | renders shimmer when isLoading=true, crossfades to children when isLoading=false, skips animation when reduced motion                                          | 3     |
| `apps/web/src/components/ui/empty-state.test.tsx`    | renders heading, renders description, renders action button, calls onAction, renders correct illustration, works at 320px                                      | 5     |
| `packages/ui/src/hooks/use-reduced-motion.test.ts`   | returns false when no preference, returns true when prefers-reduced-motion matches                                                                             | 2     |

---

#### A.12 Exit Criteria — Team A

- [ ] Dark mode toggles without flash of unstyled content on hard reload
- [ ] `localStorage('realflow-theme')` persists across tabs
- [ ] All text in dark mode passes WCAG AA 4.5:1 contrast (verified by axe-core)
- [ ] Skeleton shimmer runs left-to-right; crossfade to content in 200ms; CLS = 0
- [ ] Page rows stagger in on navigation in <= 300ms total
- [ ] Toast fires on every create/update/delete mutation in apps/web
- [ ] Success toasts auto-dismiss at 3s; error toasts require manual dismiss
- [ ] `axe-core` reports zero `focus-visible` violations across all web pages
- [ ] All h1/h2/h3/body/small sizes match the typography scale spec exactly
- [ ] Zero `outline: none` without a `focus-visible:` replacement anywhere in apps/web
- [ ] 22+ new tests passing; total test suite still 1391+ with zero regressions

---

---

### Team B — Pipeline Interaction + Accessibility

**Features:** FEAT-UI-003, FEAT-UI-011

**Goal:** Make the pipeline board the signature interaction of RealFlow — satisfying to use with a mouse and fully accessible by keyboard. Team B touches exactly two files throughout the sprint.

**Package installs (apps/web):**

```bash
npm install @dnd-kit/core@^6 @dnd-kit/sortable@^7 --workspace=apps/web
```

Note: `framer-motion` is installed by Team A at sprint start. Team B can import from it immediately after Team A's Day 1 package install lands.

---

#### B.1 Files Owned

- `apps/web/src/components/pipeline/pipeline-board.tsx`
- `apps/web/src/components/buyers-agent/ba-pipeline-board.tsx`

No other files. Team B reads `apps/web/src/hooks/use-transactions.ts` and `apps/web/src/hooks/use-client-briefs.ts` to understand mutation patterns but does not modify them.

---

#### B.2 Pipeline Drag-and-Drop Architecture

Replace the existing HTML5 drag-and-drop (or static rendering) with `@dnd-kit`.

**Key design decisions:**

- `DndContext` wraps the entire board
- Each column is a `SortableContext` with `horizontalListSortingStrategy`
- Each card is a `useSortable` element
- On `onDragEnd`: call the existing `useMutation` → `PUT /api/v1/transactions/:id` with new stage
- Optimistic update: move card in local state immediately, roll back on 422
- 422 rollback: animate card back to origin column using Framer Motion layout animation

**Card lift animation** (Framer Motion `layoutId`):

```typescript
// Inside the draggable card component
<motion.div
  layoutId={`card-${transaction.id}`}
  style={{
    boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.15)' : undefined,
    scale: isDragging ? 1.05 : 1,
    zIndex: isDragging ? 50 : undefined,
    cursor: isDragging ? 'grabbing' : 'grab',
  }}
  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
>
```

**Drop zone highlight:**

```typescript
// Column component receives isOver prop from useDroppable
<div
  className={`pipeline-column transition-colors duration-150 ${
    isOver ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/20' : ''
  }`}
>
```

**422 rollback pattern:**

```typescript
onError: (err, variables, context) => {
  // Restore previous stage in local state
  queryClient.setQueryData(['transactions'], context?.previousTransactions);
  // Toast the error message
  toast({ message: err.message ?? 'Invalid stage transition', variant: 'error' });
};
```

---

#### B.3 Pipeline Keyboard Navigation (FEAT-UI-011)

Implemented as a custom keyboard handler layered on top of the @dnd-kit keyboard sensor.

@dnd-kit ships a `KeyboardSensor` — enable it alongside the default `PointerSensor`:

```typescript
const sensors = useSensors(
  useSensor(PointerSensor),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  }),
);
```

**Keyboard behaviour spec (from FEAT-UI-011 acceptance criteria):**

- `Space` on a card: enter move mode (`aria-grabbed="true"`)
- `ArrowLeft` / `ArrowRight`: move card to adjacent column
- `Enter`: confirm drop → fires `PUT /api/v1/transactions/:id`
- `Escape`: cancel, return card to origin column

**Accessible live region** (added to board root):

```html
<div aria-live="polite" aria-atomic="true" className="sr-only" id="pipeline-announcer">
  <!-- Populated by JS: "Card moved to Inspection" -->
</div>
```

Apply the same keyboard sensor and aria pattern to `ba-pipeline-board.tsx` for the buyers agent pipeline.

---

#### B.4 AML + Animation Constraint

The discovery doc notes: AML check records must display in chronological order — no reordering by animation stagger. The pipeline boards do not display AML records. However, if a future sprint adds AML status badges to pipeline cards, the drag-and-drop must not reorder AML-timestamped records for display purposes. Team B documents this constraint in a code comment on the `onDragEnd` handler.

---

#### B.5 Tests — Team B (Target: 14+ new tests)

| File                                                              | Tests                                                                                                                                                                                                                                                                                                                                | Count |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| `apps/web/src/components/pipeline/pipeline-board.test.tsx`        | renders columns, card appears in correct column, onDragEnd fires PUT mutation, 422 rolls back card to origin column, toast fires on 422, drop zone highlights on hover, keyboard Space enters move mode, ArrowRight moves card to next column, Enter confirms drop, Escape cancels and restores position, live region announces move | 11    |
| `apps/web/src/components/buyers-agent/ba-pipeline-board.test.tsx` | renders BA pipeline columns, keyboard navigation works, 422 rollback works                                                                                                                                                                                                                                                           | 3     |

---

#### B.6 Exit Criteria — Team B

- [ ] Dragging a card from one column to another fires `PUT /api/v1/transactions/:id` immediately (optimistic)
- [ ] Card lifts with 1.05x scale and elevated shadow on pick-up
- [ ] Drop zone column shows ring highlight when card is dragged over it
- [ ] Card snaps into position with spring animation (stiffness 300, damping 30) on drop
- [ ] 422 response from API rolls card back to origin column with animation
- [ ] 422 error message displays in a toast for >= 4s (requires manual dismiss)
- [ ] `Space` on a focused card enters move mode with `aria-grabbed="true"` announced
- [ ] `ArrowLeft` / `ArrowRight` move card between columns
- [ ] `Enter` confirms drop and fires PUT mutation
- [ ] `Escape` cancels and restores card to origin column without a PUT call
- [ ] Live region announces "Card moved to [Stage Name]" on keyboard drop
- [ ] Both `pipeline-board.tsx` and `ba-pipeline-board.tsx` implement all of the above
- [ ] 14+ new tests passing; zero regressions in existing test suite

---

---

### Team C — Portal + Mobile

**Features:** FEAT-UI-005 (portal + mobile), FEAT-UI-006, FEAT-UI-007 (portal + mobile), FEAT-UI-008, FEAT-UI-009 (portal + mobile)

**Goal:** Give Mei-Ling a portal that communicates momentum. Give Lachlan a mobile app that feels native. Eliminate all hardcoded hex colours from mobile components.

**Package installs:**

```bash
# apps/portal
npm install framer-motion@^11 @radix-ui/react-toast@^1 @radix-ui/react-dialog@^1 --workspace=apps/portal

# apps/mobile — verify react-native-reanimated is already in package.json before installing
npm install expo-haptics@~14 --workspace=apps/mobile
# If react-native-reanimated is not present:
# npm install react-native-reanimated@~3 --workspace=apps/mobile
```

**Before EAS build:** Add to `apps/mobile/app.json`:

```json
{
  "expo": {
    "plugins": [["expo-haptics", {}]],
    "ios": {
      "infoPlist": {
        "NSMotionUsageDescription": "RealFlow uses haptic feedback to confirm actions."
      }
    },
    "android": {
      "permissions": ["android.permission.VIBRATE"]
    }
  }
}
```

---

#### C.1 Portal Toast System — `apps/portal/src/components/providers.tsx`

Implement `ToastContextValue` from Contract 2 using `@radix-ui/react-toast`.

**Files:**

- `apps/portal/src/components/ui/toast-provider.tsx`
- `apps/portal/src/components/ui/toast.tsx`

The implementation is structurally identical to Team A's web toast — same `ToastPayload` type, same positioning (bottom-right), same stack limit of 4. Team C imports the type from `@realflow/ui/types/toast`. They do not copy-paste the type definition.

Add `ToastProvider` to `apps/portal/src/components/providers.tsx` (wraps existing query client provider).

Every React Query mutation in `apps/portal/src/hooks/` must call `useToast().toast()` on success and error.

---

#### C.2 Portal Progress Timeline Animation — `apps/portal/src/components/timeline-step.tsx`

This is the highest-value visual change for the Mei-Ling persona. The existing `timeline-step.tsx` renders a static list. Team C replaces it with an animated version using Framer Motion.

```typescript
// apps/portal/src/components/timeline-step.tsx
'use client'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@realflow/ui'

type StepStatus = 'completed' | 'current' | 'future'

interface TimelineStepProps {
  label: string
  status: StepStatus
  /** True when this step was completed since the user's last login (triggers entry animation) */
  isNewlyCompleted: boolean
  index: number
}

export function TimelineStep({ label, status, isNewlyCompleted, index }: TimelineStepProps) {
  const reduced = useReducedMotion()

  const checkmarkVariants = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: {
      pathLength: 1,
      opacity: 1,
      transition: { duration: reduced ? 0 : 0.3, ease: 'easeOut', delay: index * 0.08 },
    },
  }

  return (
    <div className="flex items-center gap-3">
      <motion.div
        className={`w-8 h-8 rounded-full flex items-center justify-center ${
          status === 'completed' ? 'bg-success text-white' :
          status === 'current'   ? 'bg-primary-500 text-white' :
          'bg-neutral-200 text-neutral-400'
        }`}
        animate={
          status === 'current' && !reduced
            ? { opacity: [0.7, 1, 0.7], transition: { duration: 1, repeat: Infinity } }
            : { opacity: 1 }
        }
      >
        {status === 'completed' && (
          <motion.svg
            viewBox="0 0 16 16"
            initial={isNewlyCompleted ? 'hidden' : 'visible'}
            animate="visible"
          >
            <motion.path
              d="M3 8l3.5 3.5L13 5"
              stroke="currentColor"
              strokeWidth={2}
              fill="none"
              variants={checkmarkVariants}
            />
          </motion.svg>
        )}
      </motion.div>
      <span
        className={
          status === 'completed' ? 'text-text font-medium' :
          status === 'current'   ? 'text-primary-600 font-semibold' :
          'text-text-muted'
        }
      >
        {label}
      </span>
    </div>
  )
}
```

Update `apps/portal/src/app/(dashboard)/progress/page.tsx` to pass `isNewlyCompleted` derived from comparing current stage against the stage stored in the user's session at last login. Last-login stage can be read from `portal_clients.last_seen_at` (already in schema from Sprint 5) — no schema change needed.

---

#### C.3 Portal Dark Mode — `apps/portal/src/app/globals.css`

Mirror Team A's CSS variable system. Same variable names, same dark class convention. Team C does not write the variable definitions from scratch — they are copied from Team A's PR once it lands.

**⚠️ Tailwind config audit required (Risk 4 from system-architect review):** `apps/portal/tailwind.config.ts` is currently minimal — it does not have the same `extend` block as `apps/web/tailwind.config.ts`. Before Team C writes any portal animation code, they must audit every new Tailwind class against `apps/portal/tailwind.config.ts` and add missing entries. Key classes to verify are present: `animate-shimmer`, `transition-transform`, `duration-150`, `duration-200`, `duration-300`, `ease-out`, `ring-2`, `ring-primary-500`, and any `dark:` variants used. If a class is in web's config but not portal's, add it to `apps/portal/tailwind.config.ts` before opening the portal PR.

**⚠️ CSS variable names must be identical (Risk 6 from system-architect review):** Team A publishes the canonical CSS variable name list (as a comment block at the top of `apps/web/src/app/globals.css`) before Team C starts portal work. Portal tokens must use the exact same names: `--color-background`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-border`, `--color-focus-ring`, `--color-success`, `--color-error`, `--color-warning`. Portal-specific tokens use a `--portal-` prefix. This ensures any component that migrates from web to portal in a future sprint themes correctly.

The portal sidebar (`apps/portal/src/components/sidebar-nav.tsx`) gets a dark mode toggle using a local `ThemeProvider` with the same API as the web version (since portal and web share no runtime code today).

---

#### C.4 Portal Empty States — `apps/portal/src/components/empty-state.tsx`

The portal already has an `apps/portal/src/components/empty-state.tsx` file. Team C upgrades it to implement `EmptyStateProps` from Contract 3, replacing the existing stub with SVG illustrations from `@realflow/ui/illustrations`.

Apply to portal pages: property matches list, documents list, messages list.

---

#### C.5 Portal Typography + Focus Rings

Same approach as Team A. Complete `apps/portal/src/app/globals.css` with the typography scale and `*:focus-visible` rule. Remove any `outline: none` without `focus-visible:` replacement.

---

#### C.6 Mobile NativeWind Migration — `ContactCard.tsx` + `DealCard.tsx`

Both files currently use `StyleSheet.create` with hardcoded hex values. Migrate to NativeWind `className` props using existing theme tokens.

```typescript
// BEFORE (apps/mobile/src/components/ContactCard.tsx)
const styles = StyleSheet.create({
  container: { backgroundColor: '#ffffff', borderColor: '#e5e7eb' },
  name: { color: '#111827', fontSize: 16 },
  role: { color: '#6b7280', fontSize: 14 },
});

// AFTER
// Remove StyleSheet.create entirely.
// Replace with className props using NativeWind utilities:
// container: className="bg-surface border border-border"
// name:      className="text-text text-base font-medium"
// role:      className="text-text-muted text-sm"
```

Do the same for `DealCard.tsx`. After migration: zero hex literals in either file.

---

#### C.7 Mobile Micro-interactions — `QuickActionButton.tsx`

```typescript
// apps/mobile/src/components/QuickActionButton.tsx
import { Pressable } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { useReducedMotion } from '@/hooks/use-reduced-motion' // mobile RN implementation

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export function QuickActionButton({ onPress, children, ...props }) {
  const scale = useSharedValue(1)
  const reduced = useReducedMotion() // mobile hook — uses AccessibilityInfo, not window.matchMedia

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <AnimatedPressable
      style={[animatedStyle]}
      onPressIn={() => {
        if (!reduced) scale.value = withSpring(0.96, { stiffness: 400, damping: 25 })
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { stiffness: 400, damping: 25 })
      }}
      onPress={onPress}
      {...props}
    >
      {children}
    </AnimatedPressable>
  )
}
```

Apply the same pattern to the pipeline card press interaction in `apps/mobile/src/app/(tabs)/pipeline.tsx` and `ba-pipeline.tsx`.

Note: Haptics fires on `onPressIn`, not `onPress`, so tactile feedback arrives within the 100ms target from the acceptance criteria. The haptic call is wrapped in a try/catch — on Android devices with vibration disabled in system settings, the call is silently skipped.

---

#### C.8 Mobile Toast System

`apps/mobile/src/components/Toast.tsx` — a React Native component that reads from a `ToastContext` (same API as Contract 2, implemented with `useSharedValue` for slide-in animation).

Because React Native cannot use Radix UI, Team C implements the mobile toast independently, but must satisfy the same `ToastContextValue` interface from `@realflow/ui/types/toast`. This means any shared hook that calls `useToast()` will work identically on web and mobile.

**Positioning:** `bottom: 24` + `SafeAreaView` inset-aware. Centered horizontally.

**Entry animation:** Slide up from `bottom: -80` to `bottom: 24` using `withSpring`.

Update `apps/mobile/src/app/(tabs)/alerts/index.tsx` and other mutation-firing screens to call `useToast()` on success and error.

---

#### C.9 Mobile Empty States

`apps/mobile/src/components/EmptyState.tsx` already exists. Upgrade it to implement `EmptyStateProps` from Contract 3. The `illustration` prop maps to an SVG component from `@realflow/ui/illustrations` (via `react-native-svg`).

Apply to: `(tabs)/contacts.tsx`, `(tabs)/pipeline.tsx`, `alerts/index.tsx`.

---

#### C.10 Tests — Team C (Target: 18+ new tests)

| File                                                    | Tests                                                                                                                                                                                     | Count |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `apps/portal/src/components/timeline-step.test.tsx`     | completed step renders checkmark, current step pulses, future step renders muted, newly completed step animates checkmark path, reduced motion skips animation, index prop staggers delay | 6     |
| `apps/portal/src/components/ui/toast-provider.test.tsx` | toast() fires, dismiss() works, error toast has no auto-dismiss, same API as web contract                                                                                                 | 4     |
| `apps/mobile/src/components/QuickActionButton.test.tsx` | scale animates on press, haptic fires on pressIn, haptic skipped when reduced motion, onPress still fires when haptic fails                                                               | 4     |
| `apps/mobile/src/components/EmptyState.test.tsx`        | renders heading, renders action button, calls onAction, matches snapshot at 320px width                                                                                                   | 4     |

---

#### C.11 Exit Criteria — Team C

- [ ] Portal `/progress` page: completed stages show animated checkmark, current stage pulses, newly-completed stages animate on first render after login, previously-completed stages do not re-animate
- [ ] Portal toast fires on every mutation (document upload, message send, at minimum)
- [ ] Portal empty states show illustrations on property matches, documents, messages lists
- [ ] Portal dark mode toggle persists preference and applies before first paint
- [ ] `ContactCard.tsx` and `DealCard.tsx` contain zero `StyleSheet.create` calls and zero hex literals
- [ ] `QuickActionButton` spring animation runs on UI thread (Reanimated Profiler shows no JS-thread frames)
- [ ] Haptic fires on `onPressIn` within 100ms of tap on physical iOS device
- [ ] Mobile toast appears bottom-centre, stacks correctly, success auto-dismisses at 3s
- [ ] Mobile empty states display on contacts, pipeline, and alerts screens
- [ ] 18+ new tests passing; zero regressions in existing test suite

---

## 7. Test Baseline

### Sprint Start Baseline

| Package                    | Passing  | Total    |
| -------------------------- | -------- | -------- |
| `@realflow/shared`         | 168      | 168      |
| `@realflow/business-logic` | 774      | 774      |
| `@realflow/integrations`   | 122      | 122      |
| `apps/api`                 | 327      | 327      |
| **Total**                  | **1391** | **1391** |

Sprint 7 is display-only. Zero business-logic, shared, integrations, or API tests change.

### Sprint Target

| Package                    | Sprint Start | New Tests | Sprint End Target |
| -------------------------- | ------------ | --------- | ----------------- |
| `@realflow/shared`         | 168          | 0         | 168               |
| `@realflow/business-logic` | 774          | 0         | 774               |
| `@realflow/integrations`   | 122          | 0         | 122               |
| `apps/api`                 | 327          | 0         | 327               |
| `apps/web` (new)           | 0            | 36        | 36                |
| `apps/portal` (new)        | 0            | 10        | 10                |
| `apps/mobile` (new)        | 0            | 8         | 8                 |
| `packages/ui` (new)        | 0            | 2         | 2                 |
| **Total**                  | **1391**     | **56**    | **1447**          |

Team breakdown: Team A contributes 22, Team B contributes 14, Team C contributes 18, packages/ui hook contributes 2.

**Guard:** Any PR that reduces the 1391 baseline count requires an explicit written justification approved before merge. Zero tolerance for silent test regressions during a polish sprint.

### Test tooling note

`apps/web`, `apps/portal`, and `apps/mobile` currently have no Vitest/Jest config. Each team must add a `vitest.config.ts` (web, portal) or `jest.config.ts` (mobile/Expo) as part of their Day 1 setup. Component tests use `@testing-library/react` + `jsdom` (web/portal) and `@testing-library/react-native` (mobile). Animation mocks: mock `framer-motion` to return children directly in test environment; mock `react-native-reanimated` with the official `__mocks__` package.

---

## 8. Success Metrics

These are the acceptance gates for sprint close. All must pass before the sprint is marked complete.

### Performance (Lighthouse CI — run against staging)

| Metric                         | Baseline | Target                             | Measurement                   |
| ------------------------------ | -------- | ---------------------------------- | ----------------------------- |
| Largest Contentful Paint (web) | Unknown  | < 1.5s                             | Lighthouse CI on `/dashboard` |
| Total Blocking Time (web)      | Unknown  | < 200ms                            | Lighthouse CI on `/dashboard` |
| Cumulative Layout Shift (web)  | Unknown  | 0 on skeleton → content transition | Lighthouse CI                 |
| First Input Delay (mobile)     | Unknown  | < 100ms tap-to-feedback            | Expo Profiler                 |

### Accessibility (axe-core CI gate)

| Check                                      | Target                                                             |
| ------------------------------------------ | ------------------------------------------------------------------ |
| Critical violations across all web pages   | 0                                                                  |
| Serious violations across all web pages    | 0                                                                  |
| `focus-visible` violations                 | 0                                                                  |
| Pipeline drag-and-drop keyboard accessible | All FEAT-UI-011 acceptance criteria pass                           |
| WCAG AA contrast in dark mode              | All text elements pass (4.5:1 for normal text, 3:1 for large text) |

### Feature acceptance

| Feature                                  | Acceptance Gate                                                                                                                                                                     |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dark mode (FEAT-UI-002)                  | Toggle works, persists in localStorage, no FOUC on hard reload, dark mode active in both web and portal                                                                             |
| Toast on every mutation (FEAT-UI-005)    | Code-reviewed: every `useMutation` in apps/web and apps/portal has an `onSuccess` and `onError` toast call                                                                          |
| Portal timeline (FEAT-UI-006)            | Newly completed stages animate checkmark on first load after login; previously completed stages do not re-animate                                                                   |
| Pipeline D&D (FEAT-UI-003)               | Drag-and-drop works on desktop, 422 rolls back with animation and toast, keyboard navigation satisfies all FEAT-UI-011 ACs                                                          |
| Mobile haptics (FEAT-UI-008)             | Verified on physical iOS device (simulator does not produce haptics); spring animation runs on UI thread                                                                            |
| No hardcoded hex in mobile (FEAT-UI-009) | `grep -r '#[0-9a-fA-F]\{3,6\}' apps/mobile/src/components/` returns zero results                                                                                                    |
| Reduced motion respected                 | All animations skip to final state when `prefers-reduced-motion: reduce` is set at OS level                                                                                         |
| Bundle size guard                        | `framer-motion` + `@dnd-kit/core` + `@dnd-kit/sortable` + `@radix-ui/react-toast` + `@radix-ui/react-dialog` add no more than 130KB gzip to the web bundle (`next build --analyze`) |

### Deployment gate

- Staging deploy passes with all 1447 tests green
- Lighthouse CI score does not regress versus Sprint 6 staging baseline
- `axe-core` CI job is added to `.github/workflows/ci.yml` as a required check before this sprint is closed

---

## Appendix: Day 1 Checklist

The following must be complete before any team writes feature code:

- [ ] Team A installs `framer-motion`, `@radix-ui/react-toast`, `@radix-ui/react-dialog` in `apps/web`
- [ ] Team A lands `packages/ui/src/hooks/use-reduced-motion.ts` (Contract 1) — Team C is blocked until this merges
- [ ] Team A lands `packages/ui/src/types/toast.ts` (Contract 2) — Team C is blocked until this merges
- [ ] Team A lands `packages/ui/src/types/empty-state.ts` (Contract 3) — Team C is blocked until this merges
- [ ] Team A lands `packages/ui/src/illustrations/` with all 8 SVG files — Team C is blocked until this merges
- [ ] Team C installs `framer-motion`, `@radix-ui/react-toast`, `@radix-ui/react-dialog` in `apps/portal`
- [ ] Team C installs `expo-haptics` in `apps/mobile` and adds `app.json` permissions
- [ ] Team C verifies `react-native-reanimated` is present in `apps/mobile/package.json`
- [ ] Team B installs `@dnd-kit/core` and `@dnd-kit/sortable` in `apps/web` (coordinate with Team A to avoid duplicate install steps)
- [ ] All teams add Vitest/Jest config to their respective apps
- [ ] Dark mode class convention agreed (Section 4, Contract 4) — documented in this plan, no further sign-off needed
- [ ] **packages/ui owner designated** (Risk 5): One engineer on Team A is named as sole owner of `packages/ui/src/index.ts` for the sprint duration. No other PR may touch this file without routing through the owner.
- [ ] **Team A publishes CSS variable list** (Risk 6): After completing Section A.2, Team A adds a canonical variable list comment block to the top of `apps/web/src/app/globals.css` and posts it in the team channel. Team C reads this list before writing any portal CSS. Team C must not start portal animation work until this is done.
- [ ] **Team C confirms hook strategy** (Risk 2): Team C explicitly acknowledges they are writing two `useReducedMotion` hooks — one browser hook for portal (`window.matchMedia`), one React Native hook for mobile (`AccessibilityInfo`). Never import the browser hook into a React Native file.

---

## Appendix: Out-of-Scope (from Discovery Document)

These items are explicitly excluded from Sprint 7 and must not creep in:

| Item                              | Where it belongs                           |
| --------------------------------- | ------------------------------------------ |
| New routes or pages               | Not in scope                               |
| Recharts replacement              | Separate charting spike                    |
| Storybook component docs          | Separate tooling sprint                    |
| White-label / multi-theme         | Commercial decision, Sprint 9+             |
| i18n / localisation               | Not in v1 scope                            |
| New Supabase tables or migrations | Sprint 7 is display-only — blocked         |
| Backend API changes               | Sprint 7 is display-only — blocked         |
| A/B testing framework             | v1.5                                       |
| Push notification UI redesign     | Mobile notifications sprint                |
| Native splash screen redesign     | Expo managed workflow                      |
| Auction date cron alerts          | Deferred from Sprint 5, Sprint 8 candidate |

---

_Sprint plan authored 2026-03-09. Discovery sign-off required from Product Owner, Engineering Lead, QA Engineer, and Legal before BUILD phase begins._
