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
