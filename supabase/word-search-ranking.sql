create extension if not exists pgcrypto;

create table if not exists public.word_search_rankings (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(btrim(nome)) between 1 and 40),
  telefone text not null check (telefone ~ '^[0-9]{10,11}$'),
  palavras_encontradas integer not null check (palavras_encontradas >= 0),
  total_palavras integer not null check (total_palavras > 0),
  tempo_total_ms integer not null check (tempo_total_ms between 0 and 45000),
  pontuacao integer not null check (pontuacao >= 0),
  palavras_detalhadas jsonb not null default '[]'::jsonb,
  data_inicio timestamptz not null,
  data_finalizacao timestamptz not null,
  criado_em timestamptz not null default now(),
  constraint word_search_rankings_words_check check (palavras_encontradas <= total_palavras),
  constraint word_search_rankings_score_check check (pontuacao = greatest(0, palavras_encontradas * 100000 - tempo_total_ms)),
  constraint word_search_rankings_details_array_check check (jsonb_typeof(palavras_detalhadas) = 'array'),
  constraint word_search_rankings_dates_check check (data_finalizacao >= data_inicio)
);

alter table public.word_search_rankings add column if not exists telefone text;
alter table public.word_search_rankings add column if not exists total_palavras integer;
alter table public.word_search_rankings add column if not exists pontuacao integer;
alter table public.word_search_rankings add column if not exists palavras_detalhadas jsonb default '[]'::jsonb;

update public.word_search_rankings
set total_palavras = 6
where total_palavras is null;

update public.word_search_rankings
set pontuacao = greatest(0, palavras_encontradas * 100000 - tempo_total_ms)
where pontuacao is null;

update public.word_search_rankings
set palavras_detalhadas = '[]'::jsonb
where palavras_detalhadas is null;

alter table public.word_search_rankings alter column total_palavras set not null;
alter table public.word_search_rankings alter column pontuacao set not null;
alter table public.word_search_rankings alter column palavras_detalhadas set not null;
alter table public.word_search_rankings alter column palavras_detalhadas set default '[]'::jsonb;

alter table public.word_search_rankings drop constraint if exists word_search_rankings_palavras_encontradas_check;

alter table public.word_search_rankings drop constraint if exists word_search_rankings_words_check;
alter table public.word_search_rankings add constraint word_search_rankings_words_check check (palavras_encontradas <= total_palavras);

alter table public.word_search_rankings drop constraint if exists word_search_rankings_score_check;
alter table public.word_search_rankings add constraint word_search_rankings_score_check check (pontuacao = greatest(0, palavras_encontradas * 100000 - tempo_total_ms));

alter table public.word_search_rankings drop constraint if exists word_search_rankings_phone_check;
alter table public.word_search_rankings add constraint word_search_rankings_phone_check check (telefone is null or telefone ~ '^[0-9]{10,11}$');

alter table public.word_search_rankings drop constraint if exists word_search_rankings_total_words_check;
alter table public.word_search_rankings add constraint word_search_rankings_total_words_check check (total_palavras > 0);

alter table public.word_search_rankings drop constraint if exists word_search_rankings_details_array_check;
alter table public.word_search_rankings add constraint word_search_rankings_details_array_check check (jsonb_typeof(palavras_detalhadas) = 'array');

drop index if exists public.word_search_rankings_order_idx;
create index word_search_rankings_order_idx
  on public.word_search_rankings (
    palavras_encontradas desc,
    tempo_total_ms asc,
    pontuacao desc,
    data_finalizacao asc
  );

drop index if exists public.word_search_rankings_participant_unique_idx;
drop index if exists public.word_search_rankings_participant_name_unique_idx;
drop index if exists public.word_search_rankings_participant_phone_unique_idx;

create index if not exists word_search_rankings_participant_name_idx
  on public.word_search_rankings (
    translate(
      lower(btrim(regexp_replace(nome, '\s+', ' ', 'g'))),
      'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
      'aaaaaaeeeeiiiiooooouuuucnyy'
    )
  );

create unique index if not exists word_search_rankings_participant_phone_unique_idx
  on public.word_search_rankings (telefone);

create or replace function public.prevent_duplicate_word_search_participant()
returns trigger
language plpgsql
as $$
declare
  participant_name_key text;
begin
  participant_name_key := translate(
    lower(btrim(regexp_replace(new.nome, '\s+', ' ', 'g'))),
    'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
    'aaaaaaeeeeiiiiooooouuuucnyy'
  );

  if exists (
    select 1
    from public.word_search_rankings registered
    where translate(
      lower(btrim(regexp_replace(registered.nome, '\s+', ' ', 'g'))),
      'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
      'aaaaaaeeeeiiiiooooouuuucnyy'
    ) = participant_name_key
    or registered.telefone = new.telefone
  ) then
    raise exception using
      errcode = '23505',
      message = 'word_search_rankings_participant_duplicate_guard';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_duplicate_word_search_participant_trigger on public.word_search_rankings;
create trigger prevent_duplicate_word_search_participant_trigger
  before insert on public.word_search_rankings
  for each row
  execute function public.prevent_duplicate_word_search_participant();

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
    and jsonb_typeof(palavras_detalhadas) = 'array'
    and jsonb_array_length(palavras_detalhadas) = palavras_encontradas
    and data_finalizacao >= data_inicio
    and (
      palavras_encontradas = 0
      or case
        when (palavras_detalhadas -> (jsonb_array_length(palavras_detalhadas) - 1) ->> 'foundAtMs') ~ '^[0-9]+$'
        then (palavras_detalhadas -> (jsonb_array_length(palavras_detalhadas) - 1) ->> 'foundAtMs')::integer = tempo_total_ms
        else false
      end
    )
    and not exists (
      select 1
      from jsonb_array_elements(palavras_detalhadas) as palavra_detalhada(item)
      where not (
        jsonb_typeof(palavra_detalhada.item) = 'object'
        and palavra_detalhada.item ? 'word'
        and palavra_detalhada.item ? 'foundAtMs'
        and btrim(palavra_detalhada.item ->> 'word') <> ''
        and (palavra_detalhada.item ->> 'foundAtMs') ~ '^[0-9]+$'
        and case
          when (palavra_detalhada.item ->> 'foundAtMs') ~ '^[0-9]+$'
          then (palavra_detalhada.item ->> 'foundAtMs')::integer between 0 and 45000
          else false
        end
      )
    )
    and not exists (
      select 1
      from (
        select palavra_detalhada.item ->> 'word' as word
        from jsonb_array_elements(palavras_detalhadas) as palavra_detalhada(item)
        group by palavra_detalhada.item ->> 'word'
        having count(*) > 1
      ) as repeated_words
    )
  );


drop function if exists public.clear_word_search_rankings();

grant select, insert on public.word_search_rankings to anon;
