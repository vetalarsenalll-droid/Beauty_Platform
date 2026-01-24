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

## 2026-01-19 - v1
- Date: 2026-01-19
- Version: v1
- Changes: Added bearer token support for mobile and included token in login response.
- Endpoints: POST /auth/login, GET /auth/me, all /platform/* accept Authorization: Bearer.
- DTOs: AuthLoginResponse now includes token + expiresAt.
- Examples: None.
- Notes: Web keeps httpOnly cookie; mobile uses bearer token from login.

## 2026-01-21 - v1
- Date: 2026-01-21
- Version: v1
- Changes: Added CRM auth endpoints, locations CRUD, service categories CRUD, and services CRUD.
- Endpoints: POST /crm/auth/login, POST /crm/auth/refresh, POST /crm/auth/logout, GET /crm/auth/me, GET/POST /crm/locations, GET/PATCH/DELETE /crm/locations/{id}, GET/POST /crm/service-categories, PATCH/DELETE /crm/service-categories/{id}, GET/POST /crm/services, GET/PATCH/DELETE /crm/services/{id}.
- DTOs: CrmAuthLoginRequest/Response, CrmAuthMeResponse, CrmLocation* schemas, CrmServiceCategory* schemas.
- Examples: None.
- Notes: CRM auth uses separate cookies (bp_crm_access/bp_crm_refresh) and account-scoped sessions.

## 2026-01-21 - v1
- Date: 2026-01-21
- Version: v1
- Changes: Added CRM specialists CRUD and specialist level management.
- Endpoints: GET/POST /crm/specialists, GET/PATCH/DELETE /crm/specialists/{id}, GET/POST /crm/specialist-levels, PATCH/DELETE /crm/specialist-levels/{id}.
- DTOs: Specialist, CrmSpecialistLevel, CrmSpecialistLevelCreateRequest, CrmSpecialistLevelUpdateRequest.
- Examples: None.
- Notes: Specialist delete disables the user account.
