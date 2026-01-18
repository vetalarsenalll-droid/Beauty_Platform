API_CHANGELOG

## Template
- Date:
- Version:
- Changes:
- Endpoints:
- DTOs:
- Examples:
- Notes:

## 2025-__-__ - v1
- Date:
- Version:
- Changes:
- Endpoints:
- DTOs:
- Examples:
- Notes:

## 2026-01-16 - v1
- Date: 2026-01-16
- Version: v1
- Changes: Added Client/CRM/Platform/Integrations/AI DTOs and responses.
- Endpoints: Client, CRM, Platform, Integrations, AI routes now use concrete schemas.
- DTOs: ClientProfile/Favorite/Loyalty/Notification/Payment/Settings, CRM entities, Platform monitoring/account/plan, webhook, and AI schemas.
- Examples: None.
- Notes: Endpoints/DTOs to be filled per module specs.

## 2026-01-17 - v1
- Date: 2026-01-17
- Version: v1
- Changes: Added auth session endpoint and updated login response structure.
- Endpoints: GET /auth/me
- DTOs: AuthMeResponse, AuthUserSummary, updated AuthLoginResponse (user + permissions).
- Examples: None.
- Notes: Auth uses httpOnly cookies; access/refresh tokens omitted for now.
