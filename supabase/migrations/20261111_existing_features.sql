-- Add the database objects required by merged PR #8 to an existing SciOly Tracker.
-- Run in the Supabase SQL editor as the project database owner, before deploying
-- the matching application release. The existing pre-PR8 schema must be present.
-- This migration does not update/delete students, teams, point logs, test results,
-- or performances. Legal acceptance columns remain NULL for existing accounts.
-- The only data writes are private storage-bucket configuration and an idempotent
-- publication-log backfill for any flashcard decks already present.
-- Existing evidence objects are not deleted or moved.

begin;

do $$
begin
  if to_regclass('public.students') is null
     or to_regclass('public.grind_points') is null then
    raise exception 'Existing SciOly Tracker schema is required before this migration.';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'grind_points'
      and column_name = 'metadata' and data_type = 'jsonb'
  ) then
    raise exception 'The pre-PR8 grind_points.metadata jsonb column is required.';
  end if;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'point-evidence',
  'point-evidence',
  false,
  15728640,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
    'application/pdf',
    'video/mp4', 'video/quicktime', 'video/webm',
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm'
  ]::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.students add column if not exists terms_accepted_at timestamptz;
alter table public.students add column if not exists privacy_acknowledged_at timestamptz;
alter table public.students add column if not exists legal_version text;

-- Team-created flashcards. Members use authenticated route handlers; direct
-- REST access stays closed so author IDs and individual votes are not exposed.
create table if not exists public.flashcard_decks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 120),
  description text not null default '' check (length(description) <= 600),
  event_name text not null check (length(btrim(event_name)) between 1 and 120),
  author_id uuid not null references public.students(id) on delete restrict,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.flashcards (
  id bigserial primary key,
  deck_id uuid not null references public.flashcard_decks(id) on delete cascade,
  front text not null check (length(btrim(front)) between 1 and 1000),
  back text not null check (length(btrim(back)) between 1 and 5000),
  position integer not null check (position between 0 and 199),
  created_at timestamptz not null default now(),
  unique (deck_id, position)
);

