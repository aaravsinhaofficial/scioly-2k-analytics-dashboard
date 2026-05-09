-- SciOly 2K Analytics Dashboard
-- Run this in the Supabase SQL editor after creating a project.

create extension if not exists "pgcrypto";

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  email text unique not null,
  role text not null default 'viewer' check (role in ('viewer', 'officer', 'admin')),
  grade integer check (grade between 9 and 12),
  profile_picture_url text,
  ovr_rating numeric(5, 2) not null default 60.00,
  study_rating integer,
  build_rating integer,
  total_points integer not null default 0,
  prev_ovr numeric(5, 2) not null default 60.00,
  prev_avg_placement numeric(6, 2),
  last_snapshot_date timestamptz,
  created_at timestamptz not null default now()
);

alter table public.students
add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  school_name text not null,
  team_designation text not null,
  team_ovr numeric(5, 2) not null default 60.00,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  unique (school_name, team_designation)
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (team_id, student_id)
);

create table if not exists public.events (
  id serial primary key,
  name text unique not null,
  category text not null check (category in ('study', 'build'))
);

create table if not exists public.tournaments (
  id serial primary key,
  name text not null,
  date date not null,
  avg_scioly_elo numeric(8, 2) not null default 1000.00,
  sos_multiplier numeric(6, 2) not null default 1.00,
  benchmark_school text not null default 'Baseline School',
  benchmark_elo numeric(8, 2) not null default 1000.00,
  benchmark_source text not null default 'equivalent' check (benchmark_source in ('direct', 'equivalent')),
  relative_difficulty_multiplier numeric(6, 2) not null default 1.00,
  attending_schools jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (name, date)
);

create table if not exists public.performances (
  id serial primary key,
  student_id uuid not null references public.students(id) on delete cascade,
  tournament_id integer not null references public.tournaments(id) on delete cascade,
  event_id integer not null references public.events(id) on delete restrict,
  rank integer not null check (rank > 0),
  placement_score numeric(8, 2) not null,
  team_designation text not null default 'A',
  created_at timestamptz not null default now(),
  unique (student_id, tournament_id, event_id)
);

create table if not exists public.grind_points (
  id serial primary key,
  student_id uuid not null references public.students(id) on delete cascade,
  activity_type text not null,
  points integer not null check (points > 0),
  minutes integer not null default 0,
  quantity integer,
  is_approved boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references public.students(id),
  notes text
);

create table if not exists public.ovr_snapshots (
  id serial primary key,
  student_id uuid not null references public.students(id) on delete cascade,
  ovr_value numeric(5, 2) not null,
  total_points integer not null,
  avg_placement numeric(6, 2),
  recorded_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id serial primary key,
  actor_id uuid references public.students(id),
  action text not null,
  target text not null,
  reason text,
  ip_address inet,
  created_at timestamptz not null default now()
);

create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.system_settings (key, value)
values ('daily_point_log_limit', '10'::jsonb)
on conflict (key) do nothing;

create or replace function public.current_student_id()
returns uuid
language sql
stable
as $$
  select id
  from public.students
  where auth_user_id = auth.uid()
     or email = auth.jwt() ->> 'email'
  limit 1
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_name text;
  profile_grade integer;
begin
  profile_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    split_part(new.email, '@', 1),
    'New Student'
  );

  profile_grade := case
    when coalesce(new.raw_user_meta_data ->> 'grade', '') ~ '^\d+$'
      then (new.raw_user_meta_data ->> 'grade')::integer
    else null
  end;

  insert into public.students (
    auth_user_id,
    name,
    email,
    role,
    grade,
    ovr_rating,
    total_points,
    prev_ovr
  )
  values (
    new.id,
    profile_name,
    new.email,
    'viewer',
    profile_grade,
    60.00,
    0,
    60.00
  )
  on conflict (email) do update
  set auth_user_id = coalesce(public.students.auth_user_id, excluded.auth_user_id),
      name = coalesce(nullif(public.students.name, ''), excluded.name),
      grade = coalesce(public.students.grade, excluded.grade);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.current_student_role()
returns text
language sql
stable
as $$
  select coalesce(
    (select role from public.students where id = public.current_student_id()),
    'viewer'
  )
$$;

