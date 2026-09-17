begin;
create temporary table group_bill_qa (owner_id uuid, other_owner_id uuid, property_id uuid, other_property_id uuid, invoice_id uuid);
insert into group_bill_qa(owner_id,other_owner_id) values(gen_random_uuid(),gen_random_uuid());
insert into auth.users(id,instance_id,aud,role,email)
select owner_id,'00000000-0000-0000-0000-000000000000'::uuid,'authenticated','authenticated',owner_id::text||'@group-qa.invalid' from group_bill_qa
union all select other_owner_id,'00000000-0000-0000-0000-000000000000'::uuid,'authenticated','authenticated',other_owner_id::text||'@group-qa.invalid' from group_bill_qa;
grant select,update on group_bill_qa to authenticated,service_role;
select set_config('request.jwt.claim.sub',(select owner_id::text from group_bill_qa),true);
set local role authenticated;
do $$
declare p uuid; p2 uuid; r uuid; i uuid;
begin
 p:=(public.owner_command('property_save','{"name":"Group QA","rent":4000,"water_method":"meter","water_rate":18,"electric_rate":7,"due_day":5,"payment_info":"QA bank","charges":[]}')->>'id')::uuid;
 p2:=(public.owner_command('property_save','{"name":"Other Group QA","rent":4000,"water_method":"meter","water_rate":18,"electric_rate":7,"due_day":5,"payment_info":"QA bank","charges":[]}')->>'id')::uuid;
 perform public.owner_command('rooms_add',jsonb_build_object('property_id',p,'names',jsonb_build_array('201')));
 select id into r from public.rooms where property_id=p;
 perform public.owner_command('tenant_movein',jsonb_build_object('property_id',p,'room_id',r,'name','PRIVATE QA TENANT','moved_in','2026-09-01'));
 perform public.owner_command('meters_save',jsonb_build_object('property_id',p,'month','2026-09-01','rows',jsonb_build_array(jsonb_build_object('room_id',r,'water_previous',0,'water_current',1,'electric_previous',0,'electric_current',1))));
 perform public.owner_command('drafts_create',jsonb_build_object('property_id',p,'month','2026-09-01'));
 perform public.owner_command('issue_all',jsonb_build_object('property_id',p,'month','2026-09-01'));
 select id into i from public.invoices where property_id=p;
 assert i is not null,'fixture must issue invoice';
 update group_bill_qa set property_id=p,other_property_id=p2,invoice_id=i;
 insert into public.property_bill_links values(p,repeat('a',64)),(p2,repeat('b',64));
 insert into public.property_bill_links values(p,repeat('c',64)) on conflict(property_id) do nothing;
 assert (select token=repeat('a',64) from public.property_bill_links where property_id=p),'repeat share must preserve link';
 update public.property_bill_links set token=repeat('d',64) where property_id=p;
 assert (select token=repeat('d',64) from public.property_bill_links where property_id=p),'owner can rotate';
end $$;
select set_config('request.jwt.claim.sub',(select other_owner_id::text from group_bill_qa),true);
do $$
begin
 assert not exists(select 1 from public.property_bill_links),'other owner cannot list links';
 update public.property_bill_links set token=repeat('e',64) where property_id=(select property_id from group_bill_qa);
 assert not found,'other owner cannot rotate';
 begin
  insert into public.property_bill_links values((select property_id from group_bill_qa),repeat('f',64));
  raise exception 'TEST FAILURE cross owner insert';
 exception when insufficient_privilege then null;
 end;
 assert not has_table_privilege('anon','public.property_bill_links','select'),'anonymous must not list links';
 assert not has_function_privilege('authenticated','public.submit_group_slip(text,uuid,text)','execute'),'owners must not bypass gateway finalization';
end $$;
reset role;
set local role service_role;
do $$
declare q record; object_path text;
begin
 select * into q from group_bill_qa;
 object_path:=q.owner_id::text||'/'||q.invoice_id::text||'/qa.png';
 begin
  perform public.submit_group_slip(repeat('a',64),q.invoice_id,object_path);
  raise exception 'TEST FAILURE revoked token';
 exception when raise_exception then if sqlerrm='TEST FAILURE revoked token' then raise; end if;
 end;
 begin
  perform public.submit_group_slip(repeat('b',64),q.invoice_id,object_path);
  raise exception 'TEST FAILURE cross property';
 exception when raise_exception then if sqlerrm='TEST FAILURE cross property' then raise; end if;
 end;
 perform public.submit_group_slip(repeat('d',64),q.invoice_id,object_path);
 perform public.submit_group_slip(repeat('d',64),q.invoice_id,replace(object_path,'qa.png','qa2.png'));
 assert (select count(*)=2 from public.payment_submissions where invoice_id=q.invoice_id),'preserve earlier submissions';
 assert (select status='slip_submitted' from public.invoices where id=q.invoice_id),'upload cannot confirm payment';
end $$;
rollback;