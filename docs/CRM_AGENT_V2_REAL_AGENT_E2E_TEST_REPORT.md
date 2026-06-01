# CRM Agent v2 Real Agent E2E Test Report

Generated: 2026-05-30T13:22:31.174Z
Run ID: crm-agent-v2-real-e2e-1780147230542-a0873a3236a39
Scenario filter: none
Diagnostics: none

## Summary

| Metric | Value |
| --- | --- |
| Section 13 actions | 374 |
| Real dialog scenarios | 36 |
| Scenario passed | 36 |
| Scenario failed | 0 |
| Action passed | 30 |
| Action failed | 0 |
| Not covered yet | 344 |

## E2E Status Counts

| Status | Count |
| --- | --- |
| not_covered_yet | 344 |
| passed | 30 |

## Architecture Guards

| Guard | Status | Details |
| --- | --- | --- |
| runtime has no appointment keyword/regex recovery | passed | No appointment phrase parser recovery is present in runtime. |

## Bugs / Deviations

_Нет зафиксированных падений в покрытых real-E2E сценариях._

## Scenario Results

| Action | Scenario | Status | Details |
| --- | --- | --- | --- |
| client.search | client-search-real-dialog | passed | Agent produced the expected read/search behavior. |
| client.view | client-view-real-dialog | passed | Agent produced the expected read/search behavior. |
| client.resolve | client-resolve-real-dialog | passed | Agent produced the expected read/search behavior. |
| client.create | client-create-real-dialog | passed | Prepared and executed action #713. |
| client.update | client-update-real-dialog | passed | Prepared and executed action #714. |
| client.archive | client-archive-real-dialog | passed | Prepared and executed action #715. |
| client.restore | client-restore-real-dialog | passed | Prepared and executed action #716. |
| client.add_contact | client-add-contact-real-dialog | passed | Prepared and executed action #717. |
| client.update_contact | client-update-contact-real-dialog | passed | Prepared and executed action #718. |
| client.delete_contact | client-delete-contact-real-dialog | passed | Prepared and executed action #719. |
| client.add_note | client-add-note-real-dialog | passed | Prepared and executed action #720. |
| client.update_note | client-update-note-real-dialog | passed | Prepared and executed action #721. |
| client.delete_note | client-delete-note-real-dialog | passed | Prepared and executed action #722. |
| client.add_tag | client-add-tag-real-dialog | passed | Prepared and executed action #723. |
| client.remove_tag | client-remove-tag-real-dialog | passed | Prepared and executed action #724. |
| client.create_tag | client-create-tag-real-dialog | passed | Prepared and executed action #725. |
| client.view_history | client-view-history-real-dialog | passed | Agent produced the expected read/search behavior. |
| client.merge_duplicates | client-merge-duplicates-real-dialog | passed | Prepared draft action #726. |
| client.view_visits | client-view-visits-real-dialog | passed | Agent produced the expected read/search behavior. |
| client.view_payments | client-view-payments-real-dialog | passed | Agent produced the expected read/search behavior. |
| client.view_reviews | client-view-reviews-real-dialog | passed | Agent produced the expected read/search behavior. |
| client.view_loyalty | client-view-loyalty-real-dialog | passed | Agent produced the expected read/search behavior. |
| client.update_consent | client-update-consent-real-dialog | passed | Prepared and executed action #727. |
| client.notify | client-notify-real-dialog | passed | Prepared draft action #728. |
| client.create_segment | client-create-segment-real-dialog | passed | Prepared draft action #729. |
| client.export_segment | client-export-segment-real-dialog | passed | Prepared draft action #730. |
| client.search | client-search-by-phone-paraphrase | passed | Agent produced the expected read/search behavior. |
| client.view | client-view-short-paraphrase | passed | Agent produced the expected read/search behavior. |
| client.add_note | client-add-note-paraphrase | passed | Prepared and executed action #731. |
| client.notify | client-notify-paraphrase | passed | Prepared draft action #732. |
| client.view_history | client-history-multiturn | passed | Agent produced the expected read/search behavior. |
| client.delete_note | client-delete-note-ambiguous-negative | passed | Agent avoided unsafe action as expected. |
| appointment.create | appointment-create-real-dialog | passed | Prepared and executed action #733. |
| service.update_description | service-update-description-real-dialog | passed | Prepared and executed action #734. |
| service.search | service-search-real-dialog | passed | Agent produced the expected read/search behavior. |
| service.update_price | service-update-price-real-dialog | passed | Prepared and executed action #735. |

