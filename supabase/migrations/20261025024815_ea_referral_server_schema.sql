-- Private owner-operated referral workflow. All client roles are explicitly denied.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.ea_referral_jobs (
  id uuid primary key default gen_random_uuid(),
  canonical_job_id text not null unique check (canonical_job_id ~ '^EA:[0-9]+$'),
  title text not null check (length(title) between 1 and 240),
  team text not null default '',
  location text not null default '',
  locations text[] not null default '{}',
  employment_type text not null default '',
  official_url text not null,
  constraint ea_referral_job_url_allowed check (official_url ~* '^https://jobs\.ea\.com/([a-z]{2}_[A-Z]{2}/)?careers/JobDetail/([A-Za-z0-9-]+/)?[0-9]+/?$'),
  constraint ea_referral_job_url_id_matches check (substring(official_url from '/([0-9]+)/?$') is not null and substring(official_url from '/([0-9]+)/?$') = substring(canonical_job_id from '^EA:([0-9]+)$')),
  description text not null default '',
  status text not null default 'draft' check (status in ('draft','open','paused','closed','referred')),
  availability text not null default 'unknown' check (availability in ('open','closed','unknown')),
  availability_checked_at timestamptz,
  availability_source text not null default 'unknown' check (availability_source in ('manual','official','unknown')),
  availability_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ea_referral_candidates (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  country text not null,
  current_title text not null default '',
  current_company text not null default '',
  relationship text not null check (relationship in ('current_ea_employee','customer_client','family_member','former_colleague','friend','professional_network','other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ea_referral_candidate_contact_valid check (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' and length(regexp_replace(phone, '\D', '', 'g')) >= 7)
);

create table if not exists public.ea_referral_resumes (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.ea_referral_jobs(id) on delete restrict,
  storage_path text not null unique,
  file_name text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 4194304),
  content_type text not null check (content_type in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  version integer not null check (version > 0),
  parser_status text not null default 'pending' check (parser_status in ('pending','ready','correction_required','unavailable','failed')),
  scan_status text not null default 'quarantined' check (scan_status in ('quarantined','clean','rejected')),
  is_current boolean not null default true,
  parsed_fields jsonb not null default '{"firstName":false,"lastName":false,"email":false,"phone":false}'::jsonb,
  created_at timestamptz not null default now(),
  unique (auth_user_id, job_id, version),
  unique (id, job_id)
);

create table if not exists public.ea_referral_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.ea_referral_jobs(id) on delete restrict,
  candidate_id uuid references public.ea_referral_candidates(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'submitted' check (status in ('submitted','processing','correction_required','eligibility_review','needs_clarification','ready_for_review','shortlisted','selected_pending_submission','referral_confirmed','not_selected','slot_filled_other')),
  submitted_at timestamptz not null default now(),
  eligibility jsonb not null,
  resume_id uuid references public.ea_referral_resumes(id) on delete set null,
  resume jsonb not null,
  resume_ready boolean not null default false,
  correction_fields text[] not null default '{}',
  showcase jsonb not null default '{"note":"","links":[],"files":[]}'::jsonb,
  match_score numeric not null default 0 check (match_score between 0 and 100),
  match jsonb not null default '{"mandatory":0,"relevantWork":0,"preferred":0,"achievements":0}'::jsonb,
  match_summary text not null default 'Assessment unavailable; owner review required.',
  evidence jsonb not null default '[]'::jsonb,
  requirements jsonb not null default '[]'::jsonb,
  note text,
  fit_note text,
  admin_note text,
  updated_at timestamptz not null default now(),
  unique (job_id, candidate_id),
  unique (job_id, user_id),
  unique (resume_id),
  constraint ea_referral_application_identity_pair check ((user_id is null) = (candidate_id is null))
);
create index if not exists ea_referral_app_user_submitted_idx on public.ea_referral_applications(user_id, submitted_at desc);
create index if not exists ea_referral_app_job_status_idx on public.ea_referral_applications(job_id, status, submitted_at desc);

create table if not exists public.ea_referral_slots (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.ea_referral_jobs(id) on delete restrict,
  application_id uuid not null unique references public.ea_referral_applications(id) on delete restrict,
  status text not null check (status in ('reserved','confirmed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists ea_referral_one_active_slot_per_job on public.ea_referral_slots(job_id);
create unique index if not exists ea_referral_one_current_resume_per_user_job on public.ea_referral_resumes(auth_user_id,job_id) where is_current;

create table if not exists public.ea_referral_supporting_files (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete set null,
  application_id uuid references public.ea_referral_applications(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  content_type text not null check (content_type in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','image/png','image/jpeg','image/webp')),
  file_size bigint not null check (file_size > 0 and file_size <= 4194304),
  scan_status text not null default 'quarantined' check (scan_status in ('quarantined','clean','rejected')),
  created_at timestamptz not null default now(),
  constraint ea_referral_support_file_owner_stage check (application_id is not null or auth_user_id is not null)
);
create index if not exists ea_referral_supporting_files_app_idx on public.ea_referral_supporting_files(application_id);
create index if not exists ea_referral_supporting_files_owner_idx on public.ea_referral_supporting_files(auth_user_id,created_at desc);

create table if not exists public.ea_referral_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  label text not null,
  detail text not null default '',
  tone text not null default 'neutral' check (tone in ('neutral','positive','warning')),
  job_id uuid references public.ea_referral_jobs(id) on delete set null,
  application_id uuid references public.ea_referral_applications(id) on delete set null,
  session_key text,
  created_at timestamptz not null default now()
);
create index if not exists ea_referral_events_created_idx on public.ea_referral_events(created_at desc);
create index if not exists ea_referral_events_application_idx on public.ea_referral_events(application_id);

create table if not exists public.ea_referral_audit (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  action text not null,
  job_id uuid references public.ea_referral_jobs(id) on delete set null,
  application_id uuid references public.ea_referral_applications(id) on delete set null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ea_referral_audit_actor_idx on public.ea_referral_audit(actor_user_id,created_at desc);
create index if not exists ea_referral_audit_application_idx on public.ea_referral_audit(application_id);

create table if not exists public.ea_referral_outbox (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  recipient_user_id uuid references auth.users(id) on delete set null,
  recipient_email text not null,
  template text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','sending','sent','failed','cancelled')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ea_referral_outbox_pending_idx on public.ea_referral_outbox(status, available_at) where status in ('pending','failed');

create table if not exists public.ea_referral_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','completed','rejected')),
  completed_at timestamptz
);
create unique index if not exists ea_referral_one_pending_deletion_per_user on public.ea_referral_deletion_requests(auth_user_id) where status='pending' and auth_user_id is not null;

update storage.buckets set file_size_limit=4194304,allowed_mime_types=array[
  'application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain','image/png','image/jpeg','image/webp'
] where id='ea_referral_resumes';

do $$ declare t text; begin
  foreach t in array array['ea_referral_jobs','ea_referral_candidates','ea_referral_resumes','ea_referral_applications','ea_referral_slots','ea_referral_supporting_files','ea_referral_events','ea_referral_audit','ea_referral_outbox','ea_referral_deletion_requests'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- This helper emits only a public-safe job summary.
create or replace function public.ea_referral_public_jobs()
returns setof jsonb language sql stable security invoker
set search_path = pg_catalog, public
as $$
  select jsonb_build_object('id', j.id, 'canonical_job_id', j.canonical_job_id, 'title', j.title, 'team', j.team, 'location', j.location,
    'locations', j.locations, 'employment_type', j.employment_type, 'official_url', j.official_url, 'status', j.status,
    'availability', j.availability, 'availability_checked_at', j.availability_checked_at, 'availability_source', j.availability_source,
    'description', j.description, 'created_at', j.created_at, 'updated_at', j.updated_at)
  from public.ea_referral_jobs j where j.status <> 'draft'
  order by j.updated_at desc;
$$;

create or replace function public.ea_referral_create_resume(p_input jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare r public.ea_referral_resumes; v_application public.ea_referral_applications; v_job public.ea_referral_jobs; v_user_id uuid; v_job_id uuid;
  next_version integer; stored_bytes bigint; recent_uploads integer; is_ready boolean; missing_fields text[];
begin
  v_user_id := (p_input->>'authUserId')::uuid;
  v_job_id := (p_input->>'jobId')::uuid;
  -- Match submission's user-then-job lock order to avoid upload/submission deadlocks.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text,0));
  select * into v_job from public.ea_referral_jobs where id=v_job_id for update;
  if not found then raise exception using errcode='P0002', message='Job not found'; end if;
  if v_job.status<>'open' or v_job.availability<>'open' or v_job.availability_checked_at is null
    or v_job.availability_checked_at<now()-interval '24 hours'
    or exists(select 1 from public.ea_referral_slots where job_id=v_job.id) then
    raise exception using errcode='23505', message='Job is not accepting uploads';
  end if;
  if p_input->>'storagePath' not like v_user_id::text || '/%' then raise exception using errcode='22023', message='Invalid private storage path'; end if;
  if exists(select 1 from public.ea_referral_deletion_requests where auth_user_id=v_user_id and status='pending') then
    raise exception using errcode='23505', message='A pending data deletion request blocks new uploads';
  end if;
  if exists(select 1 from public.ea_referral_slots s join public.ea_referral_applications a on a.id=s.application_id where a.user_id=v_user_id and a.job_id=v_job_id) then
    raise exception using errcode='23505', message='Resume cannot be replaced while a referral slot is reserved or confirmed';
  end if;
  if exists(select 1 from public.ea_referral_slots where job_id=v_job_id) then
    raise exception using errcode='23505', message='Job is not accepting uploads';
  end if;
  select * into v_application from public.ea_referral_applications where user_id=v_user_id and job_id=v_job_id for update;
  if found and v_application.status <> 'correction_required' then
    raise exception using errcode='23505', message='A resume can only be replaced after a correction request';
  end if;
  select coalesce(max(version),0)+1 into next_version from public.ea_referral_resumes where auth_user_id=v_user_id and job_id=v_job_id;
  select coalesce(sum(file_size),0) into stored_bytes from public.ea_referral_resumes where auth_user_id=v_user_id;
  select stored_bytes+coalesce(sum(file_size),0) into stored_bytes from public.ea_referral_supporting_files where auth_user_id=v_user_id;
  select count(*) into recent_uploads from public.ea_referral_resumes where auth_user_id=v_user_id and created_at>now()-interval '24 hours';
  if recent_uploads>=10 or (select count(*) from public.ea_referral_resumes where auth_user_id=v_user_id)>=30
    or stored_bytes+(p_input->>'fileSize')::bigint>104857600 then raise exception using errcode='22023', message='Resume upload quota exceeded'; end if;
  update public.ea_referral_resumes set is_current=false where auth_user_id=v_user_id and job_id=v_job_id and is_current=true;
  insert into public.ea_referral_resumes(auth_user_id,job_id,storage_path,file_name,file_size,content_type,version,parser_status,parsed_fields,scan_status,is_current)
  values(v_user_id,v_job_id,p_input->>'storagePath',p_input->>'fileName',(p_input->>'fileSize')::bigint,p_input->>'contentType',next_version,
    coalesce(p_input->>'parserStatus','pending'),coalesce(p_input->'parsedFields','{}'::jsonb),coalesce(p_input->>'scanStatus','quarantined'),true)
  returning * into r;
  if v_application.id is not null then
    is_ready := r.scan_status='clean' and r.parser_status='ready' and r.parsed_fields @> '{"firstName":true,"lastName":true,"email":true,"phone":true}'::jsonb;
    select coalesce(array_agg(fields.field),array['firstName','lastName','email','phone']) into missing_fields
      from unnest(array['firstName','lastName','email','phone']) as fields(field)
      where coalesce((r.parsed_fields->>fields.field)::boolean,false) is not true;
    update public.ea_referral_applications set
      resume_id=r.id,
      resume=jsonb_build_object('fileName',r.file_name,'fileSize',r.file_size,'fileType',r.content_type,'version',r.version,'uploadedAt',r.created_at,'fields',r.parsed_fields),
      resume_ready=is_ready,
      correction_fields=case when is_ready then '{}'::text[] else missing_fields end,
      status=case when not is_ready then 'correction_required'
        when eligibility->>'previouslyApplied'='false' and eligibility->>'previouslyReferred'='false'
          and eligibility->>'knowsOwner'='false' and eligibility->>'inListedLocation'='true' then 'ready_for_review'
        else 'eligibility_review' end,
      match_score=0,match='{"mandatory":0,"relevantWork":0,"preferred":0,"achievements":0}'::jsonb,
      match_summary='Resume replaced; assessment is stale and owner review is required.',evidence='[]'::jsonb,requirements='[]'::jsonb,
      updated_at=now() where id=v_application.id;
  end if;
  return to_jsonb(r);
end $$;

create or replace function public.ea_referral_validate_resume(p_resume_id uuid,p_auth_user_id uuid,p_patch jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare r public.ea_referral_resumes;
begin
  update public.ea_referral_resumes set parser_status=p_patch->>'parserStatus',parsed_fields=p_patch->'parsedFields',scan_status=p_patch->>'scanStatus'
    where id=p_resume_id and auth_user_id=p_auth_user_id and is_current=true returning * into r;
  if not found then raise exception using errcode='P0002', message='Current resume upload not found'; end if;
  return to_jsonb(r);
end $$;

create or replace function public.ea_referral_create_supporting_file(p_input jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare r public.ea_referral_supporting_files; v_user_id uuid; stored_bytes bigint; recent_uploads integer;
begin
  v_user_id := (p_input->>'authUserId')::uuid;
  if p_input->>'storagePath' not like v_user_id::text || '/%' then raise exception using errcode='22023', message='Invalid private storage path'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text,0));
  if exists(select 1 from public.ea_referral_deletion_requests where auth_user_id=v_user_id and status='pending') then
    raise exception using errcode='23505', message='A pending data deletion request blocks new uploads';
  end if;
  select coalesce(sum(file_size),0) into stored_bytes from public.ea_referral_resumes where auth_user_id=v_user_id;
  select stored_bytes+coalesce(sum(file_size),0) into stored_bytes from public.ea_referral_supporting_files where auth_user_id=v_user_id;
  select count(*) into recent_uploads from public.ea_referral_supporting_files where auth_user_id=v_user_id and created_at>now()-interval '24 hours';
  if recent_uploads>=30 or (select count(*) from public.ea_referral_supporting_files where auth_user_id=v_user_id)>=100
    or stored_bytes+(p_input->>'fileSize')::bigint>104857600 then raise exception using errcode='22023', message='Supporting upload quota exceeded'; end if;
  insert into public.ea_referral_supporting_files(auth_user_id,storage_path,file_name,file_size,content_type,scan_status)
  values(v_user_id,p_input->>'storagePath',p_input->>'fileName',(p_input->>'fileSize')::bigint,p_input->>'contentType',coalesce(p_input->>'scanStatus','quarantined'))
  returning * into r;
  return to_jsonb(r);
end $$;

create or replace function public.ea_referral_request_deletion(p_auth_user_id uuid)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare r public.ea_referral_deletion_requests;
begin
  if p_auth_user_id is null then raise exception using errcode='22023', message='Verified candidate required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_auth_user_id::text,0));
  select * into r from public.ea_referral_deletion_requests where auth_user_id=p_auth_user_id and status='pending' limit 1;
  if not found then insert into public.ea_referral_deletion_requests(auth_user_id) values(p_auth_user_id) returning * into r; end if;
  return jsonb_build_object('id',r.id,'requested_at',r.requested_at,'status',r.status);
end $$;

create or replace function public.ea_referral_deletion_paths(p_request_id uuid)
returns table(bucket text, storage_path text) language sql stable security invoker set search_path = pg_catalog, public as $$
  select 'ea_referral_resumes',r.storage_path from public.ea_referral_deletion_requests d join public.ea_referral_resumes r on r.auth_user_id=d.auth_user_id where d.id=p_request_id and d.status='pending'
  union all
  select 'ea_referral_resumes',f.storage_path from public.ea_referral_deletion_requests d join public.ea_referral_supporting_files f on f.auth_user_id=d.auth_user_id where d.id=p_request_id and d.status='pending'
  ;
$$;

create or replace function public.ea_referral_process_deletion(p_request_id uuid,p_actor_id uuid)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_user_id uuid; app_ids uuid[];
begin
  select auth_user_id into v_user_id from public.ea_referral_deletion_requests where id=p_request_id and status='pending' for update;
  if not found or v_user_id is null then raise exception using errcode='P0002', message='Pending deletion request not found'; end if;
  select array_agg(id) into app_ids from public.ea_referral_applications where user_id=v_user_id;
  delete from public.ea_referral_events where application_id=any(coalesce(app_ids,'{}'::uuid[]));
  delete from public.ea_referral_audit where actor_user_id=v_user_id or application_id=any(coalesce(app_ids,'{}'::uuid[]));
  update public.ea_referral_applications set user_id=null,candidate_id=null,resume_id=null,
    resume='{"fileName":"","fileSize":0,"fileType":"","version":0,"uploadedAt":"","fields":{"firstName":false,"lastName":false,"email":false,"phone":false}}'::jsonb,
    resume_ready=false,correction_fields='{}',showcase='{"note":"","links":[],"files":[]}'::jsonb,
    note=null,fit_note=null,admin_note=null,match_score=0,
    match='{"mandatory":0,"relevantWork":0,"preferred":0,"achievements":0}'::jsonb,
    match_summary='Candidate data deleted.',evidence='[]'::jsonb,requirements='[]'::jsonb,updated_at=now()
    where user_id=v_user_id;
  delete from public.ea_referral_candidates where auth_user_id=v_user_id;
  delete from public.ea_referral_resumes where auth_user_id=v_user_id;
  delete from public.ea_referral_supporting_files where auth_user_id=v_user_id or application_id=any(coalesce(app_ids,'{}'::uuid[]));
  update public.ea_referral_deletion_requests set status='completed',completed_at=now(),auth_user_id=null where id=p_request_id;
  insert into public.ea_referral_audit(actor_user_id,action,detail) values(p_actor_id,'candidate_data_deleted',jsonb_build_object('deletion_request_id',p_request_id,'application_count',coalesce(cardinality(app_ids),0)));
  return jsonb_build_object('id',p_request_id,'status','completed');
end $$;

create or replace function public.ea_referral_create_job(p_actor_id uuid, p_job jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare r public.ea_referral_jobs;
begin
  insert into public.ea_referral_jobs(canonical_job_id,title,team,location,locations,employment_type,official_url,description)
  values (p_job->>'canonicalJobId',p_job->>'title',coalesce(p_job->>'team',''),coalesce(p_job->>'location',''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_job->'locations','[]'::jsonb))), '{}'),coalesce(p_job->>'employmentType',''),
    p_job->>'officialUrl',coalesce(p_job->>'description','')) returning * into r;
  insert into public.ea_referral_audit(actor_user_id,action,job_id) values(p_actor_id,'job_created',r.id);
  return to_jsonb(r);
end $$;

create or replace function public.ea_referral_update_job(p_actor_id uuid,p_job_id uuid,p_patch jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare r public.ea_referral_jobs;
begin
  if p_patch ? 'canonicalJobId' and p_patch->>'canonicalJobId' <> (select canonical_job_id from public.ea_referral_jobs where id=p_job_id) then
    raise exception using errcode='22023', message='Canonical EA job ID cannot be changed after creation';
  end if;
  if p_patch->>'status'='referred' then raise exception using errcode='22023', message='Confirm referral only after successful manual submission'; end if;
  if p_patch->>'status'='open' and exists(select 1 from public.ea_referral_slots where job_id=p_job_id) then
    raise exception using errcode='23505', message='A reserved or confirmed referral slot prevents reopening intake';
  end if;
  update public.ea_referral_jobs j set
    title=coalesce(p_patch->>'title',j.title), team=coalesce(p_patch->>'team',j.team), location=coalesce(p_patch->>'location',j.location),
    locations=case when p_patch ? 'locations' then array(select jsonb_array_elements_text(p_patch->'locations')) else j.locations end,
    employment_type=coalesce(p_patch->>'employmentType',j.employment_type), official_url=coalesce(p_patch->>'officialUrl',j.official_url),
    description=coalesce(p_patch->>'description',j.description),
    status=coalesce(p_patch->>'status',j.status),
    availability=coalesce(p_patch->>'availability',j.availability),
    availability_checked_at=case when p_patch ? 'availability' then now() else j.availability_checked_at end,
    availability_source=case when p_patch ? 'availability' then coalesce(p_patch->>'availabilitySource','manual') else j.availability_source end,
    availability_reason=coalesce(p_patch->>'availabilityReason',j.availability_reason), updated_at=now()
    where j.id=p_job_id returning * into r;
  if not found then raise exception using errcode='P0002', message='Job not found'; end if;
  insert into public.ea_referral_audit(actor_user_id,action,job_id,detail) values(p_actor_id,'job_updated',r.id,p_patch - 'description');
  return to_jsonb(r);
end $$;

create or replace function public.ea_referral_submit_application(p_actor_id uuid,p_input jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
  j public.ea_referral_jobs; c public.ea_referral_candidates; r public.ea_referral_resumes;
  a public.ea_referral_applications; candidate jsonb:=p_input->'candidate'; eligibility jsonb:=p_input->'eligibility';
  resume_id uuid; existing_application_id uuid; showcase jsonb:=coalesce(p_input->'showcase','{}'::jsonb); next_status text:='ready_for_review';
begin
  if p_actor_id is null then raise exception using errcode='22023', message='Verified candidate required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_actor_id::text,0));
  if exists(select 1 from public.ea_referral_deletion_requests where auth_user_id=p_actor_id and status='pending') then
    raise exception using errcode='23505', message='A pending data deletion request blocks new applications';
  end if;
  if length(coalesce(candidate->>'firstName','')) not between 1 and 100 or length(coalesce(candidate->>'lastName','')) not between 1 and 100
    or length(coalesce(candidate->>'country','')) not between 1 and 100 or length(coalesce(candidate->>'phone','')) not between 7 and 40
    or (candidate->>'email') !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception using errcode='22023', message='Candidate contact data is invalid'; end if;
  if lower(coalesce(candidate->>'email','')) <> lower(coalesce((select email from auth.users where id=p_actor_id),'')) then
    raise exception using errcode='22023', message='Use the verified account email';
  end if;
  if coalesce((eligibility->>'knowsOwner')::boolean,false) or coalesce((eligibility->>'previouslyApplied')::boolean,false) or coalesce((eligibility->>'previouslyReferred')::boolean,false) then
    raise exception using errcode='22023', message='This request cannot continue through public intake';
  end if;
  if eligibility->>'previouslyApplied' is distinct from 'false' or eligibility->>'previouslyReferred' is distinct from 'false'
    or eligibility->>'knowsOwner' is distinct from 'false' or eligibility->>'inListedLocation' is distinct from 'true' then
    next_status:='eligibility_review';
  end if;
  begin resume_id:=(p_input->>'resumeId')::uuid; exception when others then raise exception using errcode='22023', message='A verified resume upload is required'; end;
  select * into j from public.ea_referral_jobs where id=(p_input->>'jobId')::uuid for update;
  if not found then raise exception using errcode='P0002', message='Job not found'; end if;
  select id into existing_application_id from public.ea_referral_applications where job_id=j.id and user_id=p_actor_id;
  if found then return jsonb_build_object('id',existing_application_id,'existing',true); end if;
  if j.status <> 'open' or j.availability <> 'open' or j.availability_checked_at is null or j.availability_checked_at < now()-interval '24 hours'
    or exists(select 1 from public.ea_referral_slots where job_id=j.id) then raise exception using errcode='23505', message='Referral slot or job availability changed'; end if;
  select * into r from public.ea_referral_resumes where id=resume_id and auth_user_id=p_actor_id for update;
  if not found or r.job_id <> j.id or r.is_current is not true or r.scan_status <> 'clean' or r.parser_status <> 'ready' or not (r.parsed_fields @> '{"firstName":true,"lastName":true,"email":true,"phone":true}'::jsonb) then
    raise exception using errcode='22023', message='Resume contact fields must be verified before submission';
  end if;
  insert into public.ea_referral_candidates(auth_user_id,first_name,last_name,email,phone,country,current_title,current_company,relationship)
  values(p_actor_id,candidate->>'firstName',candidate->>'lastName',candidate->>'email',candidate->>'phone',candidate->>'country',coalesce(candidate->>'currentTitle',''),coalesce(candidate->>'currentCompany',''),candidate->>'relationship')
  on conflict(auth_user_id) do update set first_name=excluded.first_name,last_name=excluded.last_name,email=excluded.email,phone=excluded.phone,country=excluded.country,current_title=excluded.current_title,current_company=excluded.current_company,relationship=excluded.relationship,updated_at=now()
  returning * into c;
  if length(coalesce(showcase->>'note','')) > 500 or coalesce((select sum((f->>'size')::bigint) from jsonb_array_elements(coalesce(showcase->'files','[]'::jsonb)) f),0) > 10485760 then
    raise exception using errcode='22023', message='Optional showcase exceeds the allowed size';
  end if;
  insert into public.ea_referral_applications(job_id,candidate_id,user_id,status,eligibility,resume_id,resume,resume_ready,showcase)
  values(j.id,c.id,p_actor_id,next_status,eligibility,r.id,jsonb_build_object('fileName',r.file_name,'fileSize',r.file_size,'fileType',r.content_type,'version',r.version,'uploadedAt',r.created_at,'fields',r.parsed_fields),true,showcase)
  returning * into a;
  if jsonb_typeof(p_input->'supportingFileIds')='array' then
    if (select coalesce(sum(f.file_size),0) from public.ea_referral_supporting_files f where f.id in
      (select value::uuid from jsonb_array_elements_text(p_input->'supportingFileIds')) and f.auth_user_id=p_actor_id and f.application_id is null)>10485760 then
      raise exception using errcode='22023', message='Optional showcase files exceed the allowed aggregate size';
    end if;
    update public.ea_referral_supporting_files f set application_id=a.id
      where f.id in (select value::uuid from jsonb_array_elements_text(p_input->'supportingFileIds'))
        and f.auth_user_id=p_actor_id and f.application_id is null and f.scan_status='clean';
    if (select count(*) from jsonb_array_elements_text(p_input->'supportingFileIds')) <>
       (select count(*) from public.ea_referral_supporting_files where application_id=a.id) then
      raise exception using errcode='22023', message='Supporting file ownership or scan validation failed';
    end if;
    update public.ea_referral_applications ap set showcase=jsonb_set(ap.showcase,'{files}',coalesce((
      select jsonb_agg(jsonb_build_object('id',f.id,'name',f.file_name,'size',f.file_size,'type',f.content_type))
      from public.ea_referral_supporting_files f where f.application_id=a.id),'[]'::jsonb),true) where ap.id=a.id;
  else
    update public.ea_referral_applications ap set showcase=jsonb_set(ap.showcase,'{files}','[]'::jsonb,true) where ap.id=a.id;
  end if;
  insert into public.ea_referral_events(kind,label,detail,tone,job_id,application_id) values('application_submitted','Application received','Candidate submitted an application.','neutral',j.id,a.id);
  insert into public.ea_referral_audit(actor_user_id,action,job_id,application_id) values(p_actor_id,'application_submitted',j.id,a.id);
  return jsonb_build_object('id',a.id,'existing',false);
end $$;

create or replace function public.ea_referral_update_application(p_actor_id uuid,p_application_id uuid,p_patch jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare r public.ea_referral_applications;
begin
  update public.ea_referral_applications set
    admin_note=coalesce(p_patch->>'adminNote',admin_note), fit_note=coalesce(p_patch->>'fitNote',fit_note), note=coalesce(p_patch->>'note',note),
    updated_at=now() where id=p_application_id returning * into r;
  if not found then raise exception using errcode='P0002', message='Application not found'; end if;
  insert into public.ea_referral_audit(actor_user_id,action,job_id,application_id) values(p_actor_id,'application_updated',r.job_id,r.id);
  return to_jsonb(r);
end $$;

create or replace function public.ea_referral_decide_application(p_actor_id uuid,p_application_id uuid,p_status text,p_admin_note text default null)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare r public.ea_referral_applications; allowed boolean:=false;
begin
  select * into r from public.ea_referral_applications where id=p_application_id for update;
  if not found then raise exception using errcode='P0002', message='Application not found'; end if;
  allowed := (p_status='needs_clarification' and r.status in ('ready_for_review','shortlisted','eligibility_review'))
    or (p_status='correction_required' and r.status in ('ready_for_review','shortlisted','needs_clarification'))
    or (p_status='ready_for_review' and r.status in ('submitted','processing','eligibility_review','needs_clarification'))
    or (p_status='shortlisted' and r.status='ready_for_review')
    or (p_status='not_selected' and r.status in ('ready_for_review','shortlisted'));
  if not allowed then raise exception using errcode='22023', message='Invalid application status transition'; end if;
  update public.ea_referral_applications set status=p_status,admin_note=coalesce(p_admin_note,admin_note),
    resume_ready=case when p_status='correction_required' then false else resume_ready end,
    correction_fields=case when p_status='correction_required' then array['resume','firstName','lastName','email','phone'] else correction_fields end,
    match_score=case when p_status='correction_required' then 0 else match_score end,
    match=case when p_status='correction_required' then '{"mandatory":0,"relevantWork":0,"preferred":0,"achievements":0}'::jsonb else match end,
    match_summary=case when p_status='correction_required' then 'Owner requested a corrected resume; previous assessment is stale.' else match_summary end,
    evidence=case when p_status='correction_required' then '[]'::jsonb else evidence end,
    requirements=case when p_status='correction_required' then '[]'::jsonb else requirements end,
    updated_at=now() where id=r.id returning * into r;
  insert into public.ea_referral_audit(actor_user_id,action,job_id,application_id,detail) values(p_actor_id,'application_decision',r.job_id,r.id,jsonb_build_object('status',p_status));
  return to_jsonb(r);
end $$;

create or replace function public.ea_referral_reserve(p_actor_id uuid,p_job_id uuid,p_application_id uuid)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare j public.ea_referral_jobs; a public.ea_referral_applications; s public.ea_referral_slots;
begin
  select * into j from public.ea_referral_jobs where id=p_job_id for update;
  if not found then raise exception using errcode='P0002', message='Job not found'; end if;
  if j.status<>'open' or j.availability<>'open' or j.availability_checked_at is null or j.availability_checked_at<now()-interval '24 hours' then raise exception using errcode='23505', message='Job is not verified open'; end if;
  if exists(select 1 from public.ea_referral_slots where job_id=j.id) then raise exception using errcode='23505', message='Referral slot is already reserved'; end if;
  select * into a from public.ea_referral_applications where id=p_application_id and job_id=j.id for update;
  if not found or a.status not in ('ready_for_review','shortlisted') or a.resume_ready is not true
    or a.eligibility->>'previouslyApplied' is distinct from 'false' or a.eligibility->>'previouslyReferred' is distinct from 'false'
    or a.eligibility->>'knowsOwner' is distinct from 'false' or a.eligibility->>'inListedLocation' is distinct from 'true' then
    raise exception using errcode='22023', message='Application is not eligible for reservation';
  end if;
  insert into public.ea_referral_slots(job_id,application_id,status) values(j.id,a.id,'reserved') returning * into s;
  update public.ea_referral_applications set status='selected_pending_submission',updated_at=now() where id=a.id;
  update public.ea_referral_jobs set status='paused',updated_at=now() where id=j.id;
  insert into public.ea_referral_audit(actor_user_id,action,job_id,application_id) values(p_actor_id,'referral_reserved',j.id,a.id);
  return jsonb_build_object('job_id',s.job_id,'application_id',s.application_id,'status',s.status,'updated_at',s.updated_at);
end $$;

create or replace function public.ea_referral_release(p_actor_id uuid,p_job_id uuid)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare s public.ea_referral_slots; j public.ea_referral_jobs;
begin
  select * into j from public.ea_referral_jobs where id=p_job_id for update;
  if not found then raise exception using errcode='P0002', message='Job not found'; end if;
  select * into s from public.ea_referral_slots where job_id=j.id and status='reserved' for update;
  if not found then raise exception using errcode='22023', message='There is no active reservation to release'; end if;
  delete from public.ea_referral_slots where id=s.id;
  update public.ea_referral_applications set status='ready_for_review',updated_at=now() where id=s.application_id and status='selected_pending_submission';
  update public.ea_referral_jobs set status=case
    when availability='closed' then 'closed'
    when availability='open' and availability_checked_at is not null and availability_checked_at>=now()-interval '24 hours' then 'open'
    else 'paused' end,updated_at=now() where id=j.id;
  insert into public.ea_referral_audit(actor_user_id,action,job_id,application_id) values(p_actor_id,'referral_released',j.id,s.application_id);
  return jsonb_build_object('job_id',j.id,'application_id',s.application_id,'status','available','updated_at',now());
end $$;

create or replace function public.ea_referral_confirm(p_actor_id uuid,p_job_id uuid,p_application_id uuid)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare s public.ea_referral_slots; j public.ea_referral_jobs; a public.ea_referral_applications;
begin
  select * into j from public.ea_referral_jobs where id=p_job_id for update;
  if not found then raise exception using errcode='P0002', message='Job not found'; end if;
  select * into s from public.ea_referral_slots where job_id=j.id and status='reserved' for update;
  if not found or s.application_id<>p_application_id then raise exception using errcode='22023', message='The selected application does not own the reservation'; end if;
  select * into a from public.ea_referral_applications where id=s.application_id for update;
  if a.status<>'selected_pending_submission' then raise exception using errcode='22023', message='Application is not pending manual submission'; end if;
  update public.ea_referral_slots set status='confirmed',updated_at=now() where id=s.id returning * into s;
  update public.ea_referral_applications set status='referral_confirmed',updated_at=now() where id=a.id;
  update public.ea_referral_applications set status='slot_filled_other',updated_at=now() where job_id=j.id and id<>a.id and status not in ('referral_confirmed','not_selected','slot_filled_other');
  update public.ea_referral_jobs set status='referred',updated_at=now() where id=j.id;
  insert into public.ea_referral_events(kind,label,detail,tone,job_id,application_id) values('referral_confirmed','Referral confirmed','Owner confirmed successful manual EA portal submission.','positive',j.id,a.id);
  insert into public.ea_referral_audit(actor_user_id,action,job_id,application_id,detail) values(p_actor_id,'referral_confirmed',j.id,a.id,jsonb_build_object('manual_submission',true));
  return jsonb_build_object('job_id',s.job_id,'application_id',s.application_id,'status',s.status,'updated_at',s.updated_at);
end $$;

revoke all on function public.ea_referral_public_jobs() from public, anon, authenticated;
revoke all on function public.ea_referral_create_job(uuid,jsonb) from public, anon, authenticated;
revoke all on function public.ea_referral_update_job(uuid,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.ea_referral_submit_application(uuid,jsonb) from public, anon, authenticated;
revoke all on function public.ea_referral_update_application(uuid,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.ea_referral_decide_application(uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function public.ea_referral_reserve(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.ea_referral_release(uuid,uuid) from public, anon, authenticated;
revoke all on function public.ea_referral_confirm(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.ea_referral_create_resume(jsonb) from public, anon, authenticated;
revoke all on function public.ea_referral_validate_resume(uuid,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.ea_referral_create_supporting_file(jsonb) from public, anon, authenticated;
revoke all on function public.ea_referral_request_deletion(uuid) from public, anon, authenticated;
revoke all on function public.ea_referral_deletion_paths(uuid) from public, anon, authenticated;
revoke all on function public.ea_referral_process_deletion(uuid,uuid) from public, anon, authenticated;
grant execute on function public.ea_referral_public_jobs() to service_role;
grant execute on function public.ea_referral_create_job(uuid,jsonb), public.ea_referral_update_job(uuid,uuid,jsonb), public.ea_referral_submit_application(uuid,jsonb), public.ea_referral_update_application(uuid,uuid,jsonb), public.ea_referral_decide_application(uuid,uuid,text,text), public.ea_referral_reserve(uuid,uuid,uuid), public.ea_referral_release(uuid,uuid), public.ea_referral_confirm(uuid,uuid,uuid) to service_role;
grant execute on function public.ea_referral_create_resume(jsonb), public.ea_referral_validate_resume(uuid,uuid,jsonb), public.ea_referral_create_supporting_file(jsonb), public.ea_referral_request_deletion(uuid), public.ea_referral_deletion_paths(uuid), public.ea_referral_process_deletion(uuid,uuid) to service_role;