create or replace function public.is_officer_or_admin()
returns boolean
language sql
stable
as $$
  select public.current_student_role() in ('officer', 'admin')
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.current_student_role() = 'admin'
$$;

create or replace function public.calculate_student_ovr(target_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  approved_points integer;
  study numeric;
  build numeric;
  new_ovr numeric;
begin
  select coalesce(sum(points), 0)
  into approved_points
  from public.grind_points
  where student_id = target_student_id
    and is_approved = true
    and status = 'approved';

  select greatest(60, least(99, 55 + avg(p.placement_score) / 4 + least(4, count(*) * 0.45)))
  into study
  from public.performances p
  join public.events e on e.id = p.event_id
  where p.student_id = target_student_id
    and e.category = 'study';

  select greatest(60, least(99, 55 + avg(p.placement_score) / 4 + least(4, count(*) * 0.45)))
  into build
  from public.performances p
  join public.events e on e.id = p.event_id
  where p.student_id = target_student_id
    and e.category = 'build';

  if study is not null and build is not null then
    new_ovr := study * 0.4 + build * 0.4 + approved_points * 0.002;
  elsif study is not null then
    new_ovr := study * 0.8 + approved_points * 0.002;
  elsif build is not null then
    new_ovr := build * 0.8 + approved_points * 0.002;
  else
    new_ovr := 60 + approved_points * 0.01;
  end if;

  update public.students
  set
    study_rating = case when study is null then null else round(study)::integer end,
    build_rating = case when build is null then null else round(build)::integer end,
    total_points = approved_points,
    ovr_rating = greatest(60, least(99, round(new_ovr, 2)))
  where id = target_student_id;
end;
$$;

create or replace function public.recalculate_team_ovr(target_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  member_sum numeric;
  member_count integer;
  filler_count integer;
begin
  select coalesce(sum(ovr_rating), 0), count(*)
  into member_sum, member_count
  from (
    select s.ovr_rating
    from public.team_members tm
    join public.students s on s.id = tm.student_id
    where tm.team_id = target_team_id
    order by s.ovr_rating desc
    limit 15
  ) top_members;

  filler_count := greatest(0, 15 - member_count);

  update public.teams
  set team_ovr = round((member_sum + filler_count * 60) / 15, 2),
      version = version + 1
  where id = target_team_id;
end;
$$;

create or replace function public.recalculate_student_and_teams()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_student uuid;
  affected_team uuid;
begin
  affected_student := coalesce(new.student_id, old.student_id);
  perform public.calculate_student_ovr(affected_student);

  for affected_team in
    select team_id from public.team_members where student_id = affected_student
  loop
    perform public.recalculate_team_ovr(affected_team);
  end loop;

  return coalesce(new, old);
end;
$$;

create or replace function public.recalculate_team_after_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'DELETE' and new.team_id is not null then
    perform public.recalculate_team_ovr(new.team_id);
  end if;

  if tg_op <> 'INSERT'
    and old.team_id is not null
    and (tg_op = 'DELETE' or old.team_id is distinct from new.team_id)
  then
    perform public.recalculate_team_ovr(old.team_id);
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.enforce_daily_point_limit()
returns trigger
language plpgsql
as $$
declare
  daily_limit integer;
  submitted_count integer;
begin
  select coalesce((value #>> '{}')::integer, 10)
  into daily_limit
  from public.system_settings
  where key = 'daily_point_log_limit';

  select count(*)
  into submitted_count
  from public.grind_points
  where student_id = new.student_id
    and submitted_at >= date_trunc('day', now());

  if submitted_count >= daily_limit then
    raise exception 'Daily point log limit reached';
  end if;

  return new;
end;
$$;

create or replace function public.sync_grind_status()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'approved' then
    new.is_approved := true;
    new.approved_at := coalesce(new.approved_at, now());
  elsif new.status = 'rejected' then
    new.is_approved := false;
    new.approved_at := coalesce(new.approved_at, now());
  else
    new.is_approved := false;
  end if;

  return new;
end;
$$;

create or replace function public.create_weekly_ovr_snapshots()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  insert into public.ovr_snapshots (student_id, ovr_value, total_points, avg_placement, recorded_at)
  select
    s.id,
    s.ovr_rating,
    s.total_points,
    (
      select round(avg(p.rank), 2)
      from public.performances p
      where p.student_id = s.id
    ),
    now()
  from public.students s;

  get diagnostics inserted_count = row_count;

  update public.students s
  set prev_ovr = s.ovr_rating,
      prev_avg_placement = (
        select round(avg(p.rank), 2)
        from public.performances p
        where p.student_id = s.id
      ),
      last_snapshot_date = now();

  return inserted_count;
end;
$$;

drop trigger if exists trg_performance_recalculate_student on public.performances;
create trigger trg_performance_recalculate_student
after insert or update or delete on public.performances
for each row execute function public.recalculate_student_and_teams();

drop trigger if exists trg_grind_sync_status on public.grind_points;
create trigger trg_grind_sync_status
before insert or update on public.grind_points
for each row execute function public.sync_grind_status();

drop trigger if exists trg_grind_limit on public.grind_points;
create trigger trg_grind_limit
before insert on public.grind_points
for each row execute function public.enforce_daily_point_limit();

drop trigger if exists trg_grind_recalculate_student on public.grind_points;
create trigger trg_grind_recalculate_student
after insert or update or delete on public.grind_points
for each row execute function public.recalculate_student_and_teams();

drop trigger if exists trg_team_members_recalculate on public.team_members;
create trigger trg_team_members_recalculate
after insert or update or delete on public.team_members
for each row execute function public.recalculate_team_after_membership();

alter table public.students enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.events enable row level security;
alter table public.tournaments enable row level security;
alter table public.performances enable row level security;
alter table public.grind_points enable row level security;
alter table public.ovr_snapshots enable row level security;
alter table public.audit_logs enable row level security;
alter table public.system_settings enable row level security;

create policy "students_select_logged_in"
on public.students for select
to authenticated
using (true);

create policy "students_admin_write"
on public.students for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "teams_select_logged_in"
on public.teams for select
to authenticated
using (true);

create policy "teams_admin_write"
on public.teams for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "team_members_select_logged_in"
on public.team_members for select
to authenticated
using (true);

create policy "team_members_admin_write"
on public.team_members for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "events_select_logged_in"
on public.events for select
to authenticated
using (true);

create policy "events_officer_write"
on public.events for all
to authenticated
using (public.is_officer_or_admin())
with check (public.is_officer_or_admin());

create policy "tournaments_select_logged_in"
on public.tournaments for select
to authenticated
using (true);

create policy "tournaments_officer_insert"
on public.tournaments for insert
to authenticated
with check (public.is_officer_or_admin());

create policy "tournaments_admin_delete"
on public.tournaments for delete
to authenticated
using (public.is_admin());

create policy "performances_select_logged_in"
on public.performances for select
to authenticated
using (true);

create policy "performances_officer_write"
on public.performances for all
to authenticated
using (public.is_officer_or_admin())
with check (public.is_officer_or_admin());

create policy "grind_points_select_scope"
on public.grind_points for select
to authenticated
using (student_id = public.current_student_id() or public.is_officer_or_admin());

create policy "grind_points_insert_own"
on public.grind_points for insert
to authenticated
with check (student_id = public.current_student_id());

create policy "grind_points_officer_update"
on public.grind_points for update
to authenticated
using (public.is_officer_or_admin())
with check (public.is_officer_or_admin());

create policy "grind_points_admin_delete"
on public.grind_points for delete
to authenticated
using (public.is_admin());

create policy "snapshots_select_scope"
on public.ovr_snapshots for select
to authenticated
using (student_id = public.current_student_id() or public.is_officer_or_admin());

create policy "audit_admin_select"
on public.audit_logs for select
to authenticated
using (public.is_admin());

create policy "audit_service_insert"
on public.audit_logs for insert
to authenticated
with check (public.is_officer_or_admin());

create policy "settings_admin_all"
on public.system_settings for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create index if not exists idx_performances_student on public.performances(student_id);
create index if not exists idx_performances_tournament on public.performances(tournament_id);
create index if not exists idx_grind_points_student_status on public.grind_points(student_id, status);
create index if not exists idx_grind_points_submitted on public.grind_points(submitted_at);
create index if not exists idx_snapshots_student_recorded on public.ovr_snapshots(student_id, recorded_at);
