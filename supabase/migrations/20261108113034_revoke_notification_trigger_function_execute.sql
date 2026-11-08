-- Trigger functions run through their triggers only; callers do not need to
-- invoke them directly. Keep their execution privilege out of client roles.
revoke all on function public.ea_referral_require_live_notification_candidate()
  from public, anon, authenticated;
revoke all on function public.ea_referral_purge_candidate_notification_outbox()
  from public, anon, authenticated;

grant execute on function public.ea_referral_require_live_notification_candidate()
  to service_role;
grant execute on function public.ea_referral_purge_candidate_notification_outbox()
  to service_role;