create table if not exists public.flashcard_votes (
  deck_id uuid not null references public.flashcard_decks(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (deck_id, student_id)
);

create index if not exists flashcard_decks_published_created_idx
on public.flashcard_decks (is_published, created_at desc);

create index if not exists flashcards_deck_position_idx
on public.flashcards (deck_id, position);

create index if not exists flashcard_votes_deck_idx
on public.flashcard_votes (deck_id);

-- Publication attempts remain after a deck is removed so the rolling limit
-- cannot be reset by deleting and recreating decks.
create table if not exists public.flashcard_publication_log (
  id bigserial primary key,
  author_id uuid not null references public.students(id) on delete cascade,
  deck_id uuid references public.flashcard_decks(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists flashcard_publication_log_author_created_idx
on public.flashcard_publication_log (author_id, created_at desc);

create unique index if not exists flashcard_publication_log_deck_idx
on public.flashcard_publication_log (deck_id)
where deck_id is not null;

insert into public.flashcard_publication_log (author_id, deck_id, created_at)
select deck.author_id, deck.id, deck.created_at
from public.flashcard_decks deck
where not exists (
  select 1 from public.flashcard_publication_log publication where publication.deck_id = deck.id
)
on conflict do nothing;

-- Durable upload tickets provide a per-member quota and give the cleanup job
-- a complete list of staged objects that were never attached to a point log.
create table if not exists public.point_evidence_upload_tickets (
  id uuid primary key,
  batch_id uuid not null,
  student_id uuid not null references public.students(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null check (length(original_name) between 1 and 180),
  mime_type text not null check (length(mime_type) between 1 and 100),
  size_bytes bigint not null check (size_bytes between 1 and 15728640),
  status text not null default 'reserved'
    check (status in ('reserved', 'attaching', 'attached', 'cleanup_pending', 'expired', 'deleted')),
  claim_id uuid,
  claimed_at timestamptz,
  attached_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists point_evidence_tickets_student_created_idx
on public.point_evidence_upload_tickets (student_id, created_at desc);

create index if not exists point_evidence_tickets_cleanup_idx
on public.point_evidence_upload_tickets (status, created_at);

create or replace function public.publish_flashcard_deck(
  p_author_id uuid,
  p_title text,
  p_description text,
  p_event_name text,
  p_cards jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_deck public.flashcard_decks%rowtype;
begin
  if jsonb_typeof(p_cards) is distinct from 'array'
     or jsonb_array_length(p_cards) < 2
     or jsonb_array_length(p_cards) > 200 then
    raise exception 'INVALID_FLASHCARD_DECK';
  end if;

  -- Serialize publications for one author so concurrent requests share the
  -- same rolling-window count.
  perform pg_advisory_xact_lock(hashtextextended('flashcard-publish:' || p_author_id::text, 0));

  if (
    select count(*)
    from public.flashcard_publication_log publication
    where publication.author_id = p_author_id
      and publication.created_at >= now() - interval '24 hours'
  ) >= 10 then
    raise exception 'FLASHCARD_DECK_LIMIT';
  end if;

  insert into public.flashcard_decks (title, description, event_name, author_id, is_published)
  values (p_title, p_description, p_event_name, p_author_id, true)
  returning * into new_deck;

  insert into public.flashcards (deck_id, front, back, position)
  select new_deck.id, card.front, card.back, card.position
  from jsonb_to_recordset(p_cards) as card(front text, back text, position integer);

  insert into public.flashcard_publication_log (author_id, deck_id)
  values (p_author_id, new_deck.id);

  return jsonb_build_object(
    'id', new_deck.id,
    'title', new_deck.title,
    'description', new_deck.description,
    'eventName', new_deck.event_name,
    'createdAt', new_deck.created_at
  );
end;
$$;

create or replace function public.flashcard_deck_card_counts(p_deck_ids uuid[])
returns table(deck_id uuid, card_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select card.deck_id, count(*)::bigint
  from public.flashcards card
  where card.deck_id = any(coalesce(p_deck_ids, array[]::uuid[]))
  group by card.deck_id;
$$;

create or replace function public.reserve_point_evidence_uploads(
  p_student_id uuid,
  p_batch_id uuid,
  p_uploads jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_count integer;
  requested_bytes bigint;
  recent_count bigint;
  recent_bytes bigint;
  inserted_count integer;
begin
  if jsonb_typeof(p_uploads) is distinct from 'array' then
    raise exception 'INVALID_EVIDENCE_TICKETS';
  end if;

  requested_count := jsonb_array_length(p_uploads);
  if requested_count < 1 or requested_count > 5 then
    raise exception 'INVALID_EVIDENCE_TICKETS';
  end if;

  if (
    select count(distinct upload.item->>'storagePath')
    from jsonb_array_elements(p_uploads) upload(item)
  ) <> requested_count then
    raise exception 'INVALID_EVIDENCE_TICKETS';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_uploads) upload(item)
    where coalesce(upload.item->>'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or position(p_student_id::text || '/' || p_batch_id::text || '/' in coalesce(upload.item->>'storagePath', '')) <> 1
      or length(coalesce(upload.item->>'name', '')) not between 1 and 180
      or length(coalesce(upload.item->>'mimeType', '')) not between 1 and 100
      or case
        when coalesce(upload.item->>'sizeBytes', '') ~ '^[0-9]+$'
          then (upload.item->>'sizeBytes')::bigint not between 1 and 15728640
        else true
      end
  ) then
    raise exception 'INVALID_EVIDENCE_TICKETS';
  end if;

  select coalesce(sum((upload.item->>'sizeBytes')::bigint), 0)
  into requested_bytes
  from jsonb_array_elements(p_uploads) upload(item);

  perform pg_advisory_xact_lock(hashtextextended('point-evidence:' || p_student_id::text, 0));

  select count(*), coalesce(sum(ticket.size_bytes), 0)
  into recent_count, recent_bytes
  from public.point_evidence_upload_tickets ticket
  where ticket.student_id = p_student_id
    and ticket.created_at >= now() - interval '24 hours';

  if recent_count + requested_count > 50
     or recent_bytes + requested_bytes > 524288000 then
    raise exception 'POINT_EVIDENCE_UPLOAD_LIMIT';
  end if;

  insert into public.point_evidence_upload_tickets (
    id,
    batch_id,
    student_id,
    storage_path,
    original_name,
    mime_type,
    size_bytes
  )
  select
    (upload.item->>'id')::uuid,
    p_batch_id,
    p_student_id,
    upload.item->>'storagePath',
    upload.item->>'name',
    upload.item->>'mimeType',
    (upload.item->>'sizeBytes')::bigint
  from jsonb_array_elements(p_uploads) upload(item);

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.claim_stale_point_evidence_uploads(
  p_before timestamptz,
  p_limit integer default 200
)
returns table(ticket_id uuid, storage_path text)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Recover from a process that inserted the point log but stopped before it
  -- finalized the ticket state. Referenced objects must never be swept.
  update public.point_evidence_upload_tickets ticket
  set status = 'attached',
      attached_at = coalesce(ticket.attached_at, now()),
      claim_id = null,
      claimed_at = null
  where ticket.status in ('reserved', 'attaching', 'cleanup_pending')
    and exists (
      select 1
      from public.grind_points point,
      lateral jsonb_array_elements(
        case
          when jsonb_typeof(point.metadata->'evidence') = 'array' then point.metadata->'evidence'
          else '[]'::jsonb
        end
      ) evidence(item)
      where evidence.item->>'kind' = 'file'
        and evidence.item->>'storagePath' = ticket.storage_path
    );

  return query
  with candidates as (
    select ticket.id
    from public.point_evidence_upload_tickets ticket
    where (
      ticket.status = 'reserved' and ticket.created_at < p_before
    ) or (
      ticket.status = 'attaching' and coalesce(ticket.claimed_at, ticket.created_at) < p_before
    ) or (
      ticket.status = 'cleanup_pending'
      and coalesce(ticket.claimed_at, ticket.created_at) < now() - interval '30 minutes'
    )
    order by ticket.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 200), 500))
  ), claimed as (
    update public.point_evidence_upload_tickets ticket
    set status = 'cleanup_pending',
        claim_id = null,
        claimed_at = now()
    from candidates candidate
    where ticket.id = candidate.id
    returning ticket.id, ticket.storage_path
  )
  select claimed.id, claimed.storage_path from claimed;
end;
$$;

create or replace function public.prevent_evidenced_point_reassignment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.student_id is distinct from old.student_id
     and (case
       when jsonb_typeof(old.metadata->'evidence') = 'array'
         then jsonb_array_length(old.metadata->'evidence') > 0
       else false
     end) then
    raise exception 'POINT_EVIDENCE_OWNER_IMMUTABLE';
  end if;
  return new;
end;
$$;

-- New RPCs are callable only by server-side service-role clients.
revoke all on function public.publish_flashcard_deck(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.flashcard_deck_card_counts(uuid[]) from public, anon, authenticated;
revoke all on function public.reserve_point_evidence_uploads(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.claim_stale_point_evidence_uploads(timestamptz, integer) from public, anon, authenticated;
revoke all on function public.prevent_evidenced_point_reassignment() from public, anon, authenticated;
grant execute on function public.publish_flashcard_deck(uuid, text, text, text, jsonb) to service_role;
grant execute on function public.flashcard_deck_card_counts(uuid[]) to service_role;
grant execute on function public.reserve_point_evidence_uploads(uuid, uuid, jsonb) to service_role;
grant execute on function public.claim_stale_point_evidence_uploads(timestamptz, integer) to service_role;

drop trigger if exists trg_grind_evidence_owner on public.grind_points;
create trigger trg_grind_evidence_owner
before update of student_id on public.grind_points
for each row execute function public.prevent_evidenced_point_reassignment();

alter table public.flashcard_decks enable row level security;
alter table public.flashcards enable row level security;
alter table public.flashcard_votes enable row level security;
alter table public.flashcard_publication_log enable row level security;
alter table public.point_evidence_upload_tickets enable row level security;

commit;

-- Read-only post-migration verification (run separately if desired):
-- 1. Three nullable legal-record columns; existing acceptance is not fabricated.
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'students'
--   and column_name in ('terms_accepted_at', 'privacy_acknowledged_at', 'legal_version');
--
-- 2. All five new tables must show relrowsecurity = true.
-- select relname, relrowsecurity from pg_class
-- where relnamespace = 'public'::regnamespace
--   and relname in ('flashcard_decks', 'flashcards', 'flashcard_votes',
--                   'flashcard_publication_log', 'point_evidence_upload_tickets');
--
-- 3. These API-only tables should have no member-facing policies.
-- select tablename, policyname, roles, cmd from pg_policies
-- where schemaname = 'public'
--   and tablename in ('flashcard_decks', 'flashcards', 'flashcard_votes',
--                     'flashcard_publication_log', 'point_evidence_upload_tickets');
--
-- 4. Each RPC must be executable by service_role, not anon/authenticated.
-- select p.proname,
--   has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute,
--   has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
--   has_function_privilege('authenticated', p.oid, 'EXECUTE') as member_can_execute
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in ('publish_flashcard_deck', 'flashcard_deck_card_counts',
--                    'reserve_point_evidence_uploads', 'claim_stale_point_evidence_uploads');
--
-- 5. Private bucket, 15 MiB limit, and intended evidence-owner guard.
-- select id, public, file_size_limit, allowed_mime_types from storage.buckets
-- where id = 'point-evidence';
-- select tgname, pg_get_triggerdef(oid) from pg_trigger
-- where tgrelid = 'public.grind_points'::regclass and tgname = 'trg_grind_evidence_owner';
--
-- Deployment prerequisite outside SQL: set a nonempty CRON_SECRET in Vercel
-- production before enabling the scheduled evidence-cleanup route. Verify the
-- production deployment uses the intended Git commit and custom domain. Smoke-test
-- signup/Google legal acceptance, flashcard create/read/vote/delete, evidence
-- upload/view ownership, and the authenticated cleanup route after deployment.
