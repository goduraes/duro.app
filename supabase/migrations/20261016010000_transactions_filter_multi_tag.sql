-- Filtro por várias tags: a transação entra se tiver QUALQUER uma das tags escolhidas.
-- p_tags nulo ou vazio = sem filtro de tag.

drop function if exists public.transactions_totals(date, date, text, uuid);
drop function if exists public.transactions_page_by_tag(date, date, text, uuid, text, int, int);

create or replace function public.transactions_totals(
  p_from date,
  p_to date,
  p_type text default null,
  p_tags uuid[] default null
)
returns table (income_cents bigint, expense_cents bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(sum(t.amount_cents) filter (where t.type = 'income'), 0)::bigint,
    coalesce(sum(t.amount_cents) filter (where t.type = 'expense'), 0)::bigint
  from public.transactions t
  where t.user_id = (select auth.uid())
    and t.occurred_on between p_from and p_to
    and (p_type is null or t.type = p_type)
    and (p_tags is null or cardinality(p_tags) = 0 or exists (
      select 1 from public.transaction_tags tt
      where tt.transaction_id = t.id and tt.tag_id = any (p_tags)
    ));
$$;

create or replace function public.transactions_page_by_tag(
  p_from date,
  p_to date,
  p_type text default null,
  p_tags uuid[] default null,
  p_dir text default 'asc',
  p_limit int default 10,
  p_offset int default 0
)
returns table (id uuid, total bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.id, count(*) over () as total
  from public.transactions t
  left join lateral (
    select min(g.name) as tag_name
    from public.transaction_tags tt
    join public.tags g on g.id = tt.tag_id
    where tt.transaction_id = t.id
  ) x on true
  where t.user_id = (select auth.uid())
    and t.occurred_on between p_from and p_to
    and (p_type is null or t.type = p_type)
    and (p_tags is null or cardinality(p_tags) = 0 or exists (
      select 1 from public.transaction_tags tt
      where tt.transaction_id = t.id and tt.tag_id = any (p_tags)
    ))
  order by
    (case when p_dir = 'desc' then x.tag_name end) desc nulls last,
    (case when p_dir <> 'desc' then x.tag_name end) asc nulls last,
    t.occurred_on desc, t.created_at desc, t.id
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;

revoke execute on function public.transactions_totals(date, date, text, uuid[]) from public, anon;
grant execute on function public.transactions_totals(date, date, text, uuid[]) to authenticated;
revoke execute on function public.transactions_page_by_tag(date, date, text, uuid[], text, int, int) from public, anon;
grant execute on function public.transactions_page_by_tag(date, date, text, uuid[], text, int, int) to authenticated;
