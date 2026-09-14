alter table public.invoices drop constraint invoices_cycle_id_room_id_key;
create unique index one_active_bill_per_room on public.invoices(cycle_id,room_id) where status<>'void';
do $$ declare r record; begin
 for r in select table_name,column_name from information_schema.columns where table_schema='public' and data_type='numeric' loop
 execute format('alter table public.%I add constraint %I check (%I <> ''NaN''::numeric)',r.table_name,r.column_name||'_finite',r.column_name);
 end loop;
end $$;
create or replace function private.owner_command(op text, p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); pid uuid; rid uuid; cid uuid; iid uuid; tid uuid; mon date;
 prop public.properties; rm public.rooms; inv public.invoices; meter public.meter_readings;
 x jsonb; rec record; n integer:=0; w numeric; e numeric;
begin
 if u is null then raise exception 'กรุณาเข้าสู่ระบบ' using errcode='42501'; end if;
 insert into public.profiles(id) values(u) on conflict do nothing;
 if op='property_save' then
  if nullif(p->>'id','') is null then
   insert into public.properties(owner_id,name,address,rent,water_method,water_rate,electric_rate,due_day,payment_info)
   values(u,p->>'name',coalesce(p->>'address',''),(p->>'rent')::numeric,(p->>'water_method')::public.water_method,
   (p->>'water_rate')::numeric,(p->>'electric_rate')::numeric,(p->>'due_day')::int,coalesce(p->>'payment_info','')) returning id into pid;
  else
   pid:=(p->>'id')::uuid;
   update public.properties set name=p->>'name',address=coalesce(p->>'address',''),rent=(p->>'rent')::numeric,
   water_method=(p->>'water_method')::public.water_method,water_rate=(p->>'water_rate')::numeric,
   electric_rate=(p->>'electric_rate')::numeric,due_day=(p->>'due_day')::int,payment_info=coalesce(p->>'payment_info','')
   where id=pid and owner_id=u;
   if not found then raise exception 'ไม่พบหอพัก'; end if;
  end if;
  if jsonb_array_length(p->'charges')>30 then raise exception 'รายการมากเกินไป'; end if;
  delete from public.charge_templates where property_id=pid and owner_id=u;
  for x in select * from jsonb_array_elements(p->'charges') loop
   insert into public.charge_templates(owner_id,property_id,label,amount) values(u,pid,x->>'label',(x->>'amount')::numeric);
  end loop;
  return jsonb_build_object('id',pid);
 end if;
 if op in ('room_save','rooms_add','tenant_movein','tenant_moveout','meters_save','drafts_create','issue_all') then
  pid:=(p->>'property_id')::uuid;
  select * into prop from public.properties where id=pid and owner_id=u for update;
  if not found then raise exception 'ไม่พบหอพัก' using errcode='42501'; end if;
 end if;
 if op='rooms_add' then
  if jsonb_array_length(p->'names') not between 1 and 200 then raise exception 'เพิ่มได้ครั้งละ 1–200 ห้อง'; end if;
  for x in select * from jsonb_array_elements(p->'names') loop
   insert into public.rooms(owner_id,property_id,name,floor) values(u,pid,x#>>'{}',coalesce(p->>'floor',''));
   n:=n+1;
  end loop;
 elsif op='room_save' then
  update public.rooms set name=p->>'name',floor=coalesce(p->>'floor',''),rent=nullif(p->>'rent','')::numeric,
  water_rate=nullif(p->>'water_rate','')::numeric,electric_rate=nullif(p->>'electric_rate','')::numeric
  where id=(p->>'id')::uuid and property_id=pid and owner_id=u;
  if not found then raise exception 'ไม่พบห้อง'; end if;
 elsif op='tenant_movein' then
  rid:=(p->>'room_id')::uuid;
  perform 1 from public.rooms where id=rid and property_id=pid and owner_id=u for update;
  if not found then raise exception 'ไม่พบห้อง'; end if;
  if exists(select 1 from public.tenancies where room_id=rid and (moved_out is null or moved_out>=(p->>'moved_in')::date)) then
   raise exception 'ช่วงเข้าพักทับซ้อนกับผู้เช่าเดิม';
  end if;
  insert into public.tenants(owner_id,name,phone) values(u,p->>'name',coalesce(p->>'phone','')) returning id into tid;
  insert into public.tenancies(owner_id,room_id,tenant_id,moved_in) values(u,rid,tid,(p->>'moved_in')::date);
 elsif op='tenant_moveout' then
  update public.tenancies set moved_out=(p->>'moved_out')::date
  where id=(p->>'id')::uuid and owner_id=u and moved_out is null and room_id in(select id from public.rooms where property_id=pid);
  if not found then raise exception 'ไม่พบผู้เช่าปัจจุบัน'; end if;
 elsif op in ('meters_save','drafts_create','issue_all') then
  mon:=(p->>'month')::date;
  insert into public.billing_cycles(owner_id,property_id,month) values(u,pid,mon) on conflict(property_id,month) do nothing;
  select id into cid from public.billing_cycles where property_id=pid and month=mon for update;
  if op='meters_save' then
   if jsonb_array_length(p->'rows')>200 then raise exception 'บันทึกได้ครั้งละ 200 ห้อง'; end if;
   for x in select * from jsonb_array_elements(p->'rows') loop
    rid:=(x->>'room_id')::uuid;
    perform 1 from public.rooms where id=rid and property_id=pid and owner_id=u;
    if not found then raise exception 'ไม่พบห้อง'; end if;
    if exists(select 1 from public.invoices where cycle_id=cid and room_id=rid and status<>'void') then raise exception 'มีบิลแล้ว กรุณายกเลิกร่างก่อนแก้มิเตอร์'; end if;
    if exists(select 1 from public.meter_readings m join public.billing_cycles c on c.id=m.cycle_id where m.room_id=rid and c.month>mon) then
     raise exception 'มีเลขมิเตอร์รอบถัดไปแล้ว ไม่สามารถแก้ย้อนหลัง';
    end if;
    select m.* into meter from public.meter_readings m join public.billing_cycles c on c.id=m.cycle_id
      where m.room_id=rid and c.month<mon order by c.month desc limit 1;
    if meter.electric_current is not null and nullif(x->>'electric_previous','')::numeric is distinct from meter.electric_current then raise exception 'เลขไฟครั้งก่อนต้องตรงกับรอบล่าสุด'; end if;
    if prop.water_method='meter' and meter.water_current is not null and nullif(x->>'water_previous','')::numeric is distinct from meter.water_current then raise exception 'เลขน้ำครั้งก่อนต้องตรงกับรอบล่าสุด'; end if;
    insert into public.meter_readings(owner_id,cycle_id,room_id,water_previous,water_current,electric_previous,electric_current)
    values(u,cid,rid,nullif(x->>'water_previous','')::numeric,nullif(x->>'water_current','')::numeric,
    nullif(x->>'electric_previous','')::numeric,nullif(x->>'electric_current','')::numeric)
    on conflict(cycle_id,room_id) do update set water_previous=excluded.water_previous,water_current=excluded.water_current,
    electric_previous=excluded.electric_previous,electric_current=excluded.electric_current;
    n:=n+1;
   end loop;
  elsif op='drafts_create' then
   for rec in
    select r.*, t.id as tenancy, te.name as tenant_name from public.rooms r
    join public.tenancies t on t.room_id=r.id and t.moved_out is null
    join public.tenants te on te.id=t.tenant_id
    where r.property_id=pid and t.moved_in<(mon+interval '1 month')
    and not exists(select 1 from public.invoices i where i.cycle_id=cid and i.room_id=r.id and i.status<>'void')
   loop
    select * into meter from public.meter_readings where cycle_id=cid and room_id=rec.id;
    if meter.electric_current is null or meter.electric_previous is null then continue; end if;
    if prop.water_method='meter' and (meter.water_current is null or meter.water_previous is null) then continue; end if;
    insert into public.invoices(owner_id,property_id,cycle_id,room_id,tenancy_id,property_name,room_name,tenant_name,payment_info,month,due_date)
    values(u,pid,cid,rec.id,rec.tenancy,prop.name,rec.name,rec.tenant_name,prop.payment_info,mon,(mon+interval '1 month')::date+prop.due_day-1)
    returning id into iid;
    w:=case when prop.water_method='flat' then 1 else meter.water_current-meter.water_previous end;
    e:=meter.electric_current-meter.electric_previous;
    insert into public.invoice_items(owner_id,invoice_id,kind,label,quantity,rate,previous_reading,current_reading,position) values
    (u,iid,'rent','ค่าเช่าห้อง',1,coalesce(rec.rent,prop.rent),null,null,0),
    (u,iid,'water',case when prop.water_method='flat' then 'ค่าน้ำเหมาจ่าย' else 'ค่าน้ำ' end,w,coalesce(rec.water_rate,prop.water_rate),
     case when prop.water_method='meter' then meter.water_previous end,case when prop.water_method='meter' then meter.water_current end,1),
    (u,iid,'electric','ค่าไฟฟ้า',e,coalesce(rec.electric_rate,prop.electric_rate),meter.electric_previous,meter.electric_current,2);
    insert into public.invoice_items(owner_id,invoice_id,kind,label,quantity,rate,position)
    select u,iid,'other',label,1,amount,3 from public.charge_templates where property_id=pid;
    update public.invoices set total=(select sum(amount) from public.invoice_items where invoice_id=iid) where id=iid;
    n:=n+1;
   end loop;
  else
   if length(trim(prop.payment_info))=0 then raise exception 'กรุณาตั้งค่าบัญชีรับเงินก่อนออกบิล'; end if;
   update public.invoices set status='issued',issued_at=now() where cycle_id=cid and owner_id=u and status='draft';
   get diagnostics n=row_count;
   update public.billing_cycles set status='issued' where id=cid;
  end if;
 elsif op in ('invoice_edit','draft_delete','invoice_void','payment_confirm','payment_revoke','link_renew') then
  iid:=(p->>'id')::uuid;
  select * into inv from public.invoices where id=iid and owner_id=u for update;
  if not found then raise exception 'ไม่พบบิล' using errcode='42501'; end if;
  if op='invoice_edit' then
   if inv.status<>'draft' then raise exception 'แก้ได้เฉพาะบิลร่าง'; end if;
   if jsonb_array_length(p->'items') not between 1 and 40 then raise exception 'ต้องมี 1–40 รายการ'; end if;
   delete from public.invoice_items where invoice_id=iid;
   for x in select * from jsonb_array_elements(p->'items') loop
    insert into public.invoice_items(owner_id,invoice_id,kind,label,quantity,rate,previous_reading,current_reading,position)
    values(u,iid,(x->>'kind')::public.charge_kind,x->>'label',(x->>'quantity')::numeric,(x->>'rate')::numeric,
    nullif(x->>'previous_reading','')::numeric,nullif(x->>'current_reading','')::numeric,n); n:=n+1;
   end loop;
   update public.invoices set total=(select sum(amount) from public.invoice_items where invoice_id=iid),due_date=(p->>'due_date')::date where id=iid;
  elsif op='draft_delete' then
   if inv.status<>'draft' then raise exception 'ลบได้เฉพาะร่าง'; end if;
   delete from public.invoice_items where invoice_id=iid;
   delete from public.invoices where id=iid;
  elsif op='invoice_void' then
   if inv.status in ('paid','draft','void') then raise exception 'ไม่สามารถยกเลิกสถานะนี้'; end if;
   update public.invoices set status='void',token_expires_at=now() where id=iid;
   insert into public.payment_events(owner_id,invoice_id,actor_id,event,note) values(u,iid,u,'void',coalesce(p->>'note',''));
  elsif op='payment_confirm' then
   if inv.status not in ('issued','overdue','slip_submitted') then raise exception 'บิลนี้ไม่พร้อมรับชำระ'; end if;
   if p->>'method' not in ('cash','transfer') then raise exception 'วิธีชำระไม่ถูกต้อง'; end if;
   update public.invoices set status='paid',paid_at=now(),paid_by=u,payment_method=p->>'method' where id=iid;
   insert into public.payment_events(owner_id,invoice_id,actor_id,event,amount,note)
   values(u,iid,u,'confirmed',inv.total,p->>'method');
  elsif op='payment_revoke' then
   if inv.status<>'paid' or length(trim(coalesce(p->>'note','')))=0 then raise exception 'กรุณาระบุเหตุผลยกเลิกการรับเงิน'; end if;
   update public.invoices set status=case when exists(select 1 from public.payment_submissions where invoice_id=iid) then 'slip_submitted'::public.invoice_status else 'issued'::public.invoice_status end,
   paid_at=null,paid_by=null,payment_method=null where id=iid;
   insert into public.payment_events(owner_id,invoice_id,actor_id,event,note,amount) values(u,iid,u,'revoked',p->>'note',-inv.total);
  else
   if inv.status in ('draft','void') then raise exception 'ไม่สามารถสร้างลิงก์ได้'; end if;
   update public.invoices set token=encode(extensions.gen_random_bytes(32),'hex'),token_expires_at=now()+interval '18 months' where id=iid;
  end if;
 else raise exception 'ไม่รองรับคำสั่ง'; end if;
 return jsonb_build_object('count',n);
end $$;

