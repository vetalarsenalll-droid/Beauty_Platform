MIGRATIONS

## 2026-03-23 - baseline_reconstruction
- Date: 2026-03-23
- Slug: baseline_reconstruction
- Prisma migration: packages/db/prisma/migrations/20260323132000_baseline
- Purpose: Restore reproducible bootstrap of a new database after consolidating legacy migrations into an archive.
- Schema changes: No functional schema change; baseline SQL now contains the full DDL reconstructed from archived migrations.
- Data migration: None.
- Rollback: Restore previous migration layout or regenerate a fresh baseline from schema.prisma.
- Notes: Archived history remains in packages/db/prisma/migrations_archive_20260323_021619 for audit/reference; new environments should apply the active baseline migration.


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

## 2026-02-05 - public_booking_idempotency
- Date: 2026-02-05
- Slug: public_booking_idempotency
- Prisma migration: packages/db/prisma/migrations/20260205_public_booking_idempotency
- Purpose: Add idempotency keys storage for public booking.
- Schema changes: New IdempotencyKey table with unique (accountId, key), response JSON, status.
- Data migration: None.
- Rollback: Drop IdempotencyKey table and related indexes.
- Notes: Used by public booking create appointment for deduplication.

## 2026-02-05 - legal_documents
- Date: 2026-02-05
- Slug: legal_documents
- Prisma migration: packages/db/prisma/migrations/20260205_legal_documents
- Purpose: Store legal documents, versions, and client acceptances.
- Schema changes: Added LegalDocument, LegalDocumentVersion, LegalAcceptance with relations to Account/Appointment/Client.
- Data migration: None.
- Rollback: Drop legal document tables and indexes.
- Notes: Used for public booking consent capture.

## 2026-02-05 - account_profile
- Date: 2026-02-05
- Slug: account_profile
- Prisma migration: packages/db/prisma/migrations/20260205200000_account_profile
- Purpose: Add account profile and branding fields for public site/profile.
- Schema changes: Added AccountProfile and AccountBranding tables with accountId unique relations.
- Data migration: None.
- Rollback: Drop AccountProfile and AccountBranding tables.
- Notes: Migration initially failed due BOM in SQL; re-applied after cleanup.

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
- Prisma migration: packages/db/prisma/migrations/20260120_auth_sessions_access_refresh
- Purpose: Split auth sessions into access/refresh tokens with independent TTLs.
- Schema changes: UserSession now stores accessTokenHash/accessExpiresAt and refreshTokenHash/refreshExpiresAt with unique constraints.
- Data migration: Existing sessions must be recreated (logout all users).
- Rollback: Revert UserSession columns to refreshTokenHash/expiresAt.
- Notes: Requires a new Prisma migration and redeploy.

## 2026-01-21 - crm_auth_sessions_account_audit
- Date: 2026-01-21
- Slug: crm_auth_sessions_account_audit
- Prisma migration: packages/db/prisma/migrations/20260121184532_crm_auth_sessions_account_audit
- Purpose: Support CRM sessions per account and add account-level audit logging.
- Schema changes: Added SessionType enum; UserSession now includes sessionType + accountId; added AccountAuditLog table and relations on Account/User.
- Data migration: Existing sessions default to PLATFORM; no backfill required.
- Rollback: Drop AccountAuditLog table and new UserSession columns/enum.
- Notes: Requires a new Prisma migration and re-login for CRM sessions.

## 2026-01-21 - location_managers
- Date: 2026-01-21
- Slug: location_managers
- Prisma migration: packages/db/prisma/migrations/20260121202652_location_managers
- Purpose: Track manager assignments per location.
- Schema changes: Added LocationManager table + relations on Account/User/Location.
- Data migration: None.
- Rollback: Drop LocationManager table and relations.
- Notes: Used for CRM manager-to-location binding.

## 2026-01-24 - media_link_sort_cover
- Date: 2026-01-24
- Slug: media_link_sort_cover
- Prisma migration: packages/db/prisma/migrations/20260124170000_media_link_sort_cover
- Purpose: Support media ordering and cover selection.
- Schema changes: Added MediaLink.sortOrder and MediaLink.isCover with index by entity.
- Data migration: None (defaults applied).
- Rollback: Drop added columns and index.
- Notes: Used for CRM media admin panel.

## 2026-01-24 - location_social_links
- Date: 2026-01-24
- Slug: location_social_links
- Prisma migration: packages/db/prisma/migrations/20260124223000_location_social_links
- Purpose: Store location social and messenger links.
- Schema changes: Added websiteUrl, instagramUrl, whatsappUrl, telegramUrl, vkUrl, viberUrl, pinterestUrl, facebookUrl on Location.
- Data migration: None.
- Rollback: Drop added columns.
- Notes: Used in CRM location profile.

## 2026-01-24 - location_social_links_max
- Date: 2026-01-24
- Slug: location_social_links_max
- Prisma migration: packages/db/prisma/migrations/20260124231000_location_social_links_max
- Purpose: Adjust social links (add MAX, remove Facebook).
- Schema changes: Added Location.maxUrl; removed Location.facebookUrl.
- Data migration: None.
- Rollback: Re-add facebookUrl and drop maxUrl.
- Notes: MAX replaces Facebook.

## 2026-01-25 - crm_schedule
- Date: 2026-01-25
- Slug: crm_schedule
- Prisma migration: packages/db/prisma/migrations/20260125134137_crm_schedule
- Purpose: Add CRM schedule entities for work calendar and non-working types.
- Schema changes: Added ScheduleEntryType enum, ScheduleEntry, ScheduleEntryBreak, ScheduleNonWorkingType, and relations to Account/Location/SpecialistProfile.
- Data migration: None.
- Rollback: Drop schedule tables and enum, remove relations.
- Notes: Migration applied; Prisma client generation may fail if query engine is locked by running dev server.
