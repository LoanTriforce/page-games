create extension if not exists pgcrypto;

create table if not exists public.memory_rankings (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(btrim(nome)) between 1 and 30),
  pontuacao integer not null check (pontuacao between 0 and 1920),
  pares integer not null check (pares between 0 and 12),
  tempo_ms integer not null check (tempo_ms between 0 and 60000),
  criado_em timestamptz not null default now(),
  constraint memory_rankings_score_range_check check (
    (pares = 0 and pontuacao = 0)
    or (pares > 0 and pontuacao between pares * 100 and pares * 160)
  )
);

create index if not exists memory_rankings_order_idx
  on public.memory_rankings (
    pontuacao desc,
    tempo_ms asc,
    criado_em asc
  );

alter table public.memory_rankings enable row level security;

drop policy if exists "memory_rankings_public_read" on public.memory_rankings;
create policy "memory_rankings_public_read"
  on public.memory_rankings
  for select
  to anon
  using (true);

drop policy if exists "memory_rankings_public_insert" on public.memory_rankings;
create policy "memory_rankings_public_insert"
  on public.memory_rankings
  for insert
  to anon
  with check (
    char_length(btrim(nome)) between 1 and 30
    and pontuacao between 0 and 1920
    and pares between 0 and 12
    and tempo_ms between 0 and 60000
    and (
      (pares = 0 and pontuacao = 0)
      or (pares > 0 and pontuacao between pares * 100 and pares * 160)
    )
  );

grant select, insert on public.memory_rankings to anon;
