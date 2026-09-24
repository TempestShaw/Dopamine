-- Community app categories for Dopamine.
--
-- What is stored, and nothing else: an app's process name, the category a user picked for it, the
-- platform, and a random install id (so one install counts once). No window titles, no times, no
-- usage, no account. Clients only ever call the three functions below; the table itself is not
-- readable or writable from the public API.
--
-- The functions live in `public` so PostgREST exposes them as /rest/v1/rpc/*; the data lives in the
-- private `dopamine` schema, which is not exposed.

create schema if not exists dopamine;

create table if not exists dopamine.category_votes (
  install_id uuid not null,
  app text not null check (char_length(app) between 1 and 120),
  platform text not null check (platform in ('mac', 'windows')),
  category text not null check (category in ('work', 'study', 'social', 'entertainment', 'other')),
  updated_at timestamptz not null default now(),
  primary key (install_id, app, platform)
);

create index if not exists category_votes_app_idx on dopamine.category_votes (platform, app);

alter table dopamine.category_votes enable row level security; -- no policies: no direct access

revoke all on schema dopamine from public, anon, authenticated;
revoke all on all tables in schema dopamine from public, anon, authenticated;

-- Record (or change) one install's choice for one app.
create or replace function public.dopamine_vote(p_install uuid, p_app text, p_platform text, p_category text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Keep a single install from flooding the table.
  if (select count(*) from dopamine.category_votes where install_id = p_install) >= 500
     and not exists (select 1 from dopamine.category_votes where install_id = p_install and app = p_app and platform = p_platform) then
    raise exception 'too many votes from this install';
  end if;

  insert into dopamine.category_votes (install_id, app, platform, category)
  values (p_install, left(trim(p_app), 120), p_platform, p_category)
  on conflict (install_id, app, platform)
  do update set category = excluded.category, updated_at = now();
end;
$$;

-- Take back a choice (the user went back to automatic).
create or replace function public.dopamine_unvote(p_install uuid, p_app text, p_platform text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from dopamine.category_votes where install_id = p_install and app = p_app and platform = p_platform;
$$;

-- Categories the community agrees on: at least `min_voters` installs and a clear majority.
create or replace function public.dopamine_community_categories(p_platform text, min_voters int default 5, min_share real default 0.7)
returns table (app text, category text, voters bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with tallies as (
    select v.app, v.category, count(*) as n, sum(count(*)) over (partition by v.app) as total
    from dopamine.category_votes v
    where v.platform = p_platform
    group by v.app, v.category
  )
  select t.app, t.category, t.total
  from tallies t
  where t.total >= greatest(min_voters, 3) and t.n::real / t.total >= greatest(min_share, 0.6);
$$;

revoke all on function public.dopamine_vote(uuid, text, text, text) from public;
revoke all on function public.dopamine_unvote(uuid, text, text) from public;
revoke all on function public.dopamine_community_categories(text, int, real) from public;
grant execute on function public.dopamine_vote(uuid, text, text, text) to anon;
grant execute on function public.dopamine_unvote(uuid, text, text) to anon;
grant execute on function public.dopamine_community_categories(text, int, real) to anon;
