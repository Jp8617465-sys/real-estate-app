# Client Portal — Discovery Document

**Feature:** Client Portal (Sprint 5)
**Status:** Discovery — Ready for Sprint Planning
**Date:** 2026-03-02
**Author:** Requirements Discovery (Claude Code)
**Sprint context:** Sprint 4 complete; portal scaffold exists at `apps/portal/`

---

## 1. Feature Overview

### The Problem

Buyers agents in Australia charge $10,000–$25,000 per engagement. Clients paying that fee expect transparency and regular communication. Today, agents deliver updates via ad hoc WhatsApp messages, email threads, and phone calls. The result is:

- Clients feel out of the loop between agent check-ins
- Agents spend 30–60 minutes per week per client on status updates that could be self-served
- When clients want to review their search criteria or find a document, they must contact the agent
- There is no persistent record of what was agreed (brief sign-off) or what was shared (documents, inspection reports)

### The Solution

A secure, read-only web portal where the buyer sees exactly what their agent sees — in real time. The portal does not replace the agent relationship; it reinforces it. The agent remains in full control of what is visible. The client gains confidence through transparency, which directly justifies the buyers agent fee.

### Why This Is the Highest-Priority Sprint 5 Feature

The strategic roadmap (Section 3, Decision 3) explicitly ranks the client portal above social media integration because it is **revenue-critical**. It directly supports the argument buyers agents make when closing new engagements: "You will have full visibility into everything we do for you." No competitor CRM built for buyers agents offers this today.

### What Already Exists (Do Not Rebuild)

The portal scaffold is significantly more advanced than a blank slate. The following is already built and partially functional in `apps/portal/`:

| Component | Location | Status |
|-----------|----------|--------|
| Magic link auth + middleware | `apps/portal/src/app/auth/`, `middleware.ts` | Working |
| Auth callback route | `apps/portal/src/app/auth/callback/route.ts` | Working |
| Dashboard with pipeline progress | `apps/portal/src/app/page.tsx` | Working |
| Brief read-only view | `apps/portal/src/app/brief/page.tsx` | Working |
| Property shortlist with match scores | `apps/portal/src/app/properties/page.tsx` | Working |
| Key dates / timeline | `apps/portal/src/app/timeline/page.tsx` | Working |
| Documents list + upload + download | `apps/portal/src/app/documents/page.tsx` | Working |
| Due diligence progress view | `apps/portal/src/app/due-diligence/page.tsx` | Exists |
| Messages thread | `apps/portal/src/app/messages/page.tsx` | Exists |
| Portal API routes (3 endpoints) | `apps/api/src/routes/portal.ts` | Partial |
| `portal_clients` DB table + RLS | Migration `00005` | Done |
| Documents RLS (portal read) | Migration `00005` | Done |

Sprint 5 is about **completing and hardening** the portal, not starting from scratch. The gaps are: brief sign-off flow, inspection feedback forms, agent visibility controls, deeper API coverage, and production-grade RLS for all relevant tables.

---

## 2. User Personas

### Primary Persona: The Buyer/Client

**Name:** Sarah, 38, first-home buyer
**Situation:** Has engaged a buyers agent after six months of unsuccessful searching alone. She is not a real estate expert. She has paid an engagement fee and wants to feel that money is working for her.
**Behaviours:**
- Checks the portal on her phone during lunch breaks and evenings
- Forwards the portal link to her partner who wants to stay informed
- Gets anxious when she has not heard from her agent in 3+ days
- Does not understand industry jargon (vendor, settlement, cooling off)

**Portal needs:**
- See where she is in the process in plain language
- Know which properties her agent is considering
- Be able to sign off on her brief so the search can formally begin
- Download documents without having to ask the agent
- Send a quick message without calling

**Pain points if portal is poorly designed:**
- Confusion about what each pipeline stage means
- Inability to find documents she has been told were shared
- No way to give feedback on a property she has inspected

---

### Secondary Persona: The Buyers Agent

**Name:** Michael, 45, boutique buyers agent with 30 active clients
**Situation:** Manages the full lifecycle for each client using RealFlow's web and mobile apps. The portal is his primary tool for reducing inbound client queries.
**Behaviours:**
- Controls what each client sees (may want to hide speculative matches)
- Updates property match statuses to reflect client decisions
- Shares documents via the documents section rather than email attachments
- Uses inspection notes to inform the brief

**Portal needs:**
- Toggle which property matches are visible to the client
- Know whether a client has viewed a document or match
- Write agent notes on matches that the client can see
- Trigger a brief sign-off request from inside RealFlow web

**Pain points if controls are absent:**
- A client sees a speculative match and calls immediately — wasted conversation
- A client sees an internal note not intended for them
- No way to know if the client has actually read their brief before escalating to the next stage

---

### Tertiary Persona: The Agency Principal

**Name:** Lisa, principal of a 4-agent boutique buyers agency
**Situation:** Oversees agents and is responsible for compliance and client satisfaction.
**Behaviours:**
- Reviews portal usage in aggregate to assess agent adoption
- Wants confirmation that AML/KYC documents are being collected
- May access the portal on behalf of a client if an agent is unavailable

