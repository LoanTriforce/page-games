create extension if not exists pgcrypto;

create table if not exists public.word_search_rankings (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(btrim(nome)) between 1 and 40),
  telefone text not null check (telefone ~ '^[0-9]{10,11}$'),
  palavras_encontradas integer not null check (palavras_encontradas >= 0),
  total_palavras integer not null check (total_palavras > 0),
  tempo_total_ms integer not null check (tempo_total_ms between 0 and 45000),
  pontuacao integer not null check (pontuacao >= 0),
  data_inicio timestamptz not null,
  data_finalizacao timestamptz not null,
  criado_em timestamptz not null default now(),
  constraint word_search_rankings_words_check check (palavras_encontradas <= total_palavras),
  constraint word_search_rankings_score_check check (pontuacao = greatest(0, palavras_encontradas * 100000 - tempo_total_ms)),
  constraint word_search_rankings_dates_check check (data_finalizacao >= data_inicio)
);

alter table public.word_search_rankings add column if not exists telefone text;
alter table public.word_search_rankings add column if not exists total_palavras integer;
alter table public.word_search_rankings add column if not exists pontuacao integer;

update public.word_search_rankings
set total_palavras = 6
where total_palavras is null;

update public.word_search_rankings
set pontuacao = greatest(0, palavras_encontradas * 100000 - tempo_total_ms)
where pontuacao is null;

alter table public.word_search_rankings alter column total_palavras set not null;
alter table public.word_search_rankings alter column pontuacao set not null;

alter table public.word_search_rankings drop constraint if exists word_search_rankings_palavras_encontradas_check;

alter table public.word_search_rankings drop constraint if exists word_search_rankings_words_check;
alter table public.word_search_rankings add constraint word_search_rankings_words_check check (palavras_encontradas <= total_palavras);

alter table public.word_search_rankings drop constraint if exists word_search_rankings_score_check;
alter table public.word_search_rankings add constraint word_search_rankings_score_check check (pontuacao = greatest(0, palavras_encontradas * 100000 - tempo_total_ms));

alter table public.word_search_rankings drop constraint if exists word_search_rankings_phone_check;
alter table public.word_search_rankings add constraint word_search_rankings_phone_check check (telefone is null or telefone ~ '^[0-9]{10,11}$');

alter table public.word_search_rankings drop constraint if exists word_search_rankings_total_words_check;
alter table public.word_search_rankings add constraint word_search_rankings_total_words_check check (total_palavras > 0);

create index if not exists word_search_rankings_order_idx
  on public.word_search_rankings (
    pontuacao desc,
    palavras_encontradas desc,
    tempo_total_ms asc,
    data_finalizacao asc
  );

alter table public.word_search_rankings enable row level security;

drop policy if exists "word_search_rankings_public_read" on public.word_search_rankings;
create policy "word_search_rankings_public_read"
  on public.word_search_rankings
  for select
  to anon
  using (true);

drop policy if exists "word_search_rankings_public_insert" on public.word_search_rankings;
create policy "word_search_rankings_public_insert"
  on public.word_search_rankings
  for insert
  to anon
  with check (
    char_length(btrim(nome)) between 1 and 40
    and telefone ~ '^[0-9]{10,11}$'
    and palavras_encontradas >= 0
    and total_palavras > 0
    and palavras_encontradas <= total_palavras
    and tempo_total_ms between 0 and 45000
    and pontuacao = greatest(0, palavras_encontradas * 100000 - tempo_total_ms)
    and data_finalizacao >= data_inicio
  );

grant select, insert on public.word_search_rankings to anon;
