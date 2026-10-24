-- Backend integration metadata only. Reuses all existing procurement/evidence tables.
CREATE UNIQUE INDEX IF NOT EXISTS uq_purchase_cases_id_org ON public.purchase_cases(id,org_id);

CREATE TABLE public.investigation_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id),
    case_id uuid NOT NULL,
    user_id uuid NOT NULL,
    idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 128),
    request_fingerprint text NOT NULL CHECK(length(request_fingerprint)=64),
    request_data jsonb NOT NULL,
    status text NOT NULL DEFAULT 'QUEUED' CHECK(status IN
      ('QUEUED','PROCESSING','REVIEW_READY','PARTIAL_REVIEW','FAILED','REVIEWED')),
    stage text NOT NULL DEFAULT 'QUEUED',
    provider_run_id text,
    error_code text,
    lease_token uuid,
    lease_until timestamptz,
    terminal_result_id uuid,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    FOREIGN KEY(case_id,org_id) REFERENCES public.purchase_cases(id,org_id),
    UNIQUE(user_id,case_id,idempotency_key),
    CHECK(jsonb_typeof(request_data)='object'),
    CHECK(status<>'PROCESSING' OR (lease_token IS NOT NULL AND lease_until IS NOT NULL))
);
CREATE UNIQUE INDEX uq_case_active_investigation ON public.investigation_jobs(case_id)
  WHERE status IN ('QUEUED','PROCESSING');
CREATE INDEX idx_investigation_case_created ON public.investigation_jobs(case_id,created_at DESC,id DESC);
CREATE INDEX idx_investigation_expired_lease ON public.investigation_jobs(lease_until) WHERE status='PROCESSING';

CREATE TABLE public.investigation_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id uuid NOT NULL REFERENCES public.investigation_jobs(id),
    terminal boolean NOT NULL,
    payload jsonb NOT NULL,
    payload_fingerprint text NOT NULL CHECK(length(payload_fingerprint)=64),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    UNIQUE(job_id,terminal), UNIQUE(id,job_id)
);
ALTER TABLE public.investigation_jobs ADD CONSTRAINT fk_terminal_result_same_job
  FOREIGN KEY(terminal_result_id,id) REFERENCES public.investigation_results(id,job_id);

CREATE FUNCTION public.guard_investigation_job() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF (NEW.id,NEW.org_id,NEW.case_id,NEW.user_id,NEW.idempotency_key,NEW.request_fingerprint,NEW.request_data,NEW.created_at)
    IS DISTINCT FROM
    (OLD.id,OLD.org_id,OLD.case_id,OLD.user_id,OLD.idempotency_key,OLD.request_fingerprint,OLD.request_data,OLD.created_at) THEN
    RAISE EXCEPTION 'Investigation identity and request are immutable';
  END IF;
  IF OLD.status IN ('REVIEW_READY','PARTIAL_REVIEW','FAILED','REVIEWED') AND
      NOT (NEW.status=OLD.status OR (OLD.status IN ('REVIEW_READY','PARTIAL_REVIEW') AND NEW.status='REVIEWED')) THEN
    RAISE EXCEPTION 'Invalid terminal investigation transition';
  END IF;
  IF OLD.status='PROCESSING' AND NEW.status='QUEUED' THEN
    RAISE EXCEPTION 'Processing jobs must resume using a fenced lease';
  END IF;
  IF NEW.status IN ('REVIEW_READY','PARTIAL_REVIEW','REVIEWED') AND NEW.terminal_result_id IS NULL THEN
    RAISE EXCEPTION 'Review states require a terminal result';
  END IF;
  IF OLD.provider_run_id IS NOT NULL AND NEW.provider_run_id IS DISTINCT FROM OLD.provider_run_id THEN
    RAISE EXCEPTION 'Provider run association is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_investigation_job BEFORE UPDATE ON public.investigation_jobs
  FOR EACH ROW EXECUTE FUNCTION public.guard_investigation_job();

CREATE FUNCTION public.reject_immutable_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Immutable integration record cannot be changed'; END $$;
CREATE TRIGGER immutable_investigation_results BEFORE UPDATE OR DELETE ON public.investigation_results
  FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_change();

ALTER TABLE public.public_research_runs ADD COLUMN investigation_job_id uuid REFERENCES public.investigation_jobs(id);
CREATE UNIQUE INDEX uq_research_job ON public.public_research_runs(investigation_job_id) WHERE investigation_job_id IS NOT NULL;
ALTER TABLE public.deal_versions ADD COLUMN investigation_job_id uuid REFERENCES public.investigation_jobs(id);
ALTER TABLE public.evidence_sources ADD COLUMN investigation_job_id uuid REFERENCES public.investigation_jobs(id);
ALTER TABLE public.claims ADD COLUMN investigation_job_id uuid REFERENCES public.investigation_jobs(id);
ALTER TABLE public.findings ADD COLUMN investigation_job_id uuid REFERENCES public.investigation_jobs(id);
ALTER TABLE public.deal_changes ADD COLUMN investigation_job_id uuid REFERENCES public.investigation_jobs(id);
ALTER TABLE public.review_decisions ADD COLUMN investigation_job_id uuid REFERENCES public.investigation_jobs(id);
CREATE INDEX idx_findings_job ON public.findings(investigation_job_id);
CREATE INDEX idx_evidence_job ON public.evidence_sources(investigation_job_id);

ALTER TABLE public.investigation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigation_results ENABLE ROW LEVEL SECURITY;
-- Only the trusted backend database login accesses job internals and immutable snapshots.
REVOKE ALL ON public.investigation_jobs,public.investigation_results FROM PUBLIC,anon,authenticated;
