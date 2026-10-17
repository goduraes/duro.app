-- Página de transações ordenada pela tag (primeira tag em ordem alfabética; sem tag vai por último).
-- Retorna os ids da página e o total (já com os filtros de período/tipo/tag aplicados).
create or replace function public.transactions_page_by_tag(
  p_from date,
  p_to date,
  p_type text default null,
  p_tag uuid default null,
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
    and (p_tag is null or exists (
      select 1 from public.transaction_tags tt
      where tt.transaction_id = t.id and tt.tag_id = p_tag
    ))
  order by
    (case when p_dir = 'desc' then x.tag_name end) desc nulls last,
    (case when p_dir <> 'desc' then x.tag_name end) asc nulls last,
    t.occurred_on desc, t.created_at desc, t.id
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;

revoke execute on function public.transactions_page_by_tag(date, date, text, uuid, text, int, int) from public, anon;
grant execute on function public.transactions_page_by_tag(date, date, text, uuid, text, int, int) to authenticated;
