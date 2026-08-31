-- Daily jam limits only apply inside send_jam_request. Direct inserts skipped the cap.

drop policy if exists "jam_requests_insert_own_pending" on public.jam_requests;

revoke insert on public.jam_requests from public;
revoke insert on public.jam_requests from anon;
revoke insert on public.jam_requests from authenticated;
