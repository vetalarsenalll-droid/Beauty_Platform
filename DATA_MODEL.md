DATA_MODEL (сущности)

Platform
- plans, subscriptions, invoices, limits
- platform_admins, platform_audit
- platform_settings (глобальные настройки)
- template_library (шаблоны уведомлений/конструктора/SEO пресеты)

Tenant
- accounts, account_settings (включая шаг слота)
- branding, domains, public_pages, seo

Marketplace
- categories, tags, media_assets, reviews, favorites, search_index, geo_points

Structure
- locations, location_hours, location_media

People
- users (staff), roles, permissions, role_assignments
- specialist_profiles, specialist_levels

Catalog
- services, service_categories, service_variants
- service_level_configs
- specialist_services (links + price overrides)
- service_locations, specialist_locations

Clients
- clients, client_contacts, client_notes, consents

Booking
- appointments, appointment_services, status_history, cancellation_reasons

Schedule
- working_hours, breaks, blocked_slots, vacations, schedule_templates

Promo/Loyalty
- promotions, promo_codes, promo_redemptions
- loyalty_wallet, loyalty_rules, loyalty_transactions
- referrals, gift_cards, memberships

Payments
- payment_intents, transactions, refunds, payment_methods, receipts

Notifications
- notification_templates
- notification_preferences (user + account + platform scope)
- outbox_items, delivery_logs

Realtime/Webhooks
- webhook_endpoints, webhook_events, webhook_deliveries

AI
- ai_threads, ai_messages, ai_actions, ai_logs, ai_limits, ai_settings
