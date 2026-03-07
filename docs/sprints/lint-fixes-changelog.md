# Changelog

All notable changes to RealFlow are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Dates use ISO 8601 (YYYY-MM-DD). Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Fixed

- **ESLint pre-commit gate now passes 6/6 packages with 0 errors.**
  Pre-existing ESLint errors accumulated across the monorepo were blocking
  the Husky pre-commit hook introduced in the agent-workflow setup. All
  errors have been resolved; 32 remaining warnings are intentional
  non-null assertions (`!`) and are expected.

#### Root `eslint.config.js`

- Added browser and Node.js runtime globals to the shared TypeScript rule
  block so that references to `fetch`, `URLSearchParams`, `localStorage`,
  `sessionStorage`, `setTimeout`, `clearTimeout`, `setInterval`,
  `clearInterval`, `confirm`, `alert`, `Buffer`, `NodeJS`, `__dirname`,
  and `__filename` are recognised without requiring per-file `/* global */`
  comments.
- Disabled the base `no-unused-vars` rule in favour of
  `@typescript-eslint/no-unused-vars`, which understands TypeScript type
  imports and prevents false positives on type-only identifiers.

#### `apps/mobile/eslint.config.js`

- Added React Native runtime globals (`process`, `fetch`, `console`,
  `URLSearchParams`, `setTimeout`, `clearTimeout`, `setInterval`,
  `clearInterval`) to the mobile-specific ESLint config, resolving
  `no-undef` errors that fired because the mobile workspace does not
  extend the root config's globals block.

#### `apps/mobile/package.json`

- Added `"type": "module"` to align the package declaration with the
  ES module format assumed by `apps/mobile/eslint.config.js`, preventing
  the `require()` / `import` mismatch error reported by the ESLint config
  loader.

#### Unused import and variable removal

Removed 15+ unused imports and variables across the following files to
satisfy `@typescript-eslint/no-unused-vars`:

- `apps/mobile/app/(tabs)/contacts.tsx`
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/app/contact/[id].tsx`
- `apps/mobile/app/inspection/[id].tsx`
- `apps/mobile/app/matches/[id].tsx`
- `apps/portal/src/app/brief/page.tsx`
- `apps/portal/src/app/properties/page.tsx`
- `apps/web/src/app/buyers-agent/dashboard-client.tsx`
- `apps/web/src/app/daily-actions/page.tsx`
- `apps/web/src/components/contacts/contact-detail.tsx`
- `apps/web/src/components/dashboard/daily-action-list.tsx`
- `apps/web/src/components/layout/sidebar.tsx`

#### `apps/web/src/app/properties/price-changes/price-changes-client.tsx`

- Resolved a name conflict where both a TypeScript `interface` and a
  React function component were named `PriceChangeRow` in the same
  module scope. The interface retains the name `PriceChangeRow`; the
  component has been renamed to `PriceChangeRowItem`. All JSX call sites
  updated accordingly.

#### `apps/web/src/hooks/use-client-briefs.ts`

- Added `// eslint-disable-next-line @typescript-eslint/no-explicit-any`
  comments on three intentional `any` casts that are required by
  Supabase's generated types when accessing joined relations returned via
  `.select()` with a nested selector string. These are documented
  suppressions, not unchecked casts — the shape is validated at the
  call site in each case.

### Changed

- `apps/mobile/src/hooks/__tests__/use-offers.test.ts` — minor
  variable cleanup to satisfy the `no-unused-vars` rule after the
  globals change activated previously-hidden errors.
- `apps/mobile/src/hooks/__tests__/use-tasks.test.ts` — same cleanup
  as `use-offers.test.ts`.
- `apps/mobile/src/hooks/use-client-briefs.ts` — removed unused import
  brought in during Sprint 5 feature work.

---

### Result

```
npm run lint
  @realflow/shared        ✔  0 errors, 0 warnings
  @realflow/business-logic ✔  0 errors, 0 warnings
  @realflow/integrations  ✔  0 errors, 0 warnings
  apps/api                ✔  0 errors, 8 warnings  (non-null assertions)
  apps/web                ✔  0 errors, 14 warnings (non-null assertions)
  apps/mobile             ✔  0 errors, 10 warnings (non-null assertions)
  Total                      0 errors, 32 warnings
```

The Husky pre-commit hook (`lint → type-check → test`) is now fully
unblocked on the `sprint-5` branch.
