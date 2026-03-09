# Frontend Modernisation — Discovery Document

**Status:** DRAFT
**Date:** 2026-03-08
**Feature Slug:** `FRONTEND_MODERNISATION`
**Sprint Target:** Sprint 7 (post Sprint 6 Growth & Scale close)

---

## 1. Feature Framing

### Problem Statement

RealFlow's backend is mature (Sprints 1–6: AI, communications, automation, data integrations, client portal, social leads, off-market, team management). The frontend surfaces a capable system behind a dated, unanimated shell. Specifically:

- `pipeline-board.tsx` renders hardcoded seed data with no motion on drag/drop
- Skeleton loaders use static `animate-pulse` with no entry or exit choreography
- Mobile components (`ContactCard.tsx`, `DealCard.tsx`) use inline hex strings in `StyleSheet.create` — bypassing the theme system entirely
- `theme-switcher.tsx` is a stub with no dark mode implementation
- `globals.css` CSS variable system is half-implemented (HSL tokens defined but many components hardcode Tailwind colours)
- Zero third-party animation library — no Framer Motion, no Reanimated gesture polish, no spring physics
- Portal pages (`/progress`, `/timeline`) lack the visual trust signals buyers agents need when presenting to clients

**Pain:** Buyers agents demoing RealFlow to vendor principals or buyers are embarrassed by the app's visual maturity relative to competitors (Rex, Agentbox, Vault RE). The product is under-selling its backend capability.

### Beachhead User

**Lachlan** — solo buyers agent principal, 3–8 active clients, field-based on iPhone 15. He runs demos on his phone and laptop. He compares RealFlow directly to Rex CRM and Agentbox. Visual polish and fast, snappy interactions close sales.

### Success Metrics

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Agent NPS (self-reported) | Unknown | ≥ 50 | Quarterly survey |
| Portal session duration | Unknown | +40% | Supabase analytics |
| Mobile app demo close rate | Unknown | +25% | Sales tracking |
| Largest Contentful Paint (web) | Unknown | < 1.5s | Lighthouse CI |
| Total Blocking Time (web) | Unknown | < 200ms | Lighthouse CI |
| axe-core accessibility violations | Unknown | 0 critical | CI gate |
| Dark mode adoption | 0% | ≥ 30% within 30 days | localStorage analytics |

---

## 2. User Personas

### Lachlan — Solo Buyers Agent Principal (Beachhead)
- **Device:** iPhone 15 Pro + MacBook Pro M3
- **Context:** Field-based, demos on phone during property inspections
- **Jobs to be done:** Impress clients, move fast, never lose track of a deal
- **Pain:** Pipeline board looks like a spreadsheet. No satisfaction when moving a deal forward.

### Sunita — Team Lead (5 agents under management)
- **Device:** iPad Pro + Windows laptop
- **Context:** Office-based, Sprint 6 Team engine user
- **Jobs to be done:** See team performance at a glance, assign leads fairly
- **Pain:** Dashboard stat cards feel flat. No visual hierarchy between urgent and routine items.

### Mei-Ling — Buyer Client on Portal
- **Device:** Samsung Galaxy S24 (Android) + occasional iPad
- **Context:** Remote, checks portal between work meetings
- **Jobs to be done:** Know what's happening with her property search without calling her agent
- **Pain:** Portal `/progress` page shows a static list with no sense of momentum or progress

### Grace — Admin / Office Manager
- **Device:** Windows desktop, JAWS screen reader (accessibility requirement)
- **Context:** High-volume data entry, compliance-focused
- **Jobs to be done:** Log contacts quickly, run AML checks, generate reports
- **Pain:** Form focus states are invisible. Tab order is unpredictable.

---

## 3. User Stories & Acceptance Criteria

### FEAT-UI-001 — Animated Page Entrance (Web)
**As Lachlan, I want page content to animate in smoothly when I navigate so that the app feels premium and alive.**

