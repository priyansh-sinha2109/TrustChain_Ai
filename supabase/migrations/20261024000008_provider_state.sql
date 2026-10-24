ALTER TABLE public.investigation_jobs ADD COLUMN provider_status text
  CHECK(provider_status IN ('PENDING','RUNNING','COMPLETED','FAILED','CANCELLED'));
ALTER TABLE public.investigation_jobs ADD COLUMN provider_finished_at timestamptz;
COMMENT ON COLUMN public.investigation_jobs.provider_finished_at IS
  'Provider-supplied finish time only; never generated from local request completion.';
