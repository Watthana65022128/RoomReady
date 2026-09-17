insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-qr', 'payment-qr', false, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public=false, file_size_limit=2097152, allowed_mime_types=excluded.allowed_mime_types;

create policy owner_payment_qr on storage.objects for all to authenticated
using (
  bucket_id='payment-qr'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and storage.filename(name)='qr'
  and exists (select 1 from public.properties p where p.id::text=(storage.foldername(name))[2] and p.owner_id=(select auth.uid()))
)
with check (
  bucket_id='payment-qr'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and array_length(storage.foldername(name),1)=2
  and storage.filename(name)='qr'
  and exists (select 1 from public.properties p where p.id::text=(storage.foldername(name))[2] and p.owner_id=(select auth.uid()))
);
