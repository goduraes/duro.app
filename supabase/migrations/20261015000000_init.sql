-- Duro.app — schema inicial
-- Segurança: toda autorização vive em RLS. O front usa a anon key, então
-- nenhuma tabela pode depender de checagem no cliente.

------------------------------------------------------------------
-- Tabelas
------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null default '',
  email       text not null default '',
  role        text not null default 'common' check (role in ('admin', 'common')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.tags (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 40),
  color       text not null default '#868e96' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

create table public.transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  description   text not null check (char_length(btrim(description)) between 1 and 120),
  amount_cents  integer not null check (amount_cents > 0),   -- sempre em centavos, sempre positivo
  type          text not null check (type in ('income', 'expense')),
  occurred_on   date not null default current_date,
  created_at    timestamptz not null default now()
);

create index transactions_user_date_idx on public.transactions (user_id, occurred_on desc);

create table public.transaction_tags (
  transaction_id  uuid not null references public.transactions (id) on delete cascade,
  tag_id          uuid not null references public.tags (id) on delete cascade,
  primary key (transaction_id, tag_id)
);

create index transaction_tags_tag_idx on public.transaction_tags (tag_id);

------------------------------------------------------------------
-- Funções auxiliares (security definer para não depender de RLS em profiles)
------------------------------------------------------------------

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin' and p.is_active
  );
$$;

-- Todo novo usuário do Auth ganha um profile com papel 'common'.
-- O papel NUNCA vem de metadados enviados pelo cliente.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(btrim(new.raw_user_meta_data ->> 'name'), ''),
    coalesce(new.email, '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

------------------------------------------------------------------
-- RLS
------------------------------------------------------------------

alter table public.profiles          enable row level security;
alter table public.tags              enable row level security;
alter table public.transactions      enable row level security;
alter table public.transaction_tags  enable row level security;

-- profiles: cada um lê o próprio; admin lê todos.
-- Não há policy de INSERT/UPDATE/DELETE: alterações de papel/status só
-- acontecem no servidor (Server Actions) com a service role.
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

-- tags e transactions: estritamente do dono, e só enquanto a conta estiver ativa.
-- (Admin NÃO enxerga dados financeiros de outros usuários.)
create policy tags_owner on public.tags
  for all to authenticated
  using (user_id = (select auth.uid()) and public.is_active_user())
  with check (user_id = (select auth.uid()) and public.is_active_user());

create policy transactions_owner on public.transactions
  for all to authenticated
  using (user_id = (select auth.uid()) and public.is_active_user())
  with check (user_id = (select auth.uid()) and public.is_active_user());

create policy transaction_tags_owner on public.transaction_tags
  for all to authenticated
  using (
    public.is_active_user()
    and exists (
      select 1 from public.transactions t
      where t.id = transaction_id and t.user_id = (select auth.uid())
    )
  )
  with check (
    public.is_active_user()
    and exists (
      select 1 from public.transactions t
      where t.id = transaction_id and t.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.tags g
      where g.id = tag_id and g.user_id = (select auth.uid())
    )
  );

------------------------------------------------------------------
-- Grants explícitos (não depende do default do projeto)
------------------------------------------------------------------

revoke all on public.profiles, public.tags, public.transactions, public.transaction_tags from anon;
revoke all on public.profiles, public.tags, public.transactions, public.transaction_tags from authenticated;

grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.tags, public.transactions, public.transaction_tags to authenticated;

revoke execute on function public.is_active_user(), public.is_admin() from public, anon;
grant  execute on function public.is_active_user(), public.is_admin() to authenticated;

------------------------------------------------------------------
-- RPCs do dashboard (security invoker: RLS continua valendo)
------------------------------------------------------------------

create or replace function public.dashboard_summary(p_from date, p_to date)
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
    and t.occurred_on between p_from and p_to;
$$;

-- Total por tag. Uma transação com várias tags conta integralmente em cada uma;
-- transações sem tag aparecem como "Sem tag".
create or replace function public.dashboard_by_tag(p_from date, p_to date, p_type text)
returns table (tag_id uuid, tag_name text, color text, total_cents bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select g.id, g.name, g.color, sum(t.amount_cents)::bigint
  from public.transactions t
  join public.transaction_tags tt on tt.transaction_id = t.id
  join public.tags g on g.id = tt.tag_id
  where t.user_id = (select auth.uid())
    and t.type = p_type
    and t.occurred_on between p_from and p_to
  group by g.id, g.name, g.color

  union all

  select null::uuid, 'Sem tag'::text, '#adb5bd'::text, sum(t.amount_cents)::bigint
  from public.transactions t
  where t.user_id = (select auth.uid())
    and t.type = p_type
    and t.occurred_on between p_from and p_to
    and not exists (select 1 from public.transaction_tags tt where tt.transaction_id = t.id)
  having sum(t.amount_cents) is not null

  order by 4 desc;
$$;

create or replace function public.dashboard_monthly(p_from date, p_to date)
returns table (month date, income_cents bigint, expense_cents bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m::date,
    coalesce(sum(t.amount_cents) filter (where t.type = 'income'), 0)::bigint,
    coalesce(sum(t.amount_cents) filter (where t.type = 'expense'), 0)::bigint
  from generate_series(
         date_trunc('month', p_from::timestamp),
         date_trunc('month', p_to::timestamp),
         interval '1 month'
       ) as m
  left join public.transactions t
    on t.user_id = (select auth.uid())
   and date_trunc('month', t.occurred_on::timestamp) = m
   and t.occurred_on between p_from and p_to
  group by m
  order by m;
$$;

-- Criação/edição atômica de transação + tags.
create or replace function public.save_transaction(
  p_id           uuid,
  p_description  text,
  p_amount_cents integer,
  p_type         text,
  p_occurred_on  date,
  p_tag_ids      uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_id is null then
    insert into public.transactions (user_id, description, amount_cents, type, occurred_on)
    values ((select auth.uid()), p_description, p_amount_cents, p_type, p_occurred_on)
    returning id into v_id;
  else
    update public.transactions
       set description = p_description,
           amount_cents = p_amount_cents,
           type = p_type,
           occurred_on = p_occurred_on
     where id = p_id and user_id = (select auth.uid())
    returning id into v_id;

    if v_id is null then
      raise exception 'Transação não encontrada';
    end if;

    delete from public.transaction_tags where transaction_id = v_id;
  end if;

  if p_tag_ids is not null and cardinality(p_tag_ids) > 0 then
    insert into public.transaction_tags (transaction_id, tag_id)
    select v_id, tag from unnest(p_tag_ids) as tag;
  end if;

  return v_id;
end;
$$;

revoke execute on function
  public.dashboard_summary(date, date),
  public.dashboard_by_tag(date, date, text),
  public.dashboard_monthly(date, date),
  public.save_transaction(uuid, text, integer, text, date, uuid[])
from public, anon;

grant execute on function
  public.dashboard_summary(date, date),
  public.dashboard_by_tag(date, date, text),
  public.dashboard_monthly(date, date),
  public.save_transaction(uuid, text, integer, text, date, uuid[])
to authenticated;
