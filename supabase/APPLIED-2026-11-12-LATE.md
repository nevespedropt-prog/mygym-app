# Database changes applied on 2026-11-12 (evening), applied straight to the live database with the migration tool
The full SQL for these was run live; this note records what each one is so nothing is a mystery later.
- `members_crm` (also saved as migration-members-crm.sql): wix_contacts, member_notes, admin_member_directory / profile / notes, admin_payments_summary.
- `members_segments_import_birthdays`: campaign audiences (lapsed, gym_classes, classes_only), admin_import_subscribers, admin_subscribers_export, send_birthday_emails (cron 09:15).
- `import_wix_subscribers`: admin_import_wix_subscribers (copies Wix subscribers, blocks Wix unsubscribes).
- `message_templates`: table + admin_templates_list / save / delete (7 starter templates, later 8 more).
- `manual_members`: people added in person (health form, agreements, plan); admin_member_directory and admin_member_profile now wrap the originals (_member_directory_core, _member_profile_core).
- `client_audiences_more_templates`: audiences active_clients, paused_clients, former_clients; 8 more templates.
- coach_defaults table + trigger + admin_coach_defaults / admin_classes_set_coach.
- Edge functions deployed: sync-wix-clients (cron every 30 min), admin-add-member.
Gotcha: execute_sql with begin/rollback in the same call rolls back everything in that call; run `notify pgrst, 'reload schema'` after creating functions.
