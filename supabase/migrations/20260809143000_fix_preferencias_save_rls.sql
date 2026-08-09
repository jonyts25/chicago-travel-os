-- Fix silent save failures: UPDATE in Postgres RLS requires SELECT visibility.
-- Run this in Supabase SQL Editor if preferencias/trip settings show success but stay null.

alter table public.users enable row level security;

drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users
  for select to authenticated
  using (auth.uid() = id);

drop policy if exists users_insert_own on public.users;
create policy users_insert_own on public.users
  for insert to authenticated
  with check (auth.uid() = id);

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

alter table public.trips enable row level security;

drop policy if exists trips_select_trip_members on public.trips;
create policy trips_select_trip_members on public.trips
  for select to authenticated
  using (
    exists (
      select 1
      from public.trip_members tm
      where tm.trip_id = trips.id
        and tm.user_id = auth.uid()
    )
  );

drop policy if exists trips_update_trip_members on public.trips;
create policy trips_update_trip_members on public.trips
  for update to authenticated
  using (
    exists (
      select 1
      from public.trip_members tm
      where tm.trip_id = trips.id
        and tm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.trip_members tm
      where tm.trip_id = trips.id
        and tm.user_id = auth.uid()
    )
  );
