-- Cache de 6h por Riot ID. Stats de ranqueada nao mudam de minuto em minuto
-- e isso reduz drasticamente o risco de bloqueio pelo Cloudflare.
create table public.tracker_cache (
  riot_id     text primary key,
  payload      jsonb not null,
  score        int,
  score_origem text check (score_origem in ('html','estimado','rank')),
  fetched_at   timestamptz not null default now()
);

create index tracker_cache_fetched_idx on public.tracker_cache (fetched_at desc);

alter table public.tracker_cache enable row level security;
-- sem policy: so service_role acessa