```
Given: I navigate from /pipeline to /contacts
When: The contacts page mounts
Then: Contact rows stagger in from opacity 0 → 1 with a 60ms delay between each row
And: The total animation duration is ≤ 300ms
And: Total Blocking Time does not increase by more than 20ms versus baseline
And: The animation is suppressed when prefers-reduced-motion is set
```

### FEAT-UI-002 — Dark Mode Toggle (Web + Portal)
**As Lachlan, I want to switch to dark mode so that the app is comfortable to use at night inspections.**

```
Given: I am on any authenticated page
When: I click the theme toggle in the sidebar
Then: The entire app switches to dark mode within one frame (no FOUC)
And: My preference is persisted in localStorage('realflow-theme')
And: On next page load, dark mode applies before first paint
And: All text meets WCAG AA contrast (4.5:1) in dark mode as verified by axe-core
```

### FEAT-UI-003 — Pipeline Drag-and-Drop with Animation
**As Lachlan, I want drag-and-drop on the pipeline board to feel satisfying with visual feedback so that moving deals forward is a moment of reward.**

```
Given: I am on /pipeline with at least one transaction card
When: I drag a card from "Inspection" to "Offer"
Then: The card lifts with a 4dp shadow and 1.05x scale transform on pick-up
And: A drop zone highlight appears in the target column
And: On drop, the card snaps into position with a spring animation (stiffness 300, damping 30)
And: A PUT /api/v1/transactions/:id request fires immediately (optimistic update)
And: If the API returns 422 (invalid transition), the card animates back to its origin column
And: The 422 error message displays in a toast for 4 seconds
And: The drag interaction is keyboard-accessible (Space to pick up, arrows to move, Enter to drop, Escape to cancel)
```

### FEAT-UI-004 — Skeleton Loaders with Entry Animation
**As Sunita, I want loading states to feel intentional so that the app doesn't feel broken during data fetch.**

```
Given: I open /dashboard and React Query is fetching
When: The skeleton renders
Then: Skeleton shimmer runs left-to-right at 1.5s loop
And: When data arrives, skeletons cross-fade to content in 200ms
And: No layout shift occurs during the skeleton → content transition (CLS = 0)
```

### FEAT-UI-005 — Toast Notification System
**As any user, I want clear feedback after every action so that I know if my change was saved or failed.**

```
Given: I perform any mutation (create, update, delete)
When: The API responds
Then: A toast appears in the bottom-right corner (web) or bottom-centre (mobile)
And: Success toasts are green, auto-dismiss after 3s
And: Error toasts are red, require manual dismiss
And: Toasts stack when multiple fire within 2s
And: Each toast announces to screen readers via aria-live="polite"
```

### FEAT-UI-006 — Portal Progress Timeline Animation
**As Mei-Ling, I want to see my buyer journey progress animate so that I feel the search is moving forward.**

```
Given: I open /progress on the portal
When: The page mounts
Then: Completed stages render with a checkmark and a green fill animation (300ms)
And: The current stage pulses gently (opacity 0.7 → 1.0, 1s loop)
And: Future stages render in muted grey with no animation
And: Stages that changed since my last login animate; stages already completed on mount do not re-animate
```

### FEAT-UI-007 — Empty States with Illustration
**As any user, I want meaningful empty states so that I know what to do when a list is empty.**

```
Given: A list (contacts, properties, matches, alerts) has zero records
When: The list renders
Then: An SVG illustration relevant to the section displays
And: A clear headline and action button appear (e.g. "Add your first contact" → opens contact form)
And: The empty state is not a plain text label
And: The empty state works at 320px viewport width (smallest supported)
```

### FEAT-UI-008 — Mobile Micro-interactions (Haptics + Spring)
**As Lachlan on mobile, I want tapping primary actions to feel tactile so that the app feels native and responsive.**

