# CRM Agent v2 Section 13 Action Catalog Test Report

Generated: 2026-05-29T17:53:42.837Z

## Summary

| Metric | Value |
| --- | --- |
| Section 13 actions | 374 |
| Registry actions | 374 |
| Planner-visible actions | 374 |
| Executable actions | 252 |
| Failures | 0 |
| Warnings | 0 |
| Extra registry actions | 0 |

## Status Counts

| Status | Count |
| --- | --- |
| draft_only | 13 |
| implemented | 252 |
| read_only | 109 |

## Domain Counts

| Domain | Count |
| --- | --- |
| account | 19 |
| agent-settings | 12 |
| analytics | 17 |
| appointments | 23 |
| clients | 26 |
| domains | 6 |
| finance | 16 |
| group-sessions | 12 |
| integrations | 8 |
| legal | 7 |
| locations | 21 |
| loyalty | 17 |
| marketing | 16 |
| media | 13 |
| notifications | 13 |
| promos | 16 |
| reviews | 15 |
| schedule | 23 |
| services | 29 |
| site | 22 |
| specialists | 21 |
| users | 22 |

## Failures

_Нет._

## Warnings

_Нет._

## Per-Action Results

| Section | Action | Status | Kind | Risk | Confirmation | Permission | File | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 13.1 Аккаунт | account.view | read_only | read | low | never | crm.settings.read | apps/web/lib/crm-agent-v2/actions/account/account.view.ts | PASS |
| 13.1 Аккаунт | account.update_name | implemented | write | medium | medium_plus | crm.settings.update | apps/web/lib/crm-agent-v2/actions/account/account.update-name.ts | PASS |
| 13.1 Аккаунт | account.update_slug | implemented | write | high | always | crm.settings.update | apps/web/lib/crm-agent-v2/actions/account/account.update-slug.ts | PASS |
| 13.1 Аккаунт | account.update_status | implemented | system | critical | separate_sensitive_confirm | platform.accounts.update | apps/web/lib/crm-agent-v2/actions/account/account.update-status.ts | PASS |
| 13.1 Аккаунт | account.update_business_type | implemented | write | medium | medium_plus | crm.settings.update | apps/web/lib/crm-agent-v2/actions/account/account.update-business-type.ts | PASS |
| 13.1 Аккаунт | account.update_profile | implemented | write | medium | medium_plus | crm.settings.update | apps/web/lib/crm-agent-v2/actions/account/account.update-profile.ts | PASS |
| 13.1 Аккаунт | account.update_contacts | implemented | write | medium | medium_plus | crm.settings.update | apps/web/lib/crm-agent-v2/actions/account/account.update-contacts.ts | PASS |
| 13.1 Аккаунт | account.update_address | implemented | write | medium | medium_plus | crm.settings.update | apps/web/lib/crm-agent-v2/actions/account/account.update-address.ts | PASS |
| 13.1 Аккаунт | account.update_branding | implemented | write | medium | medium_plus | crm.settings.update | apps/web/lib/crm-agent-v2/actions/account/account.update-branding.ts | PASS |
| 13.1 Аккаунт | account.update_logo | implemented | write | medium | medium_plus | crm.settings.update | apps/web/lib/crm-agent-v2/actions/account/account.update-logo.ts | PASS |
| 13.1 Аккаунт | account.update_colors | implemented | write | medium | medium_plus | crm.settings.update | apps/web/lib/crm-agent-v2/actions/account/account.update-colors.ts | PASS |
| 13.1 Аккаунт | account.update_public_description | implemented | write | medium | medium_plus | crm.settings.update | apps/web/lib/crm-agent-v2/actions/account/account.update-public-description.ts | PASS |
| 13.1 Аккаунт | account.update_booking_rules | implemented | write | high | always | crm.settings.update | apps/web/lib/crm-agent-v2/actions/account/account.update-booking-rules.ts | PASS |
| 13.1 Аккаунт | account.update_cancellation_rules | implemented | write | high | always | crm.settings.update | apps/web/lib/crm-agent-v2/actions/account/account.update-cancellation-rules.ts | PASS |
| 13.1 Аккаунт | account.update_reschedule_rules | implemented | write | high | always | crm.settings.update | apps/web/lib/crm-agent-v2/actions/account/account.update-reschedule-rules.ts | PASS |
| 13.1 Аккаунт | account.update_deposit_rules | implemented | write | high | always | crm.settings.update | apps/web/lib/crm-agent-v2/actions/account/account.update-deposit-rules.ts | PASS |
| 13.1 Аккаунт | account.update_review_rules | implemented | write | medium | medium_plus | crm.settings.update | apps/web/lib/crm-agent-v2/actions/account/account.update-review-rules.ts | PASS |
| 13.1 Аккаунт | account.view_audit | read_only | read | medium | never | crm.audit.read | apps/web/lib/crm-agent-v2/actions/account/account.view-audit.ts | PASS |
| 13.1 Аккаунт | account.export_data | implemented | export | high | always | crm.settings.export | apps/web/lib/crm-agent-v2/actions/account/account.export-data.ts | PASS |
| 13.2 Пользователи, роли, пароль | user.search | read_only | read | low | never | crm.users.read | apps/web/lib/crm-agent-v2/actions/users/user.search.ts | PASS |
| 13.2 Пользователи, роли, пароль | user.view | read_only | read | low | never | crm.users.read | apps/web/lib/crm-agent-v2/actions/users/user.view.ts | PASS |
| 13.2 Пользователи, роли, пароль | user.invite | implemented | write | medium | medium_plus | crm.users.invite | apps/web/lib/crm-agent-v2/actions/users/user.invite.ts | PASS |
| 13.2 Пользователи, роли, пароль | user.create | implemented | write | high | always | crm.users.create | apps/web/lib/crm-agent-v2/actions/users/user.create.ts | PASS |
| 13.2 Пользователи, роли, пароль | user.update_profile | implemented | write | medium | medium_plus | crm.users.update | apps/web/lib/crm-agent-v2/actions/users/user.update-profile.ts | PASS |
| 13.2 Пользователи, роли, пароль | user.update_email | implemented | write | high | always | crm.users.update | apps/web/lib/crm-agent-v2/actions/users/user.update-email.ts | PASS |
| 13.2 Пользователи, роли, пароль | user.update_phone | implemented | write | medium | medium_plus | crm.users.update | apps/web/lib/crm-agent-v2/actions/users/user.update-phone.ts | PASS |
| 13.2 Пользователи, роли, пароль | user.change_role | implemented | system | high | always | crm.users.roles.update | apps/web/lib/crm-agent-v2/actions/users/user.change-role.ts | PASS |
| 13.2 Пользователи, роли, пароль | user.activate | implemented | write | medium | medium_plus | crm.users.update | apps/web/lib/crm-agent-v2/actions/users/user.activate.ts | PASS |
| 13.2 Пользователи, роли, пароль | user.deactivate | implemented | system | high | always | crm.users.update | apps/web/lib/crm-agent-v2/actions/users/user.deactivate.ts | PASS |
| 13.2 Пользователи, роли, пароль | user.reset_password | implemented | system | high | separate_sensitive_confirm | crm.users.security.update | apps/web/lib/crm-agent-v2/actions/users/user.reset-password.ts | PASS |
| 13.2 Пользователи, роли, пароль | user.change_own_password | implemented | system | critical | separate_sensitive_confirm | self | apps/web/lib/crm-agent-v2/actions/users/user.change-own-password.ts | PASS |
| 13.2 Пользователи, роли, пароль | user.revoke_sessions | implemented | system | high | separate_sensitive_confirm | crm.users.security.update | apps/web/lib/crm-agent-v2/actions/users/user.revoke-sessions.ts | PASS |
| 13.2 Пользователи, роли, пароль | user.link_identity | implemented | system | high | always | crm.users.security.update | apps/web/lib/crm-agent-v2/actions/users/user.link-identity.ts | PASS |
| 13.2 Пользователи, роли, пароль | user.unlink_identity | implemented | system | high | always | crm.users.security.update | apps/web/lib/crm-agent-v2/actions/users/user.unlink-identity.ts | PASS |
| 13.2 Пользователи, роли, пароль | role.search | read_only | read | low | never | crm.roles.read | apps/web/lib/crm-agent-v2/actions/users/role.search.ts | PASS |
| 13.2 Пользователи, роли, пароль | role.create | implemented | write | high | always | crm.roles.manage | apps/web/lib/crm-agent-v2/actions/users/role.create.ts | PASS |
| 13.2 Пользователи, роли, пароль | role.update | implemented | write | high | always | crm.roles.manage | apps/web/lib/crm-agent-v2/actions/users/role.update.ts | PASS |
| 13.2 Пользователи, роли, пароль | role.delete | implemented | system | critical | separate_sensitive_confirm | crm.roles.manage | apps/web/lib/crm-agent-v2/actions/users/role.delete.ts | PASS |
| 13.2 Пользователи, роли, пароль | permission.assign | implemented | system | critical | separate_sensitive_confirm | crm.roles.manage | apps/web/lib/crm-agent-v2/actions/users/permission.assign.ts | PASS |
| 13.2 Пользователи, роли, пароль | permission.revoke | implemented | system | critical | separate_sensitive_confirm | crm.roles.manage | apps/web/lib/crm-agent-v2/actions/users/permission.revoke.ts | PASS |
| 13.2 Пользователи, роли, пароль | permission.view_matrix | read_only | read | medium | never | crm.roles.read | apps/web/lib/crm-agent-v2/actions/users/permission.view-matrix.ts | PASS |
| 13.3 Клиенты | client.search | read_only | read | low | never | crm.clients.read | apps/web/lib/crm-agent-v2/actions/clients/client.search.ts | PASS |
| 13.3 Клиенты | client.view | read_only | read | low | never | crm.clients.read | apps/web/lib/crm-agent-v2/actions/clients/client.view.ts | PASS |
| 13.3 Клиенты | client.resolve | read_only | read | low | never | crm.clients.read | apps/web/lib/crm-agent-v2/actions/clients/client.resolve.ts | PASS |
| 13.3 Клиенты | client.create | implemented | write | medium | medium_plus | crm.clients.create | apps/web/lib/crm-agent-v2/actions/clients/client.create.ts | PASS |
| 13.3 Клиенты | client.update | implemented | write | medium | medium_plus | crm.clients.update | apps/web/lib/crm-agent-v2/actions/clients/client.update.ts | PASS |
| 13.3 Клиенты | client.archive | implemented | write | high | always | crm.clients.delete | apps/web/lib/crm-agent-v2/actions/clients/client.archive.ts | PASS |
| 13.3 Клиенты | client.restore | implemented | write | medium | medium_plus | crm.clients.update | apps/web/lib/crm-agent-v2/actions/clients/client.restore.ts | PASS |
| 13.3 Клиенты | client.add_contact | implemented | write | medium | medium_plus | crm.clients.update | apps/web/lib/crm-agent-v2/actions/clients/client.add-contact.ts | PASS |
| 13.3 Клиенты | client.update_contact | implemented | write | medium | medium_plus | crm.clients.update | apps/web/lib/crm-agent-v2/actions/clients/client.update-contact.ts | PASS |
| 13.3 Клиенты | client.delete_contact | implemented | write | high | always | crm.clients.update | apps/web/lib/crm-agent-v2/actions/clients/client.delete-contact.ts | PASS |
| 13.3 Клиенты | client.add_note | implemented | write | medium | medium_plus | crm.clients.update | apps/web/lib/crm-agent-v2/actions/clients/client.add-note.ts | PASS |
| 13.3 Клиенты | client.update_note | implemented | write | medium | medium_plus | crm.clients.update | apps/web/lib/crm-agent-v2/actions/clients/client.update-note.ts | PASS |
| 13.3 Клиенты | client.delete_note | implemented | write | high | always | crm.clients.update | apps/web/lib/crm-agent-v2/actions/clients/client.delete-note.ts | PASS |
| 13.3 Клиенты | client.add_tag | implemented | write | low | never | crm.clients.update | apps/web/lib/crm-agent-v2/actions/clients/client.add-tag.ts | PASS |
| 13.3 Клиенты | client.remove_tag | implemented | write | low | never | crm.clients.update | apps/web/lib/crm-agent-v2/actions/clients/client.remove-tag.ts | PASS |
| 13.3 Клиенты | client.create_tag | implemented | write | low | never | crm.clients.update | apps/web/lib/crm-agent-v2/actions/clients/client.create-tag.ts | PASS |
| 13.3 Клиенты | client.merge_duplicates | draft_only | system | high | always | crm.clients.merge | apps/web/lib/crm-agent-v2/actions/clients/client.merge-duplicates.ts | PASS |
| 13.3 Клиенты | client.view_history | read_only | read | low | never | crm.clients.read | apps/web/lib/crm-agent-v2/actions/clients/client.view-history.ts | PASS |
| 13.3 Клиенты | client.view_visits | read_only | read | low | never | crm.clients.read | apps/web/lib/crm-agent-v2/actions/clients/client.view-visits.ts | PASS |
| 13.3 Клиенты | client.view_payments | read_only | read | medium | never | crm.finance.read | apps/web/lib/crm-agent-v2/actions/clients/client.view-payments.ts | PASS |
| 13.3 Клиенты | client.view_reviews | read_only | read | low | never | crm.reviews.read | apps/web/lib/crm-agent-v2/actions/clients/client.view-reviews.ts | PASS |
| 13.3 Клиенты | client.view_loyalty | read_only | read | low | never | crm.loyalty.read | apps/web/lib/crm-agent-v2/actions/clients/client.view-loyalty.ts | PASS |
| 13.3 Клиенты | client.update_consent | implemented | write | high | always | crm.clients.update | apps/web/lib/crm-agent-v2/actions/clients/client.update-consent.ts | PASS |
| 13.3 Клиенты | client.notify | draft_only | write | high | always | crm.notifications.send | apps/web/lib/crm-agent-v2/actions/clients/client.notify.ts | PASS |
| 13.3 Клиенты | client.create_segment | draft_only | write | medium | medium_plus | crm.clients.segments.manage | apps/web/lib/crm-agent-v2/actions/clients/client.create-segment.ts | PASS |
| 13.3 Клиенты | client.export_segment | draft_only | export | high | always | crm.clients.export | apps/web/lib/crm-agent-v2/actions/clients/client.export-segment.ts | PASS |
| 13.4 Записи | appointment.search | read_only | read | low | never | crm.calendar.read | apps/web/lib/crm-agent-v2/actions/appointments/appointment.search.ts | PASS |
| 13.4 Записи | appointment.view | read_only | read | low | never | crm.calendar.read | apps/web/lib/crm-agent-v2/actions/appointments/appointment.view.ts | PASS |
| 13.4 Записи | appointment.resolve | read_only | read | low | never | crm.calendar.read | apps/web/lib/crm-agent-v2/actions/appointments/appointment.resolve.ts | PASS |
| 13.4 Записи | appointment.find_slots | read_only | read | low | never | crm.schedule.read | apps/web/lib/crm-agent-v2/actions/appointments/appointment.find-slots.ts | PASS |
| 13.4 Записи | appointment.hold_slot | implemented | write | medium | medium_plus | crm.appointments.create | apps/web/lib/crm-agent-v2/actions/appointments/appointment.hold-slot.ts | PASS |
| 13.4 Записи | appointment.release_hold | implemented | write | low | never | crm.appointments.create | apps/web/lib/crm-agent-v2/actions/appointments/appointment.release-hold.ts | PASS |
| 13.4 Записи | appointment.create | implemented | write | high | always | crm.appointments.create | apps/web/lib/crm-agent-v2/actions/appointments/appointment.create.ts | PASS |
| 13.4 Записи | appointment.reschedule | implemented | write | high | always | crm.appointments.reschedule | apps/web/lib/crm-agent-v2/actions/appointments/appointment.reschedule.ts | PASS |
| 13.4 Записи | appointment.cancel | implemented | write | high | always | crm.appointments.cancel | apps/web/lib/crm-agent-v2/actions/appointments/appointment.cancel.ts | PASS |
| 13.4 Записи | appointment.confirm | implemented | write | medium | medium_plus | crm.appointments.update | apps/web/lib/crm-agent-v2/actions/appointments/appointment.confirm.ts | PASS |
| 13.4 Записи | appointment.mark_done | implemented | write | medium | medium_plus | crm.appointments.update | apps/web/lib/crm-agent-v2/actions/appointments/appointment.mark-done.ts | PASS |
| 13.4 Записи | appointment.mark_no_show | implemented | write | high | always | crm.appointments.update | apps/web/lib/crm-agent-v2/actions/appointments/appointment.mark-no-show.ts | PASS |
| 13.4 Записи | appointment.change_client | implemented | write | high | always | crm.appointments.update | apps/web/lib/crm-agent-v2/actions/appointments/appointment.change-client.ts | PASS |
| 13.4 Записи | appointment.change_service | implemented | write | high | always | crm.appointments.update | apps/web/lib/crm-agent-v2/actions/appointments/appointment.change-service.ts | PASS |
| 13.4 Записи | appointment.change_specialist | implemented | write | high | always | crm.appointments.update | apps/web/lib/crm-agent-v2/actions/appointments/appointment.change-specialist.ts | PASS |
| 13.4 Записи | appointment.change_location | implemented | write | high | always | crm.appointments.update | apps/web/lib/crm-agent-v2/actions/appointments/appointment.change-location.ts | PASS |
| 13.4 Записи | appointment.change_time | implemented | write | high | always | crm.appointments.reschedule | apps/web/lib/crm-agent-v2/actions/appointments/appointment.change-time.ts | PASS |
| 13.4 Записи | appointment.change_price | implemented | write | high | always | crm.appointments.update | apps/web/lib/crm-agent-v2/actions/appointments/appointment.change-price.ts | PASS |
| 13.4 Записи | appointment.change_duration | implemented | write | medium | medium_plus | crm.appointments.update | apps/web/lib/crm-agent-v2/actions/appointments/appointment.change-duration.ts | PASS |
| 13.4 Записи | appointment.add_comment | implemented | write | low | never | crm.appointments.update | apps/web/lib/crm-agent-v2/actions/appointments/appointment.add-comment.ts | PASS |
| 13.4 Записи | appointment.update_comment | implemented | write | low | never | crm.appointments.update | apps/web/lib/crm-agent-v2/actions/appointments/appointment.update-comment.ts | PASS |
| 13.4 Записи | appointment.view_conflicts | read_only | read | low | never | crm.calendar.read | apps/web/lib/crm-agent-v2/actions/appointments/appointment.view-conflicts.ts | PASS |
| 13.4 Записи | appointment.view_history | read_only | read | low | never | crm.calendar.read | apps/web/lib/crm-agent-v2/actions/appointments/appointment.view-history.ts | PASS |
| 13.5 Групповые записи | group_session.search | read_only | read | low | never | crm.group_sessions.read | apps/web/lib/crm-agent-v2/actions/group-sessions/group-session.search.ts | PASS |
| 13.5 Групповые записи | group_session.view | read_only | read | low | never | crm.group_sessions.read | apps/web/lib/crm-agent-v2/actions/group-sessions/group-session.view.ts | PASS |
| 13.5 Групповые записи | group_session.create | implemented | write | high | always | crm.group_sessions.create | apps/web/lib/crm-agent-v2/actions/group-sessions/group-session.create.ts | PASS |
| 13.5 Групповые записи | group_session.update | implemented | write | high | always | crm.group_sessions.update | apps/web/lib/crm-agent-v2/actions/group-sessions/group-session.update.ts | PASS |
| 13.5 Групповые записи | group_session.cancel | implemented | write | high | always | crm.group_sessions.cancel | apps/web/lib/crm-agent-v2/actions/group-sessions/group-session.cancel.ts | PASS |
| 13.5 Групповые записи | group_session.change_capacity | implemented | write | medium | medium_plus | crm.group_sessions.update | apps/web/lib/crm-agent-v2/actions/group-sessions/group-session.change-capacity.ts | PASS |
| 13.5 Групповые записи | group_session.change_price | implemented | write | high | always | crm.group_sessions.update | apps/web/lib/crm-agent-v2/actions/group-sessions/group-session.change-price.ts | PASS |
| 13.5 Групповые записи | group_session.add_participant | implemented | write | medium | medium_plus | crm.group_sessions.update | apps/web/lib/crm-agent-v2/actions/group-sessions/group-session.add-participant.ts | PASS |
| 13.5 Групповые записи | group_session.remove_participant | implemented | write | high | always | crm.group_sessions.update | apps/web/lib/crm-agent-v2/actions/group-sessions/group-session.remove-participant.ts | PASS |
| 13.5 Групповые записи | group_session.update_participant_status | implemented | write | medium | medium_plus | crm.group_sessions.update | apps/web/lib/crm-agent-v2/actions/group-sessions/group-session.update-participant-status.ts | PASS |
| 13.5 Групповые записи | group_session.mark_participant_done | implemented | write | medium | medium_plus | crm.group_sessions.update | apps/web/lib/crm-agent-v2/actions/group-sessions/group-session.mark-participant-done.ts | PASS |
| 13.5 Групповые записи | group_session.mark_participant_no_show | implemented | write | high | always | crm.group_sessions.update | apps/web/lib/crm-agent-v2/actions/group-sessions/group-session.mark-participant-no-show.ts | PASS |
| 13.6 График | schedule.search | read_only | read | low | never | crm.schedule.read | apps/web/lib/crm-agent-v2/actions/schedule/schedule.search.ts | PASS |
| 13.6 График | schedule.view_day | read_only | read | low | never | crm.schedule.read | apps/web/lib/crm-agent-v2/actions/schedule/schedule.view-day.ts | PASS |
| 13.6 График | schedule.view_week | read_only | read | low | never | crm.schedule.read | apps/web/lib/crm-agent-v2/actions/schedule/schedule.view-week.ts | PASS |
| 13.6 График | schedule.view_month | read_only | read | low | never | crm.schedule.read | apps/web/lib/crm-agent-v2/actions/schedule/schedule.view-month.ts | PASS |
| 13.6 График | schedule.set_workday | implemented | write | high | always | crm.schedule.update | apps/web/lib/crm-agent-v2/actions/schedule/schedule.set-workday.ts | PASS |
| 13.6 График | schedule.set_day_off | implemented | write | high | always | crm.schedule.update | apps/web/lib/crm-agent-v2/actions/schedule/schedule.set-day-off.ts | PASS |
| 13.6 График | schedule.set_vacation | implemented | write | high | always | crm.schedule.update | apps/web/lib/crm-agent-v2/actions/schedule/schedule.set-vacation.ts | PASS |
| 13.6 График | schedule.add_break | implemented | write | medium | medium_plus | crm.schedule.update | apps/web/lib/crm-agent-v2/actions/schedule/schedule.add-break.ts | PASS |
| 13.6 График | schedule.update_break | implemented | write | medium | medium_plus | crm.schedule.update | apps/web/lib/crm-agent-v2/actions/schedule/schedule.update-break.ts | PASS |
| 13.6 График | schedule.remove_break | implemented | write | medium | medium_plus | crm.schedule.update | apps/web/lib/crm-agent-v2/actions/schedule/schedule.remove-break.ts | PASS |
| 13.6 График | schedule.block_slot | implemented | write | high | always | crm.schedule.update | apps/web/lib/crm-agent-v2/actions/schedule/schedule.block-slot.ts | PASS |
| 13.6 График | schedule.unblock_slot | implemented | write | high | always | crm.schedule.update | apps/web/lib/crm-agent-v2/actions/schedule/schedule.unblock-slot.ts | PASS |
| 13.6 График | schedule.copy_day | implemented | write | high | always | crm.schedule.update | apps/web/lib/crm-agent-v2/actions/schedule/schedule.copy-day.ts | PASS |
| 13.6 График | schedule.copy_week | implemented | write | high | always | crm.schedule.update | apps/web/lib/crm-agent-v2/actions/schedule/schedule.copy-week.ts | PASS |
| 13.6 График | schedule.create_template | implemented | write | medium | medium_plus | crm.schedule.update | apps/web/lib/crm-agent-v2/actions/schedule/schedule.create-template.ts | PASS |
| 13.6 График | schedule.update_template | implemented | write | medium | medium_plus | crm.schedule.update | apps/web/lib/crm-agent-v2/actions/schedule/schedule.update-template.ts | PASS |
| 13.6 График | schedule.delete_template | implemented | write | high | always | crm.schedule.update | apps/web/lib/crm-agent-v2/actions/schedule/schedule.delete-template.ts | PASS |
| 13.6 График | schedule.apply_template | implemented | write | high | always | crm.schedule.update | apps/web/lib/crm-agent-v2/actions/schedule/schedule.apply-template.ts | PASS |
| 13.6 График | schedule.create_non_working_type | implemented | write | medium | medium_plus | crm.schedule.update | apps/web/lib/crm-agent-v2/actions/schedule/schedule.create-non-working-type.ts | PASS |
| 13.6 График | schedule.update_non_working_type | implemented | write | medium | medium_plus | crm.schedule.update | apps/web/lib/crm-agent-v2/actions/schedule/schedule.update-non-working-type.ts | PASS |
| 13.6 График | schedule.delete_non_working_type | implemented | write | high | always | crm.schedule.update | apps/web/lib/crm-agent-v2/actions/schedule/schedule.delete-non-working-type.ts | PASS |
| 13.6 График | schedule.find_empty_windows | read_only | read | low | never | crm.schedule.read | apps/web/lib/crm-agent-v2/actions/schedule/schedule.find-empty-windows.ts | PASS |
| 13.6 График | schedule.find_overlaps | read_only | read | low | never | crm.schedule.read | apps/web/lib/crm-agent-v2/actions/schedule/schedule.find-overlaps.ts | PASS |
| 13.7 Услуги | service.search | read_only | read | low | never | crm.services.read | apps/web/lib/crm-agent-v2/actions/services/service.search.ts | PASS |
| 13.7 Услуги | service.view | read_only | read | low | never | crm.services.read | apps/web/lib/crm-agent-v2/actions/services/service.view.ts | PASS |
| 13.7 Услуги | service.resolve | read_only | read | low | never | crm.services.read | apps/web/lib/crm-agent-v2/actions/services/service.resolve.ts | PASS |
| 13.7 Услуги | service.create | implemented | write | medium | medium_plus | crm.services.create | apps/web/lib/crm-agent-v2/actions/services/service.create.ts | PASS |
| 13.7 Услуги | service.update | implemented | write | medium | medium_plus | crm.services.update | apps/web/lib/crm-agent-v2/actions/services/service.update.ts | PASS |
| 13.7 Услуги | service.update_name | implemented | write | medium | medium_plus | crm.services.update | apps/web/lib/crm-agent-v2/actions/services/service.update-name.ts | PASS |
| 13.7 Услуги | service.update_description | implemented | write | medium | medium_plus | crm.services.update | apps/web/lib/crm-agent-v2/actions/services/service.update-description.ts | PASS |
| 13.7 Услуги | service.generate_description | draft_only | generate | medium | medium_plus | crm.services.update | apps/web/lib/crm-agent-v2/actions/services/service.generate-description.ts | PASS |
| 13.7 Услуги | service.update_price | implemented | write | high | always | crm.services.update | apps/web/lib/crm-agent-v2/actions/services/service.update-price.ts | PASS |
| 13.7 Услуги | service.update_duration | implemented | write | medium | medium_plus | crm.services.update | apps/web/lib/crm-agent-v2/actions/services/service.update-duration.ts | PASS |
| 13.7 Услуги | service.update_booking_type | implemented | write | high | always | crm.services.update | apps/web/lib/crm-agent-v2/actions/services/service.update-booking-type.ts | PASS |
| 13.7 Услуги | service.activate | implemented | write | medium | medium_plus | crm.services.update | apps/web/lib/crm-agent-v2/actions/services/service.activate.ts | PASS |
| 13.7 Услуги | service.archive | implemented | write | high | always | crm.services.delete | apps/web/lib/crm-agent-v2/actions/services/service.archive.ts | PASS |
| 13.7 Услуги | service.restore | implemented | write | medium | medium_plus | crm.services.update | apps/web/lib/crm-agent-v2/actions/services/service.restore.ts | PASS |
| 13.7 Услуги | service.delete_if_empty | implemented | system | critical | separate_sensitive_confirm | crm.services.delete | apps/web/lib/crm-agent-v2/actions/services/service.delete-if-empty.ts | PASS |
| 13.7 Услуги | service.assign_specialist | implemented | write | medium | medium_plus | crm.services.update | apps/web/lib/crm-agent-v2/actions/services/service.assign-specialist.ts | PASS |
| 13.7 Услуги | service.unassign_specialist | implemented | write | high | always | crm.services.update | apps/web/lib/crm-agent-v2/actions/services/service.unassign-specialist.ts | PASS |
| 13.7 Услуги | service.assign_location | implemented | write | medium | medium_plus | crm.services.update | apps/web/lib/crm-agent-v2/actions/services/service.assign-location.ts | PASS |
| 13.7 Услуги | service.unassign_location | implemented | write | high | always | crm.services.update | apps/web/lib/crm-agent-v2/actions/services/service.unassign-location.ts | PASS |
| 13.7 Услуги | service.add_variant | implemented | write | medium | medium_plus | crm.services.update | apps/web/lib/crm-agent-v2/actions/services/service.add-variant.ts | PASS |
| 13.7 Услуги | service.update_variant | implemented | write | medium | medium_plus | crm.services.update | apps/web/lib/crm-agent-v2/actions/services/service.update-variant.ts | PASS |
| 13.7 Услуги | service.delete_variant | implemented | write | high | always | crm.services.update | apps/web/lib/crm-agent-v2/actions/services/service.delete-variant.ts | PASS |
| 13.7 Услуги | service.create_category | implemented | write | medium | medium_plus | crm.services.create | apps/web/lib/crm-agent-v2/actions/services/service.create-category.ts | PASS |
| 13.7 Услуги | service.update_category | implemented | write | medium | medium_plus | crm.services.update | apps/web/lib/crm-agent-v2/actions/services/service.update-category.ts | PASS |
| 13.7 Услуги | service.delete_category | implemented | write | high | always | crm.services.delete | apps/web/lib/crm-agent-v2/actions/services/service.delete-category.ts | PASS |
| 13.7 Услуги | service.move_to_category | implemented | write | medium | medium_plus | crm.services.update | apps/web/lib/crm-agent-v2/actions/services/service.move-to-category.ts | PASS |
| 13.7 Услуги | service.update_level_config | implemented | write | high | always | crm.services.update | apps/web/lib/crm-agent-v2/actions/services/service.update-level-config.ts | PASS |
| 13.7 Услуги | service.attach_media | implemented | write | medium | medium_plus | crm.services.update | apps/web/lib/crm-agent-v2/actions/services/service.attach-media.ts | PASS |
| 13.7 Услуги | service.detach_media | implemented | write | medium | medium_plus | crm.services.update | apps/web/lib/crm-agent-v2/actions/services/service.detach-media.ts | PASS |
| 13.8 Сотрудники | specialist.search | read_only | read | low | never | crm.specialists.read | apps/web/lib/crm-agent-v2/actions/specialists/specialist.search.ts | PASS |
| 13.8 Сотрудники | specialist.view | read_only | read | low | never | crm.specialists.read | apps/web/lib/crm-agent-v2/actions/specialists/specialist.view.ts | PASS |
| 13.8 Сотрудники | specialist.resolve | read_only | read | low | never | crm.specialists.read | apps/web/lib/crm-agent-v2/actions/specialists/specialist.resolve.ts | PASS |
| 13.8 Сотрудники | specialist.create | implemented | write | medium | medium_plus | crm.specialists.create | apps/web/lib/crm-agent-v2/actions/specialists/specialist.create.ts | PASS |
| 13.8 Сотрудники | specialist.update | implemented | write | medium | medium_plus | crm.specialists.update | apps/web/lib/crm-agent-v2/actions/specialists/specialist.update.ts | PASS |
| 13.8 Сотрудники | specialist.update_bio | implemented | write | medium | medium_plus | crm.specialists.update | apps/web/lib/crm-agent-v2/actions/specialists/specialist.update-bio.ts | PASS |
| 13.8 Сотрудники | specialist.generate_bio | draft_only | generate | medium | medium_plus | crm.specialists.update | apps/web/lib/crm-agent-v2/actions/specialists/specialist.generate-bio.ts | PASS |
| 13.8 Сотрудники | specialist.update_avatar | implemented | write | medium | medium_plus | crm.specialists.update | apps/web/lib/crm-agent-v2/actions/specialists/specialist.update-avatar.ts | PASS |
| 13.8 Сотрудники | specialist.set_public | implemented | write | medium | medium_plus | crm.specialists.update | apps/web/lib/crm-agent-v2/actions/specialists/specialist.set-public.ts | PASS |
| 13.8 Сотрудники | specialist.hide | implemented | write | high | always | crm.specialists.update | apps/web/lib/crm-agent-v2/actions/specialists/specialist.hide.ts | PASS |
| 13.8 Сотрудники | specialist.assign_service | implemented | write | medium | medium_plus | crm.specialists.update | apps/web/lib/crm-agent-v2/actions/specialists/specialist.assign-service.ts | PASS |
| 13.8 Сотрудники | specialist.unassign_service | implemented | write | high | always | crm.specialists.update | apps/web/lib/crm-agent-v2/actions/specialists/specialist.unassign-service.ts | PASS |
| 13.8 Сотрудники | specialist.assign_location | implemented | write | medium | medium_plus | crm.specialists.update | apps/web/lib/crm-agent-v2/actions/specialists/specialist.assign-location.ts | PASS |
| 13.8 Сотрудники | specialist.unassign_location | implemented | write | high | always | crm.specialists.update | apps/web/lib/crm-agent-v2/actions/specialists/specialist.unassign-location.ts | PASS |
| 13.8 Сотрудники | specialist.assign_category | implemented | write | low | never | crm.specialists.update | apps/web/lib/crm-agent-v2/actions/specialists/specialist.assign-category.ts | PASS |
| 13.8 Сотрудники | specialist.remove_category | implemented | write | low | never | crm.specialists.update | apps/web/lib/crm-agent-v2/actions/specialists/specialist.remove-category.ts | PASS |
| 13.8 Сотрудники | specialist.set_level | implemented | write | medium | medium_plus | crm.specialists.update | apps/web/lib/crm-agent-v2/actions/specialists/specialist.set-level.ts | PASS |
| 13.8 Сотрудники | specialist.view_workload | read_only | read | low | never | crm.assistant.analytics.read | apps/web/lib/crm-agent-v2/actions/specialists/specialist.view-workload.ts | PASS |
| 13.8 Сотрудники | specialist.view_revenue | read_only | read | medium | never | crm.finance.read | apps/web/lib/crm-agent-v2/actions/specialists/specialist.view-revenue.ts | PASS |
| 13.8 Сотрудники | specialist.view_reviews | read_only | read | low | never | crm.reviews.read | apps/web/lib/crm-agent-v2/actions/specialists/specialist.view-reviews.ts | PASS |
| 13.8 Сотрудники | specialist.view_empty_slots | read_only | read | low | never | crm.schedule.read | apps/web/lib/crm-agent-v2/actions/specialists/specialist.view-empty-slots.ts | PASS |
| 13.9 Локации | location.search | read_only | read | low | never | crm.locations.read | apps/web/lib/crm-agent-v2/actions/locations/location.search.ts | PASS |
| 13.9 Локации | location.view | read_only | read | low | never | crm.locations.read | apps/web/lib/crm-agent-v2/actions/locations/location.view.ts | PASS |
| 13.9 Локации | location.resolve | read_only | read | low | never | crm.locations.read | apps/web/lib/crm-agent-v2/actions/locations/location.resolve.ts | PASS |
| 13.9 Локации | location.create | implemented | write | medium | medium_plus | crm.locations.create | apps/web/lib/crm-agent-v2/actions/locations/location.create.ts | PASS |
| 13.9 Локации | location.update | implemented | write | medium | medium_plus | crm.locations.update | apps/web/lib/crm-agent-v2/actions/locations/location.update.ts | PASS |
| 13.9 Локации | location.update_name | implemented | write | medium | medium_plus | crm.locations.update | apps/web/lib/crm-agent-v2/actions/locations/location.update-name.ts | PASS |
| 13.9 Локации | location.update_address | implemented | write | high | always | crm.locations.update | apps/web/lib/crm-agent-v2/actions/locations/location.update-address.ts | PASS |
| 13.9 Локации | location.update_phone | implemented | write | medium | medium_plus | crm.locations.update | apps/web/lib/crm-agent-v2/actions/locations/location.update-phone.ts | PASS |
| 13.9 Локации | location.update_description | implemented | write | medium | medium_plus | crm.locations.update | apps/web/lib/crm-agent-v2/actions/locations/location.update-description.ts | PASS |
| 13.9 Локации | location.generate_description | draft_only | generate | medium | medium_plus | crm.locations.update | apps/web/lib/crm-agent-v2/actions/locations/location.generate-description.ts | PASS |
| 13.9 Локации | location.activate | implemented | write | medium | medium_plus | crm.locations.update | apps/web/lib/crm-agent-v2/actions/locations/location.activate.ts | PASS |
| 13.9 Локации | location.deactivate | implemented | write | high | always | crm.locations.update | apps/web/lib/crm-agent-v2/actions/locations/location.deactivate.ts | PASS |
| 13.9 Локации | location.update_hours | implemented | write | high | always | crm.locations.update | apps/web/lib/crm-agent-v2/actions/locations/location.update-hours.ts | PASS |
| 13.9 Локации | location.add_exception | implemented | write | high | always | crm.locations.update | apps/web/lib/crm-agent-v2/actions/locations/location.add-exception.ts | PASS |
| 13.9 Локации | location.remove_exception | implemented | write | high | always | crm.locations.update | apps/web/lib/crm-agent-v2/actions/locations/location.remove-exception.ts | PASS |
| 13.9 Локации | location.assign_manager | implemented | system | high | always | crm.locations.update | apps/web/lib/crm-agent-v2/actions/locations/location.assign-manager.ts | PASS |
| 13.9 Локации | location.remove_manager | implemented | system | high | always | crm.locations.update | apps/web/lib/crm-agent-v2/actions/locations/location.remove-manager.ts | PASS |
| 13.9 Локации | location.attach_media | implemented | write | medium | medium_plus | crm.locations.update | apps/web/lib/crm-agent-v2/actions/locations/location.attach-media.ts | PASS |
| 13.9 Локации | location.detach_media | implemented | write | medium | medium_plus | crm.locations.update | apps/web/lib/crm-agent-v2/actions/locations/location.detach-media.ts | PASS |
| 13.9 Локации | location.view_schedule | read_only | read | low | never | crm.schedule.read | apps/web/lib/crm-agent-v2/actions/locations/location.view-schedule.ts | PASS |
| 13.9 Локации | location.view_workload | read_only | read | low | never | crm.assistant.analytics.read | apps/web/lib/crm-agent-v2/actions/locations/location.view-workload.ts | PASS |
| 13.10 Отзывы | review.search | read_only | read | low | never | crm.reviews.read | apps/web/lib/crm-agent-v2/actions/reviews/review.search.ts | PASS |
| 13.10 Отзывы | review.view | read_only | read | low | never | crm.reviews.read | apps/web/lib/crm-agent-v2/actions/reviews/review.view.ts | PASS |
| 13.10 Отзывы | review.resolve | read_only | read | low | never | crm.reviews.read | apps/web/lib/crm-agent-v2/actions/reviews/review.resolve.ts | PASS |
| 13.10 Отзывы | review.find_negative | read_only | read | low | never | crm.reviews.read | apps/web/lib/crm-agent-v2/actions/reviews/review.find-negative.ts | PASS |
| 13.10 Отзывы | review.find_unanswered | read_only | read | low | never | crm.reviews.read | apps/web/lib/crm-agent-v2/actions/reviews/review.find-unanswered.ts | PASS |
| 13.10 Отзывы | review.reply | implemented | write | medium | medium_plus | crm.reviews.manage | apps/web/lib/crm-agent-v2/actions/reviews/review.reply.ts | PASS |
| 13.10 Отзывы | review.generate_reply | draft_only | generate | medium | medium_plus | crm.reviews.manage | apps/web/lib/crm-agent-v2/actions/reviews/review.generate-reply.ts | PASS |
| 13.10 Отзывы | review.update_reply | implemented | write | medium | medium_plus | crm.reviews.manage | apps/web/lib/crm-agent-v2/actions/reviews/review.update-reply.ts | PASS |
| 13.10 Отзывы | review.delete_reply | implemented | write | high | always | crm.reviews.manage | apps/web/lib/crm-agent-v2/actions/reviews/review.delete-reply.ts | PASS |
| 13.10 Отзывы | review.change_status | implemented | write | medium | medium_plus | crm.reviews.manage | apps/web/lib/crm-agent-v2/actions/reviews/review.change-status.ts | PASS |
| 13.10 Отзывы | review.bulk_update_status | implemented | write | high | always | crm.reviews.manage | apps/web/lib/crm-agent-v2/actions/reviews/review.bulk-update-status.ts | PASS |
| 13.10 Отзывы | review.attach_reply_media | implemented | write | medium | medium_plus | crm.reviews.manage | apps/web/lib/crm-agent-v2/actions/reviews/review.attach-reply-media.ts | PASS |
| 13.10 Отзывы | review.remove_reply_media | implemented | write | medium | medium_plus | crm.reviews.manage | apps/web/lib/crm-agent-v2/actions/reviews/review.remove-reply-media.ts | PASS |
| 13.10 Отзывы | review.analyze_complaints | read_only | read | low | never | crm.assistant.analytics.read | apps/web/lib/crm-agent-v2/actions/reviews/review.analyze-complaints.ts | PASS |
| 13.10 Отзывы | review.suggest_process_fix | draft_only | generate | low | never | crm.assistant.analytics.read | apps/web/lib/crm-agent-v2/actions/reviews/review.suggest-process-fix.ts | PASS |
| 13.11 Сайт и SEO | site.health | read_only | read | low | never | crm.settings.read | apps/web/lib/crm-agent-v2/actions/site/site.health.ts | PASS |
| 13.11 Сайт и SEO | site.view_public_page | read_only | read | low | never | crm.settings.read | apps/web/lib/crm-agent-v2/actions/site/site.view-public-page.ts | PASS |
| 13.11 Сайт и SEO | site.create_public_page | implemented | write | high | always | crm.settings.update | apps/web/lib/crm-agent-v2/actions/site/site.create-public-page.ts | PASS |
| 13.11 Сайт и SEO | site.update_public_page | implemented | write | high | always | crm.settings.update | apps/web/lib/crm-agent-v2/actions/site/site.update-public-page.ts | PASS |
| 13.11 Сайт и SEO | site.archive_public_page | implemented | write | high | always | crm.settings.update | apps/web/lib/crm-agent-v2/actions/site/site.archive-public-page.ts | PASS |
| 13.11 Сайт и SEO | site.create_section | implemented | write | medium | medium_plus | crm.settings.update | apps/web/lib/crm-agent-v2/actions/site/site.create-section.ts | PASS |
| 13.11 Сайт и SEO | site.update_section | implemented | write | medium | medium_plus | crm.settings.update | apps/web/lib/crm-agent-v2/actions/site/site.update-section.ts | PASS |
| 13.11 Сайт и SEO | site.delete_section | implemented | write | high | always | crm.settings.update | apps/web/lib/crm-agent-v2/actions/site/site.delete-section.ts | PASS |
| 13.11 Сайт и SEO | site.create_block | implemented | write | medium | medium_plus | crm.settings.update | apps/web/lib/crm-agent-v2/actions/site/site.create-block.ts | PASS |
| 13.11 Сайт и SEO | site.update_block | implemented | write | medium | medium_plus | crm.settings.update | apps/web/lib/crm-agent-v2/actions/site/site.update-block.ts | PASS |
| 13.11 Сайт и SEO | site.delete_block | implemented | write | high | always | crm.settings.update | apps/web/lib/crm-agent-v2/actions/site/site.delete-block.ts | PASS |
| 13.11 Сайт и SEO | site.update_home_copy | implemented | write | medium | medium_plus | crm.settings.update | apps/web/lib/crm-agent-v2/actions/site/site.update-home-copy.ts | PASS |
| 13.11 Сайт и SEO | site.update_service_copy | implemented | write | medium | medium_plus | crm.settings.update | apps/web/lib/crm-agent-v2/actions/site/site.update-service-copy.ts | PASS |
| 13.11 Сайт и SEO | site.update_specialist_copy | implemented | write | medium | medium_plus | crm.settings.update | apps/web/lib/crm-agent-v2/actions/site/site.update-specialist-copy.ts | PASS |
| 13.11 Сайт и SEO | site.update_location_copy | implemented | write | medium | medium_plus | crm.settings.update | apps/web/lib/crm-agent-v2/actions/site/site.update-location-copy.ts | PASS |
| 13.11 Сайт и SEO | site.update_contacts | implemented | write | medium | medium_plus | crm.settings.update | apps/web/lib/crm-agent-v2/actions/site/site.update-contacts.ts | PASS |
| 13.11 Сайт и SEO | site.update_booking_settings | implemented | write | high | always | crm.settings.update | apps/web/lib/crm-agent-v2/actions/site/site.update-booking-settings.ts | PASS |
| 13.11 Сайт и SEO | site.update_seo_global | implemented | write | high | always | crm.settings.update | apps/web/lib/crm-agent-v2/actions/site/site.update-seo-global.ts | PASS |
| 13.11 Сайт и SEO | site.update_seo_page | implemented | write | medium | medium_plus | crm.settings.update | apps/web/lib/crm-agent-v2/actions/site/site.update-seo-page.ts | PASS |
| 13.11 Сайт и SEO | site.generate_missing_descriptions | draft_only | generate | medium | medium_plus | crm.settings.update | apps/web/lib/crm-agent-v2/actions/site/site.generate-missing-descriptions.ts | PASS |
| 13.11 Сайт и SEO | site.preview_changes | read_only | read | low | never | crm.settings.read | apps/web/lib/crm-agent-v2/actions/site/site.preview-changes.ts | PASS |
| 13.11 Сайт и SEO | site.apply_changes | implemented | write | high | always | crm.settings.update | apps/web/lib/crm-agent-v2/actions/site/site.apply-changes.ts | PASS |
| 13.12 Домены | domain.search | read_only | read | low | never | crm.settings.read | apps/web/lib/crm-agent-v2/actions/domains/domain.search.ts | PASS |
| 13.12 Домены | domain.add | implemented | write | high | always | crm.settings.update | apps/web/lib/crm-agent-v2/actions/domains/domain.add.ts | PASS |
| 13.12 Домены | domain.check | read_only | read | low | never | crm.settings.read | apps/web/lib/crm-agent-v2/actions/domains/domain.check.ts | PASS |
| 13.12 Домены | domain.set_primary | implemented | write | high | always | crm.settings.update | apps/web/lib/crm-agent-v2/actions/domains/domain.set-primary.ts | PASS |
| 13.12 Домены | domain.remove | implemented | write | high | always | crm.settings.update | apps/web/lib/crm-agent-v2/actions/domains/domain.remove.ts | PASS |
| 13.12 Домены | domain.view_dns_status | read_only | read | low | never | crm.settings.read | apps/web/lib/crm-agent-v2/actions/domains/domain.view-dns-status.ts | PASS |
| 13.13 Медиа | media.search | read_only | read | low | never | crm.media.read | apps/web/lib/crm-agent-v2/actions/media/media.search.ts | PASS |
| 13.13 Медиа | media.upload | implemented | write | medium | medium_plus | crm.media.upload | apps/web/lib/crm-agent-v2/actions/media/media.upload.ts | PASS |
| 13.13 Медиа | media.update_alt | implemented | write | low | never | crm.media.update | apps/web/lib/crm-agent-v2/actions/media/media.update-alt.ts | PASS |
| 13.13 Медиа | media.update_metadata | implemented | write | medium | medium_plus | crm.media.update | apps/web/lib/crm-agent-v2/actions/media/media.update-metadata.ts | PASS |
| 13.13 Медиа | media.create_collection | implemented | write | medium | medium_plus | crm.media.update | apps/web/lib/crm-agent-v2/actions/media/media.create-collection.ts | PASS |
| 13.13 Медиа | media.update_collection | implemented | write | medium | medium_plus | crm.media.update | apps/web/lib/crm-agent-v2/actions/media/media.update-collection.ts | PASS |
| 13.13 Медиа | media.delete_collection | implemented | write | high | always | crm.media.update | apps/web/lib/crm-agent-v2/actions/media/media.delete-collection.ts | PASS |
| 13.13 Медиа | media.link_to_account | implemented | write | medium | medium_plus | crm.media.update | apps/web/lib/crm-agent-v2/actions/media/media.link-to-account.ts | PASS |
| 13.13 Медиа | media.link_to_service | implemented | write | medium | medium_plus | crm.media.update | apps/web/lib/crm-agent-v2/actions/media/media.link-to-service.ts | PASS |
| 13.13 Медиа | media.link_to_specialist | implemented | write | medium | medium_plus | crm.media.update | apps/web/lib/crm-agent-v2/actions/media/media.link-to-specialist.ts | PASS |
| 13.13 Медиа | media.link_to_location | implemented | write | medium | medium_plus | crm.media.update | apps/web/lib/crm-agent-v2/actions/media/media.link-to-location.ts | PASS |
| 13.13 Медиа | media.unlink | implemented | write | medium | medium_plus | crm.media.update | apps/web/lib/crm-agent-v2/actions/media/media.unlink.ts | PASS |
| 13.13 Медиа | media.archive | implemented | write | high | always | crm.media.update | apps/web/lib/crm-agent-v2/actions/media/media.archive.ts | PASS |
| 13.14 Акции и промокоды | promo.search | read_only | read | low | never | crm.promos.read | apps/web/lib/crm-agent-v2/actions/promos/promo.search.ts | PASS |
| 13.14 Акции и промокоды | promo.view | read_only | read | low | never | crm.promos.read | apps/web/lib/crm-agent-v2/actions/promos/promo.view.ts | PASS |
| 13.14 Акции и промокоды | promo.resolve | read_only | read | low | never | crm.promos.read | apps/web/lib/crm-agent-v2/actions/promos/promo.resolve.ts | PASS |
| 13.14 Акции и промокоды | promo.create | implemented | write | medium | medium_plus | crm.promos.create | apps/web/lib/crm-agent-v2/actions/promos/promo.create.ts | PASS |
| 13.14 Акции и промокоды | promo.update | implemented | write | medium | medium_plus | crm.promos.update | apps/web/lib/crm-agent-v2/actions/promos/promo.update.ts | PASS |
| 13.14 Акции и промокоды | promo.activate | implemented | write | medium | medium_plus | crm.promos.update | apps/web/lib/crm-agent-v2/actions/promos/promo.activate.ts | PASS |
| 13.14 Акции и промокоды | promo.deactivate | implemented | write | medium | medium_plus | crm.promos.update | apps/web/lib/crm-agent-v2/actions/promos/promo.deactivate.ts | PASS |
| 13.14 Акции и промокоды | promo.archive | implemented | write | high | always | crm.promos.update | apps/web/lib/crm-agent-v2/actions/promos/promo.archive.ts | PASS |
| 13.14 Акции и промокоды | promo.restore | implemented | write | medium | medium_plus | crm.promos.update | apps/web/lib/crm-agent-v2/actions/promos/promo.restore.ts | PASS |
| 13.14 Акции и промокоды | promo.create_code | implemented | write | medium | medium_plus | crm.promos.update | apps/web/lib/crm-agent-v2/actions/promos/promo.create-code.ts | PASS |
| 13.14 Акции и промокоды | promo.update_code | implemented | write | medium | medium_plus | crm.promos.update | apps/web/lib/crm-agent-v2/actions/promos/promo.update-code.ts | PASS |
| 13.14 Акции и промокоды | promo.disable_code | implemented | write | medium | medium_plus | crm.promos.update | apps/web/lib/crm-agent-v2/actions/promos/promo.disable-code.ts | PASS |
| 13.14 Акции и промокоды | promo.view_redemptions | read_only | read | low | never | crm.promos.read | apps/web/lib/crm-agent-v2/actions/promos/promo.view-redemptions.ts | PASS |
| 13.14 Акции и промокоды | promo.suggest_for_retention | draft_only | generate | low | never | crm.assistant.analytics.read | apps/web/lib/crm-agent-v2/actions/promos/promo.suggest-for-retention.ts | PASS |
| 13.14 Акции и промокоды | promo.suggest_for_empty_slots | draft_only | generate | low | never | crm.assistant.analytics.read | apps/web/lib/crm-agent-v2/actions/promos/promo.suggest-for-empty-slots.ts | PASS |
| 13.14 Акции и промокоды | promo.suggest_for_birthday | draft_only | generate | low | never | crm.assistant.analytics.read | apps/web/lib/crm-agent-v2/actions/promos/promo.suggest-for-birthday.ts | PASS |
| 13.15 Лояльность, подарочные карты, абонементы | loyalty.view_wallet | read_only | read | low | never | crm.loyalty.read | apps/web/lib/crm-agent-v2/actions/loyalty/loyalty.view-wallet.ts | PASS |
| 13.15 Лояльность, подарочные карты, абонементы | loyalty.adjust_balance | implemented | write | high | always | crm.loyalty.manage | apps/web/lib/crm-agent-v2/actions/loyalty/loyalty.adjust-balance.ts | PASS |
| 13.15 Лояльность, подарочные карты, абонементы | loyalty.create_rule | implemented | write | medium | medium_plus | crm.loyalty.manage | apps/web/lib/crm-agent-v2/actions/loyalty/loyalty.create-rule.ts | PASS |
| 13.15 Лояльность, подарочные карты, абонементы | loyalty.update_rule | implemented | write | medium | medium_plus | crm.loyalty.manage | apps/web/lib/crm-agent-v2/actions/loyalty/loyalty.update-rule.ts | PASS |
| 13.15 Лояльность, подарочные карты, абонементы | loyalty.disable_rule | implemented | write | medium | medium_plus | crm.loyalty.manage | apps/web/lib/crm-agent-v2/actions/loyalty/loyalty.disable-rule.ts | PASS |
| 13.15 Лояльность, подарочные карты, абонементы | loyalty.view_transactions | read_only | read | low | never | crm.loyalty.read | apps/web/lib/crm-agent-v2/actions/loyalty/loyalty.view-transactions.ts | PASS |
| 13.15 Лояльность, подарочные карты, абонементы | gift_card.search | read_only | read | low | never | crm.gift_cards.read | apps/web/lib/crm-agent-v2/actions/loyalty/gift-card.search.ts | PASS |
| 13.15 Лояльность, подарочные карты, абонементы | gift_card.create | implemented | write | high | always | crm.gift_cards.manage | apps/web/lib/crm-agent-v2/actions/loyalty/gift-card.create.ts | PASS |
| 13.15 Лояльность, подарочные карты, абонементы | gift_card.update | implemented | write | high | always | crm.gift_cards.manage | apps/web/lib/crm-agent-v2/actions/loyalty/gift-card.update.ts | PASS |
| 13.15 Лояльность, подарочные карты, абонементы | gift_card.activate | implemented | write | high | always | crm.gift_cards.manage | apps/web/lib/crm-agent-v2/actions/loyalty/gift-card.activate.ts | PASS |
| 13.15 Лояльность, подарочные карты, абонементы | gift_card.cancel | implemented | write | high | always | crm.gift_cards.manage | apps/web/lib/crm-agent-v2/actions/loyalty/gift-card.cancel.ts | PASS |
| 13.15 Лояльность, подарочные карты, абонементы | membership.search | read_only | read | low | never | crm.memberships.read | apps/web/lib/crm-agent-v2/actions/loyalty/membership.search.ts | PASS |
| 13.15 Лояльность, подарочные карты, абонементы | membership.create | implemented | write | high | always | crm.memberships.manage | apps/web/lib/crm-agent-v2/actions/loyalty/membership.create.ts | PASS |
| 13.15 Лояльность, подарочные карты, абонементы | membership.update | implemented | write | high | always | crm.memberships.manage | apps/web/lib/crm-agent-v2/actions/loyalty/membership.update.ts | PASS |
| 13.15 Лояльность, подарочные карты, абонементы | membership.activate | implemented | write | high | always | crm.memberships.manage | apps/web/lib/crm-agent-v2/actions/loyalty/membership.activate.ts | PASS |
| 13.15 Лояльность, подарочные карты, абонементы | membership.cancel | implemented | write | high | always | crm.memberships.manage | apps/web/lib/crm-agent-v2/actions/loyalty/membership.cancel.ts | PASS |
| 13.15 Лояльность, подарочные карты, абонементы | membership.redeem | implemented | write | high | always | crm.memberships.manage | apps/web/lib/crm-agent-v2/actions/loyalty/membership.redeem.ts | PASS |
| 13.16 Финансы | finance.view_revenue | read_only | read | medium | never | crm.finance.read | apps/web/lib/crm-agent-v2/actions/finance/finance.view-revenue.ts | PASS |
| 13.16 Финансы | finance.view_payments | read_only | read | medium | never | crm.finance.read | apps/web/lib/crm-agent-v2/actions/finance/finance.view-payments.ts | PASS |
| 13.16 Финансы | finance.view_refunds | read_only | read | medium | never | crm.finance.read | apps/web/lib/crm-agent-v2/actions/finance/finance.view-refunds.ts | PASS |
| 13.16 Финансы | finance.view_receipts | read_only | read | medium | never | crm.finance.read | apps/web/lib/crm-agent-v2/actions/finance/finance.view-receipts.ts | PASS |
| 13.16 Финансы | finance.find_unpaid | read_only | read | medium | never | crm.finance.read | apps/web/lib/crm-agent-v2/actions/finance/finance.find-unpaid.ts | PASS |
| 13.16 Финансы | finance.view_client_balance | read_only | read | medium | never | crm.finance.read | apps/web/lib/crm-agent-v2/actions/finance/finance.view-client-balance.ts | PASS |
| 13.16 Финансы | finance.revenue_by_service | read_only | read | medium | never | crm.finance.read | apps/web/lib/crm-agent-v2/actions/finance/finance.revenue-by-service.ts | PASS |
| 13.16 Финансы | finance.revenue_by_specialist | read_only | read | medium | never | crm.finance.read | apps/web/lib/crm-agent-v2/actions/finance/finance.revenue-by-specialist.ts | PASS |
| 13.16 Финансы | finance.revenue_by_location | read_only | read | medium | never | crm.finance.read | apps/web/lib/crm-agent-v2/actions/finance/finance.revenue-by-location.ts | PASS |
| 13.16 Финансы | finance.reconcile_appointment | implemented | write | high | always | crm.finance.manage | apps/web/lib/crm-agent-v2/actions/finance/finance.reconcile-appointment.ts | PASS |
| 13.16 Финансы | payment_intent.search | read_only | read | medium | never | crm.finance.read | apps/web/lib/crm-agent-v2/actions/finance/payment-intent.search.ts | PASS |
| 13.16 Финансы | payment_intent.create | implemented | write | high | always | crm.finance.manage | apps/web/lib/crm-agent-v2/actions/finance/payment-intent.create.ts | PASS |
| 13.16 Финансы | payment_intent.cancel | implemented | write | high | always | crm.finance.manage | apps/web/lib/crm-agent-v2/actions/finance/payment-intent.cancel.ts | PASS |
| 13.16 Финансы | refund.create | implemented | system | critical | separate_sensitive_confirm | crm.finance.refund | apps/web/lib/crm-agent-v2/actions/finance/refund.create.ts | PASS |
| 13.16 Финансы | receipt.view | read_only | read | medium | never | crm.finance.read | apps/web/lib/crm-agent-v2/actions/finance/receipt.view.ts | PASS |
| 13.16 Финансы | receipt.resend | implemented | write | medium | medium_plus | crm.finance.manage | apps/web/lib/crm-agent-v2/actions/finance/receipt.resend.ts | PASS |
| 13.17 Уведомления | notification.search | read_only | read | low | never | crm.notifications.read | apps/web/lib/crm-agent-v2/actions/notifications/notification.search.ts | PASS |
| 13.17 Уведомления | notification.view | read_only | read | low | never | crm.notifications.read | apps/web/lib/crm-agent-v2/actions/notifications/notification.view.ts | PASS |
| 13.17 Уведомления | notification.send_client | implemented | write | high | always | crm.notifications.send | apps/web/lib/crm-agent-v2/actions/notifications/notification.send-client.ts | PASS |
| 13.17 Уведомления | notification.send_segment | implemented | write | high | always | crm.notifications.send | apps/web/lib/crm-agent-v2/actions/notifications/notification.send-segment.ts | PASS |
| 13.17 Уведомления | notification.create_template | implemented | write | medium | medium_plus | crm.notifications.manage | apps/web/lib/crm-agent-v2/actions/notifications/notification.create-template.ts | PASS |
| 13.17 Уведомления | notification.update_template | implemented | write | medium | medium_plus | crm.notifications.manage | apps/web/lib/crm-agent-v2/actions/notifications/notification.update-template.ts | PASS |
| 13.17 Уведомления | notification.delete_template | implemented | write | high | always | crm.notifications.manage | apps/web/lib/crm-agent-v2/actions/notifications/notification.delete-template.ts | PASS |
| 13.17 Уведомления | notification.update_preferences | implemented | write | high | always | crm.notifications.manage | apps/web/lib/crm-agent-v2/actions/notifications/notification.update-preferences.ts | PASS |
| 13.17 Уведомления | notification.preview | read_only | read | low | never | crm.notifications.read | apps/web/lib/crm-agent-v2/actions/notifications/notification.preview.ts | PASS |
| 13.17 Уведомления | notification.retry_failed | implemented | write | medium | medium_plus | crm.notifications.send | apps/web/lib/crm-agent-v2/actions/notifications/notification.retry-failed.ts | PASS |
| 13.17 Уведомления | outbox.search | read_only | read | low | never | crm.notifications.read | apps/web/lib/crm-agent-v2/actions/notifications/outbox.search.ts | PASS |
| 13.17 Уведомления | outbox.retry | implemented | write | medium | medium_plus | crm.notifications.send | apps/web/lib/crm-agent-v2/actions/notifications/outbox.retry.ts | PASS |
| 13.17 Уведомления | delivery.view_status | read_only | read | low | never | crm.notifications.read | apps/web/lib/crm-agent-v2/actions/notifications/delivery.view-status.ts | PASS |
| 13.18 Маркетинг | campaign.create_retention | implemented | write | high | always | crm.marketing.manage | apps/web/lib/crm-agent-v2/actions/marketing/campaign.create-retention.ts | PASS |
| 13.18 Маркетинг | campaign.create_reactivation | implemented | write | high | always | crm.marketing.manage | apps/web/lib/crm-agent-v2/actions/marketing/campaign.create-reactivation.ts | PASS |
| 13.18 Маркетинг | campaign.create_repeat_visit | implemented | write | high | always | crm.marketing.manage | apps/web/lib/crm-agent-v2/actions/marketing/campaign.create-repeat-visit.ts | PASS |
| 13.18 Маркетинг | campaign.create_empty_slots | implemented | write | high | always | crm.marketing.manage | apps/web/lib/crm-agent-v2/actions/marketing/campaign.create-empty-slots.ts | PASS |
| 13.18 Маркетинг | campaign.create_birthday | implemented | write | high | always | crm.marketing.manage | apps/web/lib/crm-agent-v2/actions/marketing/campaign.create-birthday.ts | PASS |
| 13.18 Маркетинг | campaign.create_seasonal | implemented | write | high | always | crm.marketing.manage | apps/web/lib/crm-agent-v2/actions/marketing/campaign.create-seasonal.ts | PASS |
| 13.18 Маркетинг | campaign.preview_audience | read_only | read | medium | never | crm.marketing.read | apps/web/lib/crm-agent-v2/actions/marketing/campaign.preview-audience.ts | PASS |
| 13.18 Маркетинг | campaign.update_audience | implemented | write | high | always | crm.marketing.manage | apps/web/lib/crm-agent-v2/actions/marketing/campaign.update-audience.ts | PASS |
| 13.18 Маркетинг | campaign.update_offer | implemented | write | medium | medium_plus | crm.marketing.manage | apps/web/lib/crm-agent-v2/actions/marketing/campaign.update-offer.ts | PASS |
| 13.18 Маркетинг | campaign.update_message | implemented | write | medium | medium_plus | crm.marketing.manage | apps/web/lib/crm-agent-v2/actions/marketing/campaign.update-message.ts | PASS |
| 13.18 Маркетинг | campaign.schedule | implemented | write | high | always | crm.marketing.manage | apps/web/lib/crm-agent-v2/actions/marketing/campaign.schedule.ts | PASS |
| 13.18 Маркетинг | campaign.send | implemented | system | critical | separate_sensitive_confirm | crm.marketing.send | apps/web/lib/crm-agent-v2/actions/marketing/campaign.send.ts | PASS |
| 13.18 Маркетинг | campaign.pause | implemented | write | medium | medium_plus | crm.marketing.manage | apps/web/lib/crm-agent-v2/actions/marketing/campaign.pause.ts | PASS |
| 13.18 Маркетинг | campaign.cancel | implemented | write | high | always | crm.marketing.manage | apps/web/lib/crm-agent-v2/actions/marketing/campaign.cancel.ts | PASS |
| 13.18 Маркетинг | campaign.view_results | read_only | read | low | never | crm.marketing.read | apps/web/lib/crm-agent-v2/actions/marketing/campaign.view-results.ts | PASS |
| 13.18 Маркетинг | campaign.analyze_conversions | read_only | read | low | never | crm.assistant.analytics.read | apps/web/lib/crm-agent-v2/actions/marketing/campaign.analyze-conversions.ts | PASS |
| 13.19 Аналитика | analytics.attention_review | read_only | read | low | never | crm.assistant.analytics.read | apps/web/lib/crm-agent-v2/actions/analytics/analytics.attention-review.ts | PASS |
| 13.19 Аналитика | analytics.daily_brief | read_only | read | low | never | crm.assistant.analytics.read | apps/web/lib/crm-agent-v2/actions/analytics/analytics.daily-brief.ts | PASS |
| 13.19 Аналитика | analytics.weekly_brief | read_only | read | low | never | crm.assistant.analytics.read | apps/web/lib/crm-agent-v2/actions/analytics/analytics.weekly-brief.ts | PASS |
| 13.19 Аналитика | analytics.workload | read_only | read | low | never | crm.assistant.analytics.read | apps/web/lib/crm-agent-v2/actions/analytics/analytics.workload.ts | PASS |
| 13.19 Аналитика | analytics.revenue | read_only | read | medium | never | crm.finance.read | apps/web/lib/crm-agent-v2/actions/analytics/analytics.revenue.ts | PASS |
| 13.19 Аналитика | analytics.retention | read_only | read | low | never | crm.assistant.analytics.read | apps/web/lib/crm-agent-v2/actions/analytics/analytics.retention.ts | PASS |
| 13.19 Аналитика | analytics.no_show_rate | read_only | read | low | never | crm.assistant.analytics.read | apps/web/lib/crm-agent-v2/actions/analytics/analytics.no-show-rate.ts | PASS |
| 13.19 Аналитика | analytics.cancellations | read_only | read | low | never | crm.assistant.analytics.read | apps/web/lib/crm-agent-v2/actions/analytics/analytics.cancellations.ts | PASS |
| 13.19 Аналитика | analytics.empty_windows | read_only | read | low | never | crm.assistant.analytics.read | apps/web/lib/crm-agent-v2/actions/analytics/analytics.empty-windows.ts | PASS |
| 13.19 Аналитика | analytics.underloaded_specialists | read_only | read | low | never | crm.assistant.analytics.read | apps/web/lib/crm-agent-v2/actions/analytics/analytics.underloaded-specialists.ts | PASS |
| 13.19 Аналитика | analytics.declining_services | read_only | read | low | never | crm.assistant.analytics.read | apps/web/lib/crm-agent-v2/actions/analytics/analytics.declining-services.ts | PASS |
| 13.19 Аналитика | analytics.top_services | read_only | read | low | never | crm.assistant.analytics.read | apps/web/lib/crm-agent-v2/actions/analytics/analytics.top-services.ts | PASS |
| 13.19 Аналитика | analytics.top_clients | read_only | read | low | never | crm.assistant.analytics.read | apps/web/lib/crm-agent-v2/actions/analytics/analytics.top-clients.ts | PASS |
| 13.19 Аналитика | analytics.review_themes | read_only | read | low | never | crm.assistant.analytics.read | apps/web/lib/crm-agent-v2/actions/analytics/analytics.review-themes.ts | PASS |
| 13.19 Аналитика | analytics.campaign_conversion | read_only | read | low | never | crm.assistant.analytics.read | apps/web/lib/crm-agent-v2/actions/analytics/analytics.campaign-conversion.ts | PASS |
| 13.19 Аналитика | analytics.forecast | read_only | generate | low | never | crm.assistant.analytics.read | apps/web/lib/crm-agent-v2/actions/analytics/analytics.forecast.ts | PASS |
| 13.19 Аналитика | analytics.find_growth_opportunities | read_only | generate | low | never | crm.assistant.analytics.read | apps/web/lib/crm-agent-v2/actions/analytics/analytics.find-growth-opportunities.ts | PASS |
| 13.20 Юридические документы | legal.view_documents | read_only | read | low | never | crm.legal.read | apps/web/lib/crm-agent-v2/actions/legal/legal.view-documents.ts | PASS |
| 13.20 Юридические документы | legal.create_document | implemented | write | high | always | crm.legal.manage | apps/web/lib/crm-agent-v2/actions/legal/legal.create-document.ts | PASS |
| 13.20 Юридические документы | legal.update_document | implemented | write | high | always | crm.legal.manage | apps/web/lib/crm-agent-v2/actions/legal/legal.update-document.ts | PASS |
| 13.20 Юридические документы | legal.publish_version | implemented | system | critical | separate_sensitive_confirm | crm.legal.manage | apps/web/lib/crm-agent-v2/actions/legal/legal.publish-version.ts | PASS |
| 13.20 Юридические документы | legal.archive_document | implemented | write | high | always | crm.legal.manage | apps/web/lib/crm-agent-v2/actions/legal/legal.archive-document.ts | PASS |
| 13.20 Юридические документы | legal.view_acceptances | read_only | read | medium | never | crm.legal.read | apps/web/lib/crm-agent-v2/actions/legal/legal.view-acceptances.ts | PASS |
| 13.20 Юридические документы | legal.check_missing_acceptances | read_only | read | medium | never | crm.legal.read | apps/web/lib/crm-agent-v2/actions/legal/legal.check-missing-acceptances.ts | PASS |
| 13.21 Интеграции и webhooks | webhook.create_endpoint | implemented | system | high | always | crm.integrations.manage | apps/web/lib/crm-agent-v2/actions/integrations/webhook.create-endpoint.ts | PASS |
| 13.21 Интеграции и webhooks | webhook.update_endpoint | implemented | system | high | always | crm.integrations.manage | apps/web/lib/crm-agent-v2/actions/integrations/webhook.update-endpoint.ts | PASS |
| 13.21 Интеграции и webhooks | webhook.disable_endpoint | implemented | system | high | always | crm.integrations.manage | apps/web/lib/crm-agent-v2/actions/integrations/webhook.disable-endpoint.ts | PASS |
| 13.21 Интеграции и webhooks | webhook.delete_endpoint | implemented | system | critical | separate_sensitive_confirm | crm.integrations.manage | apps/web/lib/crm-agent-v2/actions/integrations/webhook.delete-endpoint.ts | PASS |
| 13.21 Интеграции и webhooks | webhook.view_events | read_only | read | low | never | crm.integrations.read | apps/web/lib/crm-agent-v2/actions/integrations/webhook.view-events.ts | PASS |
| 13.21 Интеграции и webhooks | webhook.retry_delivery | implemented | write | medium | medium_plus | crm.integrations.manage | apps/web/lib/crm-agent-v2/actions/integrations/webhook.retry-delivery.ts | PASS |
| 13.21 Интеграции и webhooks | integration.delivery_status | read_only | read | low | never | crm.integrations.read | apps/web/lib/crm-agent-v2/actions/integrations/integration.delivery-status.ts | PASS |
| 13.21 Интеграции и webhooks | integration.unsubscribe | implemented | system | high | always | crm.integrations.manage | apps/web/lib/crm-agent-v2/actions/integrations/integration.unsubscribe.ts | PASS |
| 13.22 Настройки агента | agent.memory.view | read_only | read | medium | never | crm.assistant.memory.manage | apps/web/lib/crm-agent-v2/actions/agent-settings/agent.memory-view.ts | PASS |
| 13.22 Настройки агента | agent.memory.update | implemented | write | medium | medium_plus | crm.assistant.memory.manage | apps/web/lib/crm-agent-v2/actions/agent-settings/agent.memory-update.ts | PASS |
| 13.22 Настройки агента | agent.memory.delete | implemented | write | high | always | crm.assistant.memory.manage | apps/web/lib/crm-agent-v2/actions/agent-settings/agent.memory-delete.ts | PASS |
| 13.22 Настройки агента | agent.policy.view | read_only | read | medium | never | crm.assistant.autopilot.manage | apps/web/lib/crm-agent-v2/actions/agent-settings/agent.policy-view.ts | PASS |
| 13.22 Настройки агента | agent.policy.update | implemented | system | high | always | crm.assistant.autopilot.manage | apps/web/lib/crm-agent-v2/actions/agent-settings/agent.policy-update.ts | PASS |
| 13.22 Настройки агента | agent.autopilot.enable | implemented | system | high | always | crm.assistant.autopilot.manage | apps/web/lib/crm-agent-v2/actions/agent-settings/agent.autopilot-enable.ts | PASS |
| 13.22 Настройки агента | agent.autopilot.disable | implemented | system | high | always | crm.assistant.autopilot.manage | apps/web/lib/crm-agent-v2/actions/agent-settings/agent.autopilot-disable.ts | PASS |
| 13.22 Настройки агента | agent.autopilot.set_level | implemented | system | high | always | crm.assistant.autopilot.manage | apps/web/lib/crm-agent-v2/actions/agent-settings/agent.autopilot-set-level.ts | PASS |
| 13.22 Настройки агента | agent.view_runs | read_only | read | medium | never | crm.assistant.runs.read | apps/web/lib/crm-agent-v2/actions/agent-settings/agent.view-runs.ts | PASS |
| 13.22 Настройки агента | agent.view_trace | read_only | read | medium | never | crm.assistant.runs.read | apps/web/lib/crm-agent-v2/actions/agent-settings/agent.view-trace.ts | PASS |
| 13.22 Настройки агента | agent.cancel_task | implemented | system | high | always | crm.assistant.tasks.manage | apps/web/lib/crm-agent-v2/actions/agent-settings/agent.cancel-task.ts | PASS |
| 13.22 Настройки агента | agent.resume_task | implemented | system | medium | medium_plus | crm.assistant.tasks.manage | apps/web/lib/crm-agent-v2/actions/agent-settings/agent.resume-task.ts | PASS |
