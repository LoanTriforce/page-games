create extension if not exists pgcrypto;

create table if not exists public.bubbles_rankings (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(btrim(nome)) between 1 and 40),
  telefone text not null check (telefone ~ '^[0-9]{10,11}$'),
  bolinhas_clicadas integer not null check (bolinhas_clicadas > 0),
  tempo_total_ms integer not null check (tempo_total_ms between 0 and 60000),
  tempo_medio_ms integer not null check (tempo_medio_ms between 0 and 60000),
  pontuacao integer not null check (pontuacao >= 0),
  detalhes_cliques jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now(),
  constraint bubbles_rankings_details_array_check check (jsonb_typeof(detalhes_cliques) = 'array'),
  constraint bubbles_rankings_details_length_check check (jsonb_array_length(detalhes_cliques) = bolinhas_clicadas),
  constraint bubbles_rankings_score_check check (
    pontuacao = greatest(
      0,
      bolinhas_clicadas * 100000
      + greatest(0, 60000 - tempo_total_ms)
      + (round((bolinhas_clicadas * 60000)::numeric / greatest(1000, tempo_total_ms))::integer * 250)
    )
  ),
  constraint bubbles_rankings_average_check check (tempo_medio_ms = round(tempo_total_ms::numeric / bolinhas_clicadas)::integer),
  constraint bubbles_rankings_last_click_check check (
    case
      when jsonb_array_length(detalhes_cliques) = 0 then false
      when (detalhes_cliques -> (jsonb_array_length(detalhes_cliques) - 1) ->> 'clickedAtMs') ~ '^[0-9]+$'
      then (detalhes_cliques -> (jsonb_array_length(detalhes_cliques) - 1) ->> 'clickedAtMs')::integer = tempo_total_ms
      else false
    end
  )
);

create index if not exists bubbles_rankings_order_idx
  on public.bubbles_rankings (
    bolinhas_clicadas desc,
    tempo_total_ms asc,
    pontuacao desc,
    criado_em asc
  );

alter table public.bubbles_rankings enable row level security;

drop policy if exists "bubbles_rankings_public_read" on public.bubbles_rankings;
create policy "bubbles_rankings_public_read"
  on public.bubbles_rankings
  for select
  to anon
  using (true);

drop policy if exists "bubbles_rankings_public_insert" on public.bubbles_rankings;
create policy "bubbles_rankings_public_insert"
  on public.bubbles_rankings
  for insert
  to anon
  with check (
    char_length(btrim(nome)) between 1 and 40
    and telefone ~ '^[0-9]{10,11}$'
    and bolinhas_clicadas > 0
    and tempo_total_ms between 0 and 60000
    and tempo_medio_ms = round(tempo_total_ms::numeric / bolinhas_clicadas)::integer
    and pontuacao = greatest(
      0,
      bolinhas_clicadas * 100000
      + greatest(0, 60000 - tempo_total_ms)
      + (round((bolinhas_clicadas * 60000)::numeric / greatest(1000, tempo_total_ms))::integer * 250)
    )
    and jsonb_typeof(detalhes_cliques) = 'array'
    and jsonb_array_length(detalhes_cliques) = bolinhas_clicadas
    and case
      when jsonb_array_length(detalhes_cliques) = 0 then false
      when (detalhes_cliques -> (jsonb_array_length(detalhes_cliques) - 1) ->> 'clickedAtMs') ~ '^[0-9]+$'
      then (detalhes_cliques -> (jsonb_array_length(detalhes_cliques) - 1) ->> 'clickedAtMs')::integer = tempo_total_ms
      else false
    end
    and not exists (
      select 1
      from jsonb_array_elements(detalhes_cliques) as click_detail(item)
      where not (
        jsonb_typeof(click_detail.item) = 'object'
        and click_detail.item ? 'product'
        and click_detail.item ? 'clickedAtMs'
        and click_detail.item ->> 'product' in ('Page Eventos', 'Page Serviços', 'Page Move', 'Page City')
        and (click_detail.item ->> 'clickedAtMs') ~ '^[0-9]+$'
        and (click_detail.item ->> 'clickedAtMs')::integer between 0 and 60000
      )
    )
  );

create or replace function public.clear_bubbles_rankings()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.bubbles_rankings;
$$;

revoke all on function public.clear_bubbles_rankings() from public;
grant execute on function public.clear_bubbles_rankings() to anon;

grant select, insert on public.bubbles_rankings to anon;