```
Given: I am on any mobile screen
When: I tap a primary action button (e.g. "Add Contact", "Log Call")
Then: A light haptic pulse fires via expo-haptics (iOS) or Vibration API (Android)
And: The button scales to 0.96x on press-in and springs back on release (Reanimated spring)
And: The interaction completes in ≤ 100ms from tap to visual feedback
And: The haptic is skipped if the device has vibration disabled in system settings
```

### FEAT-UI-009 — Consistent Typography Scale
**As Grace, I want consistent heading and body text sizes so that information hierarchy is immediately clear.**

```
Given: I open any page
When: I inspect text elements
Then: h1 = 30px/1.2, h2 = 24px/1.3, h3 = 20px/1.4, body = 16px/1.6, small = 14px/1.5
And: The same scale applies in dark mode with no size changes
And: Text is set in Inter (web) / System font stack (mobile) only
And: No raw pixel values appear in component files — all via Tailwind text-* utilities
```

### FEAT-UI-010 — Accessible Focus Rings
**As Grace (screen reader user), I want visible focus indicators on every interactive element so that I can navigate the app by keyboard.**

```
Given: I tab through any page
When: Focus lands on a button, link, input, or dropdown
Then: A 2px solid focus ring in the primary colour appears at 2px offset
And: The focus ring meets WCAG AA (3:1 contrast against background in both light and dark mode)
And: Focus order follows DOM source order on all pages (no tabindex > 0)
And: axe-core reports zero "focus-visible" violations in CI
```

### FEAT-UI-011 — Pipeline Keyboard Navigation
**As Grace, I want to move pipeline cards with keyboard alone so that the drag-and-drop feature is accessible.**

```
Given: Focus is on a pipeline card
When: I press Space
Then: The card enters "move mode" (border highlights, aria-grabbed="true" announced)
And: Left/right arrows move the card between columns
And: Enter drops the card in the current column (fires PUT /api/v1/transactions/:id)
And: Escape cancels and returns the card to its original column
And: A live region announces "Card moved to [Stage Name]" on drop
```

---

## 4. Out-of-Scope (Explicit)

| Item | Reason |
|------|--------|
| New routes or pages | This is a polish pass, not a feature sprint |
| Recharts replacement | Recharts is adequate; charting library migration is a separate spike |
| Storybook component docs | Valuable but a separate tooling sprint |
| White-label / multi-theme for partners | ePlace theme exists; new partner themes are a commercial decision |
| i18n / localisation | English-only for AU market v1 |
| New Supabase tables or migrations | No schema changes needed |
| Backend API changes | All changes are display-layer only |
| A/B testing framework | Deferred to v1.5 |
| Video backgrounds or complex canvas animations | Not appropriate for a B2B CRM |
| Social sharing previews (OG images) | Separate sprint |
| Push notification UI redesign | Part of mobile notifications sprint |
| Native iOS/Android splash screen redesign | Handled by Expo managed workflow separately |

---

## 5. Mobile Requirements

### Platform Constraints

- **Expo SDK:** 54 (version locked — no upgrade in this sprint)
- **NativeWind:** 4.2.2 — requires JSX transform enabled in `babel.config.js`
- **React Native Reanimated:** 3.x — all animations must run on the UI thread via worklets; no JS-thread animations in lists
- **Minimum touch target:** 44pt × 44pt (Apple HIG + Android Material 3)
- **expo-haptics:** Requires `NSMotionUsageDescription` in `app.json` (iOS) and `VIBRATE` permission in Android manifest

### Screens Requiring Mobile Pass

| Screen | Change |
|--------|--------|
| `(tabs)/index.tsx` — Dashboard | Stat card spring animations, skeleton shimmer |
| `(tabs)/pipeline.tsx` — Seller Pipeline | Card press animation, haptic on stage change |
| `(tabs)/ba-pipeline.tsx` — Buyers Agent Pipeline | Same as seller pipeline |
| `(tabs)/contacts.tsx` | Empty state illustration, row entrance animation |
| `contact/[id].tsx` | Activity timeline entrance animation |
| `alerts/index.tsx` | Toast system, empty state |
| `notifications/index.tsx` | Entry animation |

