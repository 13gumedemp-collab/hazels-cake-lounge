# Hazel's Cake Lounge — Supabase backend

One Supabase project is shared by the public website and the admin dashboard.

## Apply the schema

Either paste the migration into the Supabase SQL editor, or use the CLI:

```bash
supabase link --project-ref <PROJECT_REF>
supabase db push
```

## Migration order

| File | What it does | When to run |
|------|--------------|-------------|
| `migrations/0001_initial_schema.sql` | All 6 tables, indexes, extensions, RLS enabled | First |
| `migrations/0002_cron_daily_occasion_checker.sql` | Schedules the 08:00 SAST job | After the `daily-occasion-checker` edge function is deployed (Part 2) |

## Storage buckets (Part 1 / build step 2)

Create two buckets (Dashboard → Storage, or CLI). Keep them **private**; the
app serves files via signed URLs from the server layer.

- `cake-photos`
- `memory-cards`

## Security model

- RLS is **on** for every table with **no** anon/authenticated policies, so the
  tables are closed by default.
- All server work (edge functions, the admin app's server routes) uses the
  `service_role` key, which bypasses RLS.
- The public website never talks to the tables directly; it calls the
  `occasion-registration` edge function.
- Realtime read access for the dashboard is decided in Part 8.
