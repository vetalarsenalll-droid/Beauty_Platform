MIGRATIONS

## Template
- Date:
- Slug:
- Prisma migration:
- Purpose:
- Schema changes:
- Data migration:
- Rollback:
- Notes:

## 2025-__-__ - ____
- Date:
- Slug:
- Prisma migration:
- Purpose:
- Schema changes:
- Data migration:
- Rollback:
- Notes:

## 2026-01-16 - init
- Date: 2026-01-16
- Slug: init
- Prisma migration: packages/db/prisma/migrations/20260116_init
- Purpose: Baseline schema for full domain map.
- Schema changes: Initial create of all tables/enums from schema.prisma (platform, accounts, settings, booking, payments, promo/loyalty, notifications, webhooks, AI).
- Data migration: None.
- Rollback: Drop created schema (baseline).
- Notes: Migration SQL generated via `prisma migrate diff --from-empty`.

## 2026-01-17 - add_user_identity_password
- Date: 2026-01-17
- Slug: add_user_identity_password
- Prisma migration: packages/db/prisma/migrations/20260117_add_user_identity_password
- Purpose: Add password fields to UserIdentity for email+password auth.
- Schema changes: Added passwordHash, passwordSalt, passwordAlgo, passwordUpdatedAt; unique (provider, email).
- Data migration: None.
- Rollback: Drop added columns/index.
- Notes: Generated SQL was commented out; fixed by follow-up migration.

## 2026-01-17 - add_user_identity_password_fix
- Date: 2026-01-17
- Slug: add_user_identity_password_fix
- Prisma migration: packages/db/prisma/migrations/20260117_add_user_identity_password_fix
- Purpose: Apply password fields and unique index for UserIdentity.
- Schema changes: Added passwordHash, passwordSalt, passwordAlgo, passwordUpdatedAt; unique (provider, email).
- Data migration: None.
- Rollback: Drop added columns/index.
- Notes: Fixes commented SQL in previous migration.

## 2026-01-20 - auth_sessions_access_refresh
- Date: 2026-01-20
- Slug: auth_sessions_access_refresh
- Prisma migration: pending
- Purpose: Split auth sessions into access/refresh tokens with independent TTLs.
- Schema changes: UserSession now stores accessTokenHash/accessExpiresAt and refreshTokenHash/refreshExpiresAt with unique constraints.
- Data migration: Existing sessions must be recreated (logout all users).
- Rollback: Revert UserSession columns to refreshTokenHash/expiresAt.
- Notes: Requires a new Prisma migration and redeploy.
