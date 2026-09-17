alter policy owner_payment_qr on storage.objects
using (
  bucket_id='payment-qr'
  and (storage.foldername(objects.name))[1]=(select auth.uid())::text
  and storage.filename(objects.name)='qr'
  and exists (select 1 from public.properties p where p.id::text=(storage.foldername(objects.name))[2] and p.owner_id=(select auth.uid()))
)
with check (
  bucket_id='payment-qr'
  and (storage.foldername(objects.name))[1]=(select auth.uid())::text
  and array_length(storage.foldername(objects.name),1)=2
  and storage.filename(objects.name)='qr'
  and exists (select 1 from public.properties p where p.id::text=(storage.foldername(objects.name))[2] and p.owner_id=(select auth.uid()))
);
