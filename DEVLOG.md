DEVLOG

## Template
- Date:
- Task:
- Summary:
- Files:
- Notes:
- Tests:

## 2025-__-__
- Date:
- Task:
- Summary:
- Files:
- Notes:
- Tests:

## 2026-01-16
- Date: 2026-01-16
- Task: Bootstrap project master docs and specs
- Summary: Added master project document and split core specs/logs into separate files.
- Files: MASTER_PROJECT.md, SETTINGS_SPEC.md, API_SPEC.md, DATA_MODEL.md, DEVLOG.md, MIGRATIONS.md, API_CHANGELOG.md
- Notes: Initial structure only; no schema or API changes yet.
- Tests: Not run (docs only).

## 2026-01-16
- Date: 2026-01-16
- Task: Add docs structure + full Prisma schema
- Summary: Created docs tree for workflow/architecture/product/api/booking/payments/promo/notifications/settings/ui/db and added full schema.prisma.
- Files: docs/MASTER_PROJECT.md, docs/INDEX.md, docs/00_WORKFLOW/WORKFLOW.md, docs/ARCHITECTURE/STACK.md, docs/PRODUCT/PRODUCT_OVERVIEW.md, docs/API/OPENAPI_RULES.md, docs/BOOKING/BOOKING_ENGINE.md, docs/PAYMENTS/PAYMENTS_SPEC.md, docs/PROMO_LOYALTY/PROMO_SPEC.md, docs/EVENTS/EVENT_CATALOG.md, docs/SETTINGS/SETTINGS_SPEC.md, docs/UI/DESIGN_TOKENS.md, docs/DB/DB_MAP.md, docs/ARCHITECTURE/REPO_MONOREPO.md, SETTINGS_CHANGELOG.md, packages/db/prisma/schema.prisma, MASTER_PROJECT.md, SETTINGS_SPEC.md
- Notes: Docs are skeletonized per master; schema defines full domain map. No migrations yet.
- Tests: Not run (docs/schema only).

## 2026-01-16
- Date: 2026-01-16
- Task: Align schema relations + create baseline migration + OpenAPI skeleton
- Summary: Added missing relations/structures in schema.prisma, generated initial migration SQL, and created OpenAPI v1 skeleton.
- Files: packages/db/prisma/schema.prisma, packages/db/prisma/migrations/20260116_init/migration.sql, packages/db/prisma/migrations/migration_lock.toml, MIGRATIONS.md, packages/contracts/openapi.yaml, API_CHANGELOG.md
- Notes: Prisma migration generated via `prisma migrate diff --from-empty` (no live DB). Prisma migrate dev requires DATABASE_URL and running DB for later updates.
- Tests: Not run (schema/docs only).

## 2026-01-16
- Date: 2026-01-16
- Task: Expand OpenAPI v1 paths and placeholders
- Summary: Added base routes for auth/marketplace/booking/client/crm/platform/integrations/ai/realtime with placeholder schemas/params.
- Files: packages/contracts/openapi.yaml, API_CHANGELOG.md
- Notes: Paths are skeletons; will be detailed per module specs.
- Tests: Not run (docs only).

## 2026-01-16
- Date: 2026-01-16
- Task: Detail Marketplace + Booking OpenAPI schemas
- Summary: Added filters, response schemas, and DTOs for marketplace and booking endpoints.
- Files: packages/contracts/openapi.yaml, API_CHANGELOG.md
- Notes: Client/CRM/Platform schemas still placeholders.
- Tests: Not run (docs only).

## 2026-01-16
- Date: 2026-01-16
- Task: Detail Client/CRM/Platform/Integrations/AI OpenAPI schemas
- Summary: Added DTOs and response schemas for Client, CRM, Platform, Integrations, and AI endpoints.
- Files: packages/contracts/openapi.yaml, API_CHANGELOG.md
- Notes: Schemas are placeholders pending per-module spec detail.
- Tests: Not run (docs only).

## 2026-01-16
- Date: 2026-01-16
- Task: Local Docker Postgres + apply baseline migration
- Summary: Added dev Docker compose/env files, started Postgres, and applied initial Prisma migration.
- Files: docker/dev/docker-compose.yml, docker/dev/.env, .env, .env.example, packages/db/prisma/migrations/20260116_init/migration.sql, packages/db/prisma/migrations/migration_lock.toml
- Notes: Fixed BOM in migration.sql and migration_lock.toml before apply.
- Tests: Not run (infra only).

## 2026-01-16
- Date: 2026-01-16
- Task: Standardize Prisma CLI version
- Summary: Set Prisma CLI standard to v6.19.1 in docs.
- Files: docs/DB/PRISMA_RULES.md
- Notes: Use npx prisma@6.19.1 for studio/migrate.
- Tests: Not run (docs only).

## 2026-01-16
- Date: 2026-01-16
- Task: Add Prisma helper script
- Summary: Added scripts/prisma.ps1 to run standard Prisma commands.
- Files: scripts/prisma.ps1
- Notes: Script reads DATABASE_URL from .env if not set in shell.
- Tests: Not run (script only).

## 2026-01-16
- Date: 2026-01-16
- Task: Add one-command Prisma Studio launcher
- Summary: Added studio.ps1 to set project root, load DATABASE_URL, and start Prisma Studio.
- Files: studio.ps1
- Notes: Run from any directory.
- Tests: Not run (script only).

