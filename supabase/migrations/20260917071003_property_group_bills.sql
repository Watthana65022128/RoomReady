-- Created only when an owner explicitly shares; existing properties stay private.
create table public.property_bill_links (
  property_id uuid primary key references public.properties(id) on delete cascade,
  token text not null unique check (token ~ '^[a-f0-9]{64}$')
);
alter table public.property_bill_links enable row level security;
revoke all on public.property_bill_links from public, anon, authenticated;
grant select, insert on public.property_bill_links to authenticated;
grant update(token) on public.property_bill_links to authenticated;
grant all on public.property_bill_links to service_role;
create policy owner_group_link_select on public.property_bill_links for select to authenticated
using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid())));
create policy owner_group_link_insert on public.property_bill_links for insert to authenticated
with check (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid())));
create policy owner_group_link_update on public.property_bill_links for update to authenticated
using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid())))
with check (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid())));

-- Serialize finalization against link rotation, including in-flight uploads.
create function public.submit_group_slip(group_token text, invoice_id uuid, object_path text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare property uuid; bill_token text;
begin
  select l.property_id into property from public.property_bill_links l
    where l.token = group_token for share;
  if not found then raise exception 'ลิงก์ถูกเปลี่ยนแล้ว กรุณาขอลิงก์ใหม่'; end if;
  select i.token into bill_token from public.invoices i
    join public.properties p on p.id = i.property_id and p.owner_id = i.owner_id
    where i.id = invoice_id and i.property_id = property;
  if not found then raise exception 'ไม่พบบิลของหอนี้'; end if;
  return public.submit_slip(bill_token, object_path);
end $$;
revoke all on function public.submit_group_slip(text,uuid,text) from public, anon, authenticated;
grant execute on function public.submit_group_slip(text,uuid,text) to service_role;
create index invoices_group_listing on public.invoices(property_id, month desc, id)
where status not in ('draft','void');
