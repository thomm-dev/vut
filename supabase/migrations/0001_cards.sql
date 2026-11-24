-- VUT · cartas. Um Riot ID gera uma carta por serie.
create table public.cards (
  slug           text primary key,
  riot_id        text not null,
  -- chave canonica: o display preserva o original, a busca usa esta
  riot_key       text generated always as (lower(riot_id)) stored,
  nick           text not null,
  tag            text not null,
  pais           text,
  tipo           text not null check (tipo in ('tracker','manual','pro')),
  rank_nome      text,
  rank_icon      text,
  peak_nome      text,
  peak_icon      text,
  time_logo      text,
  tracker_score  int,
  -- 'rank': overall derivado do rank + desempenho nas ultimas partidas
  score_origem   text check (score_origem in ('html','estimado','rank')),
  agente         text,
  agente_icon    text,
  agente_hero    text,
  agente_role    text,
  -- atleta de capa escolhido pelo dono; null = sorteado pelo Riot ID
  atleta         int,
  overall        int  not null check (overall between 40 and 99),
  percentil      numeric(5,2),
  tier           text not null,
  -- valor + percentil de cada stat: o percentil alimenta a letra S/A/B/C/D
  rw numeric, rw_p int,
  kast numeric, kast_p int,
  acs numeric, acs_p int,
  dd numeric, dd_p int,
  partidas       int  not null default 0,
  temporada      text,
  serie          int  not null default 1,
  serial_num     bigint generated always as identity,
  ip_hash        text,
  created_at     timestamptz not null default now()
);

-- Buscar de novo atualiza a carta existente em vez de criar outra:
-- preserva o link ja compartilhado.
create unique index cards_riot_serie on public.cards (riot_key, serie);
create index cards_created_idx on public.cards (created_at desc);
-- rate limit por ip_hash na ultima hora
create index cards_ip_recentes_idx on public.cards (ip_hash, created_at desc);

alter table public.cards enable row level security;
create policy "cards_public_read" on public.cards
  for select to anon, authenticated using (true);
revoke insert, update, delete on public.cards from anon, authenticated;