## 2026-01-16
- Date: 2026-01-16
- Task: Monorepo structure + Next.js + Flutter setup
- Summary: Created repo skeleton, scaffolded Next.js app, installed Flutter SDK, installed Android Studio, and generated Flutter app.
- Files: README.md, .gitignore, package.json, .npmrc, apps/web/*, apps/worker/*, apps/mobile/*, docs/DB/PRISMA_RULES.md
- Notes: Flutter SDK at C:\\Tools\\flutter. Android Studio installed; SDK setup still needed via IDE.
- Tests: Not run (setup only).

## 2026-01-17
- Date: 2026-01-17
- Task: Web landing page cleanup
- Summary: Replaced default Next.js starter page with Marketplace landing and zone links.
- Files: apps/web/app/page.tsx
- Notes: Zone routes stubbed in separate pages.
- Tests: Not run (ui only).

## 2026-01-17
- Date: 2026-01-17
- Task: Add web zone stubs + health endpoint
- Summary: Added placeholder pages for client, crm, platform and a basic health route.
- Files: apps/web/app/c/page.tsx, apps/web/app/crm/page.tsx, apps/web/app/platform/page.tsx, apps/web/app/api/v1/health/route.ts
- Notes: Health returns basic JSON for uptime checks.
- Tests: Not run (ui/api only).

## 2026-01-17
- Date: 2026-01-17
- Task: Fix JSON BOM in package files
- Summary: Rewrote root and web package.json to remove BOM and restore valid JSON parsing.
- Files: package.json, apps/web/package.json
- Notes: Resolves Tailwind/PostCSS parse error referencing package.json.
- Tests: Not run (dev setup only).

## 2026-01-17
- Date: 2026-01-17
- Task: Localize web home page
- Summary: Switched Marketplace home content to Russian and removed CRM/Platform links from main page.
- Files: apps/web/app/page.tsx, apps/web/app/layout.tsx
- Notes: CRM and Platform remain on their own routes.
- Tests: Not run (ui only).

## 2026-01-17
- Date: 2026-01-17
- Task: Localize CRM/Platform/Client stubs + add booking entry
- Summary: Added Russian copy for CRM, Platform, Client, and created /booking entry page.
- Files: apps/web/app/page.tsx, apps/web/app/booking/page.tsx, apps/web/app/c/page.tsx, apps/web/app/crm/page.tsx, apps/web/app/platform/page.tsx
- Notes: Booking entry is a placeholder for the online booking flow.
- Tests: Not run (ui only).

## 2026-01-17
- Date: 2026-01-17
- Task: Platform Admin layout + sections
- Summary: Added platform layout with navigation and stub pages for accounts, plans, moderation, monitoring, audit, and settings.
- Files: apps/web/app/platform/layout.tsx, apps/web/app/platform/page.tsx, apps/web/app/platform/accounts/page.tsx, apps/web/app/platform/plans/page.tsx, apps/web/app/platform/moderation/page.tsx, apps/web/app/platform/monitoring/page.tsx, apps/web/app/platform/audit/page.tsx, apps/web/app/platform/settings/page.tsx
- Notes: Layout is a clean baseline; no data wiring yet.
- Tests: Not run (ui only).

## 2026-01-17
- Date: 2026-01-17
- Task: UI polish + Platform login stub
- Summary: Added baseline visual system (fonts/colors/background) and Platform Admin login page.
- Files: apps/web/app/globals.css, apps/web/app/layout.tsx, apps/web/app/platform/layout.tsx, apps/web/app/platform/page.tsx, apps/web/app/platform/accounts/page.tsx, apps/web/app/platform/plans/page.tsx, apps/web/app/platform/moderation/page.tsx, apps/web/app/platform/monitoring/page.tsx, apps/web/app/platform/audit/page.tsx, apps/web/app/platform/settings/page.tsx, apps/web/app/platform/login/page.tsx, apps/web/app/page.tsx, apps/web/app/c/page.tsx, apps/web/app/crm/page.tsx, apps/web/app/booking/page.tsx
- Notes: Visual system uses CSS variables; auth form is UI-only for now.
- Tests: Not run (ui only).

## 2026-01-17
- Date: 2026-01-17
- Task: Platform admin seed scripts
- Summary: Added SQL seed and PowerShell runner for initial platform admin.
- Files: scripts/seed-platform-admin.sql, scripts/seed-platform-admin.ps1
- Notes: Uses scrypt hash; requires UserIdentity password fields and applied migration.
- Tests: Not run (seed only).

## 2026-01-17
- Date: 2026-01-17
- Task: Add password fields to UserIdentity
- Summary: Added password hash/salt/algo fields to support email+password auth.
- Files: packages/db/prisma/schema.prisma
- Notes: Migration pending; Prisma reported modified initial migration and requires reset.
- Tests: Not run (schema only).

## 2026-01-17
- Date: 2026-01-17
- Task: Apply auth password fields + seed platform admin
- Summary: Generated and applied migration for UserIdentity password fields, then seeded platform admin user.
- Files: packages/db/prisma/migrations/20260117_add_user_identity_password, packages/db/prisma/migrations/20260117_add_user_identity_password_fix/migration.sql, scripts/seed-platform-admin.sql, scripts/seed-platform-admin.ps1, MIGRATIONS.md
- Notes: First migration contained commented SQL; fixed via follow-up migration. Seeded admin: admin@beauty.local.
- Tests: Not run (db/seed only).

## 2026-01-17
- Date: 2026-01-17
- Task: Update UI to SaaS gray style + responsive menu
- Summary: Switched to SaaS-like neutral palette, flat surfaces, and updated Platform menu to collapsible + mobile overlay.
- Files: apps/web/app/globals.css, apps/web/app/layout.tsx, apps/web/app/platform/layout.tsx, apps/web/app/platform/page.tsx, apps/web/app/platform/accounts/page.tsx, apps/web/app/platform/plans/page.tsx, apps/web/app/platform/moderation/page.tsx, apps/web/app/platform/monitoring/page.tsx, apps/web/app/platform/audit/page.tsx, apps/web/app/platform/settings/page.tsx, apps/web/app/page.tsx
- Notes: Style matches reference image; rounded corners reduced, gray UI.
- Tests: Not run (ui only).

## 2026-01-17
- Date: 2026-01-17
- Task: Platform auth + RBAC guards
- Summary: Added auth API, session checks, Platform guards, and role-based navigation.
- Files: apps/web/app/(platform)/layout.tsx, apps/web/app/(platform)/platform/platform-shell.tsx, apps/web/app/platform/login/page.tsx, apps/web/lib/auth.ts, apps/web/lib/prisma.ts, apps/web/app/api/v1/auth/login/route.ts, apps/web/app/api/v1/auth/logout/route.ts, apps/web/app/api/v1/auth/me/route.ts, apps/web/middleware.ts, apps/web/app/(platform)/platform/accounts/page.tsx, apps/web/app/(platform)/platform/plans/page.tsx, apps/web/app/(platform)/platform/moderation/page.tsx, apps/web/app/(platform)/platform/monitoring/page.tsx, apps/web/app/(platform)/platform/audit/page.tsx, apps/web/app/(platform)/platform/settings/page.tsx, apps/web/app/(platform)/platform/page.tsx, apps/web/package.json, apps/web/.env.local, scripts/seed-platform-admin.sql, API_CHANGELOG.md
- Notes: Requires `npm install` in apps/web for @prisma/client and re-run seed to add permissions/moderator.
- Tests: Not run (auth only).

## 2026-01-17
- Date: 2026-01-17
- Task: Fix Flutter Android build JDK
- Summary: Installed JDK 17 and pinned Gradle to use it for Android builds.
- Files: apps/mobile/android/gradle.properties
- Notes: JDK path: C:\\Program Files\\Microsoft\\jdk-17.0.17.10-hotspot.
- Tests: Not run (setup only).

## 2026-01-17
- Date: 2026-01-17
- Task: Split mobile into three apps (mode selector)
- Summary: Replaced 4-tab demo with mode picker and per-app navigation (Platform, CRM, Client+Marketplace).
- Files: apps/mobile/lib/main.dart
- Notes: Client app uses bottom tabs for booking + client area.
- Tests: Not run (ui only).

## 2026-01-17
- Date: 2026-01-17
- Task: Split mobile into three separate entrypoints
- Summary: Created platform/crm/client entry files and shared widgets/theme; removed combined shell.
- Files: apps/mobile/lib/app_theme.dart, apps/mobile/lib/main_platform.dart, apps/mobile/lib/main_crm.dart, apps/mobile/lib/main_client.dart, apps/mobile/lib/screens/platform_home.dart, apps/mobile/lib/screens/crm_home.dart, apps/mobile/lib/screens/booking_home.dart, apps/mobile/lib/screens/client_home.dart, apps/mobile/lib/widgets/section_header.dart, apps/mobile/lib/widgets/summary_grid.dart
- Notes: Run with -t to select app entrypoint.
- Tests: Not run (ui only).

## 2026-01-17
- Date: 2026-01-17
- Task: Platform Admin topbar + login error handling
- Summary: Added topbar with search/user chip and login error message for forbidden access.
- Files: apps/web/app/(platform)/platform/platform-shell.tsx, apps/web/app/platform/login/page.tsx, docs/PRODUCT/PLATFORM_ADMIN.md
- Notes: Platform layout now includes a consistent topbar across pages.
- Tests: Not run (ui only).

## 2026-01-17
- Date: 2026-01-17
- Task: Localize Platform Admin shell
- Summary: Replaced garbled labels with Russian copy across sidebar, header, and mobile menu.
- Files: apps/web/app/(platform)/platform/platform-shell.tsx
- Notes: Visual language remains the purple SaaS style from globals.
- Tests: Not run (ui only).

## 2026-01-18
- Date: 2026-01-18
- Task: Fix Next.js dynamic params in platform routes
- Summary: Awaited params Promise in platform [id] API handlers to avoid undefined id.
- Files: apps/web/app/api/v1/platform/accounts/[id]/route.ts, apps/web/app/api/v1/platform/plans/[id]/route.ts, apps/web/app/api/v1/platform/templates/[id]/route.ts, apps/web/app/api/v1/platform/moderation/public-pages/[id]/route.ts
- Notes: Required by Next.js 16 dynamic API behavior.
- Tests: Not run (api only).

## 2026-01-18
- Date: 2026-01-18
- Task: Platform accounts save feedback + refresh
- Summary: Added response handling and refresh after saving plan/status changes.
- Files: apps/web/app/(platform)/platform/accounts/account-row-actions.tsx
- Notes: Shows API errors to avoid silent failures.
- Tests: Not run (ui only).

## 2026-01-18
- Date: 2026-01-18
- Task: Platform Admin overview metrics wired to DB
- Summary: Replaced placeholders with real counts for active accounts, recent registrations, outbox lag, and system alerts.
- Files: apps/web/app/(platform)/platform/page.tsx
- Notes: Outbox lag computed from pending/processing items.
- Tests: Not run (ui only).

## 2026-01-18
- Date: 2026-01-18
- Task: Platform Admin audit logging in API
- Summary: Added audit logger and writes on platform accounts/plans/settings/templates/moderation actions.
- Files: apps/web/lib/audit.ts, apps/web/lib/auth.ts, apps/web/app/api/v1/platform/accounts/route.ts, apps/web/app/api/v1/platform/accounts/[id]/route.ts, apps/web/app/api/v1/platform/plans/route.ts, apps/web/app/api/v1/platform/plans/[id]/route.ts, apps/web/app/api/v1/platform/settings/route.ts, apps/web/app/api/v1/platform/templates/route.ts, apps/web/app/api/v1/platform/templates/[id]/route.ts, apps/web/app/api/v1/platform/moderation/public-pages/[id]/route.ts
- Notes: Audit rows now appear in Platform Admin Audit page.
- Tests: Not run (api only).

## 2026-01-18
- Date: 2026-01-18
- Task: Platform Admin audit page wired to DB
- Summary: Replaced static audit rows with real PlatformAuditLog data and added empty state.
- Files: apps/web/app/(platform)/platform/audit/page.tsx
- Notes: Uses admin->user email when available.
- Tests: Not run (ui only).

## 2026-01-18
- Date: 2026-01-18
- Task: Prep numeric IDs + fix Platform API text
- Summary: Added script to convert Prisma IDs to Int, rewrote Platform API routes with numeric IDs and Russian audit text, rewrote Platform overview metrics, updated seed SQL for numeric IDs + UTF-8, and set Postgres init encoding.
- Files: scripts/convert-prisma-ids-to-int.ps1, packages/db/prisma/schema.prisma, docker/dev/docker-compose.yml, scripts/seed-platform-admin.sql, apps/web/app/(platform)/platform/page.tsx, apps/web/app/api/v1/platform/accounts/route.ts, apps/web/app/api/v1/platform/accounts/[id]/route.ts, apps/web/app/api/v1/platform/plans/route.ts, apps/web/app/api/v1/platform/plans/[id]/route.ts, apps/web/app/api/v1/platform/templates/route.ts, apps/web/app/api/v1/platform/templates/[id]/route.ts, apps/web/app/api/v1/platform/moderation/public-pages/[id]/route.ts
- Notes: Requires schema conversion + DB reset to take effect.
- Tests: Not run (schema/seed/API only).

## 2026-01-18
- Date: 2026-01-18
- Task: Unify mobile theme with web style
- Summary: Updated Flutter theme palette, typography, and radii to match the purple SaaS design.
- Files: apps/mobile/lib/app_theme.dart
- Notes: Material-only theme to keep Android/iOS visuals consistent.
- Tests: Not run (ui only).

## 2026-01-18
- Date: 2026-01-18
- Task: Platform Admin web content + navigation polish
- Summary: Rewrote Platform pages in Russian, added structured cards/tables, and highlighted active nav items.
- Files: apps/web/app/(platform)/platform/platform-shell.tsx, apps/web/app/(platform)/platform/page.tsx, apps/web/app/(platform)/platform/accounts/page.tsx, apps/web/app/(platform)/platform/plans/page.tsx, apps/web/app/(platform)/platform/moderation/page.tsx, apps/web/app/(platform)/platform/monitoring/page.tsx, apps/web/app/(platform)/platform/audit/page.tsx, apps/web/app/(platform)/platform/settings/page.tsx
- Notes: Still static placeholders; data wiring comes next.
- Tests: Not run (ui only).

## 2026-01-18
- Date: 2026-01-18
- Task: Fix Russian text in platform permissions seed
- Summary: Rewrote seed SQL with UTF-8 and updated permission descriptions via ON CONFLICT DO UPDATE.
- Files: scripts/seed-platform-admin.sql
- Notes: Re-ran seed script to update existing records.
- Tests: Not run (seed only).

## 2026-01-18
- Date: 2026-01-18
- Task: Fix seed script encoding
- Summary: Forced UTF-8 when piping seed SQL to psql and re-seeded to restore Russian descriptions.
- Files: scripts/seed-platform-admin.ps1
- Notes: Refresh Prisma Studio to see updated descriptions.
- Tests: Not run (seed only).

## 2026-01-18
- Date: 2026-01-18
- Task: Fix Flutter widget test entrypoint
- Summary: Pointed widget_test to PlatformApp after removing main.dart.
- Files: apps/mobile/test/widget_test.dart
- Notes: Test now checks Platform Admin title.
- Tests: Not run (test only).

## 2026-01-18
- Date: 2026-01-18
- Task: Improve Platform accounts API errors
- Summary: Added duplicate/foreign-key handling for account creation to return proper error codes.
- Files: apps/web/app/api/v1/platform/accounts/route.ts
- Notes: Plan lookup now returns VALIDATION_FAILED instead of generic SERVER_ERROR.
- Tests: Not run (manual only).

## 2026-01-18
- Date: 2026-01-18
- Task: Improve Platform plan/account error handling
- Summary: Added duplicate detection for plan name/code and improved account update errors when planId is invalid.
- Files: apps/web/app/api/v1/platform/plans/route.ts, apps/web/app/api/v1/platform/plans/[id]/route.ts, apps/web/app/api/v1/platform/accounts/[id]/route.ts
- Notes: API now returns DUPLICATE or VALIDATION_FAILED instead of SERVER_ERROR.
- Tests: Not run (manual only).

## 2026-01-18
- Date: 2026-01-18
- Task: Fix platform audit logging for numeric IDs
- Summary: Coerced audit targetId to string to avoid Prisma type errors when passing numeric IDs.
- Files: apps/web/lib/audit.ts
- Notes: Should stop SERVER_ERROR on create/update when audit logging runs.
- Tests: Not run (manual only).

## 2026-01-18
- Date: 2026-01-18
- Task: Align mobile Platform Admin shell with web sections
- Summary: Added drawer-based navigation and section views for overview/accounts/plans/moderation/monitoring/audit/settings; fixed mojibake in mobile screens.
- Files: apps/mobile/lib/main_platform.dart, apps/mobile/lib/screens/platform_home.dart, apps/mobile/lib/screens/crm_home.dart, apps/mobile/lib/screens/client_home.dart, apps/mobile/lib/screens/booking_home.dart, apps/mobile/lib/main_client.dart
- Notes: Mobile sections show empty states until API wiring is added.
- Tests: Not run (manual only).

## 2026-01-18
- Date: 2026-01-18
- Task: Add in-screen navigation for mobile Platform Admin
- Summary: Quick action cards now switch to the related section; section views accept navigation callback.
- Files: apps/mobile/lib/main_platform.dart, apps/mobile/lib/screens/platform_home.dart
- Notes: Real data still requires API wiring.
- Tests: Not run (manual only).

## 2026-01-18
- Date: 2026-01-18
- Task: Fix mobile Platform Admin build errors
- Summary: Removed const from widget lists that include callbacks so navigation cards compile.
- Files: apps/mobile/lib/screens/platform_home.dart
- Notes: Rebuild required after Flutter hot restart.
- Tests: Not run (manual only).

## 2026-01-19
- Date: 2026-01-19
- Task: Add mobile token auth + API wiring for Platform Admin
- Summary: Added bearer token support in API auth, mobile login screen, and API client to load overview/accounts/plans data.
- Files: apps/web/lib/auth.ts, apps/web/lib/platform-api.ts, apps/web/app/api/v1/auth/login/route.ts, apps/web/app/api/v1/auth/me/route.ts, apps/mobile/lib/api_config.dart, apps/mobile/lib/api_client.dart, apps/mobile/lib/auth_service.dart, apps/mobile/lib/platform_api.dart, apps/mobile/lib/platform_login.dart, apps/mobile/lib/main_platform.dart, apps/mobile/lib/screens/platform_home.dart, apps/mobile/pubspec.yaml, API_CHANGELOG.md
- Notes: Mobile uses token from /auth/login; web continues to use cookies.
- Tests: Not run (manual only).

## 2026-01-20
- Date: 2026-01-20
- Task: Proper access/refresh session flow for web + mobile
- Summary: Split sessions into access/refresh tokens, added refresh endpoint, rotated access on API calls, and updated mobile to store/refresh tokens.
- Files: packages/db/prisma/schema.prisma, apps/web/lib/auth.ts, apps/web/lib/platform-api.ts, apps/web/app/api/v1/auth/login/route.ts, apps/web/app/api/v1/auth/refresh/route.ts, apps/web/app/api/v1/auth/logout/route.ts, apps/web/middleware.ts, apps/web/app/api/v1/platform/accounts/route.ts, apps/web/app/api/v1/platform/accounts/[id]/route.ts, apps/web/app/api/v1/platform/plans/route.ts, apps/web/app/api/v1/platform/plans/[id]/route.ts, apps/web/app/api/v1/platform/monitoring/outbox/route.ts, apps/web/app/api/v1/platform/monitoring/deliveries/route.ts, apps/web/app/api/v1/platform/monitoring/webhooks/route.ts, apps/web/app/api/v1/platform/audit/route.ts, apps/web/app/api/v1/platform/moderation/public-pages/route.ts, apps/web/app/api/v1/platform/moderation/public-pages/[id]/route.ts, apps/web/app/api/v1/platform/settings/route.ts, apps/web/app/api/v1/platform/templates/route.ts, apps/web/app/api/v1/platform/templates/[id]/route.ts, apps/mobile/lib/api_client.dart, apps/mobile/lib/auth_service.dart, apps/mobile/lib/platform_api.dart, apps/mobile/lib/platform_login.dart, apps/mobile/lib/main_platform.dart, apps/mobile/lib/screens/platform_home.dart
- Notes: Requires Prisma migration and re-login to create new sessions.
- Tests: Not run (manual only).

## 2026-01-21
- Date: 2026-01-21
- Task: Platform Billing (ручные счета и оплаты)
- Summary: Added billing section with invoice list, manual payment action, and API routes for issuing invoices and marking them as paid; updated nav labels and platform docs.
- Files: apps/web/app/(platform)/platform/billing/page.tsx, apps/web/app/(platform)/platform/billing/billing-create-invoice-form.tsx, apps/web/app/(platform)/platform/billing/billing-invoice-actions.tsx, apps/web/app/api/v1/platform/billing/invoices/route.ts, apps/web/app/api/v1/platform/billing/invoices/[id]/pay/route.ts, apps/web/app/(platform)/platform/platform-shell.tsx, docs/PRODUCT/PLATFORM_ADMIN.md, docs/PAYMENTS/PAYMENTS_SPEC.md
- Notes: Manual payments set invoice to PAID and activate subscription (+1 month).
- Tests: Not run (manual only).

## 2026-01-21
- Date: 2026-01-21
- Task: Platform settings UI
- Summary: Replaced generic key/JSON settings with structured payment/SEO/contact forms and documented new settings keys.
- Files: apps/web/app/(platform)/platform/settings/page.tsx, apps/web/app/(platform)/platform/settings/platform-settings-panels.tsx, docs/SETTINGS/PLATFORM_SETTINGS.md
- Notes: Settings stored in platform.billing / platform.seo / platform.contacts keys.
- Tests: Not run (manual only).

## 2026-01-21
- Date: 2026-01-21
- Task: CRM auth + RBAC + locations/services base
- Summary: Added CRM auth with account-scoped sessions, RBAC permissions catalog/seed, account audit logging, and CRUD UI+API for locations, service categories, and services; wired CRM shell to auth/permissions and updated OpenAPI.
- Files: packages/db/prisma/schema.prisma, apps/web/lib/auth.ts, apps/web/lib/crm-api.ts, apps/web/lib/crm-audit.ts, apps/web/middleware.ts, apps/web/app/crm/login/page.tsx, apps/web/app/(crm)/layout.tsx, apps/web/app/(crm)/crm/crm-shell.tsx, apps/web/app/(crm)/crm/page.tsx, apps/web/app/(crm)/crm/locations/page.tsx, apps/web/app/(crm)/crm/locations/location-create-form.tsx, apps/web/app/(crm)/crm/locations/location-row-actions.tsx, apps/web/app/(crm)/crm/services/page.tsx, apps/web/app/(crm)/crm/services/service-create-form.tsx, apps/web/app/(crm)/crm/services/service-row-actions.tsx, apps/web/app/(crm)/crm/services/service-category-form.tsx, apps/web/app/(crm)/crm/services/service-category-row.tsx, apps/web/app/api/v1/crm/auth/login/route.ts, apps/web/app/api/v1/crm/auth/logout/route.ts, apps/web/app/api/v1/crm/auth/me/route.ts, apps/web/app/api/v1/crm/auth/refresh/route.ts, apps/web/app/api/v1/crm/locations/route.ts, apps/web/app/api/v1/crm/locations/[id]/route.ts, apps/web/app/api/v1/crm/services/route.ts, apps/web/app/api/v1/crm/services/[id]/route.ts, apps/web/app/api/v1/crm/service-categories/route.ts, apps/web/app/api/v1/crm/service-categories/[id]/route.ts, scripts/seed-crm-rbac.sql, docs/RBAC/PERMISSIONS_CATALOG.md, docs/DB/DB_MAP.md, packages/contracts/openapi.yaml, API_CHANGELOG.md, MIGRATIONS.md
- Notes: CRM auth uses separate cookies (bp_crm_access/bp_crm_refresh). AccountAuditLog requires new migration.
- Tests: Not run (manual only).

## 2026-01-21
- Date: 2026-01-21
- Task: Fix CRM session relation for migration
- Summary: Added missing Account relation on UserSession to satisfy Prisma validation.
- Files: packages/db/prisma/schema.prisma
- Notes: Migration still blocked because previously applied migration file was modified; requires reset or manual resolution.
- Tests: Not run (blocked).

## 2026-01-21
- Date: 2026-01-21
- Task: Reset dev DB + CRM seeds + smoke-test setup
- Summary: Reset dev database, applied CRM auth/audit migration, seeded platform admin + CRM RBAC, added CRM demo account/roles, and updated CRM API permission guard to honor crm.all; attempted Prisma generate and CRM smoke tests.
- Files: apps/web/lib/crm-api.ts, packages/db/prisma/migrations/20260121184532_crm_auth_sessions_account_audit/migration.sql, scripts/seed-crm-account.sql, MIGRATIONS.md
- Notes: Prisma generate fails with EPERM rename for query_engine DLL; CRM login endpoints return 500 until client generation is fixed. Admin dev password set to Beauty123! for smoke tests.
- Tests: CRM login/location/category/service/audit smoke tests attempted; blocked by 500 responses.

## 2026-01-21
- Date: 2026-01-21
- Task: CRM smoke tests after Prisma generate fix
- Summary: Regenerated Prisma client, started dev server, and verified CRM login plus create flows for location/category/service with audit entries; ensured OWNER role has crm.all.
- Files: DEVLOG.md
- Notes: CRM demo account slug is demo; admin password is Beauty123! for dev smoke tests.
- Tests: CRM login, create location/category/service, verify AccountAuditLog entries (pass).

## 2026-01-21
- Date: 2026-01-21
- Task: CRM login data for beauty-salon
- Summary: Added CRM account `beauty-salon` with owner user `owner@beauty.local` and assigned OWNER role with crm.all.
- Files: DEVLOG.md
- Notes: Owner password set to Beauty123!.
- Tests: Not run (seed only).

## 2026-01-21
- Date: 2026-01-21
- Task: CRM logout button
- Summary: Added CRM sidebar logout action to match platform navigation.
- Files: apps/web/app/(crm)/crm/crm-shell.tsx
- Notes: CRM logout posts to `/api/v1/crm/auth/logout` and redirects to `/crm/login`.
- Tests: Not run (manual only).

## 2026-01-21
- Date: 2026-01-21
- Task: CRM specialists (employees)
- Summary: Added specialist levels and specialists CRUD (API + UI), including role assignment for specialists and account audit logs.
- Files: apps/web/app/(crm)/crm/specialists/page.tsx, apps/web/app/(crm)/crm/specialists/specialist-create-form.tsx, apps/web/app/(crm)/crm/specialists/specialist-row-actions.tsx, apps/web/app/(crm)/crm/specialists/specialist-level-form.tsx, apps/web/app/(crm)/crm/specialists/specialist-level-row.tsx, apps/web/app/api/v1/crm/specialists/route.ts, apps/web/app/api/v1/crm/specialists/[id]/route.ts, apps/web/app/api/v1/crm/specialist-levels/route.ts, apps/web/app/api/v1/crm/specialist-levels/[id]/route.ts, packages/contracts/openapi.yaml, API_CHANGELOG.md
- Notes: Specialist delete disables user status; base levels (accountId null) are read-only.
- Tests: Not run (manual only).

## 2026-01-21
- Date: 2026-01-21
- Task: CRM sample data for beauty-salon
- Summary: Added location managers table and seeded two locations, eight specialists with levels, ten services across categories, two managers, and location/service/specialist bindings for the beauty-salon account.
- Files: packages/db/prisma/schema.prisma, packages/db/prisma/migrations/20260121202652_location_managers/migration.sql, scripts/seed-crm-sample-data.sql, MIGRATIONS.md, docs/DB/DB_MAP.md
- Notes: Services are shared across locations (8 shared, 1 per location). Managers are linked via LocationManager.
- Tests: Not run (seed only).

## 2026-01-21
- Date: 2026-01-21
- Task: CRM staff submenu
- Summary: Renamed Specialists menu to Staff with expandable submenu for Specialists and Managers; added Managers placeholder page.
- Files: apps/web/app/(crm)/crm/crm-shell.tsx, apps/web/app/(crm)/crm/managers/page.tsx
- Notes: Managers UI CRUD not implemented yet.
- Tests: Not run (manual only).

## 2026-01-21
- Date: 2026-01-21
- Task: CRM menu labels encoding fix
- Summary: Restored Russian labels for CRM sidebar navigation and staff submenu after encoding corruption.
- Files: apps/web/app/(crm)/crm/crm-shell.tsx
- Notes: File is UTF-8; restart dev server if menu still shows gibberish.
- Tests: Not run (manual only).

## 2026-01-21
- Date: 2026-01-21
- Task: CRM staff submenu hover in collapsed mode
- Summary: Added hover flyout for staff submenu in collapsed sidebar and fixed toggle alignment/labels.
- Files: apps/web/app/(crm)/crm/crm-shell.tsx
- Notes: Flyout only shows on hover in collapsed state; toggle hidden when collapsed.
- Tests: Not run (manual only).

## 2026-01-21
- Date: 2026-01-21
- Task: CRM sidebar encoding + JSX fix
- Summary: Restored Russian labels in CRM sidebar and fixed broken JSX around staff submenu rendering.
- Files: apps/web/app/(crm)/crm/crm-shell.tsx
- Notes: Restart dev server after changes if errors persist.
- Tests: Not run (manual only).

## 2026-01-21
- Date: 2026-01-21
- Task: CRM staff hover submenu
- Summary: Enabled hover to reveal staff submenu in expanded sidebar and kept collapsed flyout clickable.
- Files: apps/web/app/(crm)/crm/crm-shell.tsx
- Notes: Submenu now appears on hover or toggle.
- Tests: Not run (manual only).

## 2026-01-21
- Date: 2026-01-21
- Task: CRM collapsed submenu visibility
- Summary: Allowed sidebar flyout to overflow the layout and kept main content clipped to avoid horizontal scroll.
- Files: apps/web/app/(crm)/crm/crm-shell.tsx
- Notes: Root container now allows overflow-x for submenu popover.
- Tests: Not run (manual only).

## 2026-01-21
- Date: 2026-01-21
- Task: CRM mobile sidebar labels + submenu behavior
- Summary: Ensured collapsed logic is ignored on mobile menu so labels render and submenu opens by click; hover flyout stays desktop-only.
- Files: apps/web/app/(crm)/crm/crm-shell.tsx
- Notes: Collapsed state now uses effectiveCollapsed = collapsed && !mobileOpen.
- Tests: Not run (manual only).

## 2026-01-21
- Date: 2026-01-21
- Task: CRM location profile page
- Summary: Added location profile page with full sections (details, photos, schedule, specialists, managers, services) and profile button from locations list.
- Files: apps/web/app/(crm)/crm/locations/location-row-actions.tsx, apps/web/app/(crm)/crm/locations/[id]/page.tsx
- Notes: Sections include current bindings; edit forms to be added later.
- Tests: Not run (manual only).

## 2026-01-21
- Date: 2026-01-21
- Task: CRM locations list cleanup
- Summary: Simplified location cards to show only name + profile/delete actions (details moved to profile).
- Files: apps/web/app/(crm)/crm/locations/location-row-actions.tsx
- Notes: Editing fields moved to location profile work.
- Tests: Not run (manual only).

## 2026-01-21
- Date: 2026-01-21
- Task: CRM location profile params fix
- Summary: Fixed Next.js params Promise handling in location profile route.
- Files: apps/web/app/(crm)/crm/locations/[id]/page.tsx
- Notes: params now awaited before use.
- Tests: Not run (manual only).

## 2026-01-24
- Date: 2026-01-24
- Task: CRM location profile UI + bindings/media/hours endpoints
- Summary: Restored Russian strings in CRM locations UI, added full location profile with editing, hours, media, bindings, tabs, and a header with cover photo. Added API routes for hours/bindings/media with OpenAPI updates.
- Files: apps/web/app/(crm)/crm/locations/page.tsx, apps/web/app/(crm)/crm/locations/location-create-form.tsx, apps/web/app/(crm)/crm/locations/location-row-actions.tsx, apps/web/app/(crm)/crm/locations/[id]/page.tsx, apps/web/app/(crm)/crm/locations/[id]/location-profile-tabs.tsx, apps/web/app/(crm)/crm/locations/[id]/location-profile-form.tsx, apps/web/app/(crm)/crm/locations/[id]/location-hours-form.tsx, apps/web/app/(crm)/crm/locations/[id]/location-media-form.tsx, apps/web/app/(crm)/crm/locations/[id]/location-bindings-form.tsx, apps/web/app/api/v1/crm/locations/route.ts, apps/web/app/api/v1/crm/locations/[id]/route.ts, apps/web/app/api/v1/crm/locations/[id]/hours/route.ts, apps/web/app/api/v1/crm/locations/[id]/bindings/route.ts, apps/web/app/api/v1/crm/locations/[id]/media/route.ts, apps/web/app/api/v1/crm/locations/[id]/media/[linkId]/route.ts, packages/contracts/openapi.yaml, API_CHANGELOG.md, packages/db/prisma/schema.prisma, packages/db/prisma/migrations/20260124170000_media_link_sort_cover/migration.sql, apps/web/package.json, MIGRATIONS.md
- Notes: Media uploads support multiple files, previews, ordering, cover selection, server-side compression/limits, and HEIC conversion. Location geo uses manual lat/lng input.
- Tests: Not run.

## 2026-01-24
- Date: 2026-01-24
- Task: CRM archive page and location archive action
- Summary: Removed delete from location list, added archive action in location profile, added Archive menu/page with restore and delete actions, and added hard-delete API with safety checks.
- Files: apps/web/app/(crm)/crm/locations/location-row-actions.tsx, apps/web/app/(crm)/crm/locations/[id]/location-profile-actions.tsx, apps/web/app/(crm)/crm/locations/[id]/page.tsx, apps/web/app/(crm)/crm/archive/page.tsx, apps/web/app/(crm)/crm/archive/archive-restore-button.tsx, apps/web/app/(crm)/crm/archive/archive-delete-button.tsx, apps/web/app/api/v1/crm/archive/route.ts, apps/web/app/api/v1/crm/promos/[id]/route.ts, apps/web/app/(crm)/crm/crm-shell.tsx
- Notes: Archive page supports restore and delete actions for locations/services/specialists/promos; clients archive pending.
- Tests: Not run.

## 2026-01-24
- Date: 2026-01-24
- Task: Location social and messenger links
- Summary: Added social/messenger fields to Location model and CRM profile form with icon inputs. Added MAX and removed Facebook. Extended locations API and OpenAPI schema. Added auto-normalization for social URLs.
- Files: packages/db/prisma/schema.prisma, packages/db/prisma/migrations/20260124223000_location_social_links/migration.sql, packages/db/prisma/migrations/20260124231000_location_social_links_max/migration.sql, MIGRATIONS.md, apps/web/app/api/v1/crm/locations/route.ts, apps/web/app/api/v1/crm/locations/[id]/route.ts, apps/web/app/(crm)/crm/locations/[id]/page.tsx, apps/web/app/(crm)/crm/locations/[id]/location-profile-tabs.tsx, apps/web/app/(crm)/crm/locations/[id]/location-profile-form.tsx, packages/contracts/openapi.yaml
- Notes: Place PNG icons in `apps/web/public/assets/socials` (website, instagram, whatsapp, telegram, max, vk, viber, pinterest).
- Tests: Not run.

## 2026-01-24
- Date: 2026-01-24
- Task: CRM services page copy fix
- Summary: Restored readable Russian UI text for CRM services page headings and empty states.
- Files: apps/web/app/(crm)/crm/services/page.tsx
- Tests: Not run.

## 2026-01-25
- Date: 2026-01-25
- Task: CRM services profile and API
- Summary: Added full service profile (general, photos, variants/levels, bindings), service media upload endpoints, and fixed services UI text/flow to use profile cards instead of inline edits.
- Files: apps/web/app/(crm)/crm/services/page.tsx, apps/web/app/(crm)/crm/services/service-create-form.tsx, apps/web/app/(crm)/crm/services/service-row-actions.tsx, apps/web/app/(crm)/crm/services/service-category-form.tsx, apps/web/app/(crm)/crm/services/service-category-row.tsx, apps/web/app/(crm)/crm/services/[id]/page.tsx, apps/web/app/(crm)/crm/services/[id]/service-profile-tabs.tsx, apps/web/app/(crm)/crm/services/[id]/service-profile-form.tsx, apps/web/app/(crm)/crm/services/[id]/service-profile-actions.tsx, apps/web/app/(crm)/crm/services/[id]/service-media-form.tsx, apps/web/app/(crm)/crm/services/[id]/service-variants-form.tsx, apps/web/app/(crm)/crm/services/[id]/service-bindings-form.tsx, apps/web/app/api/v1/crm/services/route.ts, apps/web/app/api/v1/crm/services/[id]/route.ts, apps/web/app/api/v1/crm/services/[id]/bindings/route.ts, apps/web/app/api/v1/crm/services/[id]/media/route.ts, apps/web/app/api/v1/crm/services/[id]/media/[linkId]/route.ts, apps/web/app/api/v1/crm/services/[id]/variants/route.ts, apps/web/app/api/v1/crm/services/[id]/levels/route.ts, apps/web/app/api/v1/crm/service-categories/route.ts, apps/web/app/api/v1/crm/service-categories/[id]/route.ts, packages/contracts/openapi.yaml, API_CHANGELOG.md
- Tests: Not run.

## 2026-01-25
- Date: 2026-01-25
- Task: CRM service levels-only UI
- Summary: Reworked service "Варианты и уровни" tab to only manage specialist level pricing/duration (removed variants UI).
- Files: apps/web/app/(crm)/crm/services/[id]/service-profile-tabs.tsx, apps/web/app/(crm)/crm/services/[id]/service-variants-form.tsx, apps/web/app/(crm)/crm/services/[id]/page.tsx
- Tests: Not run.

## 2026-01-25
- Date: 2026-01-25
- Task: CRM specialists profile
- Summary: Reworked specialists list to use profile cards, added specialist profile page with general info and bindings, added bindings API, and fixed Russian copy in specialists UI/API.
- Files: apps/web/app/(crm)/crm/specialists/page.tsx, apps/web/app/(crm)/crm/specialists/specialist-create-form.tsx, apps/web/app/(crm)/crm/specialists/specialist-level-form.tsx, apps/web/app/(crm)/crm/specialists/specialist-level-row.tsx, apps/web/app/(crm)/crm/specialists/specialist-row-actions.tsx, apps/web/app/(crm)/crm/specialists/[id]/page.tsx, apps/web/app/(crm)/crm/specialists/[id]/specialist-profile-tabs.tsx, apps/web/app/(crm)/crm/specialists/[id]/specialist-profile-form.tsx, apps/web/app/(crm)/crm/specialists/[id]/specialist-profile-actions.tsx, apps/web/app/(crm)/crm/specialists/[id]/specialist-bindings-form.tsx, apps/web/app/api/v1/crm/specialists/route.ts, apps/web/app/api/v1/crm/specialists/[id]/route.ts, apps/web/app/api/v1/crm/specialists/[id]/bindings/route.ts, apps/web/app/api/v1/crm/specialist-levels/route.ts, apps/web/app/api/v1/crm/specialist-levels/[id]/route.ts, packages/contracts/openapi.yaml, API_CHANGELOG.md
- Tests: Not run.

## 2026-01-25
- Date: 2026-01-25
- Task: CRM specialist media tab
- Summary: Added specialist media tab with photo uploads and API endpoints for specialist photo/work galleries.
- Files: apps/web/app/(crm)/crm/specialists/[id]/specialist-profile-tabs.tsx, apps/web/app/(crm)/crm/specialists/[id]/specialist-media-form.tsx, apps/web/app/(crm)/crm/specialists/[id]/page.tsx, apps/web/app/api/v1/crm/specialists/[id]/media/route.ts, apps/web/app/api/v1/crm/specialists/[id]/media/[linkId]/route.ts, packages/contracts/openapi.yaml, API_CHANGELOG.md
- Tests: Not run.

## 2026-01-25
- Date: 2026-01-25
- Task: CRM managers section
- Summary: Added managers list/profile UI, bindings to locations, and managers API endpoints.
- Files: apps/web/app/(crm)/crm/managers/page.tsx, apps/web/app/(crm)/crm/managers/manager-create-form.tsx, apps/web/app/(crm)/crm/managers/manager-row-actions.tsx, apps/web/app/(crm)/crm/managers/[id]/page.tsx, apps/web/app/(crm)/crm/managers/[id]/manager-profile-actions.tsx, apps/web/app/(crm)/crm/managers/[id]/manager-profile-form.tsx, apps/web/app/(crm)/crm/managers/[id]/manager-profile-tabs.tsx, apps/web/app/(crm)/crm/managers/[id]/manager-bindings-form.tsx, apps/web/app/api/v1/crm/managers/route.ts, apps/web/app/api/v1/crm/managers/[id]/route.ts, apps/web/app/api/v1/crm/managers/[id]/bindings/route.ts, packages/contracts/openapi.yaml, API_CHANGELOG.md
- Tests: Not run.

## 2026-01-25
- Date: 2026-01-25
- Task: CRM schedule UI and copy fixes
- Summary: Rebuilt CRM work schedule page with toolbar, filters, grid, side panel, and copy modal; fixed Russian copy in CRM menu and locations page.
- Files: apps/web/app/(crm)/crm/schedule/page.tsx, apps/web/app/(crm)/crm/schedule/schedule-view.tsx, apps/web/app/(crm)/crm/crm-shell.tsx, apps/web/app/(crm)/crm/locations/page.tsx
- Tests: Not run.

## 2026-01-25
- Date: 2026-01-25
- Task: CRM график работы (логика + миграция)
- Summary: Реализована логика графика работы (шаблоны, массовое применение, удаление, копирование, фильтры/счетчики) и добавлена миграция расписания; обновлены OpenAPI и changelog.
- Files: apps/web/app/(crm)/crm/schedule/schedule-view.tsx, apps/web/app/(crm)/crm/schedule/page.tsx, packages/contracts/openapi.yaml, API_CHANGELOG.md, MIGRATIONS.md, packages/db/prisma/migrations/20260125134137_crm_schedule/migration.sql
- Notes: Prisma migrate dev применен; `prisma generate` падает с EPERM на `query_engine-windows.dll.node` (нужно закрыть запущенные процессы и повторить генерацию).
- Tests: Not run (Prisma generate blocked).

## 2026-01-25
- Date: 2026-01-25
- Task: CRM график работы — UX правки
- Summary: Панель настроек появляется только при выборе дня, счетчики смен/сотрудников всегда видимы, а меню и фильтры закрываются по клику вне блока; улучшена адаптация для мобильных экранов.
- Files: apps/web/app/(crm)/crm/schedule/schedule-view.tsx
- Notes: UI кнопка настроек удалена, counts всегда включены.
- Tests: Not run.

## 2026-01-25
- Date: 2026-01-25
- Task: CRM график работы — выделение дня и выравнивание
- Summary: Добавлено выделение выбранных дней, скрыты пустые круги в слотах, выровнены строки сотрудников с сеткой, добавлена кнопка закрытия панели и выставлено рабочее время 10:00–21:00.
- Files: apps/web/app/(crm)/crm/schedule/schedule-view.tsx, apps/web/app/(crm)/crm/crm-shell.tsx
- Notes: Страница графика теперь разворачивается на всю ширину.
- Tests: Not run.

## 2026-01-25
- Date: 2026-01-25
- Task: CRM график работы — мобильная адаптация
- Summary: Добавлены мобильные вкладки (График/Сотрудники), выбор сотрудника на мобильных и скрытие лишних строк графика; улучшен горизонтальный скролл сетки.
- Files: apps/web/app/(crm)/crm/schedule/schedule-view.tsx
- Tests: Not run.

## 2026-01-25
- Date: 2026-01-25
- Task: CRM график работы — выравнивание лент
- Summary: Увеличена высота строк и выровнены отступы, чтобы строки сотрудников совпадали с лентами дней.
- Files: apps/web/app/(crm)/crm/schedule/schedule-view.tsx
- Tests: Not run.

## 2026-01-25
- Date: 2026-01-25
- Task: CRM график работы — выравнивание заголовков
- Summary: Выровнены высоты заголовка сотрудников и строки дней для аккуратного совпадения лент.
- Files: apps/web/app/(crm)/crm/schedule/schedule-view.tsx
- Tests: Not run.

## 2026-01-25
- Date: 2026-01-25
- Task: CRM график работы — единые линии
- Summary: Зафиксированы высоты строк и шапки (64/88px), чтобы горизонтальные линии совпадали по всей сетке.
- Files: apps/web/app/(crm)/crm/schedule/schedule-view.tsx
- Tests: Not run.

## 2026-01-25
- Date: 2026-01-25
- Task: CRM график работы - синхронные линии
- Summary: Зафиксированы высоты строк сетки и слотов, чтобы горизонтальные линии совпадали у сотрудников и дней.
- Files: apps/web/app/(crm)/crm/schedule/schedule-view.tsx
- Tests: Not run.

## 2026-01-25
- Date: 2026-01-25
- Task: CRM clients list + profile
- Summary: Added CRM clients list page with create form, client cards linking to profile, and CRM clients CRUD API with audit logs.
- Files: apps/web/app/(crm)/crm/clients/page.tsx, apps/web/app/(crm)/crm/clients/client-create-form.tsx, apps/web/app/(crm)/crm/clients/client-row-actions.tsx, apps/web/app/(crm)/crm/clients/[id]/page.tsx, apps/web/app/api/v1/crm/clients/route.ts, apps/web/app/api/v1/crm/clients/[id]/route.ts, packages/contracts/openapi.yaml, API_CHANGELOG.md
- Notes: Profile page is read-only for now; edit UI can be added next.
- Tests: Not run.

## 2026-01-25
- Date: 2026-01-25
- Task: CRM журнал записи (UI + данные)
- Summary: Replaced calendar stub with Journal view, pulling real appointments for the current month and rendering day/week grids, filters, and status styling.
- Files: apps/web/app/(crm)/crm/calendar/page.tsx, apps/web/app/(crm)/crm/calendar/journal-view.tsx, apps/web/app/(crm)/crm/crm-shell.tsx
- Notes: Uses Appointment data; interactive UI only (no create/edit flows yet).
- Tests: Not run.

## 2026-01-26
- Date: 2026-01-26
- Task: CRM журнал записи — пересборка по инструкции
- Summary: Собран новый журнал записи с полной шириной, тулбаром, мини-календарем, дневной/недельной сеткой, карточками визитов и окном редактирования; добавлены API создания/редактирования записей и схемы OpenAPI.
- Files: apps/web/app/(crm)/crm/calendar/page.tsx, apps/web/app/(crm)/crm/calendar/journal-view.tsx, apps/web/app/api/v1/crm/appointments/route.ts, apps/web/app/api/v1/crm/appointments/[id]/route.ts, packages/contracts/openapi.yaml, API_CHANGELOG.md, DEVLOG.md
- Notes: Привязка услуги делается по названию при совпадении; в остальном запись сохраняется без услуг.
- Tests: Not run.

## 2026-01-27
- Date: 2026-01-27
- Task: CRM журнал записи — валидации расписания и пересечений
- Summary: Добавлены серверные проверки графика, перерывов, блокировок и пересечений записей; журнал передает serviceId и показывает ошибки сохранения.
- Files: apps/web/app/api/v1/crm/appointments/route.ts, apps/web/app/api/v1/crm/appointments/[id]/route.ts, apps/web/app/(crm)/crm/calendar/journal-view.tsx, apps/web/app/(crm)/crm/calendar/page.tsx, packages/contracts/openapi.yaml
- Notes: Запись теперь блокируется вне рабочего дня/перерывов и при пересечении активных записей.
- Tests: Not run.

## 2026-01-27
- Date: 2026-01-27
- Task: CRM журнал записи — шаг 15 минут, авто-окончание и визуализация графика
- Summary: Починил определение рабочего дня по UTC-дате, добавил загрузку schedule entries в журнал, подсветку нерабочих слотов, авто-расчет окончания по длительности услуги и шаг времени 15 минут.
- Files: apps/web/app/api/v1/crm/appointments/route.ts, apps/web/app/api/v1/crm/appointments/[id]/route.ts, apps/web/app/(crm)/crm/calendar/page.tsx, apps/web/app/(crm)/crm/calendar/journal-view.tsx, DEVLOG.md
- Notes: В новом сеансе конец времени скрыт до выбора услуги; запись блокируется на нерабочих слотах.
- Tests: Not run.

## 2026-01-27
- Date: 2026-01-27
- Task: CRM журнал записи — синхронизация смены даты с данными графика
- Summary: Перевел навигацию по датам на goToDate с push в `/crm/calendar?date=...`, чтобы при смене дня загружались актуальные рабочие часы и слоты не блокировались.
- Files: apps/web/app/(crm)/crm/calendar/journal-view.tsx, DEVLOG.md
- Tests: Not run.

## 2026-01-27
- Date: 2026-01-27
- Task: CRM график работы — нормализация дат
- Summary: Исправил формирование ISO-даты в графике работы на локальную (YYYY-MM-DD), чтобы рабочие дни не сдвигались на сутки.
- Files: apps/web/app/(crm)/crm/schedule/schedule-view.tsx, DEVLOG.md
- Tests: Not run.

## 2026-01-27
- Date: 2026-01-27
- Task: CRM журнал записи — компактная шкала времени
- Summary: Уменьшил высоту слота времени, чтобы сетка по времени была компактнее.
- Files: apps/web/app/(crm)/crm/calendar/journal-view.tsx, DEVLOG.md
- Tests: Not run.

## 2026-01-27
- Date: 2026-01-27
- Task: CRM журнал записи — еще плотнее
- Summary: Дополнительно уменьшил высоту слота времени для более плотной шкалы.
- Files: apps/web/app/(crm)/crm/calendar/journal-view.tsx, DEVLOG.md
- Tests: Not run.

## 2026-01-27
- Date: 2026-01-27
- Task: CRM журнал записи — шаги масштаба A-/A+
- Summary: Перевел масштаб на 4 дискретных шага, чтобы от минимального до максимального было ровно 3 клика.
- Files: apps/web/app/(crm)/crm/calendar/journal-view.tsx, DEVLOG.md
- Tests: Not run.

## 2026-01-27
- Date: 2026-01-27
- Task: Booking page searchParams fix
- Summary: Read `searchParams` via async server component to pass account slug to booking client.
- Files: apps/web/app/booking/page.tsx, DEVLOG.md
- Tests: Not run.

## 2026-01-26
- Date: 2026-01-26
- Task: Public booking page uses live booking APIs
- Summary: Built booking flow UI that loads locations/services/specialists/slots from public APIs and posts appointments; wired booking entry to BookingClient.
- Files: apps/web/app/booking/booking-client.tsx, apps/web/app/booking/page.tsx, DEVLOG.md
- Tests: Not run.

## 2026-01-26
- Date: 2026-01-26
- Task: Fix BookingClient React node types
- Summary: Switched to ReactNode import to avoid React namespace type errors in booking UI helpers.
- Files: apps/web/app/booking/booking-client.tsx, DEVLOG.md
- Tests: Not run.

## 2026-01-27
- Date: 2026-01-27
- Task: Public booking location params
- Summary: Awaited route params in public booking services/specialists APIs to fix invalid location errors.
- Files: apps/web/app/api/v1/public/booking/locations/[id]/services/route.ts, apps/web/app/api/v1/public/booking/locations/[id]/specialists/route.ts, DEVLOG.md
- Tests: Not run.
