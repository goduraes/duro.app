-- Todo novo usuário já nasce com um conjunto padrão de tags.
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

  insert into public.tags (user_id, name, color) values
    (new.id, 'Moradia',    '#4c6ef5'),
    (new.id, 'Mercado',    '#40c057'),
    (new.id, 'Transporte', '#fab005'),
    (new.id, 'Lazer',      '#be4bdb'),
    (new.id, 'Saúde',      '#fa5252'),
    (new.id, 'Salário',    '#12b886');

  return new;
end;
$$;
