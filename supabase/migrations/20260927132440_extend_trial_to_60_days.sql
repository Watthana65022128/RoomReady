-- Existing trial accounts receive the same total duration as new signups.
update public.owner_subscriptions
set trial_ends_at = trial_started_at + interval '60 days',
    updated_at = now()
where plan = 'trial'
  and trial_ends_at = trial_started_at + interval '30 days';

alter table public.owner_subscriptions
  alter column trial_ends_at set default now() + interval '60 days';

create or replace function private.start_owner_trial() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.owner_subscriptions(owner_id,trial_started_at,trial_ends_at)
  values(new.id,new.created_at,new.created_at+interval '60 days');
  return new;
end $$;