### Offline Behaviour

- All animation logic is client-side — no network dependency
- React Query cache covers offline reads
- Toast system must handle `isOffline` state: "Saved locally, will sync when online"

### NativeWind Migration Notes

- `ContactCard.tsx` and `DealCard.tsx` currently use `StyleSheet.create` with hardcoded hex values — migrate to NativeWind className props
- No new NativeWind custom utilities needed — existing theme tokens are sufficient

---

## 6. Australian Regulatory Context

### Privacy Act 1988 (Cth)
- No new PII fields introduced — no Privacy Act change required
- Animation layer only touches display data already on screen
- Masked fields (e.g. partial bank account numbers in fee screens) must not be revealed by animation transitions

### AML/CTF Act 2006 (AUSTRAC)
- AML check records must display in chronological order — no re-ordering by animation stagger
- Suspicious Matter Reports (SMR) form must not add playful micro-interactions that trivialise the compliance obligation
- Animation suppression: `prefers-reduced-motion` respected at OS level (no regulatory implication, but good practice)

### Electronic Transactions Act 1999 (Cth)
- Document metadata (upload date, uploader) must remain visible — no animation that obscures this data during transition

### Australian Consumer Law (ACL)
- Empty state copy for "no properties found" must not imply properties exist — legal team to review copy

### Disability Discrimination Act 1992 (Cth)
- All interactive elements must be keyboard-accessible (FEAT-UI-010, FEAT-UI-011)
- axe-core CI gate (zero critical violations) is a legal risk mitigation, not just best practice
- Screen reader announcements (aria-live regions) required for toast notifications and pipeline drag-and-drop

### State Variations
- No state-specific UI differences introduced by this sprint

---

## 7. Supabase RLS Boundary Analysis

**Finding: No new RLS policies required.**

All changes in this feature are display-layer only. The only write paths are:

| Operation | Route | RLS Impact |
|-----------|-------|-----------|
| Pipeline card move | `PUT /api/v1/transactions/:id` (Fastify) | Existing RLS via Fastify service role — no change |
| Toast dismiss | Client-only state | No DB write |
| Theme preference | `localStorage` | No DB write |
| Dark mode | `localStorage` | No DB write |

**Critical pattern to maintain:** Pipeline drag-and-drop writes must go through Fastify (`PUT /api/v1/transactions/:id`), **not** directly to Supabase from the browser. The existing RLS policy on `transactions` blocks browser-origin writes for non-owner rows. The Fastify service role is the correct write path.

**Multi-tenant isolation:** No change. The animation layer reads data already fetched by existing hooks — no new queries introduced.

---

## 8. Dependencies

### Existing Engines Touched (Display Only)

| Engine | Touch Point |
|--------|------------|
| `pipeline-engine` | Card stage display — no logic change |
| `portal-engine` | Progress stage data for timeline animation |
| `property-alert-engine` | Alert list empty state |
| None | All other engines untouched |

### New Package Dependencies

#### Web / Portal (Next.js)

| Package | Version | Size | Purpose |
|---------|---------|------|---------|
| `framer-motion` | `^11.x` | ~75KB gzip | Page transitions, card animations, spring physics |
| `@dnd-kit/core` | `^6.x` | ~20KB gzip | Pipeline drag-and-drop (replaces native HTML5 D&D) |
| `@dnd-kit/sortable` | `^7.x` | ~5KB gzip | Sortable list within columns |
| `@radix-ui/react-toast` | `^1.x` | ~8KB gzip | Accessible toast primitives |
| `@radix-ui/react-dialog` | `^1.x` | ~10KB gzip | Accessible modal primitives |

