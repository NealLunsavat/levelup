-- LevelUp sync table. Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Each row is one record (a log, quest, debt, setting...) belonging to the signed-in user.

create table if not exists public.levelup_records (
  user_id    uuid        not null default auth.uid() references auth.users on delete cascade,
  id         text        not null,
  data       jsonb       not null,
  updated_at bigint      not null,               -- when the record was last edited (device clock, ms)
  server_ts  timestamptz not null default now(), -- when the server last received it (used to pull changes)
  primary key (user_id, id)
);

create index if not exists levelup_records_pull on public.levelup_records (user_id, server_ts);

-- Only you can see or change your own rows.
grant select, insert, update, delete on public.levelup_records to authenticated;
alter table public.levelup_records enable row level security;

drop policy if exists "Own records only" on public.levelup_records;
create policy "Own records only" on public.levelup_records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Stamp server time on every write, and never let an older edit overwrite a newer one.
create or replace function public.levelup_touch() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null;
  end if;
  new.server_ts := now();
  return new;
end $$;

drop trigger if exists levelup_touch on public.levelup_records;
create trigger levelup_touch before insert or update on public.levelup_records
  for each row execute function public.levelup_touch();
