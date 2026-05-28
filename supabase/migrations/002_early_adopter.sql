alter table public.profiles
  add column if not exists early_adopter boolean not null default false;

create or replace function public.set_early_adopter()
returns trigger
language plpgsql
as $$
declare
  completed_count integer;
begin
  if new.onboarding_complete is true and (
    tg_op = 'INSERT' or coalesce(old.onboarding_complete, false) is false
  ) then
    select count(*)
    into completed_count
    from public.profiles
    where onboarding_complete is true
      and id <> new.id;

    if completed_count < 1000 then
      new.early_adopter = true;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_set_early_adopter on public.profiles;

create trigger profiles_set_early_adopter
  before insert or update of onboarding_complete on public.profiles
  for each row
  execute function public.set_early_adopter();

create table if not exists public.inbox_messages (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  sender_name text not null,
  sender_avatar text,
  message_type text not null default 'system',
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  unique (recipient_id, message_type)
);

alter table public.inbox_messages enable row level security;

drop policy if exists "inbox_messages_select_own" on public.inbox_messages;
drop policy if exists "inbox_messages_insert_own" on public.inbox_messages;
drop policy if exists "inbox_messages_update_own" on public.inbox_messages;

create policy "inbox_messages_select_own"
  on public.inbox_messages
  for select
  to authenticated
  using (auth.uid() = recipient_id);

create policy "inbox_messages_insert_own"
  on public.inbox_messages
  for insert
  to authenticated
  with check (auth.uid() = recipient_id);

create policy "inbox_messages_update_own"
  on public.inbox_messages
  for update
  to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);
