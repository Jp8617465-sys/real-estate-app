# Sprint 9 Plan — Ship & Surface

**Sprint:** 9
**Theme:** Ship & Surface
**Start:** 2026-04-23
**Target End:** 2026-04-30
**Branch:** `claude/review-project-plan-FJeCD`
**Test baseline:** 1,978 passing

---

## Goal

Get RealFlow to production for the first time. Surface the AI assistant in the web app. No new backend features until the product is live and observable.

**Definition of done:** Smoke test passes on production URL. AI assistant UI is accessible in the web app. Sentry is capturing errors.

---

## Sprint Backlog

### P0 — Production Deploy (Feature 9.1)

**Blocker. Nothing else ships until this is done.**

| Task | Owner | Notes |
| ---- | ----- | ----- |
| Audit env vars against `apps/api/.env.example` | Claude | Cross-ref DEPLOY_CHECK_SPRINT6.md list of 11 missing vars |
| Confirm Render service `srv-d6logk450q8c73a884pg` is active | Human | Render MCP check |
| Run `npm run build` — verify 0 errors | Claude | All 4 apps must build clean |
| Check Supabase migration history (00001–00026 applied?) | Claude | Supabase MCP |
| Run `/deploy-staging` | Claude | Render MCP trigger + wait for healthy |
| Run `/smoke-test https://realflow-api-staging.onrender.com` | Claude | 5-point check |
| **[HUMAN GATE] Approve staging** | Human | Review smoke test output |
| Run `/deploy-production` | Claude + Human | Human confirmation required |
| Run `/smoke-test https://realflow-api.onrender.com` | Claude | Confirm production healthy |

**Acceptance criteria:**
- `GET /health` returns 200 on production URL
- `POST /api/v1/auth/login` without body returns 400 (not 404)
- `GET /api/v1/contacts` without token returns 401
- `GET /api/v1/contacts` with invalid token returns 401
- All 5 smoke test checks pass

---

### P1 — AI Assistant Frontend (Feature 9.2)

Depends on 9.1. Backend is fully built (`apps/api/src/routes/assistant.ts`, `AssistantService`, 10 CRM tools). This is purely frontend work.

**Design decision needed:** Where does the assistant UI live?

**Recommended:** Floating panel (bottom-right corner of web app). Accessible from any page. Opens as a slide-up drawer on mobile.

| Task | File | Notes |
| ---- | ---- | ----- |
| Create `useAssistant` hook | `apps/web/src/hooks/use-assistant.ts` | SSE streaming via `EventSource`, message state, tool result handling |
| Create `AssistantPanel` component | `apps/web/src/components/assistant-panel.tsx` | Input, message list, streaming indicator |
| Create `AssistantMessage` component | `apps/web/src/components/assistant-message.tsx` | Render text + inline tool results (contact card, deal card) |
| Wire up to layout | `apps/web/src/app/layout.tsx` | Add panel toggle button + `AssistantPanel` to root layout |
| Add conversation persistence | `use-assistant.ts` | POST to `/api/v1/assistant`, store `conversationId` in state |

**Acceptance criteria:**
- Agent can open assistant panel from any page
- Agent can type a message and receive a streamed response
- Tool results (e.g., "show me today's tasks") render as structured cards, not raw JSON
- Conversation persists within a session (no reset on page navigate)

---

### P1 — Production Monitoring (Feature 9.4)

Depends on 9.1. Set up Sentry in the API so errors are visible from day one.

| Task | File | Notes |
| ---- | ---- | ----- |
| Install `@sentry/node` in API | `apps/api/package.json` | Already referenced in middleware as a plugin stub |
| Configure Sentry DSN via env var | `apps/api/src/index.ts` | `SENTRY_DSN` env var |
| Wire `errorHandler` to Sentry | `apps/api/src/middleware/error-handler.ts` | `Sentry.captureException()` before replying 500 |
| Add `SENTRY_DSN` to Render env vars | Render dashboard | Human action |

**Acceptance criteria:**
- A deliberate `throw new Error('sentry test')` in a route is captured in Sentry dashboard
- Unhandled 500s surface in Sentry with stack trace and request context

---

### P2 — Frontend Polish MVP (Feature 9.3)

Depends on 9.1. Minimal set of visual improvements to make demos compelling. Do NOT attempt full frontend modernisation in this sprint — that is a Horizon 2 item.

**Scope:** Three screens only. Pipeline board, contacts list, dashboard.

| Task | File | Notes |
| ---- | ---- | ----- |
| Pipeline board: drag-and-drop columns | `apps/web/src/app/(dashboard)/pipeline/` | `@dnd-kit/core` — already noted in Sprint 7 delivery |
| Dashboard: entrance animation on stat cards | `apps/web/src/app/(dashboard)/dashboard/` | Framer Motion `fadeInUp` — 200ms delay stagger |
| Contacts list: skeleton loader pulse | `apps/web/src/app/(dashboard)/contacts/` | Replace static grey blocks with animated pulse |
| Dark mode toggle in nav | `apps/web/src/components/` | Tailwind `dark:` class toggle, `localStorage` persist |

**Acceptance criteria:**
- Pipeline deals can be dragged between columns and the move persists (API call on drop)
- Dashboard stat cards animate in on first render
- Contacts list shows pulsing skeleton while data loads
- Dark mode toggle works and persists across page reloads

---

## What Is Explicitly Out of Scope for Sprint 9

- New API routes or business logic engines
- Stripe live mode activation (Sprint 10)
- Contact CSV import (Sprint 10)
- E2E tests / Playwright (Sprint 10)
- Mobile TestFlight distribution (Sprint 10)
- Admin dashboard (Sprint 11+)
- Social publishing UI improvements (Sprint 11+)

---

## Dependency Order

```
9.1 Production Deploy
  └─ 9.4 Sentry monitoring
  └─ 9.2 AI assistant frontend
  └─ 9.3 Frontend polish MVP
```

All P1/P2 work begins only after 9.1 is complete and production smoke test passes.

---

## Key Files

| Area | Path |
| ---- | ---- |
| AI assistant route | `apps/api/src/routes/assistant.ts` |
| AssistantService | `apps/api/src/services/ai-assistant/assistant-service.ts` |
| Tool registry | `apps/api/src/services/ai-assistant/tool-registry.ts` |
| AnthropicClient | `packages/integrations/src/ai/client.ts` |
| Web app layout | `apps/web/src/app/layout.tsx` |
| Web hooks dir | `apps/web/src/hooks/` |
| Error handler | `apps/api/src/middleware/error-handler.ts` |
| Env example | `apps/api/.env.example` |
| Deploy check doc | `docs/sprints/DEPLOY_CHECK_SPRINT6.md` |
| Smoke test script | Defined in CLAUDE.md |

---

## Sprint 9 Risks

| Risk | Mitigation |
| ---- | ---------- |
| Env vars still missing in Render | Audit before deploy; block if any required var is absent |
| SSE streaming (`EventSource`) CORS issues | Configure CORS on assistant route to allow web origin |
| Migration gaps at 00012/00013 | Check Supabase migration status before staging deploy |
| DnD-kit not installed | Check `apps/web/package.json`; install if missing |
| Framer Motion bundle size | Import only what's needed; check bundle size before ship |
