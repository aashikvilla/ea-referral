-- Candidate deletion removes durable notification rows containing the
-- candidate's address or message payload. The insert guard locks a live
-- candidate row so concurrent deletion either waits and purges the new row,
-- or completes first and prevents the row from being queued. This cannot
-- recall email already accepted by the provider while a sender has an
-- in-flight request, but the persisted PII is still purged.
create or replace function public.ea_referral_require_live_notification_candidate()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid;
begin
  select c.auth_user_id into v_user_id
  from public.ea_referral_candidates as c
  where lower(c.email) = lower(new.recipient_email)
    and (new.recipient_user_id is null or c.auth_user_id = new.recipient_user_id)
  order by c.id
  limit 1
  for key share;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Notification recipient is no longer a current candidate';
  end if;

  if new.recipient_user_id is null then
    new.recipient_user_id := v_user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists ea_referral_require_live_notification_candidate
  on public.ea_referral_outbox;

create trigger ea_referral_require_live_notification_candidate
before insert on public.ea_referral_outbox
for each row
execute function public.ea_referral_require_live_notification_candidate();

create or replace function public.ea_referral_purge_candidate_notification_outbox()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  delete from public.ea_referral_outbox
  where recipient_user_id = old.auth_user_id
     or lower(recipient_email) = lower(old.email);
  return old;
end;
$$;

drop trigger if exists ea_referral_purge_candidate_notification_outbox
  on public.ea_referral_candidates;

create trigger ea_referral_purge_candidate_notification_outbox
after delete on public.ea_referral_candidates
for each row
execute function public.ea_referral_purge_candidate_notification_outbox();
