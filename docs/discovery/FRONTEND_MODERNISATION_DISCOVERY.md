# RealFlow — Frontend Modernisation Discovery Document

**Feature:** Clean animations, improved UI/UX, and clearer information hierarchy across `apps/web`, `apps/portal`, and `apps/mobile`
**Discovery date:** 2026-03-08
**Sprint context:** Sprint 5 complete (Client Portal + Property Alerts). Sprint 6 in progress (Growth & Scale). This feature targets Sprint 7.
**Author:** Requirements Analyst agent
**Status:** Ready for stakeholder sign-off

---

## Table of Contents

1. Feature Framing
2. User Personas
3. User Stories with Acceptance Criteria
4. Explicit Out-of-Scope
5. Mobile Requirements
6. Australian Regulatory Context
7. Supabase RLS Boundary Analysis
8. Dependencies on Existing Engines and External APIs
9. Recommended Tech Choices
10. Phased Delivery Plan
11. Sign-Off Checklist

---

## 1. Feature Framing

### 1.1 Problem Statement

RealFlow's backend is feature-complete across six sprints — CRM, Pipeline, Workflows, Communication Hub, Client Portal, Property Alerts, Social Leads, Off-Market, and Team engines all ship production data. The frontend, however, reads as utilitarian scaffolding rather than a professional product. Specific observations drawn from the live codebase:

- **No entrance animations.** Page transitions are instant hard cuts. KPI cards, pipeline columns, and contact rows all appear simultaneously with no sequencing or hierarchy cues.
- **Skeleton loaders are static.** The `animate-pulse` skeleton in `dashboard-client.tsx` is a single CSS animation — no easing, no stagger, no shimmer directionality.
- **Pipeline board is static HTML.** `pipeline-board.tsx` renders 8 `div` columns with no drag-and-drop, no card-level micro-interaction, and hard-coded seed data rather than live API data.
- **Mobile uses `StyleSheet.create` exclusively.** `ContactCard.tsx` and `DealCard.tsx` use raw React Native styles with no NativeWind utility classes, producing an inconsistency gap versus the web layer and making theming changes require dual-path edits.
- **Colour system is partially realised.** The web app has a thoughtful CSS-variable token system (primary, secondary, accent, brand) but the portal uses hardcoded hex values in `tailwind.config.ts` and the mobile layer uses hardcoded hex strings inline in `StyleSheet`.
- **Empty states are passive.** The inbox empty state and pipeline empty columns show text only; no illustration, no call-to-action, no animation to confirm the system is ready.
- **No visual feedback on mutations.** Sending a message, creating a workflow from a template, toggling a pipeline stage — none of these produce a visible success state beyond a React Query cache update.
- **Information hierarchy is flat.** All pages use the same `text-2xl font-bold text-gray-900` heading treatment. There is no typographic scale distinguishing primary actions from secondary context.
- **No dark mode.** The CSS variable system supports it structurally (`globals.css` has the token variables) but `theme-switcher.tsx` exists as a stub without implementation.