**Rationale for Framer Motion:** GSAP requires a commercial licence for SaaS products. CSS-only transitions cannot orchestrate data-dependent sequences (e.g. stagger based on array index, spring physics on drag). React Spring is viable but Framer Motion has better Next.js App Router / RSC compatibility and a smaller learning curve.

**Rationale for @dnd-kit:** `react-beautiful-dnd` is unmaintained (last release 2022). `react-dnd` adds ~40KB. `@dnd-kit` is the current community standard, 25KB total, accessible by default.

**Rationale for Radix UI over shadcn/ui:** shadcn/ui generates component files into the project (code ownership burden). Radix UI primitives are headless — we style them with Tailwind and own nothing.

#### Mobile (Expo)

| Package | Version | Purpose |
|---------|---------|---------|
| `expo-haptics` | `~14.x` | Haptic feedback on iOS/Android |
| `react-native-reanimated` | `~3.x` | UI-thread animations (already likely present via Expo) |

### External API Dependencies

None. This feature is display-layer only.

### Build Graph Notes

- `framer-motion` is a client-only import — use `'use client'` directive on all animated components to prevent RSC serialisation errors
- `@dnd-kit` requires pointer events — ensure no `pointer-events: none` on pipeline container
- `expo-haptics` requires `app.json` permission additions before EAS build

---

## 9. Tech Choices Summary

