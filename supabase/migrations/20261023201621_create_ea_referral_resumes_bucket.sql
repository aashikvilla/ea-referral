-- Private resume storage for EA Referral. No public storage policies are created.
insert into storage.buckets (id, name, public, allowed_mime_types)
values (
  'ea_referral_resumes',
  'ea_referral_resumes',
  false,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
);