The consequence is that buyers agents evaluating RealFlow against Linear, Pipedrive, and Attio perceive the product as technically capable but visually unpolished. Client portal users (buyers' clients) comparing their RealFlow portal against consumer apps such as ANZ Home Loans or Domain.com.au feel they are using a beta product.

### 1.2 Beachhead User

**Primary beachhead:** The independent buyers agent principal, operating a 1–5 person practice, who demos RealFlow to a prospective client during an onboarding meeting. The portal is open on their iPad. The pipeline is displayed on a second monitor. This person sells RealFlow's polish as a proxy for their own professionalism.

**Secondary beachhead:** The buyer client accessing the portal on a personal iPhone during lunch. They check their progress stage, unread messages, and upcoming key dates. They judge the product against their banking apps.

### 1.3 Success Metrics

All metrics measured at Sprint 8 close (eight weeks after first phase ships).

| Metric | Baseline (Sprint 6 close) | Target |
|---|---|---|
| Agent-reported NPS on frontend polish (1–10 survey) | Not yet measured (assumed 5–6) | 8+ |
| Client portal session duration (median, minutes) | Not yet measured | +40% vs baseline |
| Portal bounce rate (sessions ending on dashboard without navigation) | Not yet measured | Reduce by 30% |
| Pipeline board interactions per session (card moves + stage opens) | Not yet measured | +60% vs baseline |
| Accessibility audit score (axe-core automated) | Not yet measured | Zero critical violations |
| Mobile app crash rate (from animation-related layout thrash) | Not yet measured | 0 new crashes introduced |
| Page load LCP (web, 4G throttle, Lighthouse) | Not yet measured | Below 2.5 s on all primary routes |
| Time-to-interactive on portal dashboard | Not yet measured | Below 3.0 s on mid-range Android |

---

## 2. User Personas

### Persona A — The Independent Buyers Agent Principal

**Name:** Lachlan
**Age:** 38
**Location:** Melbourne inner suburbs
**Practice:** Sole operator, 2 part-time staff, 12–18 active buyer clients at any time
**Tech literacy:** High; uses iPhone 16, MacBook Pro, Notion, Xero, Domain Pro
**Pain points with current UI:**
- Dashboard data loads but offers no at-a-glance priority signal. All KPI cards feel equal weight.
- Pipeline board is static seed data — cannot drag a client card between stages.
- No visual signal when a workflow fires or a message is sent.
- When showing the product to a client, the portal feels "like a Google Form."

**Jobs to be done:**
- In 90 seconds of opening the app, understand which clients need attention today.
- During a client demo, present the portal without embarrassment.
- On mobile while on-site at an inspection, log a note and move a deal stage without breaking flow.

### Persona B — The Agency Team Lead

**Name:** Sunita
**Age:** 44
**Location:** Brisbane
**Practice:** Runs a 6-agent buyers agency; manages team performance from the Team dashboard (Sprint 6)
**Tech literacy:** Medium-high; relies on dashboards to spot underperformance
**Pain points:**
- Team performance tables load all rows simultaneously with no priority sorting visible at a glance.
- No chart animations — the revenue breakdown appears instantaneously, making it feel like a static mockup.
- Cannot easily distinguish which metric is most urgent (low conversion rate vs. stale pipeline deals).

**Jobs to be done:**
- Start each Monday morning by scanning the Team dashboard for anything requiring intervention.
- Share performance reports with agents via the portal link with confidence in the product's appearance.

### Persona C — The Buyer Client

**Name:** Mei-Ling
**Age:** 31
**Location:** Sydney
**Context:** First-time buyer; working with a buyers agent for the first time; anxious about the process
**Tech literacy:** High consumer; uses Instagram, ANZ app, Netflix
**Pain points:**
- The portal progress tracker is a row of numbered circles with no animation when she advances a stage. It feels like nothing happened.
- The document list is a plain unordered list. No file type icons, no upload date, no preview.
- Messages section has no typing indicator and no read receipts.

**Jobs to be done:**
- At least once daily, confirm her search is progressing without having to call her agent.
- Feel confident and informed, not anxious and uncertain.

### Persona D — The Admin / PA

**Name:** Grace
**Age:** 29
**Location:** Perth
**Context:** Part-time admin for a small agency; manages contacts, compliance checks, and document uploads
**Tech literacy:** Medium; comfortable with web apps, not a developer
**Pain points:**
- Contacts table is dense with no visual differentiation between lead scores, contact types, or recency.
- Compliance dashboard is a wall of rows with no colour-coding on AML risk levels.
- When uploading documents to a client record, there is no progress indicator.

**Jobs to be done:**
- Process 20+ contact records in a single session without losing track of where she is.
- Identify which compliance checks are overdue without reading every row.

---

## 3. User Stories with Acceptance Criteria

All acceptance criteria use Given/When/Then format. "Pass" means automated test or manual QA sign-off can confirm the condition. Criteria referencing animation timing use the Reduced Motion media query exception.

---

### FEAT-UI-001 — Staggered entrance animations on data-loaded pages

**As** Lachlan (buyers agent),
**I want** KPI cards, pipeline columns, and table rows to animate into view in a staggered sequence when a page first loads,
**So that** I have a clear sense of what the application is presenting to me in order of priority.

**Acceptance Criteria:**

- **Given** the Analytics Dashboard finishes loading (API returns data), **when** the KPI card section mounts, **then** each of the four KPI cards enters with a `translateY(16px) → translateY(0)` + `opacity 0 → 1` transition, staggered at 60 ms intervals, completing within 300 ms total.
- **Given** a user has `prefers-reduced-motion: reduce` set in their OS, **when** any animated component mounts, **then** all entrance transitions are skipped and elements appear immediately at full opacity with no transform.
- **Given** the Pipeline board loads, **when** stage columns mount, **then** each column animates in left-to-right at 40 ms stagger intervals; cards within each column stagger at 30 ms intervals after their parent column is visible.
- **Given** a page is already mounted and a period selector is changed on the Dashboard, **when** new data loads, **then** existing cards animate out (100 ms fade) before new cards animate in, preventing a jarring simultaneous replacement.
- **Given** a Lighthouse performance audit runs with CPU 4x slowdown throttle, **when** the animation sequence completes, **then** Total Blocking Time remains below 200 ms and LCP does not regress by more than 10% compared to the pre-animation baseline.

---

### FEAT-UI-002 — Directional shimmer skeleton loaders

**As** any authenticated user,
**I want** skeleton loading states to use a directional shimmer animation rather than a static pulse,
**So that** the application feels responsive and active while data is fetching.

**Acceptance Criteria:**

- **Given** any data-fetching page is in the loading state, **when** the skeleton is rendered, **then** a gradient shimmer sweeps left-to-right at a 1.5 s cycle, using the existing `--color-primary-100` token as the shimmer highlight colour.
- **Given** the skeleton renders in both `apps/web` and `apps/portal`, **when** inspected in browser DevTools, **then** the shimmer is implemented as a CSS `@keyframes` animation on a `::after` pseudo-element, not JavaScript-driven, to avoid main thread blocking.
- **Given** the `SkeletonCard` component in `dashboard-client.tsx` is replaced, **when** a new `<Skeleton />` primitive is added to `packages/ui/src/components/`, **then** it accepts `className`, `width`, `height`, and `rounded` props and is consumed by both `apps/web` and `apps/portal` without duplication.
- **Given** the skeleton is visible, **when** data arrives within 200 ms of initial render, **then** the skeleton is never shown (suppress with a 200 ms delay before mounting skeleton), preventing a flash-of-skeleton for fast connections.

---

### FEAT-UI-003 — Drag-and-drop pipeline board

**As** Lachlan (buyers agent),
**I want** to drag contact cards between pipeline stages on the Kanban board,
**So that** I can update a client's stage without navigating to their contact detail page.

**Acceptance Criteria:**

- **Given** a pipeline card is in a stage column, **when** the user begins dragging, **then** the card lifts with a `box-shadow` increase and a 5 % scale-up transition completing in 150 ms.
- **Given** a card is being dragged over a valid target column, **when** the cursor enters the column, **then** the column highlights with a `border-2 border-brand-400` ring and a `bg-brand-50` background to indicate it accepts a drop.
- **Given** a card is dropped into a new stage column, **when** the drop event fires, **then** (a) the card animates to its new position over 200 ms, (b) a PATCH request is sent to `PUT /api/v1/transactions/:id` updating `current_stage`, (c) if the API returns an error (e.g., invalid stage transition per the business logic engine), the card animates back to its original column with a red flash, and (d) a toast notification renders: "Stage update failed: [reason]".
- **Given** the board is rendered on a touch device, **when** a user long-presses a card for 400 ms, **then** the drag interaction activates and is functional through the full drag lifecycle.
- **Given** the pipeline board renders on a viewport narrower than 768 px, **when** the user views the pipeline, **then** horizontal scroll is enabled and columns maintain their minimum 288 px width; drag-and-drop remains functional during horizontal scroll.
- **Given** a stage transition is blocked by a validation rule in `PipelineEngine` (e.g., "offer" requires an active offer record), **when** the API returns `422 Unprocessable Entity`, **then** the toast message displays the `details` field from the error response verbatim.

---

### FEAT-UI-004 — Mutation feedback: toast notification system

**As** any user performing a write action,
**I want** to see a non-blocking toast notification confirming success or surfacing errors,
**So that** I know whether my action was processed without interpreting loading states.

**Acceptance Criteria:**

- **Given** any mutation (send message, create workflow, move pipeline stage, upload document, invite portal client) succeeds, **when** the API returns 200 or 201, **then** a green toast appears in the bottom-right corner of the viewport with: (a) a check icon, (b) the action name in plain English (e.g., "Message sent"), and (c) an auto-dismiss timer of 4 s.
- **Given** any mutation fails, **when** the API returns 4xx or 5xx, **then** a red toast appears with: (a) an error icon, (b) the action name, (c) the error message from the API response `message` field truncated to 120 characters, and (d) a "Dismiss" button that removes it immediately.
- **Given** multiple rapid mutations fire (e.g., marking 3 messages as read in sequence), **when** toasts stack, **then** a maximum of 3 toasts are visible simultaneously; older toasts are pushed up and dismissed as new ones arrive.
- **Given** the user is on mobile web (viewport < 640 px), **when** a toast appears, **then** it renders from the bottom of the screen, full-width minus 16 px side margins, and does not overlap the fixed navigation elements.
- **Given** the toast system is implemented, **when** a Playwright end-to-end test creates a workflow from a template, **then** the test can assert `getByRole('status')` returns the success toast text within 2 s of the API response.

---

### FEAT-UI-005 — Typographic scale and information hierarchy

**As** Grace (admin),
**I want** pages to visually distinguish primary headings, section headings, data labels, and body copy through a clear typographic scale,
**So that** I can scan dense pages without reading every element.

**Acceptance Criteria:**

- **Given** any page in `apps/web`, **when** rendered, **then** the following scale is applied consistently: Page title = `text-3xl font-bold tracking-tight`; Section heading = `text-lg font-semibold`; Sub-section / card title = `text-base font-medium`; Data label = `text-xs font-medium uppercase tracking-wide text-gray-500`; Body copy = `text-sm text-gray-600`; Micro-label = `text-xs text-gray-400`.
- **Given** the current `apps/web/src/app/dashboard/dashboard-client.tsx` uses `text-2xl` for page title and `text-base` for section headings, **when** the scale is applied, **then** these classes are updated and a visual regression snapshot test confirms the change.
- **Given** the Contacts page table renders contact records, **when** the table row is inspected, **then** the contact full name uses `text-sm font-semibold text-gray-900` and the contact type badge uses `text-xs font-medium` with the appropriate colour token.
- **Given** the compliance dashboard renders AML risk levels, **when** a risk level is HIGH, **then** the row background is `bg-red-50` and the risk label renders in `text-red-700 font-semibold`; MEDIUM renders `bg-amber-50` / `text-amber-700`; LOW renders default.
- **Given** a design token update is needed, **when** the `font-sans` family is changed in `tailwind.config.ts`, **then** the change propagates across all pages without component-level changes.

---

### FEAT-UI-006 — Client portal progress stage animation

**As** Mei-Ling (buyer client),
**I want** my progress tracker to animate when I advance from one stage to the next,
**So that** I feel the momentum of my property search journey.

**Acceptance Criteria:**

- **Given** the portal dashboard `progress` tracker renders the buyer's current stage, **when** the `currentStageIndex` advances (detected by comparing previous and current values), **then** the newly completed stage circle plays a green fill animation (0 % → 100 % over 400 ms) and the connector line between the previous and current stage fills from left to right over 300 ms.
- **Given** the stage tracker renders on a mobile viewport (< 640 px), **when** the current stage changes, **then** the horizontal stepper scrolls to center the current stage indicator within the viewport width, without a visible jump.
- **Given** a client's stage has not changed since the last session, **when** the page mounts, **then** no animation plays; completed stages appear immediately in their green state.
- **Given** the portal is used by a client with `prefers-reduced-motion: reduce`, **when** a stage advances, **then** the circle and connector update instantly with no animation.

---

### FEAT-UI-007 — Illustrated empty states

**As** any user,
**I want** empty states (no contacts, no workflows, no messages, no pipeline cards) to include a contextual illustration and a primary call-to-action,
**So that** I am not confused about whether data failed to load or genuinely does not exist.

**Acceptance Criteria:**

- **Given** a user views the Contacts page with zero contacts, **when** the contacts table renders empty, **then** an inline SVG illustration (people/network motif, brand colours, height 120 px) appears above copy reading "No contacts yet" and a primary button "Add your first contact" that opens the contact creation form.
- **Given** a user views the Workflows page with zero workflows, **when** the workflow grid renders empty, **then** a gear/automation motif illustration appears above copy reading "No workflows yet" and two buttons: "Browse Templates" (primary) and "Build Custom" (secondary).
- **Given** a user views the Pipeline board and a specific stage column has zero cards, **when** the column body renders, **then** a subtle dotted-border drop zone with the text "Drop a contact here" is displayed instead of the current plain text "No contacts".
- **Given** the empty state renders, **when** a Storybook story is created for the `<EmptyState />` component in `packages/ui/src/components/`, **then** the story accepts `illustration`, `title`, `description`, `primaryAction`, and `secondaryAction` props and renders correctly.

---

### FEAT-UI-008 — Dark mode support

**As** Lachlan (buyers agent),
**I want** RealFlow web and portal to honour my system dark mode preference,
**So that** I can work comfortably in low-light environments without eye strain.

**Acceptance Criteria:**

- **Given** the user's OS is set to dark mode, **when** `apps/web` loads, **then** all surfaces switch to a dark palette using the existing CSS variable system: `--background` maps to `#0f172a`, `--foreground` to `#f1f5f9`, `--card` to `#1e293b`, `--border` to `#334155`.
- **Given** dark mode is active, **when** any brand-coloured element (buttons, badges, chart bars using `brand-600`) renders, **then** the colour remains the same (brand blue does not need to invert); only neutral surfaces and text invert.
- **Given** the `theme-switcher.tsx` stub in `apps/web/src/components/` exists, **when** it is implemented, **then** it offers three options: System (default), Light, Dark; the selection persists in `localStorage` under key `realflow-theme`.
- **Given** dark mode is active in `apps/portal`, **when** the portal dashboard renders, **then** the portal-specific `portal-600` through `portal-50` colours also shift to equivalent dark equivalents.
- **Given** dark mode is applied, **when** the Playwright visual regression suite runs, **then** snapshots for all primary routes in both light and dark mode are stored and reviewed; zero critical colour-contrast failures (WCAG AA) are reported by axe-core.

---

### FEAT-UI-009 — NativeWind migration for mobile components

**As** the engineering team,
**I want** all mobile components to use NativeWind utility classes instead of `StyleSheet.create`,
**So that** the mobile colour system shares the same token layer as the web apps and theming changes require a single-point-of-truth update.

**Acceptance Criteria:**

- **Given** `ContactCard.tsx` currently uses `StyleSheet.create` with hardcoded hex values, **when** the migration is complete, **then** it uses NativeWind classes (`bg-white`, `rounded-xl`, `text-gray-900`, etc.) and zero hardcoded hex values remain in the component file.
- **Given** `DealCard.tsx` uses `borderLeftColor: '#f59e0b'` for the stale indicator, **when** migrated, **then** this uses the NativeWind `border-amber-400` class via a conditional `className` prop.
- **Given** all 9 components in `apps/mobile/src/components/` are migrated, **when** `npm run lint` runs on the mobile app, **then** a custom ESLint rule `no-stylesheet-create-with-hardcoded-hex` reports zero violations.
- **Given** the mobile app runs on both iOS and Android simulators, **when** the NativeWind-migrated components render, **then** visual output is pixel-equivalent to the pre-migration `StyleSheet.create` baseline (verified by Detox snapshot comparison).

---

### FEAT-UI-010 — Mobile Reanimated micro-interactions

**As** Mei-Ling (buyer client) using the mobile app,
**I want** tapping cards and buttons to produce subtle haptic and visual feedback,
**So that** the app feels responsive and native-quality.

**Acceptance Criteria:**

- **Given** a user taps `ContactCard`, **when** the `TouchableOpacity` fires `onPressIn`, **then** `react-native-reanimated` animates `scale` from 1.0 to 0.97 in 80 ms with `Easing.out(Easing.quad)`, and reverts to 1.0 on `onPressOut`.
- **Given** a user taps `DealCard` with a stale indicator, **when** the press animation plays, **then** `expo-haptics` fires `ImpactFeedbackStyle.Light`; no haptic fires for non-stale cards.
- **Given** the mobile alert screen receives a new property alert via Supabase Realtime, **when** the new alert card inserts into the list, **then** it enters from the top of the list with a slide-down animation over 250 ms.
- **Given** the bottom tab navigator transitions between screens, **when** a tab is selected, **then** the incoming screen fades in with `opacity 0 → 1` over 180 ms; the outgoing screen does not animate out (only the incoming screen animates in).
- **Given** a user device has Reduce Motion enabled in iOS or Android accessibility settings, **when** any Reanimated animation would play, **then** all animations are replaced by instant state changes; `useReducedMotion()` hook from Reanimated must gate every animation.

---

### FEAT-UI-011 — Accessible focus management and keyboard navigation

**As** Grace (admin),
**I want** all interactive elements to be fully keyboard-navigable with visible focus rings,
**So that** I can operate the application efficiently without relying on a mouse.

**Acceptance Criteria:**

- **Given** any interactive element (button, link, input, card) in `apps/web` or `apps/portal`, **when** it receives keyboard focus, **then** a `focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2` ring is visible; `focus:outline-none` is never used without a `focus-visible:` replacement.
- **Given** the pipeline board is keyboard-accessible, **when** a user tabs to a card and presses Space, **then** the card enters "move mode" and arrow keys navigate it between columns; pressing Enter confirms the move; pressing Escape cancels.
- **Given** a modal or sheet is opened (e.g., "From Template" picker on Workflows page), **when** the modal mounts, **then** focus moves to the first interactive element inside the modal; when the modal closes, focus returns to the trigger element.
- **Given** the portal progress tracker renders, **when** a screen reader reads the tracker, **then** each stage circle is announced as `[Stage name], [completed/current/pending]` via `aria-label`.
- **Given** an automated axe-core accessibility audit runs against every page in `apps/web` and `apps/portal`, **when** the CI pipeline runs, **then** zero violations with impact `critical` or `serious` are reported.

---

## 4. Explicit Out-of-Scope

The following items are explicitly excluded from this feature. Each exclusion has a rationale.

| Item | Rationale |
|---|---|
| New backend API endpoints | The frontend modernisation must consume existing API contracts. Any data gaps are surfaced as follow-on tickets. |
| Real-time property alert animations (cron wiring) | Deferred in Sprint 5; the wiring is a backend task outside this feature boundary. |
| White-label / per-client theming | `docs/CLIENT_THEMES.md` tracks this separately. The CSS variable architecture enables it but the theming toggle UI is not part of this feature. |
| Recharts replacement or new charting library | Recharts is already installed in `apps/web`. Chart visual improvements (colours, animation on draw) are in scope; replacing Recharts with a different library is not. |
| New page routes or navigation items | No new routes. The modernisation applies to existing pages only. |
| Native iOS / Android gesture navigation rewrites | Standard React Navigation / Expo Router navigation remains. Only micro-interactions on existing components are in scope. |
| Storybook setup | Storybook is useful but represents a standalone infrastructure lift. This feature produces components that can be added to Storybook if it is set up separately. |
| i18n / multi-language support | RealFlow is Australian-market only. All copy remains in English. |
| Video or audio elements | No media player or recording UI is introduced. |
| Offline-first syncing improvements | NetInfo offline detection (`OfflineBanner.tsx`) already exists. Architecture changes to sync are out of scope. |
| Backend AML/KYC process changes | Compliance *display* improvements (colour-coded risk levels) are in scope. The underlying workflow is not changed. |

---

## 5. Mobile Requirements

### 5.1 Platform Targets

| Platform | Minimum OS | Test devices |
|---|---|---|
| iOS | iOS 16 | iPhone 14 (physical), iPhone SE 3rd gen (simulator) |
| Android | Android 13 | Pixel 7 (physical), Samsung Galaxy A54 (simulator) |

### 5.2 Performance Constraints

- All Reanimated animations must run on the UI thread. Any animation using `runOnJS` for anything other than state callbacks must be flagged in code review.
- The mobile app must not exceed a 16 ms frame budget during animation sequences on a mid-range Android device (Qualcomm Snapdragon 778G equivalent). Frame rate monitoring via Flipper or Perf Monitor must be documented in the PR.
- No animation should block the JS thread for more than 5 ms.

### 5.3 Touch Target Standards

- All tappable elements must have a minimum touch target of 44 x 44 pt (iOS Human Interface Guidelines) and 48 x 48 dp (Material Design).
- Current `DealCard` has `minHeight: 48` — this is the floor, not the target. Cards with single-line content must be padded to meet 64 pt minimum for comfortable scanning.

### 5.4 NativeWind Version Constraint

NativeWind `^4.2.2` is already installed. All new utility classes must be compatible with NativeWind v4's JSX transform approach. Do not use the legacy `styled()` wrapper.

### 5.5 Expo SDK Compatibility

Expo SDK 54 (~54.0.0) is locked. `react-native-reanimated` must be pinned to the version listed in the Expo SDK 54 compatibility table (currently `~3.16.x`). Do not upgrade Expo as part of this feature.

### 5.6 Haptics

`expo-haptics` is not currently installed. It must be added as a dependency. On Android, haptics require `android.permission.VIBRATE` in the app manifest — this must be added in `app.json`.

---

## 6. Australian Regulatory Context

### 6.1 Privacy Act 1988 (Cth) — APPs 11 and 12

The frontend modernisation does not change what personal information is collected or stored. However, any new UI component that displays personal information (contact names, email addresses, phone numbers, financial figures) must:

- Not log personal information to the browser console in production builds. The existing `console.log` statements in several client components (observed in prior sprints) must be removed as part of the modernisation pass.
- Mask sensitive fields (e.g., phone numbers displayed as `0412 *** ***` in read-only list views) when a `maskPII` prop is passed — groundwork laid here for an admin toggle in a future sprint.
- Not render personal information inside animation libraries' internal state or debug panels in production builds.

### 6.2 Anti-Money Laundering and Counter-Terrorism Financing Act 2006 (AML/CTF)

The compliance dashboard in `apps/web/src/app/compliance/` surfaces AML check results and AUSTRAC reports. The visual hierarchy improvement for risk levels (FEAT-UI-005 acceptance criteria for compliance dashboard) must:

- Not change the underlying data, risk classification logic, or record-keeping behaviour — those are governed by `AMLComplianceEngine`.
- Present HIGH risk records with sufficient visual prominence that a compliance officer cannot reasonably overlook them during a routine scan.
- Maintain the full audit trail: any display changes must not suppress or reorder records in a way that alters chronological or severity ordering as returned by the API.

### 6.3 Electronic Transactions Act 1999 (Cth) and State-Level Equivalents

The document signing and e-signature flows (if introduced in a future sprint) require a verifiable audit trail. This feature does not introduce e-signature but does improve the document list UI in the portal. The document metadata (upload date, uploader identity, version) must remain fully visible and not be collapsed behind a progressive disclosure that would require multiple clicks to reveal for legal inspection.

### 6.4 Australian Consumer Law — Fair Trading

Marketing copy used in empty states and onboarding prompts must not include misleading claims about RealFlow's capabilities. Empty state copy reviewed in FEAT-UI-007 must be reviewed by the product owner before shipping to ensure no feature claims are made for capabilities not yet implemented.

### 6.5 Disability Discrimination Act 1992 (Cth)

FEAT-UI-011 (keyboard navigation and screen reader support) is not merely a best practice — it is a legal obligation for services offered to the Australian public. The axe-core automated gate in CI is a minimum floor. Manual testing with VoiceOver (macOS/iOS) and TalkBack (Android) must be completed and documented before any phase is marked ready for production.

### 6.6 State Real Estate Licensing

Real estate agent licensing is governed by state-specific legislation (e.g., Property and Stock Agents Act 2002 NSW; Estate Agents Act 1980 VIC). RealFlow does not perform licensed acts itself; it assists agents who are licensed. The frontend must not present RealFlow as performing a licensed act. Any marketing copy on empty states or onboarding prompts that uses the words "buy", "sell", "negotiate", or "advise" in the first person from RealFlow's perspective must be reviewed for compliance.

---

## 7. Supabase RLS Boundary Analysis

### 7.1 Affected Surfaces and RLS Tables

The frontend modernisation reads data from the following tables. No new tables are introduced. The RLS analysis confirms that the existing policies are sufficient for the UI changes described.

| UI Surface | Tables read | RLS policy | Modernisation impact |
|---|---|---|---|
| Analytics Dashboard KPI cards | `analytics_daily_snapshots`, `transactions`, `contacts` | Agent sees only their own records (`auth.uid() = agent_id`) | None — display-only changes |
| Pipeline board (drag-and-drop) | `transactions` | Agent RLS on `transactions.agent_id` | The PUT stage update must pass through `apps/api` — direct Supabase client writes from the frontend are not permitted. RLS would block a direct frontend write anyway since the token is agent-scoped. |
| Compliance dashboard risk colours | `aml_checks` | Agent sees checks for their contacts only | None — display-only changes |
| Portal progress tracker | `portal_clients`, `transactions` | `portal_clients.contact_id` matched to authenticated portal user | Stage animation reads `currentStage` from the existing `usePortalDashboard` hook — no new queries |
| Portal document list | `documents` | Documents with `contact_id` matching portal client's contact | Document metadata exposure is unchanged; only the display components are updated |
| Mobile alerts | `property_alert_subscriptions`, `property_alert_events` | Subscription belongs to contact, contact belongs to agent | None — display-only changes |
| Team dashboard (Sprint 6) | `team_performance_snapshots`, `lead_assignment_rules` | Team lead sees own team members only | None — display-only changes |

### 7.2 New Write Path: Pipeline Stage Update from Drag-and-Drop

FEAT-UI-003 introduces a new write interaction: dragging a pipeline card. The write path must be:

```
Browser (drag-drop event)
  → PUT /api/v1/transactions/:id  (apps/api, Fastify)
  → PipelineEngine.validateTransition()
  → supabase.from('transactions').update({ current_stage: newStage })
```

The browser must NOT call Supabase directly. The frontend uses the Supabase anon/user token only for auth session retrieval; all writes go via the Fastify API. This is consistent with the existing pattern in `dashboard-client.tsx` which calls `${apiUrl}/api/v1/analytics/snapshot`.

### 7.3 Toast System — No RLS Impact

The toast notification system (FEAT-UI-004) is a pure client-side component. It consumes the result of existing mutations and does not open new database connections or make new queries.

### 7.4 Dark Mode — No RLS Impact

Dark mode is a client-side CSS variable toggle stored in `localStorage`. No database reads or writes are involved.

---

## 8. Dependencies on Existing Engines and External APIs

### 8.1 Internal Engine Dependencies

| Feature | Engine dependency | Risk |
|---|---|---|
| FEAT-UI-003 (Pipeline drag-and-drop) | `PipelineEngine.validateTransition()` in `packages/business-logic` | Medium — invalid transitions must surface as 422 errors with readable messages; confirm error contract with API team |
| FEAT-UI-005 (Compliance risk colours) | `AMLComplianceEngine` risk level field in API response | Low — the `risk_level` field is already returned; confirm enum values are `'low' | 'medium' | 'high'` |
| FEAT-UI-006 (Portal stage animation) | `PortalEngine` current stage via `usePortalDashboard` hook | Low — hook already returns `currentStage`; need to add `previousStage` tracking in local state |
| FEAT-UI-010 (Mobile alerts animation) | `PropertyAlertEngine`, Supabase Realtime channel `property_alert_events` | Medium — Realtime subscription must be stable; test with multiple devices subscribed simultaneously |
| FEAT-UI-008 (Dark mode portal) | `portal-600` colour tokens in `apps/portal/tailwind.config.ts` | Low — currently hardcoded hex, must be converted to CSS variables before dark mode mapping can work |

### 8.2 External API Dependencies

| External API | Affected feature | Risk |
|---|---|---|
| Domain.com.au (DomainClient) | Property card images in off-market / portal property lists | Low — images are already fetched; the modernisation adds `loading="lazy"` and `next/image` blur-placeholder to property images |
| Supabase Storage | Document list file type icon derivation | Low — file extension is already returned in `documents.file_path`; icon mapping is purely frontend |
| Supabase Realtime | Mobile alert list live updates (FEAT-UI-010) | Medium — channel subscription stability under load; test with 50+ simultaneous connections before sprint close |

### 8.3 Package-Level Dependencies to be Added

| Package | Version | App | Purpose | Build impact |
|---|---|---|---|---|
| `framer-motion` | `^11.x` | `apps/web`, `apps/portal` | Entrance animations, layout animations, gesture-driven interactions | Adds ~40 KB gzip to the web bundle; must be tree-shaken; verify with `webpack-bundle-analyzer` (already installed) |
| `@radix-ui/react-toast` | `^1.x` | `apps/web`, `apps/portal` | Accessible toast notifications (FEAT-UI-004) | ~8 KB gzip |
| `@radix-ui/react-dialog` | `^1.x` | `apps/web`, `apps/portal` | Accessible modal for confirmation dialogs (FEAT-UI-003 error state) | ~6 KB gzip |
| `@dnd-kit/core` | `^6.x` | `apps/web` | Drag-and-drop pipeline board (FEAT-UI-003) | ~12 KB gzip; chosen over `react-beautiful-dnd` (unmaintained) and `react-dnd` (heavier) |
| `@dnd-kit/sortable` | `^8.x` | `apps/web` | Sortable list abstraction used by dnd-kit | ~4 KB gzip |
| `react-native-reanimated` | `~3.16.x` (Expo SDK 54 compatible) | `apps/mobile` | GPU-accelerated animations (FEAT-UI-010) | Must be in `babel.config.js` plugins |
| `expo-haptics` | `~14.x` (Expo SDK 54 compatible) | `apps/mobile` | Haptic feedback (FEAT-UI-010) | Requires `app.json` Android permission |

All packages must be added to the correct `package.json` (app-level, not root). Turbo's dependency graph must be respected — no implicit imports.

---

## 9. Recommended Tech Choices

### 9.1 Web and Portal Animation: Framer Motion

**Recommendation:** Adopt Framer Motion (`framer-motion ^11.x`) for all web and portal animations.

**Rationale:**
- The existing codebase uses CSS `transition-*` and `animate-pulse` utilities. These are sufficient for hover states but inadequate for orchestrated entrance sequences, layout animations when list items are added/removed, and drag-and-drop spring physics.
- Framer Motion's `motion.div` component accepts `initial`, `animate`, and `exit` props that map naturally to the stagger patterns described in FEAT-UI-001. Variants allow a parent to orchestrate child animations with `staggerChildren` without prop-drilling.
- Framer Motion's `AnimatePresence` solves the toast unmount animation problem (FEAT-UI-004) without a custom solution.
- Framer Motion's `layout` prop handles the pipeline board card reordering animations (FEAT-UI-003) when combined with `@dnd-kit`.
- The `useReducedMotion()` hook from Framer Motion natively reads `prefers-reduced-motion` and can be used as a gate across all animation components.
- Bundle cost: ~40 KB gzip. Given RealFlow's web app already ships Recharts (~90 KB gzip), this is acceptable. Must verify with `webpack-bundle-analyzer` that tree-shaking is effective.

**Rejected alternatives:**
- **GSAP:** Licence cost for the club plugins; overkill for this feature set.
- **CSS animations only:** Cannot orchestrate complex, data-dependent sequences or handle layout animations for list item additions.
- **React Spring:** Comparable API to Framer Motion but smaller ecosystem and less documentation for Next.js App Router Server Components interop.

### 9.2 UI Primitives: Radix UI

**Recommendation:** Add `@radix-ui/react-toast` and `@radix-ui/react-dialog` (and `@radix-ui/react-dropdown-menu` if not already present) as the accessible primitive layer.

**Rationale:**
- The web app currently has no modal system and no toast system. Rolling bespoke accessible implementations is high-effort and error-prone (focus trap, aria-live region, scroll lock, portal rendering).
- Radix UI provides unstyled, WAI-ARIA-compliant primitives. Styling is done entirely with Tailwind classes, matching the existing codebase pattern.
- `@radix-ui/react-toast` handles the aria-live announcement, auto-dismiss timer, and stacking logic for FEAT-UI-004.
- The existing `packages/ui/src/components/` already has `button.ts`, `input.ts`, `card.ts`, and `badge.ts`. Radix primitives extend this layer rather than replacing it.

**Rejected alternative:**
- **shadcn/ui:** This is a code-generation tool that copies component source files into the repository. It produces excellent output but represents a significant surface area of owned code. Given the team is actively building features, owning generated component code adds maintenance burden. Adopting Radix UI primitives directly and styling them in-house gives the same outcome with explicit control.

### 9.3 Drag and Drop: @dnd-kit

**Recommendation:** Use `@dnd-kit/core` and `@dnd-kit/sortable` for the pipeline Kanban board.

**Rationale:**
- `react-beautiful-dnd` is unmaintained (last release 2022) and has open issues with React 18+ and concurrent mode.
- `react-dnd` is heavier and has a more complex context setup.
- `@dnd-kit` is actively maintained, supports touch devices natively (critical for FEAT-UI-003's touch requirement), integrates cleanly with Framer Motion layout animations, and has first-class TypeScript support.
- The accessibility story for `@dnd-kit` includes keyboard navigation (arrow key card movement) which maps directly to FEAT-UI-011's keyboard accessibility requirement.

### 9.4 Component Library Approach: Tailwind + Radix + Framer Motion, No shadcn/ui

The recommended approach is to extend the existing `packages/ui` shared package with new primitive components styled with Tailwind and animated with Framer Motion, built on Radix UI headless primitives where accessibility demands it. This is a deliberate decision not to introduce shadcn/ui at this stage to avoid owning a large corpus of auto-generated component code before the team's workflow is established.

### 9.5 Mobile Animation: React Native Reanimated + NativeWind

**Recommendation:** Use `react-native-reanimated ~3.16.x` (Expo SDK 54 compatible) for all mobile animations. Migrate all components to NativeWind v4 classes.

**Rationale:**
- Reanimated runs animations on the UI thread, bypassing the JS bridge entirely. This is the only way to achieve 60 fps animations on mid-range Android devices.
- NativeWind v4 with its JSX transform approach generates styles at build time, eliminating the `StyleSheet.create` overhead at runtime.
- Consistency: agents use both the web app (desktop) and the mobile app (on-site). A consistent visual language between the two requires a shared token system, which NativeWind v4 + the existing web Tailwind config enables.

### 9.6 Skeleton Component: Custom, in `packages/ui`

**Recommendation:** Build a single `<Skeleton />` primitive in `packages/ui/src/components/skeleton.ts` using a CSS `@keyframes` shimmer animation. Do not introduce a third-party skeleton library.

**Rationale:**
- The component is simple enough (a div with a shimmer gradient overlay) that a third-party library adds dependency weight with no benefit.
- Keeping it in `packages/ui` ensures it is shared between `apps/web` and `apps/portal` without duplication.

---

## 10. Phased Delivery Plan

Phases are ordered by visible impact-per-effort ratio. Each phase is independently shippable without requiring the next phase to be complete.

### Phase 1 — Foundation (2 weeks, highest visible impact)

**Goal:** Every page feels alive. Zero hard cuts on data load.

**Deliverables:**
- FEAT-UI-002: `<Skeleton />` primitive with directional shimmer, replacing all `animate-pulse` instances across `apps/web` and `apps/portal`.
- FEAT-UI-004: Toast notification system using `@radix-ui/react-toast`, wired to all existing mutations (send message, create workflow, mark as read, invite portal client).
- FEAT-UI-005: Typographic scale applied across all primary pages in `apps/web` (Dashboard, Contacts, Pipeline, Workflows, Inbox, Compliance).
- FEAT-UI-007: `<EmptyState />` primitive in `packages/ui`, deployed to Contacts, Workflows, and Inbox pages.

**Why first:** Skeletons, toasts, and typographic scale require no new dependencies (skeleton and scale) or trivially small ones (Radix toast). They are the difference between "looks like a prototype" and "looks like a product." Every agent who opens the app sees the improvement immediately.

**Dependencies installed in Phase 1:** `@radix-ui/react-toast`, `@radix-ui/react-dialog`.

### Phase 2 — Entrance Animation and Hierarchy (2 weeks)

**Goal:** Data arriving on screen feels intentional and prioritised.

**Deliverables:**
- FEAT-UI-001: Staggered entrance animations on KPI cards, pipeline columns, and table rows using Framer Motion.
- FEAT-UI-005 extension: Compliance dashboard risk-level colour coding (HIGH/MEDIUM/LOW row backgrounds and label colours).
- FEAT-UI-008: Dark mode implementation — CSS variable dark palette, `theme-switcher.tsx` full implementation, localStorage persistence.

**Dependencies installed in Phase 2:** `framer-motion`.

**Why second:** Framer Motion is the largest dependency addition. Phasing it after the Radix UI primitives are already battle-tested in Phase 1 reduces risk. Dark mode is bundled here because it requires the CSS variable system to be fully consistent, which Phase 1's typographic work establishes.

### Phase 3 — Interactive Pipeline and Portal Polish (2 weeks)

**Goal:** The pipeline board becomes the primary daily working surface for agents. The portal earns client trust.

**Deliverables:**
- FEAT-UI-003: Drag-and-drop pipeline board (full implementation including keyboard accessibility, API write, error revert animation).
- FEAT-UI-006: Portal progress stage animation (fill animation on stage advance, scroll-to-current on mobile).
- FEAT-UI-011: Full keyboard navigation and focus management audit + axe-core CI gate.

**Dependencies installed in Phase 3:** `@dnd-kit/core`, `@dnd-kit/sortable`.

**Why third:** Drag-and-drop is the most complex frontend feature in this modernisation — it requires coordination between `@dnd-kit`, Framer Motion layout animations, and the API write path. Doing it third ensures the animation primitives from Phase 2 are stable before being applied to a complex interactive surface.

### Phase 4 — Mobile Polish (2 weeks)

**Goal:** The mobile app matches the quality of the web app.

**Deliverables:**
- FEAT-UI-009: Full NativeWind migration of all 9 mobile components.
- FEAT-UI-010: Reanimated micro-interactions (press scale, stale card haptic, alert list entrance, tab fade).
- `expo-haptics` integration and Android permission.
- Visual regression baseline established with Detox snapshot tests for all migrated components.

**Dependencies installed in Phase 4:** `react-native-reanimated ~3.16.x` (confirm Expo SDK 54 compatibility), `expo-haptics ~14.x`.

**Why fourth:** Mobile changes require simulator and physical device testing across iOS and Android. Phasing them last ensures the web polish is already providing value while the mobile work is completed carefully, without blocking web delivery.

---

## 11. Sign-Off Checklist

All items below must be checked before this discovery document is promoted to a Sprint 7 plan and implementation begins.

### Product Owner

- [ ] Problem statement accurately reflects agent and client feedback gathered (interviews, support tickets, or NPS comments)
- [ ] Success metrics are agreed and a measurement mechanism is defined (who instruments the analytics, when the baseline is captured)
- [ ] Phased delivery plan sequence is accepted (specifically, confirm Phase 4 mobile can trail Phase 1–3 web by one sprint if team capacity requires)
- [ ] Empty state copy (FEAT-UI-007) reviewed for Australian Consumer Law compliance
- [ ] Dark mode (FEAT-UI-008) confirmed as a requirement for Sprint 7 or deferred to Sprint 8

### Engineering Lead

- [ ] Framer Motion bundle impact verified acceptable via `webpack-bundle-analyzer` on a test branch
- [ ] `@dnd-kit` confirmed compatible with Next.js 16 App Router (Server Components) — `use client` boundary placement reviewed
- [ ] `react-native-reanimated ~3.16.x` Expo SDK 54 compatibility table consulted and version pinned
- [ ] `expo-haptics ~14.x` Android manifest permission confirmed (`android.permission.VIBRATE`) in `app.json`
- [ ] Turbo build graph reviewed — new dependencies in `apps/web` and `apps/portal` do not create implicit dependency on `packages/ui` without explicit declaration in respective `package.json`
- [ ] Pre-existing type errors in `apps/api` (workflow-scheduler, PostgrestQueryBuilder, workflow-engine.ts rootDir) confirmed as not impacted by frontend changes
- [ ] Pipeline board write path confirmed: all stage updates go via `PUT /api/v1/transactions/:id`, not direct Supabase client calls from the browser
- [ ] Existing `PipelineEngine.validateTransition()` error contract documented — confirm it returns a `message` field in the 422 response body

### QA Engineer

- [ ] axe-core integration point in CI pipeline agreed (which workflow step, which threshold)
- [ ] Playwright visual regression snapshot strategy agreed for dark mode (separate snapshot sets for light and dark)
- [ ] Detox snapshot baseline capture process agreed for mobile NativeWind migration
- [ ] Reduced Motion test cases agreed — manual or automated? Which CI step?

### Design / UX

- [ ] Typographic scale values (FEAT-UI-005) reviewed and approved — specifically `text-3xl font-bold tracking-tight` for page title versus the current `text-2xl font-bold`
- [ ] Illustration assets for empty states (FEAT-UI-007) produced or sourced — SVG, brand colours, no raster images
- [ ] Dark mode palette (`#0f172a` background, `#1e293b` card, `#334155` border) approved
- [ ] Animation timing values (stagger 60 ms / 40 ms / 30 ms, entrance 300 ms, drag lift 150 ms) reviewed for feel and approved
- [ ] Portal stage animation behaviour reviewed — specifically the scroll-to-current behaviour on mobile viewport

### Compliance / Legal

- [ ] PII masking groundwork (FEAT-UI-005 — `maskPII` prop) confirmed as not conflicting with any current Privacy Act disclosure obligations
- [ ] Compliance dashboard risk colouring (HIGH/MEDIUM/LOW) reviewed against internal AML risk classification policy — confirm the colour assignment does not inadvertently suppress or de-emphasise records
- [ ] Empty state copy reviewed for ACL (Australian Consumer Law) compliance

---

*Document produced by RealFlow Requirements Analyst agent. All file paths in this document are absolute. Implementation should not begin until the sign-off checklist is complete.*