| Decision | Choice | Rejected Alternatives |
|----------|--------|----------------------|
| Web animation library | Framer Motion 11 | GSAP (licence), CSS-only (insufficient), React Spring (worse RSC compat) |
| Drag-and-drop | @dnd-kit/core | react-beautiful-dnd (unmaintained), react-dnd (heavier) |
| Toast system | @radix-ui/react-toast | react-hot-toast (no a11y), sonner (evaluate in Phase 2) |
| Component primitives | @radix-ui/* | shadcn/ui (code ownership), headlessui (Vue-first) |
| Mobile animations | Reanimated 3 worklets | Animated API (JS thread, jank), CSS (not available in RN) |
| Mobile haptics | expo-haptics | react-native-haptic-feedback (non-Expo managed) |
| Dark mode storage | localStorage | Supabase user_preferences (over-engineered for v1) |

---

## 10. Phased Delivery Plan

### Phase 1 — Foundation (Week 1–2) — Highest Impact, Lowest Risk
**Goal:** Eliminate the most visible dated elements without touching complex state.

- [ ] Implement toast system (`@radix-ui/react-toast`) — web + portal
- [ ] Implement skeleton shimmer animation (CSS keyframe, replaces `animate-pulse`)
- [ ] Typography scale standardisation (enforce via Tailwind text-* utilities)
- [ ] Empty state illustrations for all major lists (contacts, properties, matches, alerts, pipeline columns)
- [ ] Accessible focus rings (`focus-visible:ring-2 ring-primary-500`)
- [ ] `globals.css` CSS variable completion (remove all hardcoded Tailwind colours in shared components)

**Definition of Done:** axe-core zero critical violations. Lighthouse LCP < 1.5s. Toast fires on every mutation in web + portal.

### Phase 2 — Motion Layer (Week 3–4)
**Goal:** Add Framer Motion entrance animations and dark mode.

- [ ] Install `framer-motion` — web + portal
- [ ] Page-level `AnimatePresence` wrapper in root layouts
- [ ] List row stagger animation (contacts, properties, pipeline cards)
- [ ] Dashboard stat card count-up animation
- [ ] Dark mode implementation (CSS variables, localStorage, toggle in sidebar)
- [ ] Portal `/progress` timeline animation (FEAT-UI-006)

**Definition of Done:** No animation fires when `prefers-reduced-motion` is set. TBT < 200ms in Lighthouse. Dark mode passes WCAG AA.

### Phase 3 — Interaction Polish (Week 5–6)
**Goal:** Pipeline drag-and-drop, keyboard accessibility, mobile NativeWind migration.

- [ ] Install `@dnd-kit/core` + `@dnd-kit/sortable`
- [ ] Replace HTML5 D&D on `pipeline-board.tsx` with @dnd-kit
- [ ] Card lift animation on drag (scale + shadow via Framer Motion)
- [ ] Drop zone highlight animation
- [ ] Keyboard navigation for pipeline (FEAT-UI-011)
- [ ] Mobile `ContactCard.tsx` / `DealCard.tsx` NativeWind migration (remove `StyleSheet.create` hardcoded hex)
- [ ] Accessibility audit — full axe-core run, fix all critical violations

**Definition of Done:** Pipeline drag-and-drop keyboard accessible. Zero axe-core critical violations. Mobile components use theme tokens only.

### Phase 4 — Mobile Micro-interactions (Week 7–8)
**Goal:** Native-feeling mobile experience.

- [ ] `expo-haptics` install + `app.json` permissions
- [ ] Reanimated spring on all primary action buttons (FEAT-UI-008)
- [ ] Mobile empty state illustrations (shared SVG set)
- [ ] Mobile toast integration (bottom-centre, React Native compatible)
- [ ] Portal mobile layout polish (Mei-Ling persona)
- [ ] EAS build + device testing (iOS + Android)

**Definition of Done:** Haptics work on physical iOS device. Spring animations run on UI thread (no JS-thread jank in Profiler). All mobile empty states illustrated.

---

## 11. Codebase Inventory Summary

*From code exploration (2026-03-08):*

| Area | Files | Animation Status |
|------|-------|-----------------|
| Web Pages | 45 | CSS transitions only |
| Web Components | 53 | `animate-pulse` skeletons only |
| Portal Pages | 13 | No animation |
| Portal Components | 11 | No animation |
| Mobile Screens | 18 | No animation |
| Mobile Components | 9 | Hardcoded hex styles |
| Shared UI Components | 5 | Interfaces only |
| Design Tokens | 2 themes | Half-implemented CSS vars |

**Critical files to touch in Phase 1:**
- [apps/web/src/app/globals.css](apps/web/src/app/globals.css) — complete CSS variable system
- [apps/web/src/components/layout/sidebar.tsx](apps/web/src/components/layout/sidebar.tsx) — add dark mode toggle
- [apps/web/src/lib/theme-context.tsx](apps/web/src/lib/theme-context.tsx) — implement dark mode
- [apps/web/src/components/dashboard/stat-card.tsx](apps/web/src/components/dashboard/stat-card.tsx) — skeleton + animation
- [apps/portal/src/components/timeline-step.tsx](apps/portal/src/components/timeline-step.tsx) — progress animation
- [apps/mobile/src/components/ContactCard.tsx](apps/mobile/src/components/ContactCard.tsx) — NativeWind migration
- [apps/mobile/src/components/DealCard.tsx](apps/mobile/src/components/DealCard.tsx) — NativeWind migration

---

## Sign-off Checklist

```
## Sign-off Checklist

- [x] All acceptance criteria have measurable conditions
- [x] Out-of-scope items are explicitly listed (15 items)
- [x] Mobile requirements documented (Expo SDK 54, NativeWind 4.2.2, Reanimated constraints)
- [x] No open "TBD" items in the spec
- [x] Regulatory/compliance implications reviewed (Privacy Act, AML/CTF, DDA, ACL)
- [x] Dependencies on existing engines identified (pipeline-engine, portal-engine)
- [x] RLS boundary analysis complete (no new policies needed)
- [ ] Reviewed by: _____ Date: _____
- [ ] Product Owner sign-off
- [ ] Engineering Lead sign-off (bundle size targets confirmed)
- [ ] QA Engineer sign-off (axe-core CI gate agreed)
- [ ] Design/UX sign-off (illustrations sourced or commissioned)
- [ ] Compliance/Legal sign-off (empty state copy, AML animation constraints)
```

---

*Document generated by RealFlow Discovery Agent — 2026-03-08*
