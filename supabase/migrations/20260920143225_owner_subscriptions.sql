-- Existing owners keep all properties/rooms and receive 30 days from rollout.
-- Count updates lock one subscription row, so concurrent/bulk inserts cannot exceed quotas.
create table public.owner_subscriptions (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'trial' check(plan in ('trial','starter','standard','pro')),
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default now() + interval '30 days',
  expires_at timestamptz,
  room_count integer not null default 0 check(room_count >= 0),
  property_count integer not null default 0 check(property_count >= 0),
  updated_at timestamptz not null default now(),
  check(trial_ends_at > trial_started_at),
  check(plan = 'trial' or expires_at is not null)
);
create table public.subscription_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owner_subscriptions(owner_id),
  plan text not null check(plan in ('starter','standard','pro')),
  status text not null default 'pending' check(status in ('pending','approved','cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index one_pending_subscription_request on public.subscription_requests(owner_id) where status='pending';
create index subscription_requests_owner on public.subscription_requests(owner_id,created_at desc);
create table public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owner_subscriptions(owner_id),
  actor_id uuid not null references auth.users(id),
  request_id uuid not null unique references public.subscription_requests(id),
  previous_plan text not null,
  plan text not null,
  previous_expires_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index subscription_events_owner on public.subscription_events(owner_id,created_at desc);
create index subscription_events_actor on public.subscription_events(actor_id);

create function private.is_subscription_admin() returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(
    select 1 from auth.users where id=auth.uid() and raw_app_meta_data->>'role'='platform_admin'
  );
$$;
revoke all on function private.is_subscription_admin() from public,anon;
grant execute on function private.is_subscription_admin() to authenticated;
create function public.is_subscription_admin() returns boolean
language sql stable security invoker set search_path='' as $$ select private.is_subscription_admin(); $$;
revoke all on function public.is_subscription_admin() from public,anon;
grant execute on function public.is_subscription_admin() to authenticated;

do $$ declare t text; begin
  foreach t in array array['owner_subscriptions','subscription_requests','subscription_events'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('grant all on public.%I to service_role',t);
    execute format('create policy subscription_read on public.%I for select to authenticated using(owner_id=(select auth.uid()) or (select private.is_subscription_admin()))',t);
  end loop;
end $$;

-- Serialize installation against owner mutations while establishing accurate counters.
lock table public.properties, public.rooms in share row exclusive mode;
insert into public.owner_subscriptions(owner_id, room_count, property_count)
select u.id,
  (select count(*) from public.rooms r where r.owner_id=u.id),
  (select count(*) from public.properties p where p.owner_id=u.id)
from auth.users u;

create function private.start_owner_trial() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.owner_subscriptions(owner_id,trial_started_at,trial_ends_at)
  values(new.id,new.created_at,new.created_at+interval '30 days');
  return new;
end $$;
revoke all on function private.start_owner_trial() from public,anon,authenticated;
create trigger start_owner_trial after insert on auth.users
for each row execute function private.start_owner_trial();

create function private.guard_owner_write() returns trigger
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); oid uuid;
begin
  -- The public bill gateway runs as service_role; tenants can still submit existing bills.
  if uid is null then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  if tg_table_name='property_bill_links' then
    select owner_id into oid from public.properties
      where id=case when tg_op='DELETE' then old.property_id else new.property_id end;
  else
    oid:=case when tg_op='DELETE' then old.owner_id else new.owner_id end;
  end if;
  if oid is distinct from uid then raise exception 'ไม่มีสิทธิ์แก้ไขข้อมูลนี้' using errcode='42501'; end if;
  if not exists(select 1 from public.owner_subscriptions where owner_id=uid
    and case when plan='trial' then trial_ends_at else expires_at end > now()) then
    raise exception 'สิทธิ์ใช้งานหมดอายุแล้ว ดูข้อมูลเดิมได้ กรุณาขอเปิดใช้แพ็กเกจ' using errcode='42501';
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke all on function private.guard_owner_write() from public,anon,authenticated;
do $$ declare t text; begin
  foreach t in array array['properties','rooms','tenants','tenancies','charge_templates','billing_cycles','meter_readings','invoices','invoice_items','payment_events','payment_submissions','property_bill_links'] loop
    execute format('create trigger subscription_write_guard before insert or update or delete on public.%I for each row execute function private.guard_owner_write()',t);
  end loop;
end $$;

create function private.enforce_owner_capacity() returns trigger
language plpgsql security definer set search_path='' as $$
declare oid uuid; allowed boolean;
begin
  if tg_op='UPDATE' then
    if new.owner_id is distinct from old.owner_id then
      raise exception 'ไม่สามารถโอนเจ้าของข้อมูลได้' using errcode='42501';
    end if;
    return new;
  end if;
  oid:=case when tg_op='DELETE' then old.owner_id else new.owner_id end;
  if tg_table_name='rooms' then
    if tg_op='INSERT' then
      update public.owner_subscriptions set room_count=room_count+1
      where owner_id=oid and room_count < case plan when 'standard' then 100 when 'pro' then 200 else 30 end
      returning true into allowed;
      if allowed is distinct from true then
        raise exception 'จำนวนห้องครบโควตาแพ็กเกจแล้ว กรุณาอัปเกรดแพ็กเกจ' using errcode='P0001';
      end if;
    else
      update public.owner_subscriptions set room_count=room_count-1 where owner_id=oid;
    end if;
  else
    if tg_op='INSERT' then
      update public.owner_subscriptions set property_count=property_count+1
      where owner_id=oid and property_count<1 returning true into allowed;
      if allowed is distinct from true then
        raise exception 'เจ้าของ 1 บัญชีมีได้ 1 หอพักเท่านั้น' using errcode='P0001';
      end if;
    else
      update public.owner_subscriptions set property_count=property_count-1 where owner_id=oid;
    end if;
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke all on function private.enforce_owner_capacity() from public,anon,authenticated;
create trigger subscription_capacity after insert or update or delete on public.rooms
for each row execute function private.enforce_owner_capacity();
create trigger subscription_capacity after insert or update or delete on public.properties
for each row execute function private.enforce_owner_capacity();

-- Restrictive policies compose with existing ownership checks; QR reads stay available.
create policy subscription_qr_insert on storage.objects as restrictive for insert to authenticated
with check(bucket_id<>'payment-qr' or exists(select 1 from public.owner_subscriptions s where s.owner_id=(select auth.uid()) and case when s.plan='trial' then s.trial_ends_at else s.expires_at end > now()));
create policy subscription_qr_update on storage.objects as restrictive for update to authenticated
using(bucket_id<>'payment-qr' or exists(select 1 from public.owner_subscriptions s where s.owner_id=(select auth.uid()) and case when s.plan='trial' then s.trial_ends_at else s.expires_at end > now()))
with check(bucket_id<>'payment-qr' or exists(select 1 from public.owner_subscriptions s where s.owner_id=(select auth.uid()) and case when s.plan='trial' then s.trial_ends_at else s.expires_at end > now()));
create policy subscription_qr_delete on storage.objects as restrictive for delete to authenticated
using(bucket_id<>'payment-qr' or exists(select 1 from public.owner_subscriptions s where s.owner_id=(select auth.uid()) and case when s.plan='trial' then s.trial_ends_at else s.expires_at end > now()));

create function private.request_subscription(requested_plan text) returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); rid uuid;
begin
  if uid is null then raise exception 'กรุณาเข้าสู่ระบบ' using errcode='42501'; end if;
  if requested_plan is null or requested_plan not in ('starter','standard','pro') then raise exception 'แพ็กเกจไม่ถูกต้อง'; end if;
  perform 1 from public.owner_subscriptions where owner_id=uid for update;
  if not found then raise exception 'ไม่พบบัญชี'; end if;
  select id into rid from public.subscription_requests where owner_id=uid and status='pending' and plan=requested_plan;
  if found then return rid; end if;
  update public.subscription_requests set status='cancelled',resolved_at=now() where owner_id=uid and status='pending';
  insert into public.subscription_requests(owner_id,plan) values(uid,requested_plan) returning id into rid;
  return rid;
end $$;
revoke all on function private.request_subscription(text) from public,anon;
grant execute on function private.request_subscription(text) to authenticated;
create function public.request_subscription(requested_plan text) returns uuid
language sql security invoker set search_path='' as $$ select private.request_subscription(requested_plan); $$;
revoke all on function public.request_subscription(text) from public,anon;
grant execute on function public.request_subscription(text) to authenticated;

create function private.approve_subscription(request_id uuid, selected_plan text) returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); oid uuid; sub public.owner_subscriptions; req public.subscription_requests; expiry timestamptz;
begin
  if not private.is_subscription_admin() then raise exception 'สำหรับแอดมินเท่านั้น' using errcode='42501'; end if;
  if selected_plan is null or selected_plan not in ('starter','standard','pro') then raise exception 'แพ็กเกจไม่ถูกต้อง'; end if;
  select owner_id into oid from public.subscription_requests where id=request_id;
  if not found then raise exception 'ไม่พบคำขอ'; end if;
  select * into sub from public.owner_subscriptions where owner_id=oid for update;
  select * into req from public.subscription_requests where id=request_id for update;
  if req.status<>'pending' then raise exception 'คำขอนี้ดำเนินการแล้ว กรุณาโหลดข้อมูลใหม่'; end if;
  expiry := (case when sub.plan=selected_plan and sub.expires_at>now() then sub.expires_at else now() end) + interval '1 month';
  update public.owner_subscriptions set plan=selected_plan,expires_at=expiry,updated_at=now() where owner_id=oid;
  update public.subscription_requests set status='approved',resolved_at=now() where id=request_id;
  insert into public.subscription_events(owner_id,actor_id,request_id,previous_plan,plan,previous_expires_at,expires_at)
  values(oid,uid,request_id,sub.plan,selected_plan,sub.expires_at,expiry);
