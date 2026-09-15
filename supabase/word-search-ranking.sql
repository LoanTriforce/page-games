create extension if not exists pgcrypto;

create table if not exists public.word_search_rankings (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(btrim(nome)) between 1 and 40),
  palavras_encontradas integer not null check (palavras_encontradas between 0 and 6),
  tempo_total_ms integer not null check (tempo_total_ms between 0 and 45000),
  data_inicio timestamptz not null,
  data_finalizacao timestamptz not null,
  criado_em timestamptz not null default now(),
  check (data_finalizacao >= data_inicio)
);

create index if not exists word_search_rankings_order_idx
  on public.word_search_rankings (
    palavras_encontradas desc,
    tempo_total_ms asc,
    data_finalizacao asc
  );

alter table public.word_search_rankings enable row level security;

drop policy if exists "word_search_rankings_public_read" on public.word_search_rankings;
create policy "word_search_rankings_public_read"
  on public.word_search_rankings
  for select
  using (true);

drop policy if exists "word_search_rankings_public_insert" on public.word_search_rankings;
create policy "word_search_rankings_public_insert"
  on public.word_search_rankings
  for insert
  with check (
    char_length(btrim(nome)) between 1 and 40
    and palavras_encontradas between 0 and 6
    and tempo_total_ms between 0 and 45000
    and data_finalizacao >= data_inicio
  );

grant select, insert on public.word_search_rankings to anon;
