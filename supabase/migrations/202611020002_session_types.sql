begin;

do $$
begin
  create type public.session_type as enum ('interview', 'meeting', 'general');
exception
  when duplicate_object then null;
end
$$;

alter table public.sessions
  add column if not exists session_type public.session_type
  not null default 'general';

do $$
begin
  alter table public.sessions
    add constraint sessions_title_length_check
    check (char_length(trim(title)) between 1 and 120);
exception
  when duplicate_object then null;
end
$$;

create index if not exists sessions_user_type_created_idx
  on public.sessions(user_id, session_type, created_at desc);

create or replace function public.enforce_session_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = new.status then
    if new.started_at is distinct from old.started_at
      or new.ended_at is distinct from old.ended_at then
      raise exception 'Session lifecycle timestamps cannot be changed directly';
    end if;
    return new;
  end if;

  if old.status = 'draft' and new.status = 'active' then
    if new.started_at is null or new.ended_at is not null then
      raise exception 'Starting a session requires a start time and no end time';
    end if;
    return new;
  end if;

  if old.status = 'active' and new.status = 'completed' then
    if new.started_at is distinct from old.started_at
      or old.started_at is null
      or new.ended_at is null
      or new.ended_at < old.started_at then
      raise exception 'Completing a session requires a valid end time';
    end if;
    return new;
  end if;

  if old.status = 'completed' and new.status = 'archived' then
    if new.started_at is distinct from old.started_at
      or new.ended_at is distinct from old.ended_at then
      raise exception 'Archiving cannot change lifecycle timestamps';
    end if;
    return new;
  end if;

  raise exception 'Invalid session status transition from % to %',
    old.status, new.status;
end;
$$;

drop trigger if exists sessions_enforce_lifecycle on public.sessions;
create trigger sessions_enforce_lifecycle
before update on public.sessions
for each row execute function public.enforce_session_lifecycle();

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'image/jpeg',
  'image/png',
  'image/webp'
]
where id in ('user-documents', 'resumes');

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/webp',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/webm',
  'audio/ogg',
  'video/webm'
]
where id = 'session-attachments';

commit;
