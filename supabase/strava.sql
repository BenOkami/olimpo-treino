-- Olimpo · conexão com o Strava
-- Cole no SQL Editor do Supabase e clique em "Run". Pode rodar mais de uma vez.

-- Chaves de acesso ao Strava de cada usuário. Sem políticas de acesso: só a função "strava" (no servidor) lê e grava.
create table if not exists public.strava_tokens (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  athlete_id    bigint,
  athlete       jsonb,
  access_token  text   not null,
  refresh_token text   not null,
  expires_at    bigint not null,
  updated_at    timestamptz not null default now()
);
alter table public.strava_tokens enable row level security;

-- Código temporário que liga o retorno do Strava à conta que pediu a conexão
create table if not exists public.strava_oauth_state (
  nonce      text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.strava_oauth_state enable row level security;
