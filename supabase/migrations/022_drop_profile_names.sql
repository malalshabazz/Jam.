alter table public.profiles
  drop column if exists first_name,
  drop column if exists last_name;
