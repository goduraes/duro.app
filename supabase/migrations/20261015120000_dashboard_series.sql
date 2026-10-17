-- Série temporal do dashboard com granularidade escolhida pelo front:
-- 'day' (períodos curtos) ou 'month' (períodos longos). Substitui dashboard_monthly.

create or replace function public.dashboard_series(p_from date, p_to date, p_unit text)
returns table (period date, income_cents bigint, expense_cents bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    g::date,
    coalesce(sum(t.amount_cents) filter (where t.type = 'income'), 0)::bigint,
    coalesce(sum(t.amount_cents) filter (where t.type = 'expense'), 0)::bigint
  from generate_series(
         date_trunc(case when p_unit = 'day' then 'day' else 'month' end, p_from::timestamp),
         date_trunc(case when p_unit = 'day' then 'day' else 'month' end, p_to::timestamp),
         case when p_unit = 'day' then interval '1 day' else interval '1 month' end
       ) as g
  left join public.transactions t
    on t.user_id = (select auth.uid())
   and date_trunc(case when p_unit = 'day' then 'day' else 'month' end, t.occurred_on::timestamp) = g
   and t.occurred_on between p_from and p_to
  group by g
  order by g;
$$;

revoke execute on function public.dashboard_series(date, date, text) from public, anon;
grant  execute on function public.dashboard_series(date, date, text) to authenticated;

drop function if exists public.dashboard_monthly(date, date);
