begin;
insert into auth.users(id,instance_id,aud,role,email,created_at) values
('11111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','sql-owner-a@example.invalid',now()),
('22222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','sql-owner-b@example.invalid',now()),
('44444444-4444-4444-8444-444444444444','00000000-0000-0000-0000-000000000000','authenticated','authenticated','sql-owner-c@example.invalid',now());
-- Privileged test setup only: the 200-room billing fixture uses Pro.
update public.owner_subscriptions set plan='pro',expires_at=now()+interval '1 month' where owner_id='11111111-1111-4111-8111-111111111111';
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$
declare p uuid; p2 uuid; r record; payload jsonb; result jsonb; i public.invoices; saved numeric; c integer;
begin
 result:=public.owner_command('property_save','{"name":"QA 200 rooms","rent":4000,"water_method":"meter","water_rate":18,"electric_rate":7,"due_day":5,"payment_info":"QA account","charges":[{"label":"Internet","amount":200}]}');
 p:=(result->>'id')::uuid;
 result:=public.owner_command('rooms_add',jsonb_build_object('property_id',p,'names',(select jsonb_agg(n::text) from generate_series(101,300)n)));
 for r in select * from public.rooms where property_id=p loop
  perform public.owner_command('tenant_movein',jsonb_build_object('property_id',p,'room_id',r.id,'name','QA tenant','moved_in','2026-09-01'));
 end loop;
 payload:=(select jsonb_agg(jsonb_build_object('room_id',id,'water_previous','10','water_current','12.345','electric_previous','100','electric_current','120')) from public.rooms where property_id=p);
 perform public.owner_command('meters_save',jsonb_build_object('property_id',p,'month','2026-09-01','rows',payload));
 result:=public.owner_command('drafts_create',jsonb_build_object('property_id',p,'month','2026-09-01'));
 assert (result->>'count')::int=200,'batch must create 200 invoices';
 assert (select count(*) from public.invoices where total=4382.21)=200,'decimal calculation differs';
 result:=public.owner_command('drafts_create',jsonb_build_object('property_id',p,'month','2026-09-01'));
 assert (result->>'count')::int=0,'duplicate draft generation';
 select * into i from public.invoices where property_id=p limit 1;
 perform public.owner_command('invoice_edit',jsonb_build_object('id',i.id,'due_date','2026-10-05','items',jsonb_build_array(jsonb_build_object('label','Adjusted rent','kind','rent','quantity',1,'rate',4500))));
 assert (select total from public.invoices where id=i.id)=4500,'draft item total';
 perform public.owner_command('issue_all',jsonb_build_object('property_id',p,'month','2026-09-01'));
 saved:=(select total from public.invoices where id=i.id);
 perform public.owner_command('property_save',jsonb_build_object('id',p,'name','Changed name','rent',9000,'water_method','meter','water_rate',99,'electric_rate',99,'due_day',8,'payment_info','Changed account','charges','[]'::jsonb));
 assert (select total=saved and property_name='QA 200 rooms' and payment_info='QA account' from public.invoices where id=i.id),'snapshot changed';
 begin
  perform public.owner_command('invoice_edit',jsonb_build_object('id',i.id,'items','[]'::jsonb));
  raise exception 'TEST FAILURE immutable invoice';
 exception when others then if sqlerrm='TEST FAILURE immutable invoice' then raise; end if; end;
 perform public.owner_command('payment_confirm',jsonb_build_object('id',i.id,'method','cash'));
 assert (select status='paid' and paid_at is not null and paid_by=auth.uid() from public.invoices where id=i.id),'payment confirmation';
 begin
  perform public.owner_command('payment_confirm',jsonb_build_object('id',i.id,'method','cash'));
  raise exception 'TEST FAILURE duplicate payment';
 exception when others then if sqlerrm='TEST FAILURE duplicate payment' then raise; end if; end;
 perform public.owner_command('payment_revoke',jsonb_build_object('id',i.id,'note','QA undo'));
 assert (select status='issued' and paid_at is null from public.invoices where id=i.id),'payment reversal';
 assert (select sum(amount) from public.payment_events where invoice_id=i.id)=0,'audit reversal';
 begin
  update public.invoices set total=1 where id=i.id;
  raise exception 'TEST FAILURE direct financial write';
 exception when insufficient_privilege then null; end;
 -- Flat-water fixture belongs to a different owner (one property per owner).
 perform set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
 -- Incomplete and decreasing meters, carry forward, room override, flat water.
 result:=public.owner_command('property_save','{"name":"QA flat","rent":3000,"water_method":"flat","water_rate":150,"electric_rate":7,"due_day":5,"payment_info":"QA","charges":[]}');
 p2:=(result->>'id')::uuid;
 perform public.owner_command('rooms_add',jsonb_build_object('property_id',p2,'names','["A1"]'::jsonb));
 select * into r from public.rooms where property_id=p2;
 perform public.owner_command('room_save',jsonb_build_object('property_id',p2,'id',r.id,'name','A1','rent',3500,'water_rate',200,'electric_rate',8));
 perform public.owner_command('tenant_movein',jsonb_build_object('property_id',p2,'room_id',r.id,'name','QA','moved_in','2026-09-15'));
 result:=public.owner_command('drafts_create',jsonb_build_object('property_id',p2,'month','2026-09-01'));
 assert (result->>'count')::int=0,'incomplete room billed';
 begin
  perform public.owner_command('meters_save',jsonb_build_object('property_id',p2,'month','2026-09-01','rows',jsonb_build_array(jsonb_build_object('room_id',r.id,'electric_previous',10,'electric_current',9))));
  raise exception 'TEST FAILURE declining meter';
 exception when check_violation then null; end;
 perform public.owner_command('meters_save',jsonb_build_object('property_id',p2,'month','2026-09-01','rows',jsonb_build_array(jsonb_build_object('room_id',r.id,'electric_previous',10,'electric_current',20))));
 perform public.owner_command('drafts_create',jsonb_build_object('property_id',p2,'month','2026-09-01'));
 assert (select total from public.invoices where property_id=p2)=3780,'flat/override/prorate calculation';
 begin
  perform public.owner_command('meters_save',jsonb_build_object('property_id',p2,'month','2026-10-01','rows',jsonb_build_array(jsonb_build_object('room_id',r.id,'electric_previous',0,'electric_current',25))));
  raise exception 'TEST FAILURE previous meter mismatch';
 exception when others then if sqlerrm='TEST FAILURE previous meter mismatch' then raise; end if; end;
 -- Owner B cannot read or act on A's rows.
 perform set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
 assert (select count(*) from public.properties)=0,'RLS properties leak';
 assert (select count(*) from public.invoices)=0,'RLS invoice leak';
 assert (select count(*) from public.tenants)=0,'RLS tenant leak';
 begin
  perform public.owner_command('payment_confirm',jsonb_build_object('id',i.id,'method','transfer'));
  raise exception 'TEST FAILURE cross owner command';
 exception when insufficient_privilege then null; end;
 begin
  perform public.owner_command('room_save',jsonb_build_object('property_id',p2,'id',r.id,'name','HACK'));
  raise exception 'TEST FAILURE cross owner room';
 exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
 begin perform * from public.invoices; raise exception 'TEST FAILURE anonymous invoice read'; exception when insufficient_privilege then null; end;
 begin perform public.submit_slip('fake','fake'); raise exception 'TEST FAILURE anonymous slip RPC'; exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'PASS: 200-room batch, rounding, snapshots, immutable invoices, payments, overrides, flat water, meter validation, RLS and anonymous denial. Fixtures rolled back.' as result;
