-- York Drop & Add — Supabase schema

create extension if not exists pgcrypto;

-- ============================================================
-- 1. profiles — one row per signed-up student, public-safe display name
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are publicly readable"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Auto-create a profile (display name = email prefix) whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, initcap(split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 2. YorkU email guard — reused by every write policy below
-- ============================================================
create or replace function public.is_yorku_email()
returns boolean
language sql
stable
as $$
  select coalesce(
    (auth.jwt() ->> 'email') ~* '^[^@]+@(my\.)?yorku\.ca$',
    false
  );
$$;

-- ============================================================
-- 3. listings — "dropping" / "needed" posts
-- ============================================================
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('dropping', 'needed')),
  subject text not null,
  course_number text not null,
  section text,
  term text not null,
  campus text not null,
  note text,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

alter table public.listings enable row level security;

create policy "listings are publicly readable"
  on public.listings for select
  to anon, authenticated
  using (true);

create policy "yorku users can post their own listings"
  on public.listings for insert
  to authenticated
  with check (user_id = auth.uid() and public.is_yorku_email());

create policy "owners can update or close their own listings"
  on public.listings for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "owners can delete their own listings"
  on public.listings for delete
  to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- 4. conversations — one thread between two students about one listing
-- ============================================================
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete set null,
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint different_participants check (user_a <> user_b)
);

alter table public.conversations enable row level security;

create policy "participants can read their conversations"
  on public.conversations for select
  to authenticated
  using (auth.uid() in (user_a, user_b));

create policy "yorku users can start a conversation they're part of"
  on public.conversations for insert
  to authenticated
  with check (auth.uid() in (user_a, user_b) and public.is_yorku_email());

-- ============================================================
-- 5. messages — chat within a conversation
-- ============================================================
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "participants can read messages in their conversations"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and auth.uid() in (c.user_a, c.user_b)
    )
  );

create policy "participants can send messages in their conversations"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_yorku_email()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and auth.uid() in (c.user_a, c.user_b)
    )
  );

-- ============================================================
-- 6. Realtime — let the DM view subscribe to new messages live
-- ============================================================
alter publication supabase_realtime add table public.messages;
