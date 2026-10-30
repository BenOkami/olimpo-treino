-- Olimpo · nuvem no Supabase
-- Cole tudo no SQL Editor do seu projeto Supabase e clique em "Run". Pode rodar mais de uma vez sem problema.

-- 1) Tabela única com todos os registros do app (treinos, corridas, corpo, recuperação, plano, perfil...)
create table if not exists public.records (
  user_id    uuid    not null default auth.uid() references auth.users (id) on delete cascade,
  store      text    not null,               -- sessions, body, recovery, reschedules ou kv
  id         text    not null,               -- id do registro no app
  data       jsonb,                          -- conteúdo do registro
  deleted    boolean not null default false, -- exclusões também sincronizam
  updated_at bigint  not null,               -- horário da última alteração no aparelho (ms)
  server_ts  timestamptz not null default now(), -- horário em que o servidor recebeu
  primary key (user_id, store, id)
);
create index if not exists records_sync_idx on public.records (user_id, server_ts);

-- 2) Cada pessoa só enxerga e altera os próprios dados
alter table public.records enable row level security;
drop policy if exists "records_select_own" on public.records;
drop policy if exists "records_insert_own" on public.records;
drop policy if exists "records_update_own" on public.records;
drop policy if exists "records_delete_own" on public.records;
create policy "records_select_own" on public.records for select using (auth.uid() = user_id);
create policy "records_insert_own" on public.records for insert with check (auth.uid() = user_id);
create policy "records_update_own" on public.records for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "records_delete_own" on public.records for delete using (auth.uid() = user_id);

-- 3) Uma alteração antiga nunca sobrescreve uma mais nova (ex.: celular que ficou dias offline)
create or replace function public.records_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return old;
  end if;
  new.server_ts := now();
  return new;
end $$;
drop trigger if exists records_guard on public.records;
create trigger records_guard before insert or update on public.records for each row execute function public.records_guard();

-- 4) Fotos de evolução em uma pasta privada por usuário
insert into storage.buckets (id, name, public) values ('photos', 'photos', false) on conflict (id) do nothing;
drop policy if exists "photos_select_own" on storage.objects;
drop policy if exists "photos_insert_own" on storage.objects;
drop policy if exists "photos_update_own" on storage.objects;
drop policy if exists "photos_delete_own" on storage.objects;
create policy "photos_select_own" on storage.objects for select using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos_insert_own" on storage.objects for insert with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos_update_own" on storage.objects for update using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos_delete_own" on storage.objects for delete using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
