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

## 2026-02-05 - v1
- Date: 2026-02-05
- Version: v1
- Changes: Added public booking API contract and DTOs; public booking context now includes slotStepMinutes; public booking create supports Idempotency-Key.
- Endpoints: GET /public/booking/context, GET /public/booking/locations/{id}/services, GET /public/booking/locations/{id}/specialists, GET /public/booking/availability/specialists, GET /public/booking/availability/calendar, GET /public/booking/slots, GET /public/booking/offers, POST /public/booking/appointments.
- DTOs: PublicAccount, PublicLocation, PublicService, PublicSpecialist, PublicSlot, PublicBooking* responses, PublicBookingAppointmentCreateRequest/Response.
- Examples: None.
- Notes: Public booking endpoints are unauthenticated and use `account` query param for account slug.

## 2026-02-05 - v1
- Date: 2026-02-05
- Version: v1
- Changes: Added CRM settings endpoints (booking/legal/seo/public page) and legal document consent support in public booking.
- Endpoints: GET/PATCH /crm/settings/booking, /crm/settings/legal, /crm/settings/seo, /crm/settings/public-page; POST /public/booking/appointments now accepts legalVersionIds.
- DTOs: CrmBookingSettings*, CrmLegalDocuments*, CrmSeoSettings*, CrmPublicPage*, PublicLegalDocument.
- Examples: None.
- Notes: Legal documents are versioned and require client consent for required docs.

## 2026-02-05 - v1
- Date: 2026-02-05
- Version: v1
- Changes: Added CRM account profile/branding endpoints, permissions editor, and account access update; added password update for specialist/manager profiles.
- Endpoints: PATCH /crm/settings/account, GET/PATCH /crm/settings/permissions, PATCH /crm/settings/user, POST /crm/account/media, DELETE /crm/account/media/{linkId}, PATCH /crm/specialists/{id} (password), PATCH /crm/managers/{id} (password).
- DTOs: AccountProfile, AccountBranding, PermissionRoleUpdate (inline), CrmUserAccessUpdate (inline).
- Examples: None.
- Notes: Account media uploads accept images and update account branding logo/cover URLs.

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

## 2026-01-24 - v1
- Date: 2026-01-24
- Version: v1
- Changes: Added CRM location profile endpoints for hours, bindings, and media (media uses file uploads with updates).
- Endpoints: PATCH /crm/locations/{id}/hours, PATCH /crm/locations/{id}/bindings, POST /crm/locations/{id}/media, PATCH /crm/locations/{id}/media/{linkId}, DELETE /crm/locations/{id}/media/{linkId}.
- DTOs: CrmLocationHour, CrmLocationHoursUpdateRequest/Response, CrmLocationBindingsRequest/Response, CrmLocationMediaUploadRequest/Response, CrmLocationMediaUpdateRequest/Response.
- Examples: None.
- Notes: Media uploads accept image files (including HEIC) and store them in server uploads. Locations use manual geo coordinates.

## 2026-01-25 - v1
- Date: 2026-01-25
- Version: v1
- Changes: Added CRM service profile endpoints for bindings, media uploads, variants, and level configs.
- Endpoints: PATCH /crm/services/{id}/bindings, POST /crm/services/{id}/media, PATCH /crm/services/{id}/media/{linkId}, DELETE /crm/services/{id}/media/{linkId}, PATCH /crm/services/{id}/variants, PATCH /crm/services/{id}/levels.
- DTOs: CrmServiceBindingsRequest/Response, CrmServiceMediaUploadRequest/Response, CrmServiceMediaUpdateRequest/Response, CrmServiceVariantsUpdateRequest/Response, CrmServiceLevelsUpdateRequest/Response.
- Examples: None.
- Notes: Service media uses file uploads and the same image constraints as locations.

## 2026-01-25 - v1
- Date: 2026-01-25
- Version: v1
- Changes: Added CRM specialist profile bindings endpoint.
- Endpoints: PATCH /crm/specialists/{id}/bindings.
- DTOs: CrmSpecialistBindingsRequest/Response.
- Examples: None.
- Notes: Specialist bindings manage services and locations.

## 2026-01-25 - v1
- Date: 2026-01-25
- Version: v1
- Changes: Added CRM specialist media endpoints.
- Endpoints: POST /crm/specialists/{id}/media, PATCH /crm/specialists/{id}/media/{linkId}, DELETE /crm/specialists/{id}/media/{linkId}.
- DTOs: CrmSpecialistMediaUploadRequest/Response, CrmSpecialistMediaUpdateRequest/Response.
- Examples: None.
- Notes: Media uploads accept images (HEIC supported) and store in server uploads.

## 2026-01-25 - v1
- Date: 2026-01-25
- Version: v1
- Changes: Added CRM managers CRUD and bindings endpoints.
- Endpoints: GET/POST /crm/managers, GET/PATCH/DELETE /crm/managers/{id}, PATCH /crm/managers/{id}/bindings.
- DTOs: CrmManager, CrmManagersResponse, CrmManagerResponse, CrmManagerCreateRequest, CrmManagerUpdateRequest, CrmManagerBindingsRequest/Response.
- Examples: None.
- Notes: Managers are users with MANAGER role assignment.

## 2026-01-25 - v1
- Date: 2026-01-25
- Version: v1
- Changes: Added CRM schedule entries, copy, and non-working types endpoints.
- Endpoints: GET/POST /crm/schedule/entries, POST /crm/schedule/copy, GET/POST /crm/schedule/non-working-types, PATCH/DELETE /crm/schedule/non-working-types/{id}.
- DTOs: CrmScheduleEntry, CrmScheduleEntryBreak, CrmScheduleEntriesCreateRequest, CrmScheduleEntriesResponse, CrmScheduleCopyRequest, CrmScheduleNonWorkingType* schemas.
- Examples: None.
- Notes: Schedule entries support mass upsert and delete (type=DELETE).

## 2026-01-25 - v1
- Date: 2026-01-25
- Version: v1
- Changes: Added CRM clients CRUD endpoints and schemas.
- Endpoints: GET/POST /crm/clients, GET/PATCH/DELETE /crm/clients/{id}.
- DTOs: CrmClient, CrmClientsResponse, CrmClientResponse, CrmClientCreateRequest, CrmClientUpdateRequest.
- Examples: None.
- Notes: Client operations are account-scoped and write audit logs.

## 2026-01-26 - v1
- Date: 2026-01-26
- Version: v1
- Changes: Added CRM appointments create/update endpoints for journal.
- Endpoints: POST /crm/appointments, PATCH /crm/appointments/{id}.
- DTOs: CrmAppointment, CrmAppointmentsResponse, CrmAppointmentResponse, CrmAppointmentCreateRequest, CrmAppointmentUpdateRequest.
- Examples: None.
- Notes: Appointment create/update is account-scoped; services link by name when matched.

## 2026-01-27 - v1
- Date: 2026-01-27
- Version: v1
- Changes: Appointment create/update now accepts serviceId and returns serviceIds; added schedule/overlap/blocked-slot validations.
- Endpoints: POST /crm/appointments, PATCH /crm/appointments/{id}.
- DTOs: CrmAppointment, CrmAppointmentCreateRequest, CrmAppointmentUpdateRequest.
- Examples: None.
- Notes: Записи блокируются вне рабочего дня и при пересечении активных визитов; отмененные/«не пришел» не блокируют запись.