end $$;
revoke all on function private.approve_subscription(uuid,text) from public,anon;
grant execute on function private.approve_subscription(uuid,text) to authenticated;
create function public.approve_subscription(request_id uuid,selected_plan text) returns void
language sql security invoker set search_path='' as $$ select private.approve_subscription(request_id,selected_plan); $$;
revoke all on function public.approve_subscription(uuid,text) from public,anon;
grant execute on function public.approve_subscription(uuid,text) to authenticated;

create function private.subscription_admin(search text,page_offset integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not private.is_subscription_admin() then raise exception 'สำหรับแอดมินเท่านั้น' using errcode='42501'; end if;
  select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into result from (
    select s.*,u.email, q.id as request_id,q.plan as requested_plan,q.created_at as requested_at,
      (select coalesce(jsonb_agg(to_jsonb(h)),'[]'::jsonb) from (
        select e.plan,e.expires_at,e.created_at,a.email as actor_email
        from public.subscription_events e join auth.users a on a.id=e.actor_id
        where e.owner_id=s.owner_id order by e.created_at desc,e.id limit 5
      ) h) as history
    from public.owner_subscriptions s join auth.users u on u.id=s.owner_id
    left join public.subscription_requests q on q.owner_id=s.owner_id and q.status='pending'
    where position(lower(left(coalesce(search,''),254)) in lower(coalesce(u.email,'')))>0
      or position(lower(left(coalesce(search,''),254)) in s.owner_id::text)>0
    order by (q.id is null),q.created_at,s.owner_id limit 30 offset greatest(coalesce(page_offset,0),0)
  ) r;
  return result;
end $$;
revoke all on function private.subscription_admin(text,integer) from public,anon;
grant execute on function private.subscription_admin(text,integer) to authenticated;
create function public.subscription_admin(search text default '',page_offset integer default 0) returns jsonb
language sql stable security invoker set search_path='' as $$ select private.subscription_admin(search,page_offset); $$;
revoke all on function public.subscription_admin(text,integer) from public,anon;
grant execute on function public.subscription_admin(text,integer) to authenticated;
