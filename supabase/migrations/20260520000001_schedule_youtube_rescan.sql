-- Phase 3 — Schedule the weekly YouTube link-health rescan (D-11..D-14).
-- Sundays at 04:00 UTC — just after the daily YouTube quota reset.
--
-- This uses pg_cron + pg_net (both standard Supabase extensions) to POST to
-- the youtube-rescan-weekly edge function. Idempotent: safe to re-run.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Drop any prior schedule so re-running the migration doesn't duplicate jobs.
do $$
declare
  jobid integer;
begin
  for jobid in
    select jobid from cron.job where jobname = 'youtube-rescan-weekly'
  loop
    perform cron.unschedule(jobid);
  end loop;
end $$;

select
  cron.schedule(
    'youtube-rescan-weekly',
    '0 4 * * 0',
    $cron$
    select
      net.http_post(
        url := current_setting('app.supabase_functions_url', true) || '/youtube-rescan-weekly',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        ),
        body := '{}'::jsonb
      ) as request_id;
    $cron$
  );

-- NOTE: For the schedule to actually fire, the following settings must be set
-- on the Supabase project (run as a Postgres superuser; do this in the Supabase
-- dashboard SQL editor, not in a migration, to avoid leaking the service key
-- into git history):
--
--   alter database postgres set app.supabase_functions_url
--     = 'https://<project-ref>.functions.supabase.co';
--   alter database postgres set app.service_role_key
--     = '<service_role_key>';
--
-- Without these, the cron job no-ops gracefully.
