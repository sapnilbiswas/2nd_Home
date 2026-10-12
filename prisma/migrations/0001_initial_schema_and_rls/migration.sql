-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Helper function: is_admin()
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and is_active = true
  );
$$;

-- 2. Link profiles.id to auth.users(id) with CASCADE
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'profiles_id_fkey' and table_name = 'profiles'
  ) then
    alter table public.profiles
      add constraint profiles_id_fkey
      foreign key (id) references auth.users(id) on delete cascade;
  end if;
end $$;

-- 3. Enable Row-Level Security on all tables
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.rooms enable row level security;
alter table public.tenancies enable row level security;
alter table public.rent_dues enable row level security;
alter table public.payments enable row level security;
alter table public.complaints enable row level security;
alter table public.announcements enable row level security;
alter table public.meeting_rsvps enable row level security;
alter table public.messages enable row level security;

-- 4. Policies for profiles
drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "Users can update own profile or admin updates all" on public.profiles;
create policy "Users can update own profile or admin updates all"
  on public.profiles for update
  to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists "Admin can insert profiles" on public.profiles;
create policy "Admin can insert profiles"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid() or public.is_admin());

-- 5. Policies for settings
drop policy if exists "Settings readable by all authenticated" on public.settings;
create policy "Settings readable by all authenticated"
  on public.settings for select
  to authenticated
  using (true);

drop policy if exists "Settings modifiable only by admin" on public.settings;
create policy "Settings modifiable only by admin"
  on public.settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 6. Policies for rooms
drop policy if exists "Rooms readable by all authenticated" on public.rooms;
create policy "Rooms readable by all authenticated"
  on public.rooms for select
  to authenticated
  using (true);

drop policy if exists "Rooms modifiable only by admin" on public.rooms;
create policy "Rooms modifiable only by admin"
  on public.rooms for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 7. Policies for tenancies
drop policy if exists "Tenancies readable by tenant or admin" on public.tenancies;
create policy "Tenancies readable by tenant or admin"
  on public.tenancies for select
  to authenticated
  using (tenant_id = auth.uid() or public.is_admin());

drop policy if exists "Tenancies modifiable only by admin" on public.tenancies;
create policy "Tenancies modifiable only by admin"
  on public.tenancies for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 8. Policies for rent_dues
drop policy if exists "Rent dues readable by tenant or admin" on public.rent_dues;
create policy "Rent dues readable by tenant or admin"
  on public.rent_dues for select
  to authenticated
  using (
    public.is_admin() or
    tenancy_id in (select id from public.tenancies where tenant_id = auth.uid())
  );

drop policy if exists "Rent dues modifiable only by admin" on public.rent_dues;
create policy "Rent dues modifiable only by admin"
  on public.rent_dues for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 9. Policies for payments
drop policy if exists "Payments readable by tenant or admin" on public.payments;
create policy "Payments readable by tenant or admin"
  on public.payments for select
  to authenticated
  using (
    public.is_admin() or
    due_id in (
      select rd.id from public.rent_dues rd
      join public.tenancies t on rd.tenancy_id = t.id
      where t.tenant_id = auth.uid()
    )
  );

drop policy if exists "Tenant can create payments for their dues" on public.payments;
create policy "Tenant can create payments for their dues"
  on public.payments for insert
  to authenticated
  with check (
    public.is_admin() or
    due_id in (
      select rd.id from public.rent_dues rd
      join public.tenancies t on rd.tenancy_id = t.id
      where t.tenant_id = auth.uid()
    )
  );

drop policy if exists "Payments updateable only by admin" on public.payments;
create policy "Payments updateable only by admin"
  on public.payments for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 10. Policies for complaints
drop policy if exists "Complaints readable by author or admin" on public.complaints;
create policy "Complaints readable by author or admin"
  on public.complaints for select
  to authenticated
  using (tenant_id = auth.uid() or public.is_admin());

drop policy if exists "Complaints insertable by author or admin" on public.complaints;
create policy "Complaints insertable by author or admin"
  on public.complaints for insert
  to authenticated
  with check (tenant_id = auth.uid() or public.is_admin());

drop policy if exists "Complaints updateable by admin" on public.complaints;
create policy "Complaints updateable by admin"
  on public.complaints for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 11. Policies for announcements
drop policy if exists "Announcements readable by all authenticated" on public.announcements;
create policy "Announcements readable by all authenticated"
  on public.announcements for select
  to authenticated
  using (true);

drop policy if exists "Announcements modifiable only by admin" on public.announcements;
create policy "Announcements modifiable only by admin"
  on public.announcements for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 12. Policies for meeting_rsvps
drop policy if exists "RSVPs readable by tenant or admin" on public.meeting_rsvps;
create policy "RSVPs readable by tenant or admin"
  on public.meeting_rsvps for select
  to authenticated
  using (tenant_id = auth.uid() or public.is_admin());

drop policy if exists "Tenants can manage their own RSVP" on public.meeting_rsvps;
create policy "Tenants can manage their own RSVP"
  on public.meeting_rsvps for all
  to authenticated
  using (tenant_id = auth.uid() or public.is_admin())
  with check (tenant_id = auth.uid() or public.is_admin());

-- 13. Policies for messages
drop policy if exists "Messages readable in general or private thread by participants" on public.messages;
create policy "Messages readable in general or private thread by participants"
  on public.messages for select
  to authenticated
  using (
    room = 'general' or
    room = auth.uid()::text or
    public.is_admin()
  );

drop policy if exists "Messages insertable by sender" on public.messages;
create policy "Messages insertable by sender"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid() and
    (room = 'general' or room = auth.uid()::text or public.is_admin())
  );

-- 14. Seed default settings row if none exists
insert into public.settings (id, owner_upi_id, owner_name)
values (1, '9876543210@upi', 'House Owner')
on conflict (id) do nothing;

-- 15. Enable Realtime replication for chat, announcements, complaints, and payments
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.announcements;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.complaints;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.payments;
exception when others then null;
end $$;
