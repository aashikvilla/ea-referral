-- Index foreign-key columns flagged by the Supabase performance advisor.
-- These indexes support joins and parent-row update/delete checks; no schema
-- behavior or data changes are made.
create index if not exists ea_referral_applications_candidate_id_idx
  on public.ea_referral_applications(candidate_id);

create index if not exists ea_referral_audit_job_id_idx
  on public.ea_referral_audit(job_id);

create index if not exists ea_referral_events_job_id_idx
  on public.ea_referral_events(job_id);

create index if not exists ea_referral_outbox_recipient_user_id_idx
  on public.ea_referral_outbox(recipient_user_id);

create index if not exists ea_referral_resumes_job_id_idx
  on public.ea_referral_resumes(job_id);
