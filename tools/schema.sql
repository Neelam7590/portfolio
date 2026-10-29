-- Run this once in the Supabase SQL Editor.
-- It creates the messages table used by the admin inbox and the contact API.
-- The API inserts with the service_role key, so there is no public INSERT policy.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  source text not null default 'contact',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists messages_created_at_idx
  on public.messages (created_at desc);

create index if not exists messages_unread_idx
  on public.messages (is_read)
  where is_read = false;

alter table public.messages enable row level security;

drop policy if exists "Authenticated can read messages" on public.messages;
create policy "Authenticated can read messages"
  on public.messages
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated can update messages" on public.messages;
create policy "Authenticated can update messages"
  on public.messages
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated can delete messages" on public.messages;
create policy "Authenticated can delete messages"
  on public.messages
  for delete
  to authenticated
  using (true);