**Portal needs (Sprint 5 scope: limited):**
- Confidence that data isolation is correct (client A cannot see client B's data)
- Audit trail of brief sign-offs
- (Sprint 6) Multi-agent oversight dashboard

---

## 3. User Stories (Given/When/Then Format)

### Story 1 — Magic Link Login

**As a** client,
**I want to** sign in to my portal without a password,
**so that** I can access my account securely without remembering credentials.

```
Given I have been sent a magic link by my buyers agent
When I click the link in my email
Then I am authenticated and redirected to the portal dashboard
And my session persists for 7 days before requiring re-authentication
And if the link has expired (>1 hour) I am shown a clear expiry message with a re-request option
```

**Notes:** Auth page already exists at `apps/portal/src/app/auth/page.tsx` using `supabase.auth.signInWithOtp`. The callback route at `/auth/callback/route.ts` handles the token exchange. The middleware in `middleware.ts` protects all non-auth routes.

---

### Story 2 — Brief Review

**As a** client,
**I want to** read my property search criteria in plain language,
**so that** I can confirm my agent has captured my requirements accurately.

```
Given I am authenticated and my agent has created a client brief
When I navigate to "My Brief"
Then I see all key brief fields rendered in human-readable format (not database field names)
And I see the brief version number and the date it was last updated
And I can see whether the brief has been signed off
And if no brief exists yet, I see a friendly placeholder explaining what a brief is
```

**Notes:** The brief read-only page exists at `apps/portal/src/app/brief/page.tsx`. It renders budget, requirements, suburbs (ranked), must-haves, nice-to-haves, deal-breakers, timeline, communication preferences, and solicitor details. The `client_signed_off` boolean and `brief_version` integer are stored in `client_briefs`.

---

### Story 3 — Brief Sign-Off

**As a** client,
**I want to** formally acknowledge my brief is correct,
**so that** my agent can proceed with confidence that we are aligned.

```
Given I have reviewed my brief and it is accurate
When I click "Acknowledge and Sign Off"
Then I am shown a confirmation dialogue summarising the key criteria
And upon confirming, the brief is marked as signed off with a timestamp
And the sign-off date and my name are recorded in the audit trail
And my agent receives a notification that sign-off has been completed
And I can no longer sign off a brief that is already signed off (idempotent)
And if a brief is updated after sign-off, the new version is presented as requiring fresh acknowledgement
```

**Notes:** The `POST /:id/sign-off` route exists in `apps/api/src/routes/client-briefs.ts`. It sets `client_signed_off: true` and `signed_off_at`. The portal must expose this as a client-triggered action. A new portal API endpoint is needed since the existing sign-off route is agent-authenticated. The sign-off is an acknowledgement, not a legal e-signature — see Section 7 for the regulatory analysis.

---

### Story 4 — Property Shortlist

**As a** client,
**I want to** see which properties my agent has identified for me,
**so that** I can review them and provide feedback without having to wait for a call.

```
Given my agent has matched properties to my brief with status "sent_to_client" or later
When I navigate to "Property Shortlist"
Then I see each property with its address, key features (beds, baths, car spaces), price guide, match score, and agent notes
And properties are sorted by match score descending
And I can see the status of each property (Awaiting Review, Interested, Inspection Booked, Passed)
And I can indicate interest or pass on a property, which updates the status for my agent
And passed properties are shown in a collapsed section at the bottom
And properties with status "new" (not yet sent to client) are NOT visible to me
```

**Notes:** The property shortlist page exists at `apps/portal/src/app/properties/page.tsx` using `usePortalProperties`. The hook queries `property_matches` filtered by `client_id` and ordered by `overall_score`. The status filter for client-visible statuses (`sent_to_client`, `client_interested`, `inspection_booked`, `rejected`, `under_review`) needs to be enforced at the RLS or query level — see Section 8. Feedback (client_interested / rejected) requires a new mutation from the portal side.

---

### Story 5 — Inspection Calendar and Feedback

**As a** client,
**I want to** see upcoming inspections and provide feedback after attending,
**so that** my agent can refine the search based on my real-world reactions.

```
Given my agent has logged one or more inspections linked to my contact
When I navigate to "Inspections" (new page, Sprint 5)
Then I see each inspection with the property address, date, time, and agent's overall impression
And I can submit a feedback form for any past inspection I attended (rating + free text)
And submitted feedback is visible to my agent in the CRM
And upcoming inspections show the date, time, and address prominently
And I can add an inspection to my device calendar via an ICS export link
```

**Notes:** The `inspections` table exists (migration `00003`). It has `inspection_date`, `overall_impression`, `condition_notes`, `area_feel_notes`, `client_suitability`, `agent_notes`. A client feedback mechanism (client rating + client comment fields) does not yet exist in the schema and will need to be added. A new portal page `/inspections` is required. There is no existing portal hook for inspections.

---

### Story 6 — Document Access

**As a** client,
**I want to** view and download documents my agent has shared with me,
**so that** I have a single source of truth for contracts, reports, and correspondence.

```
Given my agent has uploaded documents linked to my contact record
When I navigate to "Documents"
Then I see all documents grouped by category (Contracts, Reports, Correspondence, Other)
And each document shows its name, file size, upload date, and a download button
And downloading opens the document in a new tab via a time-limited signed URL (1 hour expiry)
And I can upload my own documents (e.g. bank statements, ID for the agent's records)
And documents I upload are visible to my agent
And deleted documents (soft-deleted) do not appear
```

**Notes:** This page is already working at `apps/portal/src/app/documents/page.tsx`. Upload uses Supabase Storage at `documents/{contactId}/{timestamp}_{filename}`. Download uses `createSignedUrl` with 3600s expiry. The existing RLS policy in migration `00005` (`documents_portal_read`) allows clients to read documents where `contact_id` matches their portal client record. Client-uploaded documents set `uploaded_by` to the client's `auth.uid()` — a separate RLS policy (`documents_own`) already covers this.

---

### Story 7 — Progress Tracker

**As a** client,
**I want to** see where I am in the property buying process,
**so that** I understand what has happened and what comes next without having to ask.

```
Given I am authenticated
When I view the dashboard
Then I see a visual pipeline tracker showing all 8 buyers agent stages
And completed stages are visually distinct from the current and future stages
And the current stage name is shown in plain English (not "consult-qualify", but "Consultation and Qualification")
And I see a brief explanation of what the current stage involves
And key dates relevant to the current stage are surfaced on the dashboard
And if I am post-settlement, I see a congratulatory state
```

**Notes:** The dashboard at `apps/portal/src/app/page.tsx` already renders the 8-stage pipeline from `BUYERS_AGENT_STAGE_ORDER` and `BUYERS_AGENT_STAGE_LABELS` from `@realflow/shared`. The current stage comes from `transactions.current_stage` via `usePortalDashboard`. Plain-English stage descriptions are not yet added — this requires adding a description map for each stage label.

---

### Story 8 — Agent Controls (Agent-Facing)

**As a** buyers agent,
**I want to** control which properties and information are visible to my client in the portal,
**so that** I can manage client expectations and present information at the right time.

```
Given I am managing a client's search in RealFlow web
When I set a property match status to "sent_to_client" or later
Then that property becomes visible in the client's portal
And if I set a match status to "new" or "under_review", it is hidden from the client
When I toggle a document as "portal visible" (new field, Sprint 5)
Then that document appears in the client's portal regardless of who uploaded it
When I write agent notes on a property match
Then those notes are shown in the client's portal
When I complete a brief sign-off request from within RealFlow web
Then the client receives an email prompting them to review and acknowledge their brief
```

**Notes:** The agent-side controls for property match visibility are already implicit in the status field — the portal should filter to show only `sent_to_client`, `client_interested`, `inspection_booked`, `rejected` statuses. A `portal_visible` boolean on the `documents` table does not yet exist but is needed to give agents explicit control over which documents appear. The agent triggers the sign-off flow from `apps/web`.

---

### Story 9 — Mobile Access

**As a** client on my phone,
**I want to** access all portal features without pinching and zooming,
**so that** I can check my search progress anywhere.

```
Given I am using a mobile browser (iOS Safari or Android Chrome)
When I access any portal page
Then all text is readable without zooming
And all tap targets are at least 44x44pt
And the navigation is accessible via a bottom or top mobile-friendly menu
And the property shortlist uses a single-column card layout on small screens
And the key dates timeline is scrollable without horizontal overflow
And document downloads open correctly in the mobile browser
```

**Notes:** The existing portal uses Tailwind CSS with responsive breakpoints (`sm:`, `lg:`). The pipeline tracker in `page.tsx` already handles mobile with `sm:hidden` labels and a fallback text display. The property card grid uses `sm:grid-cols-2 lg:grid-cols-3`. Further testing on iOS Safari is required for file download behaviour.

---

## 4. Acceptance Criteria

### Story 1 — Login
- [ ] Magic link is sent when client submits their email address
- [ ] Clicking the link within 1 hour authenticates and redirects to dashboard
- [ ] Clicking an expired link shows a clear error with a re-request option
- [ ] Non-portal users (agents) who attempt to sign in are shown an appropriate error or redirected
- [ ] Authenticated session persists across browser restarts within the 7-day window
- [ ] Signing out clears all local state and redirects to `/auth`

### Story 2 — Brief Review
- [ ] All brief fields with data are rendered; empty optional fields are omitted
- [ ] Budget is formatted in AUD with appropriate locale formatting (`en-AU`)
- [ ] Suburb list shows suburbs in rank order with state and postcode
- [ ] Must-haves, nice-to-haves, and deal-breakers are visually distinct
- [ ] Brief version number and last-updated date are displayed in the header
- [ ] If no brief exists, a friendly empty state is shown (not a raw error)

### Story 3 — Brief Sign-Off
- [ ] The sign-off button is only shown when the brief is in "Draft" status
- [ ] A confirmation modal summarises the key criteria before committing
- [ ] On confirmation, `client_signed_off` is set to `true` and `signed_off_at` is recorded
- [ ] The sign-off action is only callable by an authenticated portal client (not an agent)
- [ ] After sign-off, the UI shows a "Signed Off" badge with the sign-off date
- [ ] The agent receives a notification (in-app or email) when sign-off occurs
- [ ] Sign-off on a version-bumped brief creates a fresh acknowledgement requirement

### Story 4 — Property Shortlist
- [ ] Only properties with status `sent_to_client`, `client_interested`, `inspection_booked`, or `rejected` are shown
- [ ] Properties with status `new` or `under_review` are not visible to the client
- [ ] Match score is displayed as a percentage with colour coding (green 90+, amber 75–89, orange 60–74)
- [ ] Agent notes are shown on the property card when present
- [ ] Clicking "Interested" transitions status to `client_interested`
- [ ] Clicking "Pass" transitions status to `rejected`
- [ ] Passed properties are collapsed into a secondary section
- [ ] Empty state is shown when no properties have been sent

### Story 5 — Inspection Feedback
- [ ] Upcoming and past inspections are listed, sorted by date
- [ ] Past inspections show a "Submit Feedback" button
- [ ] Feedback form accepts a star rating (1–5) and free-text comment (max 500 characters)
- [ ] Submitted feedback is stored and visible to the agent in RealFlow web
- [ ] An inspection that already has client feedback shows the feedback rather than the form
- [ ] ICS calendar export link is available for upcoming inspections
- [ ] Inspections with `is_deleted = true` are not shown

### Story 6 — Documents
- [ ] Documents are fetched filtered by `contact_id` and `is_deleted = false`
- [ ] Documents are grouped by category with clear headings
- [ ] Download uses a 1-hour signed URL (Supabase Storage)
- [ ] Upload accepts all file types; enforces a 50 MB max file size client-side
- [ ] Uploaded documents appear immediately after upload (optimistic or refetch)
- [ ] Documents not marked `portal_visible` (agent's internal docs) are hidden from the client
- [ ] No document from another client's contact record is accessible, enforced by RLS

### Story 7 — Progress Tracker
- [ ] All 8 pipeline stages are shown in order
- [ ] Completed stages are visually distinct (tick mark, green)
- [ ] Current stage is highlighted with a ring or badge
- [ ] Each stage shows a plain-English label (not the enum value)
- [ ] On mobile, stage labels collapse to a summary text showing the current stage name
- [ ] Dashboard stats (properties count, documents count, key dates count, DD completion) are accurate
- [ ] Unread message count badge is shown when there are unread messages

### Story 8 — Agent Controls
- [ ] Property match statuses `new` and `under_review` are hidden from the portal at the RLS or query level
- [ ] `portal_visible` boolean on documents is respected — only `portal_visible = true` documents appear
- [ ] Agent notes on property matches are readable by the portal client
- [ ] Agent can trigger a sign-off invitation from RealFlow web dashboard
- [ ] Agent receives a notification when client signs off on their brief

### Story 9 — Mobile
- [ ] All pages pass a basic mobile usability audit (Chrome DevTools device emulation, iPhone SE viewport)
- [ ] No horizontal scroll on any page
- [ ] All interactive elements have a minimum tap target of 44x44pt
- [ ] File downloads work on iOS Safari (open in new tab, not blocked)
- [ ] The authentication email renders correctly in Gmail and Apple Mail mobile clients

---

## 5. Out of Scope (Sprint 5)

The following are explicitly excluded from Sprint 5 to prevent scope creep. They belong in Sprint 6 or later.

| Excluded Item | Reason | Future Sprint |
|---------------|--------|--------------|
| Client self-registration | Agents must create portal invitations; open registration creates data isolation risk | Sprint 6 |
| Two-factor authentication (TOTP/SMS) | Magic link is sufficient security for v1; 2FA adds friction | Post-GA |
| Real-time notifications (push) | Polling at 30s intervals is acceptable for v1 | Sprint 6 |
| Chat with file attachment support | Basic text messaging is sufficient for Sprint 5 | Sprint 6 |
| Offer management in portal | Clients view offer status only; strategy and negotiation are agent-only | Sprint 6 |
| Client-editable brief fields | Brief is created and edited by the agent; client can only acknowledge | Sprint 6 |
| Multi-property comparison view | Nice to have, but not essential for core portal value | Sprint 6 |
| Portal white-labelling (agency branding) | Important for agency adoption but requires theme engine work | Sprint 6 (existing theme groundwork) |
| Client referral tracking | Marketing feature, not client experience | Sprint 6 |
| Offline mode (PWA) | Service worker scope is significant; not needed for v1 | Post-GA |
| Agency principal oversight view | Multi-agent visibility requires additional RLS complexity | Sprint 6 |
| Brief version history / diff view | Full version history UI is complex; current version only for Sprint 5 | Sprint 6 |
| Electronic signature with legal force | Acknowledgement flow is sufficient; formal e-sig integration (DocuSign, Adobe Sign) deferred | Post-GA |
| AML/KYC document collection via portal | AML docs are agent-collected; portal is not a verification channel in v1 | v1.5 |

---

## 6. Mobile Requirements

### Must Work on Mobile (Phones)

Everything in the client portal must be fully functional on mobile browsers. Clients are predominantly phone users.

| Feature | Mobile Requirement |
|---------|-------------------|
| Authentication (magic link) | Email opens on phone; clicking the link launches the mobile browser and authenticates |
| Dashboard + pipeline tracker | Single-column layout; current stage shown as text below the tracker on small screens |
| Brief read-only view | All section cards stack vertically; label/value pairs stack on top of each other on narrow screens |
| Brief sign-off button | Full-width button; confirmation modal is scrollable if brief summary is long |
| Property shortlist | Single-column card layout on mobile (`grid-cols-1`); two-column on tablet (`sm:grid-cols-2`) |
| Property interest/pass actions | Tap targets minimum 44pt; clear visual state after tapping |
| Inspection list + feedback form | Inline form; avoids modal overlays where possible on small screens |
| Key dates timeline | Vertical layout (already implemented); no horizontal scroll |
| Documents list | Full-width rows; file type icon + name truncated with ellipsis; download button right-aligned |
| Document upload | Native file picker works on iOS/Android; no drag-and-drop required on mobile |
| Messages | Full-screen chat view on mobile; send button is prominent |

### Desktop-Only Acceptable (Sprint 5)

| Feature | Rationale |
|---------|-----------|
| Multi-column document grid | List view is cleaner on mobile and sufficient |
| Side-by-side property comparison | Out of scope entirely for Sprint 5 |
| Detailed inspection photo viewer | Out of scope; photos are agent-only in Sprint 5 |

### Mobile Browser Targets

- iOS 16+ / Safari
- Android 10+ / Chrome
- Do not support Internet Explorer or legacy Edge

### Mobile Testing Checklist (Per Page)

Before any page ships, it must pass:
1. Chrome DevTools device emulation at 375px (iPhone SE) and 390px (iPhone 14)
2. Real-device smoke test on iOS Safari (most common AU mobile browser)
3. No horizontal overflow (`overflow-x: hidden` on root is not a fix — find the cause)
4. Touch input only (no hover-dependent interactions)

---

## 7. Australian Regulatory Considerations

### 7.1 Privacy Act 1988 (Cth)

**Applicable:** Yes. The portal stores and displays personal information about individuals (clients/buyers). The Privacy Act 1988 and the Australian Privacy Principles (APPs) apply.

**What client data is stored and displayed in the portal:**

| Data Category | Where Stored | Portal Displays |
|---------------|-------------|-----------------|
| Name, email, phone | `contacts` table | Name shown in welcome message |
| Property search criteria (budget, suburbs, requirements) | `client_briefs` table | Full brief read-only view |
| Financial information (budget, pre-approval amount, lender) | `client_briefs` table | Budget range displayed; pre-approval details visible |
| Property match decisions and notes | `property_matches` table | Match scores, agent notes, status |
| Inspection records and agent observations | `inspections` table | Inspection dates and agent impression |
| Documents (contracts, valuations, ID scans) | Supabase Storage + `documents` table | Document list and download |
| Key dates and transaction milestones | `key_dates` table | Full timeline |
| Messages between client and agent | `conversation_messages` table | Full message thread |

**APP obligations:**

- **APP 1 (Open and transparent management):** The portal must link to a Privacy Policy explaining what data is collected, how it is used, and who it is disclosed to. This policy must exist before the portal is publicly accessible.
- **APP 5 (Notification of collection):** Clients must be notified at the point of portal invitation (the magic link email) that their personal information will be accessible in the portal and who can see it.
- **APP 6 (Use and disclosure):** Client brief data may only be used to support the buyer's agent engagement. It must not be used for marketing without explicit consent.
- **APP 11 (Security):** Data must be protected against misuse, interference, loss, and unauthorised access. Supabase RLS is the primary control; see Section 8. Signed URLs for document downloads expire after 1 hour.
- **APP 12 (Access to information):** Clients have the right to access their personal information. The portal partially satisfies this right. A formal data subject access process should be documented.

**Consent:** The portal engagement should be initiated via a written or electronic consent step. The magic link invitation email should include language such as: "By accessing your client portal, you acknowledge that [Agency Name] will collect, store, and display your property search information as described in our Privacy Policy." A checkbox acknowledgement on first login is recommended.

**Data retention:** Client data must not be retained beyond the period necessary for the purpose of collection. At the end of an engagement, the agent should deactivate the `portal_clients` record (`is_active = false`). A data retention policy needs to be documented (recommended: retain for 7 years to align with AML retention requirements — see 7.3).

---

### 7.2 Real Estate Agency Obligations — Document Sharing

**Applicable legislation:** Real estate agent licensing and conduct obligations vary by state.

| State | Legislation | Relevant Obligation |
|-------|-------------|---------------------|
| NSW | Property and Stock Agents Act 2002 | Agents must act in the client's best interests; documents forming part of a transaction must be provided to clients |
| VIC | Estate Agents Act 1980 | Agent must not withhold information material to the client's decision |
| QLD | Property Occupations Act 2014 | Similar general obligations to NSW and VIC |
| WA | Real Estate and Business Agents Act 1978 | Client entitled to copies of documents relevant to their transaction |

**Portal implication:** The portal satisfies the agent's obligation to provide documents to the client in a structured, auditable way. The `documents` table records the upload timestamp and the `uploaded_by` user ID. This creates a basic audit trail of what was shared and when.

**Contracts of sale:** The portal allows clients to download contracts. Agents should ensure that the version uploaded matches the version executed. The portal does not execute contracts — it is a distribution mechanism only.

**Due diligence reports:** Clients can view the DD checklist completion status and read item notes. This is read-only; they cannot modify checklist items.

---

### 7.3 AML/KYC — Anti-Money Laundering and Counter-Terrorism Financing Act 2006

**Applicable:** Buyers agents who provide a "designated service" (facilitating the purchase of real property) are reporting entities under the AML/CTF Act 2006 and must conduct customer due diligence (CDD).

**Portal implication for Sprint 5:**

The portal is NOT a channel for AML document collection in Sprint 5. AML/KYC documents (driver's licence, passport, utility bill) are collected by the agent using the `aml_checks` and `aml_identity_documents` tables built in Sprint 4. These tables have explicit RLS policies that prevent client-side access.

The documents section of the portal must NOT display documents categorised as AML identity documents. A filter on `category != 'aml_identity'` (or equivalent) must be applied.

AUSTRAC retention requirement: AML records must be retained for 7 years after the customer relationship ends. The soft-delete pattern used throughout the codebase satisfies this (no physical deletion).

---

### 7.4 Electronic Acknowledgement vs E-Signature

**Question:** Is a client clicking "Acknowledge and Sign Off" on their brief legally equivalent to a signature?

**Analysis:**

- The Electronic Transactions Act 1999 (Cth) and state equivalents recognise electronic signatures as valid where the parties have indicated their agreement to use electronic means.
- A brief acknowledgement in the portal is not a contract — it is an agreement between the client and agent on the scope of the search mandate. It does not need to meet the same evidentiary standard as a contract for the sale of land.
- The acknowledgement should record: who clicked (auth user ID), when (ISO timestamp), what version of the brief was acknowledged, and the IP address or device fingerprint if feasible.
- The buyers agent's engagement letter (signed separately, typically via email or DocuSign) is the binding contract. The brief sign-off is an operational alignment tool.

**Recommendation for Sprint 5:** Implement acknowledgement (not legal e-signature). Record `signed_off_at` timestamp and the client's `auth_id`. Display the sign-off date to both agent and client. This is sufficient for v1. Formal e-signature integration (DocuSign, Adobe Sign) is deferred post-GA.

---

## 8. Supabase RLS Boundary Analysis

### 8.1 Auth Context Distinction

The portal uses Supabase Auth with the anon key. Portal clients authenticate as Supabase Auth users but are NOT rows in the `users` table (that table holds agents). The helper functions `get_current_user_id()` and `get_current_user_office_id()` in migration `00002` will return NULL for a portal client's `auth.uid()`, which means any agent RLS policy based on these functions will correctly deny access to portal clients.

This is a critical security property: **portal clients cannot accidentally see agent data through existing RLS policies.** All portal-specific policies must be written using `auth.uid() = portal_clients.auth_id` as the anchor.

### 8.2 Existing RLS Policies (Portal-Relevant)

| Table | Existing Policy | Assessment |
|-------|----------------|------------|
| `portal_clients` | `portal_clients_own_select`: `auth.uid() = auth_id` | Correct. Client sees only their own record. |
| `portal_clients` | `portal_clients_agent_all`: `auth.uid() = agent_id` | Correct. But `agent_id` in `portal_clients` is the `users.id` UUID, not the `users.auth_id`. This policy will fail for agents unless `agent_id` is compared to `auth.uid()` via a join. Needs verification. |
| `documents` | `documents_portal_read`: Client sees docs where their `contact_id` matches | Correct but incomplete — no filter on `portal_visible`. Sprint 5 adds this column. |
| `documents` | `documents_own`: Uploader sees all docs they uploaded | Correct. Client-uploaded docs are covered. |

### 8.3 Missing RLS Policies (Must Be Created in Sprint 5 Migration)

The following tables lack portal client read policies. All must be added in a new migration (suggested: `00014_client_portal_rls.sql`).

#### `client_briefs`

```sql
-- Portal clients can read their own brief
CREATE POLICY client_briefs_portal_select ON client_briefs
  FOR SELECT
  USING (
    contact_id IN (
      SELECT contact_id FROM portal_clients
      WHERE auth_id = auth.uid() AND is_active = true
    )
  );

-- Portal clients can sign off their own brief (UPDATE client_signed_off only)
-- Implemented via a dedicated API endpoint with RLS bypass (service role),
-- or a restrictive UPDATE policy:
CREATE POLICY client_briefs_portal_signoff ON client_briefs
  FOR UPDATE
  USING (
    contact_id IN (
      SELECT contact_id FROM portal_clients
      WHERE auth_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    -- Only allow updating the sign-off fields, not any other column
    -- Enforce column-level restriction in the API route, not RLS alone
    contact_id IN (
      SELECT contact_id FROM portal_clients
      WHERE auth_id = auth.uid() AND is_active = true
    )
  );
```

**Important:** The brief sign-off endpoint should be implemented as a dedicated portal API route that uses the service role client to apply only the specific field update, rather than relying solely on broad UPDATE RLS. This prevents a portal client from modifying other brief fields.

#### `property_matches`

```sql
-- Portal clients see matches linked to their contact, but only "sent" statuses
CREATE POLICY property_matches_portal_select ON property_matches
  FOR SELECT
  USING (
    client_id IN (
      SELECT contact_id FROM portal_clients
      WHERE auth_id = auth.uid() AND is_active = true
    )
    AND status IN ('sent_to_client', 'client_interested', 'inspection_booked', 'rejected')
  );

-- Portal clients can update status to client_interested or rejected
CREATE POLICY property_matches_portal_update ON property_matches
  FOR UPDATE
  USING (
    client_id IN (
      SELECT contact_id FROM portal_clients
      WHERE auth_id = auth.uid() AND is_active = true
    )
    AND status IN ('sent_to_client', 'client_interested', 'inspection_booked', 'rejected')
  )
  WITH CHECK (
    status IN ('client_interested', 'rejected')
  );
```

#### `inspections`

```sql
-- Portal clients see inspections linked to their contact
CREATE POLICY inspections_portal_select ON inspections
  FOR SELECT
  USING (
    client_id IN (
      SELECT contact_id FROM portal_clients
      WHERE auth_id = auth.uid() AND is_active = true
    )
    AND is_deleted = false
  );
```

Note: Client feedback on inspections requires either a new column on `inspections` (e.g., `client_rating INTEGER`, `client_feedback TEXT`, `client_feedback_at TIMESTAMPTZ`) or a separate `inspection_feedback` table. The latter is preferable to maintain separation of concerns and avoid giving portal clients UPDATE access to the full `inspections` row.

#### `due_diligence_checklists` and `due_diligence_items`

```sql
-- Portal clients see checklists for their active transaction
CREATE POLICY dd_checklists_portal_select ON due_diligence_checklists
  FOR SELECT
  USING (
    transaction_id IN (
      SELECT t.id FROM transactions t
      JOIN portal_clients pc ON pc.contact_id = t.contact_id
      WHERE pc.auth_id = auth.uid() AND pc.is_active = true
    )
  );

-- Portal clients see DD items for checklists they can see
CREATE POLICY dd_items_portal_select ON due_diligence_items
  FOR SELECT
  USING (
    checklist_id IN (
      SELECT ddc.id FROM due_diligence_checklists ddc
      JOIN transactions t ON t.id = ddc.transaction_id
      JOIN portal_clients pc ON pc.contact_id = t.contact_id
      WHERE pc.auth_id = auth.uid() AND pc.is_active = true
    )
  );
```

**Important:** Due diligence items include `notes` which may contain sensitive agent-to-agent observations. A `client_visible` boolean on `due_diligence_items` should be considered to give agents explicit control. For Sprint 5, all DD items are visible to the client — revisit if agents raise concerns.

#### `key_dates`

```sql
-- Portal clients see key dates for their active transaction
CREATE POLICY key_dates_portal_select ON key_dates
  FOR SELECT
  USING (
    transaction_id IN (
      SELECT t.id FROM transactions t
      JOIN portal_clients pc ON pc.contact_id = t.contact_id
      WHERE pc.auth_id = auth.uid() AND pc.is_active = true
    )
  );
```

#### `transactions`

```sql
-- Portal clients can read their own transaction (stage and key info only)
CREATE POLICY transactions_portal_select ON transactions
  FOR SELECT
  USING (
    contact_id IN (
      SELECT contact_id FROM portal_clients
      WHERE auth_id = auth.uid() AND is_active = true
    )
  );
```

**Note:** The `transactions` table current agent RLS policy (migration `00002`) uses `assigned_agent_id` + office check. Portal clients will have no `users` row, so `get_current_user_office_id()` returns NULL, meaning the existing agent policy will not match. The portal-specific policy above must be added explicitly.

#### `conversation_messages`

```sql
-- Portal clients see messages linked to their contact
CREATE POLICY conversation_messages_portal_select ON conversation_messages
  FOR SELECT
  USING (
    contact_id IN (
      SELECT contact_id FROM portal_clients
      WHERE auth_id = auth.uid() AND is_active = true
    )
    AND is_deleted = false
  );

-- Portal clients can insert messages (send to agent)
CREATE POLICY conversation_messages_portal_insert ON conversation_messages
  FOR INSERT
  WITH CHECK (
    contact_id IN (
      SELECT contact_id FROM portal_clients
      WHERE auth_id = auth.uid() AND is_active = true
    )
  );
```

### 8.4 What Must Remain Agent-Only (No Portal Access)

| Table | Reason |
|-------|--------|
| `aml_checks` | Identity verification records — client must never see or modify |
| `aml_identity_documents` | Raw identity document references — agent-only |
| `aml_suspicious_matter_reports` | Regulatory filings — strictly agent/compliance team |
| `contacts` (other clients) | Data isolation; portal client can only see their own contact data via `portal_clients` linkage |
| `users` | Agent profiles; portal clients have no need to access agent account data directly (agent name/email exposed via `portal_clients` join only) |
| `workflows` / `workflow_runs` | Internal automation — not relevant to client |
| `activities` | Agent CRM activity log — internal only |
| `notes` | Agent-to-agent notes — internal only |
| `tasks` | Agent task management — internal only |
| `analytics_daily_snapshots` | Business intelligence — agent/principal only |
| `market_data_snapshots` | Market data — agent use only in Sprint 5 |
| `domain_sync_jobs` | Internal sync plumbing — irrelevant to client |
| `fee_structures` / `invoices` | Financial data — agent-only; clients see fee summaries via brief if included |

### 8.5 Documents — New `portal_visible` Column

The current `documents_portal_read` policy shows ALL documents linked to the client's `contact_id`. Agents may upload internal working documents (e.g., sourcing notes, internal valuations) to a client's record that are not intended for the client's eyes.

**Recommendation:** Add `portal_visible BOOLEAN NOT NULL DEFAULT false` to the `documents` table. Update the portal RLS policy to filter on `portal_visible = true`. When an agent uploads a document to share with the client, they explicitly check "Share with client." Client-uploaded documents are always visible to the client (they uploaded them).

Updated policy:

```sql
CREATE POLICY documents_portal_read ON documents
  FOR SELECT
  USING (
    (
      -- Agent explicitly shared this document
      portal_visible = true
      AND EXISTS (
        SELECT 1 FROM portal_clients pc
        WHERE pc.auth_id = auth.uid()
          AND pc.contact_id = documents.contact_id
          AND pc.is_active = true
      )
    )
    OR
    (
      -- Client uploaded this document themselves
      uploaded_by = auth.uid()
    )
  );
```

---

## 9. API Surface (High Level)

These are the endpoints needed to fully support the client portal. Endpoints marked as existing are already implemented in `apps/api/src/routes/portal.ts` or adjacent route files. New endpoints are net-new work for Sprint 5.

### Portal Namespace (`/api/v1/portal/`)

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| `GET` | `/portal/me` | Authenticated portal client profile + agent details | Existing |
| `GET` | `/portal/transaction` | Active transaction for the portal client | Existing |
| `GET` | `/portal/agent` | Assigned agent contact details | Existing |
| `GET` | `/portal/dashboard` | Aggregated dashboard stats (stage, counts) | New (currently Supabase-direct in hook) |
| `POST` | `/portal/brief/sign-off` | Client acknowledges/signs off their brief | New |
| `POST` | `/portal/properties/:matchId/feedback` | Client marks interest or pass on a property match | New |
| `GET` | `/portal/inspections` | List inspections for the client | New |
| `POST` | `/portal/inspections/:id/feedback` | Client submits inspection feedback | New |
| `GET` | `/portal/documents` | List documents visible to the client | New (currently Supabase-direct) |
| `POST` | `/portal/documents/upload` | Client uploads a document | New (currently Supabase-direct) |
| `GET` | `/portal/documents/:id/download-url` | Generate signed download URL | New (currently Supabase-direct) |
| `GET` | `/portal/key-dates` | List key dates for the client's transaction | New (currently Supabase-direct) |
| `GET` | `/portal/due-diligence` | DD checklist and items for the client | New (currently Supabase-direct) |
| `GET` | `/portal/messages` | Message thread between client and agent | New (currently Supabase-direct) |
| `POST` | `/portal/messages` | Client sends a message to the agent | New (currently Supabase-direct) |

### Agent-Side Controls (in existing route files)

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| `POST` | `/portal-clients` | Agent creates a portal client record and sends magic link invitation | New |
| `PATCH` | `/portal-clients/:id` | Agent deactivates or reactivates a portal client | New |
| `PATCH` | `/property-matches/:id` | Update match status (controls portal visibility) | Existing (check portal visibility filter) |
| `PATCH` | `/documents/:id` | Set `portal_visible` flag on a document | New field, new endpoint behaviour |
| `POST` | `/client-briefs/:id/request-sign-off` | Agent triggers sign-off invitation email to client | New |

### Notes on Direct Supabase Queries in Portal Hooks

The current portal hooks (e.g., `use-portal-dashboard.ts`, `use-portal-properties.ts`) query Supabase directly from the browser using the anon key. This is acceptable for Sprint 5 given:
- RLS policies enforce data isolation
- The anon key is safe to expose in a browser client

However, for Sprint 6 or hardening, consider routing all portal data through authenticated API endpoints to enable server-side logging, rate limiting, and additional validation. Flag this as a known architectural debt item.

---

## 10. Sign-Off Checklist

- [ ] User stories reviewed with at least one buyers agent stakeholder
- [ ] Acceptance criteria complete and unambiguous
- [ ] Out of scope list agreed and documented
- [ ] Mobile requirements confirmed against actual device testing plan
- [ ] Privacy Act obligations reviewed by principal or compliance contact
- [ ] RLS boundary analysis confirmed by reviewing existing migration files
- [ ] New RLS policies (Section 8.3) drafted and ready for migration `00014`
- [ ] `portal_visible` column on `documents` approved and added to migration plan
- [ ] `client_feedback` mechanism on inspections (new columns or new table) decided
- [ ] Agent-side controls (property match visibility, document sharing, sign-off invitation) confirmed in scope
- [ ] API endpoint list reviewed against existing routes — no duplication
- [ ] Ready for `/sprint-plan` to produce Sprint 5 implementation plan
