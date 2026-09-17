create extension if not exists pgcrypto;

create table if not exists public.find_ticket_rankings (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(btrim(nome)) between 1 and 18),
  pontuacao integer not null check (pontuacao between 1200 and 6600),
  itens_encontrados integer not null check (itens_encontrados = 6),
  tempo_ms integer not null check (tempo_ms between 0 and 30000),
  criado_em timestamptz not null default now()
);

create index if not exists find_ticket_rankings_order_idx
  on public.find_ticket_rankings (
    pontuacao desc,
    tempo_ms asc,
    criado_em asc
  );

alter table public.find_ticket_rankings enable row level security;

drop policy if exists "find_ticket_rankings_public_read" on public.find_ticket_rankings;
create policy "find_ticket_rankings_public_read"
  on public.find_ticket_rankings
  for select
  to anon
  using (true);

drop policy if exists "find_ticket_rankings_public_insert" on public.find_ticket_rankings;
create policy "find_ticket_rankings_public_insert"
  on public.find_ticket_rankings
  for insert
  to anon
  with check (
    char_length(btrim(nome)) between 1 and 18
    and pontuacao between 1200 and 6600
    and itens_encontrados = 6
    and tempo_ms between 0 and 30000
  );

grant select, insert on public.find_ticket_rankings to anon;
