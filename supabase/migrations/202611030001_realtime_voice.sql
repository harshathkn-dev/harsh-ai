begin;

do $$
begin
  create type public.message_response_status as enum (
    'in_progress',
    'completed',
    'cancelled',
    'incomplete',
    'failed'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.realtime_connection_status as enum (
    'connecting',
    'connected',
    'ended',
    'failed'
  );
exception
  when duplicate_object then null;
end
$$;

alter table public.session_messages
  add column if not exists provider_item_id text,
  add column if not exists response_id text,
  add column if not exists response_status public.message_response_status
    not null default 'completed',
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  alter table public.session_messages
    add constraint session_messages_provider_item_unique
    unique (session_id, provider_item_id);
exception
  when duplicate_object then null;
end
$$;

create index if not exists session_messages_response_idx
  on public.session_messages(session_id, response_id)
  where response_id is not null;

drop trigger if exists session_messages_set_updated_at
  on public.session_messages;
create trigger session_messages_set_updated_at
before update on public.session_messages
for each row execute function public.set_updated_at();

create table if not exists public.realtime_connections (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_session_id text,
  model text not null,
  voice text not null,
  status public.realtime_connection_status not null default 'connecting',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  last_error_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (session_id, user_id)
    references public.sessions(id, user_id) on delete cascade,
  unique (id, user_id)
);

create index if not exists realtime_connections_user_started_idx
  on public.realtime_connections(user_id, started_at desc);
create index if not exists realtime_connections_session_started_idx
  on public.realtime_connections(session_id, started_at desc);
create unique index if not exists realtime_connections_one_live_per_session_idx
  on public.realtime_connections(session_id)
  where status in ('connecting', 'connected');

drop trigger if exists realtime_connections_set_updated_at
  on public.realtime_connections;
create trigger realtime_connections_set_updated_at
before update on public.realtime_connections
for each row execute function public.set_updated_at();

alter table public.realtime_connections enable row level security;

create policy "realtime_connections_select_own_or_admin"
on public.realtime_connections for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

grant select on public.realtime_connections to authenticated;

alter table public.usage_events
  drop constraint if exists usage_events_provider_request_unique;
alter table public.usage_events
  add constraint usage_events_provider_request_unique
  unique (user_id, provider, request_id);

commit;
