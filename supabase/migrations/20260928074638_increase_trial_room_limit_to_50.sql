-- Match the 60-day trial capacity to Starter for existing and new accounts.
create or replace function private.enforce_owner_capacity() returns trigger
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
      where owner_id=oid and room_count < case plan when 'starter' then 50 when 'standard' then 100 when 'pro' then 200 else 50 end
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
