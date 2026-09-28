-- Runs inside an isolated PostgreSQL fixture created by scripts/test-subscriptions.mjs.
do $$ begin
 assert (select property_count=2 and room_count=201 from public.owner_subscriptions where owner_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'legacy counters preserved';
 assert (select count(*) from public.rooms)=201,'legacy rows preserved';
end $$;
insert into auth.users(id,email,raw_app_meta_data) values
 ('11111111-1111-4111-8111-111111111111','owner@example.invalid','{}'),
 ('22222222-2222-4222-8222-222222222222','other@example.invalid','{}'),
 ('33333333-3333-4333-8333-333333333333','admin@example.invalid','{"role":"platform_admin"}');
-- User-editable metadata must never make an owner an administrator.
update auth.users set raw_user_meta_data='{"role":"platform_admin"}' where id='11111111-1111-4111-8111-111111111111';
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $$ declare pid uuid; rid uuid; r uuid; rec public.owner_subscriptions; begin
 assert not public.is_subscription_admin(),'user metadata escalated privileges';
 assert (select count(*) from public.owner_subscriptions)=1,'RLS leaks subscriptions';
 select * into rec from public.owner_subscriptions;
 assert rec.trial_ends_at-rec.trial_started_at=interval '60 days','trial length';
 begin update public.owner_subscriptions set plan='pro'; raise exception 'FAIL direct plan write'; exception when insufficient_privilege then null; end;
 begin perform public.subscription_admin('',0); raise exception 'FAIL owner admin directory'; exception when insufficient_privilege then null; end;
 begin perform public.approve_subscription(gen_random_uuid(),'pro'); raise exception 'FAIL owner approval'; exception when insufficient_privilege then null; end;
 pid:=(public.owner_command('property_save','{"name":"Quota test","rent":1000,"water_method":"meter","water_rate":10,"electric_rate":5,"due_day":5,"charges":[]}')->>'id')::uuid;
 begin
   perform public.owner_command('property_save','{"name":"Second","rent":1000,"water_method":"meter","water_rate":10,"electric_rate":5,"due_day":5,"charges":[]}');
   raise exception 'FAIL second property';
 exception when raise_exception then if sqlerrm='FAIL second property' then raise; end if; end;
 perform public.owner_command('rooms_add',jsonb_build_object('property_id',pid,'names',(select jsonb_agg(n::text) from generate_series(1,49)n)));
 begin
   perform public.owner_command('rooms_add',jsonb_build_object('property_id',pid,'names','["50","51"]'::jsonb));
   raise exception 'FAIL bulk over quota';
 exception when raise_exception then if sqlerrm='FAIL bulk over quota' then raise; end if; end;
 assert (select room_count from public.owner_subscriptions)=49,'bulk rollback leaked counter';
 assert (select count(*) from public.rooms)=49,'bulk rollback leaked rows';
 perform public.owner_command('rooms_add',jsonb_build_object('property_id',pid,'names','["50"]'::jsonb));
 assert (select room_count from public.owner_subscriptions)=50,'trial 50th room rejected';
 begin perform public.owner_command('rooms_add',jsonb_build_object('property_id',pid,'names','["51"]'::jsonb)); raise exception 'FAIL trial cap'; exception when raise_exception then if sqlerrm='FAIL trial cap' then raise; end if; end;
 r:=public.request_subscription('starter');
 assert public.request_subscription('starter')=r,'duplicate request not idempotent';
 perform public.request_subscription('standard');
 perform public.request_subscription('starter');
 assert (select count(*) from public.subscription_requests where status='pending')=1,'multiple pending';
 assert (select plan from public.owner_subscriptions)='trial','request granted privileges';
end $$;
-- Free one fixture slot so the paid Starter boundary is exercised independently.
reset role;
delete from public.rooms where owner_id='11111111-1111-4111-8111-111111111111' and name='50';
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $$ begin
 assert (select count(*) from public.rooms)=0,'room ownership leak';
 assert (select count(*) from public.subscription_requests)=0,'request ownership leak';
end $$;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
do $$ declare rid uuid; expiry timestamptz; begin
 assert public.is_subscription_admin(),'admin role rejected';
 assert jsonb_array_length(public.subscription_admin('owner@example.invalid',0))=1,'admin search';
 select id into rid from public.subscription_requests where status='pending';
 perform public.approve_subscription(rid,'starter');
 select expires_at into expiry from public.owner_subscriptions where owner_id='11111111-1111-4111-8111-111111111111';
 assert expiry=now()+interval '1 month','first approval expiry';
 begin perform public.approve_subscription(rid,'starter'); raise exception 'FAIL duplicate approval'; exception when raise_exception then if sqlerrm='FAIL duplicate approval' then raise; end if; end;
 assert (select count(*) from public.subscription_events)=1,'audit missing/duplicate';
end $$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $$ declare pid uuid; begin
 select id into pid from public.properties;
 assert (select plan from public.owner_subscriptions)='starter','starter approval missing';
 begin perform public.owner_command('rooms_add',jsonb_build_object('property_id',pid,'names','["50","51"]'::jsonb)); raise exception 'FAIL starter bulk cap'; exception when raise_exception then if sqlerrm='FAIL starter bulk cap' then raise; end if; end;
 assert (select room_count from public.owner_subscriptions)=49,'starter bulk rollback leaked counter';
 assert (select count(*) from public.rooms)=49,'starter bulk rollback leaked rows';
 perform public.owner_command('rooms_add',jsonb_build_object('property_id',pid,'names','["50"]'::jsonb));
 assert (select room_count from public.owner_subscriptions)=50,'starter 50th room rejected';
 begin perform public.owner_command('rooms_add',jsonb_build_object('property_id',pid,'names','["51"]'::jsonb)); raise exception 'FAIL starter cap'; exception when raise_exception then if sqlerrm='FAIL starter cap' then raise; end if; end;
 perform public.request_subscription('standard');
end $$;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
select public.approve_subscription((select id from public.subscription_requests where status='pending'),'standard');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $$ declare pid uuid; begin
 select id into pid from public.properties;
 perform public.owner_command('rooms_add',jsonb_build_object('property_id',pid,'names',(select jsonb_agg(n::text) from generate_series(51,100)n)));
 begin perform public.owner_command('rooms_add',jsonb_build_object('property_id',pid,'names','["101"]'::jsonb)); raise exception 'FAIL standard cap'; exception when raise_exception then if sqlerrm='FAIL standard cap' then raise; end if; end;
 perform public.request_subscription('standard');
end $$;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
do $$ declare rid uuid; expiry timestamptz; begin
 select id into rid from public.subscription_requests where status='pending';
 select expires_at into expiry from public.owner_subscriptions where owner_id='11111111-1111-4111-8111-111111111111';
 perform public.approve_subscription(rid,'standard');
 assert (select expires_at from public.owner_subscriptions where owner_id='11111111-1111-4111-8111-111111111111')=expiry+interval '1 month','renewal lost remaining days';
end $$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select public.request_subscription('pro');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
select public.approve_subscription((select id from public.subscription_requests where status='pending'),'pro');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $$ declare pid uuid; begin
 select id into pid from public.properties;
 perform public.owner_command('rooms_add',jsonb_build_object('property_id',pid,'names',(select jsonb_agg(n::text) from generate_series(101,200)n)));
 begin perform public.owner_command('rooms_add',jsonb_build_object('property_id',pid,'names','["201"]'::jsonb)); raise exception 'FAIL pro cap'; exception when raise_exception then if sqlerrm='FAIL pro cap' then raise; end if; end;
 perform public.request_subscription('starter');
end $$;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
select public.approve_subscription((select id from public.subscription_requests where status='pending'),'starter');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $$ declare pid uuid; rid uuid; begin
 assert (select count(*) from public.rooms)=200,'downgrade deleted data';
 select id into pid from public.properties;
 select id into rid from public.rooms limit 1;
 perform public.owner_command('room_save',jsonb_build_object('property_id',pid,'id',rid,'name','Edited over quota'));
 begin perform public.owner_command('rooms_add',jsonb_build_object('property_id',pid,'names','["extra"]'::jsonb)); raise exception 'FAIL downgrade cap'; exception when raise_exception then if sqlerrm='FAIL downgrade cap' then raise; end if; end;
 insert into storage.objects(bucket_id,name) values('payment-qr',auth.uid()::text||'/'||pid::text||'/qr');
end $$;
reset role;
update public.owner_subscriptions set expires_at=now() where owner_id='11111111-1111-4111-8111-111111111111';
set role authenticated;
do $$ declare pid uuid; rid uuid; n integer; begin
 select id into pid from public.properties;
 select id into rid from public.rooms limit 1;
 assert (select count(*) from public.rooms)=200,'expired read blocked';
 begin perform public.owner_command('room_save',jsonb_build_object('property_id',pid,'id',rid,'name','Blocked')); raise exception 'FAIL expired write'; exception when insufficient_privilege then null; end;
 begin insert into public.property_bill_links(property_id,token) values(pid,repeat('a',64)); raise exception 'FAIL expired share'; exception when insufficient_privilege then null; end;
 delete from storage.objects where bucket_id='payment-qr';
 get diagnostics n=row_count;
 assert n=0,'expired QR delete allowed';
 assert (select count(*) from storage.objects)=1,'expired QR read blocked';
 begin update storage.objects set name=name where bucket_id='payment-qr'; get diagnostics n=row_count; assert n=0,'expired QR update allowed'; exception when insufficient_privilege then null; end;
 perform public.request_subscription('starter');
end $$;
reset role;
select set_config('request.jwt.claim.sub','',false);
-- Exact trial boundary and legacy writes.
update public.owner_subscriptions set trial_started_at=now()-interval '30 days',trial_ends_at=now() where owner_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $$ begin
 assert (select count(*) from public.rooms)=201,'legacy inaccessible after expiry';
 begin perform public.owner_command('rooms_add','{"property_id":"aaaaaaaa-0000-4000-8000-000000000001","names":["new"]}'); raise exception 'FAIL expired legacy insert'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set role anon;
do $$ begin
 begin perform public.request_subscription('pro'); raise exception 'FAIL anon request'; exception when insufficient_privilege then null; end;
 begin perform public.is_subscription_admin(); raise exception 'FAIL anon admin'; exception when insufficient_privilege then null; end;
end $$;
reset role;
