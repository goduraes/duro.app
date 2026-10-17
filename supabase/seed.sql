-- SEED SOMENTE PARA DESENVOLVIMENTO LOCAL (supabase start / db reset).
-- Nunca rode isto em produção: as senhas abaixo são públicas.
--
--   admin@duro.app    / admin123456   (papel: admin)
--   usuario@duro.app  / usuario123456 (papel: common, com dados de exemplo)

do $$
declare
  v_instance uuid := '00000000-0000-0000-0000-000000000000';
  v_admin    uuid := '11111111-1111-4111-8111-111111111111';
  v_user     uuid := '22222222-2222-4222-8222-222222222222';
  r          record;
  v_tx       uuid;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values
    (v_instance, v_admin, 'authenticated', 'authenticated', 'admin@duro.app',
     extensions.crypt('admin123456', extensions.gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{"name":"Administrador"}', now(), now(), '', '', '', ''),
    (v_instance, v_user, 'authenticated', 'authenticated', 'usuario@duro.app',
     extensions.crypt('usuario123456', extensions.gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{"name":"Usuário Exemplo"}', now(), now(), '', '', '', '');

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(), u.id, u.id::text,
         jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
         'email', now(), now(), now()
  from auth.users u
  where u.id in (v_admin, v_user);

  -- o trigger on_auth_user_created já criou os profiles como 'common'
  update public.profiles set role = 'admin' where id = v_admin;

  -- as tags padrão (Moradia, Alimentação, ...) já foram criadas pelo trigger on_auth_user_created

  for r in
    select * from (values
      ('Salário',            'income',  650000,   3, 'Salário'),
      ('Aluguel',            'expense', 180000,   2, 'Moradia'),
      ('Supermercado',       'expense',  42350,   4, 'Alimentação'),
      ('Combustível',        'expense',  25000,   6, 'Transporte'),
      ('Cinema',             'expense',   8000,   9, 'Lazer'),
      ('Farmácia',           'expense',  12790,  12, 'Saúde'),
      ('Freelance',          'income',  120000,  15, null),
      ('Salário',            'income',  650000,  33, 'Salário'),
      ('Aluguel',            'expense', 180000,  32, 'Moradia'),
      ('Supermercado',       'expense',  51210,  36, 'Alimentação'),
      ('Uber',               'expense',   6890,  40, 'Transporte'),
      ('Restaurante',        'expense',  15400,  44, 'Lazer'),
      ('Salário',            'income',  650000,  63, 'Salário'),
      ('Aluguel',            'expense', 180000,  62, 'Moradia'),
      ('Supermercado',       'expense',  47890,  66, 'Alimentação'),
      ('Consulta médica',    'expense',  30000,  70, 'Saúde'),
      ('Salário',            'income',  650000,  93, 'Salário'),
      ('Aluguel',            'expense', 180000,  92, 'Moradia'),
      ('Supermercado',       'expense',  39980,  97, 'Alimentação'),
      ('Show',               'expense',  22000, 101, 'Lazer')
    ) as x(description, type, amount_cents, days_ago, tag_name)
  loop
    insert into public.transactions (user_id, description, amount_cents, type, occurred_on)
    values (v_user, r.description, r.amount_cents, r.type, current_date - r.days_ago)
    returning id into v_tx;

    insert into public.transaction_tags (transaction_id, tag_id)
    select v_tx, g.id from public.tags g where g.user_id = v_user and g.name = r.tag_name;
  end loop;
end $$;
