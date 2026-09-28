import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
const moduleRoot = path.resolve(
  process.env.PGLITE_MODULE ||
    ".tmp/db-tools/node_modules/@electric-sql/pglite/dist",
);
const { PGlite } = await import(
  pathToFileURL(path.join(moduleRoot, "index.js")).href
);
const { pgcrypto } = await import(
  pathToFileURL(path.join(moduleRoot, "contrib/pgcrypto.js")).href
);
const db = new PGlite({ extensions: { pgcrypto } });
try {
  await db.exec(`
 create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create schema storage; create schema extensions;
 create extension pgcrypto with schema extensions;
 create table auth.users(id uuid primary key,instance_id uuid,aud text,role text,created_at timestamptz not null default now(),raw_app_meta_data jsonb default '{}'::jsonb,raw_user_meta_data jsonb default '{}'::jsonb,email text);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated,anon,service_role;
 grant execute on function auth.uid() to authenticated,anon,service_role;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text);
 alter table storage.objects enable row level security;
 grant usage on schema storage to authenticated;
 grant all on storage.objects to authenticated;
 create function storage.foldername(text) returns text[] language sql as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
 create function storage.filename(text) returns text language sql as $$ select (string_to_array($1,'/'))[array_length(string_to_array($1,'/'),1)] $$;
 `);
  const subscriptionsMigration = "20260920143225_owner_subscriptions.sql";
  const migrations = (await fs.readdir("supabase/migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const file of [
    "supabase/schema.sql",
    "supabase/hardening.sql",
    ...migrations
      .filter((name) => name < subscriptionsMigration)
      .map((name) => "supabase/migrations/" + name),
  ]) {
    await db.exec(await fs.readFile(file, "utf8"));
  }
  // A legacy account with multiple properties and more than the new quota.
  await db.exec(`
 insert into auth.users(id,email) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','legacy@example.invalid');
 insert into public.properties(id,owner_id,name) values
 ('aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Legacy A'),
 ('aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Legacy B');
 insert into public.rooms(owner_id,property_id,name) select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000001',n::text from generate_series(1,201)n;
 `);
  await db.exec(
    await fs.readFile(
      "supabase/migrations/" + subscriptionsMigration,
      "utf8",
    ),
  );
  for (const name of migrations.filter((name) => name > subscriptionsMigration)) {
    await db.exec(await fs.readFile("supabase/migrations/" + name, "utf8"));
  }
  const legacyTrial = await db.query(
    "select trial_ends_at - trial_started_at as duration from public.owner_subscriptions where owner_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'",
  );
  if (legacyTrial.rows[0]?.duration !== "60 days")
    throw new Error("Existing trial was not extended to 60 days.");
  await db.exec(await fs.readFile("supabase/tests/mvp.sql", "utf8"));
  await db.exec(await fs.readFile("supabase/tests/group-bills.sql", "utf8"));
  await db.exec(await fs.readFile("supabase/tests/subscriptions.sql", "utf8"));
  console.log(
    "PASS SQL integration (existing billing and group sharing included): migration, legacy data, quotas, RLS, expiry, requests, approvals, audit, QR policies",
  );
} catch (error) {
  console.error(error.message, error.where || "", error.position || "");
  process.exitCode = 1;
} finally {
  await db.close();
}
