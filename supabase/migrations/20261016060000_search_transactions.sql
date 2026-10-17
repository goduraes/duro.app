-- Busca por descrição no histórico: sem diferenciar maiúsculas/minúsculas nem acentos
-- ("alimentacao" encontra "Alimentação"). Vale para a lista e para os totais do rodapé.

create extension if not exists unaccent with schema extensions;

drop function if exists public.list_transactions(date, date, text, uuid[], text, text, int, int);
drop function if exists public.transactions_totals(date, date, text, uuid[]);

create or replace function public.transactions_totals(
  p_from date,
  p_to date,
  p_type text default null,
  p_tags uuid[] default null,
  p_search text default null
)
returns table (income_cents bigint, expense_cents bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(sum(a.amount_cents) filter (where a.type = 'income'), 0)::bigint,
    coalesce(sum(a.amount_cents) filter (where a.type = 'expense'), 0)::bigint
  from public.all_transactions(p_from, p_to) a
  where (p_type is null or a.type = p_type)
    and (p_tags is null or cardinality(p_tags) = 0 or a.tag_ids && p_tags)
    and (
      p_search is null or btrim(p_search) = ''
      or extensions.unaccent(lower(a.description)) like
         '%' || extensions.unaccent(lower(replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_'))) || '%'
         escape '\'
    );
$$;

create or replace function public.list_transactions(
  p_from   date,
  p_to     date,
  p_type   text default null,
  p_tags   uuid[] default null,
  p_sort   text default 'occurred_on',
  p_dir    text default 'desc',
  p_limit  int default 10,
  p_offset int default 0,
  p_search text default null
)
returns table (
  key           text,
  id            uuid,
  recurring_id  uuid,
  description   text,
  amount_cents  integer,
  type          text,
  occurred_on   date,
  tags          jsonb,
  total         bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with filtered as (
    select
      a.*,
      (select min(g.name) from public.tags g where g.id = any (a.tag_ids)) as tag_name
    from public.all_transactions(p_from, p_to) a
    where (p_type is null or a.type = p_type)
      and (p_tags is null or cardinality(p_tags) = 0 or a.tag_ids && p_tags)
      and (
        p_search is null or btrim(p_search) = ''
        or extensions.unaccent(lower(a.description)) like
           '%' || extensions.unaccent(lower(replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_'))) || '%'
           escape '\'
      )
  )
  select
    f.key, f.id, f.recurring_id, f.description, f.amount_cents, f.type, f.occurred_on,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'color', g.color) order by g.name)
      from public.tags g where g.id = any (f.tag_ids)
    ), '[]'::jsonb),
    count(*) over ()
  from filtered f
  order by
    (case when p_sort = 'occurred_on'  and p_dir = 'asc'  then f.occurred_on end) asc,
    (case when p_sort = 'occurred_on'  and p_dir <> 'asc' then f.occurred_on end) desc,
    (case when p_sort = 'description'  and p_dir = 'asc'  then lower(f.description) end) asc,
    (case when p_sort = 'description'  and p_dir <> 'asc' then lower(f.description) end) desc,
    (case when p_sort = 'amount_cents' and p_dir = 'asc'  then f.amount_cents end) asc,
    (case when p_sort = 'amount_cents' and p_dir <> 'asc' then f.amount_cents end) desc,
    (case when p_sort = 'tag' and p_dir = 'asc'  then f.tag_name end) asc nulls last,
    (case when p_sort = 'tag' and p_dir <> 'asc' then f.tag_name end) desc nulls last,
    f.occurred_on desc, f.created_at desc, f.key
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;

revoke execute on function public.transactions_totals(date, date, text, uuid[], text) from public, anon;
grant execute on function public.transactions_totals(date, date, text, uuid[], text) to authenticated;
revoke execute on function public.list_transactions(date, date, text, uuid[], text, text, int, int, text) from public, anon;
grant execute on function public.list_transactions(date, date, text, uuid[], text, text, int, int, text) to authenticated;
