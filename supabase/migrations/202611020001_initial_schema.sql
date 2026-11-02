begin;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;

create type public.app_role as enum ('user', 'admin');
create type public.session_status as enum ('draft', 'active', 'completed', 'archived');
create type public.message_role as enum ('user', 'assistant', 'system', 'tool');
create type public.processing_status as enum ('pending', 'processing', 'ready', 'failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_email_lower_idx on public.profiles (lower(email));

create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'user',
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index user_roles_role_idx on public.user_roles(role);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled session',
  status public.session_status not null default 'draft',
  started_at timestamptz,
  ended_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint sessions_dates_check check (
    ended_at is null or started_at is null or ended_at >= started_at
  )
);

create index sessions_user_created_idx
  on public.sessions(user_id, created_at desc);
create index sessions_user_status_idx
  on public.sessions(user_id, status);

create table public.session_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.message_role not null,
  content text not null,
  model text,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  estimated_cost_usd numeric(12, 8) not null default 0 check (estimated_cost_usd >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (session_id, user_id)
    references public.sessions(id, user_id) on delete cascade
);

create index session_messages_session_created_idx
  on public.session_messages(session_id, created_at);
create index session_messages_user_created_idx
  on public.session_messages(user_id, created_at desc);

create table public.transcripts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text,
  language text,
  duration_seconds numeric(12, 3) not null default 0 check (duration_seconds >= 0),
  transcript_text text,
  status public.processing_status not null default 'pending',
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (session_id, user_id)
    references public.sessions(id, user_id) on delete cascade
);

create index transcripts_session_idx on public.transcripts(session_id, created_at desc);
create index transcripts_user_idx on public.transcripts(user_id, created_at desc);

create table public.ai_notes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  note_type text not null default 'general',
  title text,
  content text not null,
  model text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (session_id, user_id)
    references public.sessions(id, user_id) on delete cascade
);

create index ai_notes_session_idx on public.ai_notes(session_id, created_at desc);
create index ai_notes_user_idx on public.ai_notes(user_id, created_at desc);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket_id text not null check (
    bucket_id in ('user-documents', 'resumes', 'session-attachments')
  ),
  storage_path text not null,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  status public.processing_status not null default 'pending',
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket_id, storage_path),
  unique (id, user_id)
);

create index documents_user_created_idx on public.documents(user_id, created_at desc);
create index documents_user_status_idx on public.documents(user_id, status);

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null,
  token_count integer not null default 0 check (token_count >= 0),
  embedding extensions.vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (document_id, user_id)
    references public.documents(id, user_id) on delete cascade,
  unique (document_id, chunk_index)
);

create index document_chunks_document_idx
  on public.document_chunks(document_id, chunk_index);
create index document_chunks_user_idx on public.document_chunks(user_id);
create index document_chunks_embedding_idx
  on public.document_chunks
  using hnsw (embedding vector_cosine_ops)
  where embedding is not null;

create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  feature text not null,
  provider text not null default 'openai',
  model text not null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  audio_seconds numeric(12, 3) not null default 0 check (audio_seconds >= 0),
  estimated_cost_usd numeric(12, 8) not null default 0 check (estimated_cost_usd >= 0),
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index usage_events_user_created_idx
  on public.usage_events(user_id, created_at desc);
create index usage_events_session_idx
  on public.usage_events(session_id, created_at desc);

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'Asia/Kolkata',
  email_notifications boolean not null default true,
  session_completion_email boolean not null default true,
  preferred_answer_mode text not null default 'concise',
  ai_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger user_roles_set_updated_at
before update on public.user_roles
for each row execute function public.set_updated_at();

create trigger sessions_set_updated_at
before update on public.sessions
for each row execute function public.set_updated_at();

create trigger transcripts_set_updated_at
before update on public.transcripts
for each row execute function public.set_updated_at();

create trigger ai_notes_set_updated_at
before update on public.ai_notes
for each row execute function public.set_updated_at();

create trigger documents_set_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

