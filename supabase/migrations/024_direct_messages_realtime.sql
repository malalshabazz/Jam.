-- Enable realtime inserts for in-app inbox notifications.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'direct_messages'
  ) then
    alter publication supabase_realtime add table public.direct_messages;
  end if;
end $$;