## Per-Action Matrix

| Section | Action | Catalog Status | Real E2E Status | Scenario | Details |
| --- | --- | --- | --- | --- | --- |
| 13.1 Аккаунт | account.view | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.1 Аккаунт | account.update_name | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.1 Аккаунт | account.update_slug | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.1 Аккаунт | account.update_status | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.1 Аккаунт | account.update_business_type | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.1 Аккаунт | account.update_profile | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.1 Аккаунт | account.update_contacts | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.1 Аккаунт | account.update_address | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.1 Аккаунт | account.update_branding | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.1 Аккаунт | account.update_logo | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.1 Аккаунт | account.update_colors | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.1 Аккаунт | account.update_public_description | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.1 Аккаунт | account.update_booking_rules | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.1 Аккаунт | account.update_cancellation_rules | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.1 Аккаунт | account.update_reschedule_rules | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.1 Аккаунт | account.update_deposit_rules | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.1 Аккаунт | account.update_review_rules | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.1 Аккаунт | account.view_audit | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.1 Аккаунт | account.export_data | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.2 Пользователи, роли, пароль | user.search | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.2 Пользователи, роли, пароль | user.view | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.2 Пользователи, роли, пароль | user.invite | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.2 Пользователи, роли, пароль | user.create | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.2 Пользователи, роли, пароль | user.update_profile | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.2 Пользователи, роли, пароль | user.update_email | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.2 Пользователи, роли, пароль | user.update_phone | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.2 Пользователи, роли, пароль | user.change_role | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.2 Пользователи, роли, пароль | user.activate | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.2 Пользователи, роли, пароль | user.deactivate | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.2 Пользователи, роли, пароль | user.reset_password | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.2 Пользователи, роли, пароль | user.change_own_password | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.2 Пользователи, роли, пароль | user.revoke_sessions | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.2 Пользователи, роли, пароль | user.link_identity | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.2 Пользователи, роли, пароль | user.unlink_identity | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.2 Пользователи, роли, пароль | role.search | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.2 Пользователи, роли, пароль | role.create | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.2 Пользователи, роли, пароль | role.update | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.2 Пользователи, роли, пароль | role.delete | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.2 Пользователи, роли, пароль | permission.assign | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.2 Пользователи, роли, пароль | permission.revoke | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.2 Пользователи, роли, пароль | permission.view_matrix | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.3 Клиенты | client.search | read_only | passed | client-search-real-dialog | Agent produced the expected read/search behavior. |
| 13.3 Клиенты | client.view | read_only | passed | client-view-real-dialog | Agent produced the expected read/search behavior. |
| 13.3 Клиенты | client.resolve | read_only | passed | client-resolve-real-dialog | Agent produced the expected read/search behavior. |
| 13.3 Клиенты | client.create | implemented | passed | client-create-real-dialog | Prepared and executed action #713. |
| 13.3 Клиенты | client.update | implemented | passed | client-update-real-dialog | Prepared and executed action #714. |
| 13.3 Клиенты | client.archive | implemented | passed | client-archive-real-dialog | Prepared and executed action #715. |
| 13.3 Клиенты | client.restore | implemented | passed | client-restore-real-dialog | Prepared and executed action #716. |
| 13.3 Клиенты | client.add_contact | implemented | passed | client-add-contact-real-dialog | Prepared and executed action #717. |
| 13.3 Клиенты | client.update_contact | implemented | passed | client-update-contact-real-dialog | Prepared and executed action #718. |
| 13.3 Клиенты | client.delete_contact | implemented | passed | client-delete-contact-real-dialog | Prepared and executed action #719. |
| 13.3 Клиенты | client.add_note | implemented | passed | client-add-note-real-dialog | Prepared and executed action #720. |
| 13.3 Клиенты | client.update_note | implemented | passed | client-update-note-real-dialog | Prepared and executed action #721. |
| 13.3 Клиенты | client.delete_note | implemented | passed | client-delete-note-real-dialog | Prepared and executed action #722. |
| 13.3 Клиенты | client.add_tag | implemented | passed | client-add-tag-real-dialog | Prepared and executed action #723. |
| 13.3 Клиенты | client.remove_tag | implemented | passed | client-remove-tag-real-dialog | Prepared and executed action #724. |
| 13.3 Клиенты | client.create_tag | implemented | passed | client-create-tag-real-dialog | Prepared and executed action #725. |
| 13.3 Клиенты | client.merge_duplicates | draft_only | passed | client-merge-duplicates-real-dialog | Prepared draft action #726. |
| 13.3 Клиенты | client.view_history | read_only | passed | client-view-history-real-dialog | Agent produced the expected read/search behavior. |
| 13.3 Клиенты | client.view_visits | read_only | passed | client-view-visits-real-dialog | Agent produced the expected read/search behavior. |
| 13.3 Клиенты | client.view_payments | read_only | passed | client-view-payments-real-dialog | Agent produced the expected read/search behavior. |
| 13.3 Клиенты | client.view_reviews | read_only | passed | client-view-reviews-real-dialog | Agent produced the expected read/search behavior. |
| 13.3 Клиенты | client.view_loyalty | read_only | passed | client-view-loyalty-real-dialog | Agent produced the expected read/search behavior. |
| 13.3 Клиенты | client.update_consent | implemented | passed | client-update-consent-real-dialog | Prepared and executed action #727. |
| 13.3 Клиенты | client.notify | draft_only | passed | client-notify-real-dialog | Prepared draft action #728. |
| 13.3 Клиенты | client.create_segment | draft_only | passed | client-create-segment-real-dialog | Prepared draft action #729. |
| 13.3 Клиенты | client.export_segment | draft_only | passed | client-export-segment-real-dialog | Prepared draft action #730. |
| 13.4 Записи | appointment.search | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.4 Записи | appointment.view | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.4 Записи | appointment.resolve | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.4 Записи | appointment.find_slots | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.4 Записи | appointment.hold_slot | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.4 Записи | appointment.release_hold | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.4 Записи | appointment.create | implemented | passed | appointment-create-real-dialog | Prepared and executed action #733. |
| 13.4 Записи | appointment.reschedule | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.4 Записи | appointment.cancel | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.4 Записи | appointment.confirm | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.4 Записи | appointment.mark_done | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.4 Записи | appointment.mark_no_show | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.4 Записи | appointment.change_client | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.4 Записи | appointment.change_service | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.4 Записи | appointment.change_specialist | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.4 Записи | appointment.change_location | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.4 Записи | appointment.change_time | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.4 Записи | appointment.change_price | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.4 Записи | appointment.change_duration | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.4 Записи | appointment.add_comment | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.4 Записи | appointment.update_comment | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.4 Записи | appointment.view_conflicts | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.4 Записи | appointment.view_history | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.5 Групповые записи | group_session.search | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.5 Групповые записи | group_session.view | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.5 Групповые записи | group_session.create | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.5 Групповые записи | group_session.update | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.5 Групповые записи | group_session.cancel | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.5 Групповые записи | group_session.change_capacity | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.5 Групповые записи | group_session.change_price | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.5 Групповые записи | group_session.add_participant | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.5 Групповые записи | group_session.remove_participant | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.5 Групповые записи | group_session.update_participant_status | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.5 Групповые записи | group_session.mark_participant_done | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.5 Групповые записи | group_session.mark_participant_no_show | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.6 График | schedule.search | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.6 График | schedule.view_day | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.6 График | schedule.view_week | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.6 График | schedule.view_month | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.6 График | schedule.set_workday | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.6 График | schedule.set_day_off | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.6 График | schedule.set_vacation | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.6 График | schedule.add_break | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.6 График | schedule.update_break | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.6 График | schedule.remove_break | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.6 График | schedule.block_slot | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.6 График | schedule.unblock_slot | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.6 График | schedule.copy_day | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.6 График | schedule.copy_week | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.6 График | schedule.create_template | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.6 График | schedule.update_template | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.6 График | schedule.delete_template | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.6 График | schedule.apply_template | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.6 График | schedule.create_non_working_type | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.6 График | schedule.update_non_working_type | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.6 График | schedule.delete_non_working_type | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.6 График | schedule.find_empty_windows | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.6 График | schedule.find_overlaps | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.7 Услуги | service.search | read_only | passed | service-search-real-dialog | Agent produced the expected read/search behavior. |
| 13.7 Услуги | service.view | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.7 Услуги | service.resolve | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.7 Услуги | service.create | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.7 Услуги | service.update | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.7 Услуги | service.update_name | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.7 Услуги | service.update_description | implemented | passed | service-update-description-real-dialog | Prepared and executed action #734. |
| 13.7 Услуги | service.generate_description | draft_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.7 Услуги | service.update_price | implemented | passed | service-update-price-real-dialog | Prepared and executed action #735. |
| 13.7 Услуги | service.update_duration | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.7 Услуги | service.update_booking_type | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.7 Услуги | service.activate | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.7 Услуги | service.archive | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.7 Услуги | service.restore | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.7 Услуги | service.delete_if_empty | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.7 Услуги | service.assign_specialist | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.7 Услуги | service.unassign_specialist | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.7 Услуги | service.assign_location | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.7 Услуги | service.unassign_location | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.7 Услуги | service.add_variant | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.7 Услуги | service.update_variant | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.7 Услуги | service.delete_variant | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.7 Услуги | service.create_category | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.7 Услуги | service.update_category | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.7 Услуги | service.delete_category | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.7 Услуги | service.move_to_category | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.7 Услуги | service.update_level_config | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.7 Услуги | service.attach_media | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.7 Услуги | service.detach_media | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.8 Сотрудники | specialist.search | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.8 Сотрудники | specialist.view | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.8 Сотрудники | specialist.resolve | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.8 Сотрудники | specialist.create | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.8 Сотрудники | specialist.update | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.8 Сотрудники | specialist.update_bio | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.8 Сотрудники | specialist.generate_bio | draft_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.8 Сотрудники | specialist.update_avatar | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.8 Сотрудники | specialist.set_public | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.8 Сотрудники | specialist.hide | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.8 Сотрудники | specialist.assign_service | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.8 Сотрудники | specialist.unassign_service | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.8 Сотрудники | specialist.assign_location | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.8 Сотрудники | specialist.unassign_location | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.8 Сотрудники | specialist.assign_category | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.8 Сотрудники | specialist.remove_category | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.8 Сотрудники | specialist.set_level | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.8 Сотрудники | specialist.view_workload | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.8 Сотрудники | specialist.view_revenue | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.8 Сотрудники | specialist.view_reviews | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.8 Сотрудники | specialist.view_empty_slots | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.9 Локации | location.search | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.9 Локации | location.view | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.9 Локации | location.resolve | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.9 Локации | location.create | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.9 Локации | location.update | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.9 Локации | location.update_name | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.9 Локации | location.update_address | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.9 Локации | location.update_phone | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.9 Локации | location.update_description | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.9 Локации | location.generate_description | draft_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.9 Локации | location.activate | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.9 Локации | location.deactivate | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.9 Локации | location.update_hours | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.9 Локации | location.add_exception | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.9 Локации | location.remove_exception | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.9 Локации | location.assign_manager | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.9 Локации | location.remove_manager | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.9 Локации | location.attach_media | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.9 Локации | location.detach_media | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.9 Локации | location.view_schedule | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.9 Локации | location.view_workload | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.10 Отзывы | review.search | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.10 Отзывы | review.view | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.10 Отзывы | review.resolve | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.10 Отзывы | review.find_negative | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.10 Отзывы | review.find_unanswered | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.10 Отзывы | review.reply | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.10 Отзывы | review.generate_reply | draft_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.10 Отзывы | review.update_reply | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.10 Отзывы | review.delete_reply | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.10 Отзывы | review.change_status | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.10 Отзывы | review.bulk_update_status | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.10 Отзывы | review.attach_reply_media | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.10 Отзывы | review.remove_reply_media | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.10 Отзывы | review.analyze_complaints | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.10 Отзывы | review.suggest_process_fix | draft_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.11 Сайт и SEO | site.health | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.11 Сайт и SEO | site.view_public_page | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.11 Сайт и SEO | site.create_public_page | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.11 Сайт и SEO | site.update_public_page | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.11 Сайт и SEO | site.archive_public_page | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.11 Сайт и SEO | site.create_section | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.11 Сайт и SEO | site.update_section | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.11 Сайт и SEO | site.delete_section | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.11 Сайт и SEO | site.create_block | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.11 Сайт и SEO | site.update_block | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.11 Сайт и SEO | site.delete_block | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.11 Сайт и SEO | site.update_home_copy | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.11 Сайт и SEO | site.update_service_copy | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.11 Сайт и SEO | site.update_specialist_copy | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.11 Сайт и SEO | site.update_location_copy | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.11 Сайт и SEO | site.update_contacts | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.11 Сайт и SEO | site.update_booking_settings | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.11 Сайт и SEO | site.update_seo_global | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.11 Сайт и SEO | site.update_seo_page | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.11 Сайт и SEO | site.generate_missing_descriptions | draft_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.11 Сайт и SEO | site.preview_changes | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.11 Сайт и SEO | site.apply_changes | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.12 Домены | domain.search | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.12 Домены | domain.add | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.12 Домены | domain.check | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.12 Домены | domain.set_primary | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.12 Домены | domain.remove | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.12 Домены | domain.view_dns_status | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.13 Медиа | media.search | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.13 Медиа | media.upload | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.13 Медиа | media.update_alt | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.13 Медиа | media.update_metadata | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.13 Медиа | media.create_collection | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.13 Медиа | media.update_collection | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.13 Медиа | media.delete_collection | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.13 Медиа | media.link_to_account | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.13 Медиа | media.link_to_service | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.13 Медиа | media.link_to_specialist | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.13 Медиа | media.link_to_location | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.13 Медиа | media.unlink | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.13 Медиа | media.archive | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.14 Акции и промокоды | promo.search | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.14 Акции и промокоды | promo.view | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.14 Акции и промокоды | promo.resolve | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.14 Акции и промокоды | promo.create | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.14 Акции и промокоды | promo.update | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.14 Акции и промокоды | promo.activate | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.14 Акции и промокоды | promo.deactivate | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.14 Акции и промокоды | promo.archive | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.14 Акции и промокоды | promo.restore | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.14 Акции и промокоды | promo.create_code | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.14 Акции и промокоды | promo.update_code | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.14 Акции и промокоды | promo.disable_code | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.14 Акции и промокоды | promo.view_redemptions | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.14 Акции и промокоды | promo.suggest_for_retention | draft_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.14 Акции и промокоды | promo.suggest_for_empty_slots | draft_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.14 Акции и промокоды | promo.suggest_for_birthday | draft_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.15 Лояльность, подарочные карты, абонементы | loyalty.view_wallet | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.15 Лояльность, подарочные карты, абонементы | loyalty.adjust_balance | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.15 Лояльность, подарочные карты, абонементы | loyalty.create_rule | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.15 Лояльность, подарочные карты, абонементы | loyalty.update_rule | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.15 Лояльность, подарочные карты, абонементы | loyalty.disable_rule | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.15 Лояльность, подарочные карты, абонементы | loyalty.view_transactions | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.15 Лояльность, подарочные карты, абонементы | gift_card.search | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.15 Лояльность, подарочные карты, абонементы | gift_card.create | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.15 Лояльность, подарочные карты, абонементы | gift_card.update | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.15 Лояльность, подарочные карты, абонементы | gift_card.activate | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.15 Лояльность, подарочные карты, абонементы | gift_card.cancel | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.15 Лояльность, подарочные карты, абонементы | membership.search | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.15 Лояльность, подарочные карты, абонементы | membership.create | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.15 Лояльность, подарочные карты, абонементы | membership.update | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.15 Лояльность, подарочные карты, абонементы | membership.activate | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.15 Лояльность, подарочные карты, абонементы | membership.cancel | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.15 Лояльность, подарочные карты, абонементы | membership.redeem | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.16 Финансы | finance.view_revenue | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.16 Финансы | finance.view_payments | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.16 Финансы | finance.view_refunds | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.16 Финансы | finance.view_receipts | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.16 Финансы | finance.find_unpaid | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.16 Финансы | finance.view_client_balance | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.16 Финансы | finance.revenue_by_service | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.16 Финансы | finance.revenue_by_specialist | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.16 Финансы | finance.revenue_by_location | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.16 Финансы | finance.reconcile_appointment | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.16 Финансы | payment_intent.search | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.16 Финансы | payment_intent.create | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.16 Финансы | payment_intent.cancel | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.16 Финансы | refund.create | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.16 Финансы | receipt.view | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.16 Финансы | receipt.resend | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.17 Уведомления | notification.search | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.17 Уведомления | notification.view | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.17 Уведомления | notification.send_client | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.17 Уведомления | notification.send_segment | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.17 Уведомления | notification.create_template | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.17 Уведомления | notification.update_template | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.17 Уведомления | notification.delete_template | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.17 Уведомления | notification.update_preferences | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.17 Уведомления | notification.preview | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.17 Уведомления | notification.retry_failed | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.17 Уведомления | outbox.search | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.17 Уведомления | outbox.retry | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.17 Уведомления | delivery.view_status | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.18 Маркетинг | campaign.create_retention | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.18 Маркетинг | campaign.create_reactivation | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.18 Маркетинг | campaign.create_repeat_visit | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.18 Маркетинг | campaign.create_empty_slots | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.18 Маркетинг | campaign.create_birthday | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.18 Маркетинг | campaign.create_seasonal | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.18 Маркетинг | campaign.preview_audience | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.18 Маркетинг | campaign.update_audience | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.18 Маркетинг | campaign.update_offer | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.18 Маркетинг | campaign.update_message | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.18 Маркетинг | campaign.schedule | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.18 Маркетинг | campaign.send | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.18 Маркетинг | campaign.pause | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.18 Маркетинг | campaign.cancel | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.18 Маркетинг | campaign.view_results | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.18 Маркетинг | campaign.analyze_conversions | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.19 Аналитика | analytics.attention_review | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.19 Аналитика | analytics.daily_brief | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.19 Аналитика | analytics.weekly_brief | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.19 Аналитика | analytics.workload | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.19 Аналитика | analytics.revenue | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.19 Аналитика | analytics.retention | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.19 Аналитика | analytics.no_show_rate | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.19 Аналитика | analytics.cancellations | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.19 Аналитика | analytics.empty_windows | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.19 Аналитика | analytics.underloaded_specialists | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.19 Аналитика | analytics.declining_services | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.19 Аналитика | analytics.top_services | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.19 Аналитика | analytics.top_clients | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.19 Аналитика | analytics.review_themes | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.19 Аналитика | analytics.campaign_conversion | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.19 Аналитика | analytics.forecast | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.19 Аналитика | analytics.find_growth_opportunities | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.20 Юридические документы | legal.view_documents | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.20 Юридические документы | legal.create_document | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.20 Юридические документы | legal.update_document | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.20 Юридические документы | legal.publish_version | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.20 Юридические документы | legal.archive_document | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.20 Юридические документы | legal.view_acceptances | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.20 Юридические документы | legal.check_missing_acceptances | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.21 Интеграции и webhooks | webhook.create_endpoint | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.21 Интеграции и webhooks | webhook.update_endpoint | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.21 Интеграции и webhooks | webhook.disable_endpoint | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.21 Интеграции и webhooks | webhook.delete_endpoint | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.21 Интеграции и webhooks | webhook.view_events | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.21 Интеграции и webhooks | webhook.retry_delivery | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.21 Интеграции и webhooks | integration.delivery_status | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.21 Интеграции и webhooks | integration.unsubscribe | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.22 Настройки агента | agent.memory.view | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.22 Настройки агента | agent.memory.update | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.22 Настройки агента | agent.memory.delete | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.22 Настройки агента | agent.policy.view | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.22 Настройки агента | agent.policy.update | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.22 Настройки агента | agent.autopilot.enable | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.22 Настройки агента | agent.autopilot.disable | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.22 Настройки агента | agent.autopilot.set_level | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.22 Настройки агента | agent.view_runs | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.22 Настройки агента | agent.view_trace | read_only | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.22 Настройки агента | agent.cancel_task | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
| 13.22 Настройки агента | agent.resume_task | implemented | not_covered_yet |  | Real dialog scenario is not defined yet. |
