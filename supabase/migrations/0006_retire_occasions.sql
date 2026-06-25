-- ============================================================================
-- Retire the deprecated occasions model now that all functions use the Circle
-- model (circle_members + circle_member_id). Run after Step 3 function deploys.
-- ============================================================================
alter table public.orders                drop column if exists occasion_id;
alter table public.reminder_log          drop column if exists occasion_id;
alter table public.whatsapp_reminders_due drop column if exists occasion_id;
drop table if exists public.occasions cascade;

delete from public.message_templates
where template_name in ('invoice_delivery', 'order_ready', 'welcome_occasion_book');