create trigger user_settings_set_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );

  insert into public.user_roles (user_id, role)
  values (new.id, 'user');

  insert into public.user_settings (user_id)
  values (new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.sessions enable row level security;
alter table public.session_messages enable row level security;
alter table public.transcripts enable row level security;
alter table public.ai_notes enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.usage_events enable row level security;
alter table public.user_settings enable row level security;

create policy "profiles_select_own_or_admin"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

create policy "profiles_update_own_or_admin"
on public.profiles for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

create policy "roles_select_own_or_admin"
on public.user_roles for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "sessions_select_own_or_admin"
on public.sessions for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "sessions_insert_own"
on public.sessions for insert
to authenticated
with check (user_id = auth.uid());

create policy "sessions_update_own"
on public.sessions for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "sessions_delete_own"
on public.sessions for delete
to authenticated
using (user_id = auth.uid());

create policy "messages_select_own_or_admin"
on public.session_messages for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "messages_insert_own_user_messages"
on public.session_messages for insert
to authenticated
with check (user_id = auth.uid() and role = 'user');

create policy "transcripts_select_own_or_admin"
on public.transcripts for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "notes_select_own_or_admin"
on public.ai_notes for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "notes_update_own"
on public.ai_notes for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "notes_delete_own"
on public.ai_notes for delete
to authenticated
using (user_id = auth.uid());

create policy "documents_select_own_or_admin"
on public.documents for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "documents_insert_own"
on public.documents for insert
to authenticated
with check (user_id = auth.uid());

create policy "documents_update_own"
on public.documents for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "documents_delete_own"
on public.documents for delete
to authenticated
using (user_id = auth.uid());

create policy "chunks_select_own_or_admin"
on public.document_chunks for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "usage_select_own_or_admin"
on public.usage_events for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "settings_select_own_or_admin"
on public.user_settings for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "settings_update_own"
on public.user_settings for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
grant select, insert, update, delete on public.sessions to authenticated;
grant select, insert on public.session_messages to authenticated;
grant select on public.transcripts to authenticated;
grant select, update, delete on public.ai_notes to authenticated;
grant select, insert, update, delete on public.documents to authenticated;
grant select on public.document_chunks to authenticated;
grant select on public.usage_events to authenticated;
grant select, update on public.user_settings to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('user-documents', 'user-documents', false, 10485760),
  ('resumes', 'resumes', false, 10485760),
  ('session-attachments', 'session-attachments', false, 10485760)
on conflict (id) do update
set public = false, file_size_limit = excluded.file_size_limit;

create policy "storage_select_own_or_admin"
on storage.objects for select
to authenticated
using (
  bucket_id in ('user-documents', 'resumes', 'session-attachments')
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

create policy "storage_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id in ('user-documents', 'resumes', 'session-attachments')
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "storage_update_own"
on storage.objects for update
to authenticated
using (
  bucket_id in ('user-documents', 'resumes', 'session-attachments')
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id in ('user-documents', 'resumes', 'session-attachments')
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "storage_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id in ('user-documents', 'resumes', 'session-attachments')
  and (storage.foldername(name))[1] = auth.uid()::text
);

create or replace function public.match_document_chunks(
  query_embedding extensions.vector(1536),
  match_count integer default 8
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity double precision
)
language sql
stable
set search_path = 'public', 'extensions'
as $$
  select
    dc.id,
    dc.document_id,
    dc.content,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  where dc.user_id = auth.uid()
    and dc.embedding is not null
  order by dc.embedding <=> query_embedding
  limit greatest(1, least(match_count, 20));
$$;

revoke all on function public.match_document_chunks(extensions.vector, integer)
from public;
grant execute on function public.match_document_chunks(extensions.vector, integer)
to authenticated;

create or replace function public.bootstrap_initial_admin()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
begin
  if exists (
    select 1 from public.user_roles where role = 'admin'
  ) then
    raise exception 'An administrator already exists';
  end if;

  select id into target_user_id
  from auth.users
  where lower(email) = 'harshath.kn2911@gmail.com'
    and email_confirmed_at is not null
  limit 1;

  if target_user_id is null then
    raise exception 'The initial administrator must register and verify the configured email first';
  end if;

  insert into public.user_roles (user_id, role, assigned_by)
  values (target_user_id, 'admin', target_user_id)
  on conflict (user_id) do update
  set role = 'admin',
      assigned_by = target_user_id,
      updated_at = now();

  return target_user_id;
end;
$$;

revoke all on function public.bootstrap_initial_admin() from public, anon, authenticated;
grant execute on function public.bootstrap_initial_admin() to service_role;

commit;
