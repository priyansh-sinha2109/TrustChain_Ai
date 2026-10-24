-- ==============================================================================
-- TrustChain AI — Migration 000002: Evidence, USP Deal Changes & Audit Engine
-- Team Ashwamedha (HackIIITD 2026) | Role: Member 3
-- ==============================================================================
-- Purpose:
-- 1. Commercial Deal Versions (RFQ, Accepted Quote, Final PI)
-- 2. TinyFish Public Research Runs (real run IDs, public web execution status)
-- 3. Evidence Sources (Public Web URLs & Private PDF page references)
-- 4. Extracted Claims with confidence scores
-- 5. Discrepancy Findings (Technical & Commercial risks)
-- 6. USP Core: Deal Changes (field-by-field diff, baseline vs final PI)
-- 7. USP Core: Deal Change Reviews (Reviewer actions: ACKNOWLEDGED, REQUEST_INFO, NEEDS_ENGINEER)
-- 8. Overall Human Review Decisions (pre-advance release authorization)
-- 9. Append-Only Tamper-Evident Audit Events Log
-- 10. Financial calculations (Advance Exposure Difference engine)
-- 11. Cross-table consistency triggers & RLS policies
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Commercial Document Versions (USP)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deal_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.purchase_cases(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    stage TEXT NOT NULL CHECK (stage IN ('RFQ', 'ACCEPTED_QUOTE', 'PURCHASE_ORDER', 'FINAL_PI')),
    version_no INT NOT NULL DEFAULT 1 CHECK (version_no > 0),
    total_amount NUMERIC(14, 2) CHECK (total_amount >= 0),
    advance_percentage NUMERIC(5, 2) CHECK (advance_percentage >= 0 AND advance_percentage <= 100),
    advance_amount NUMERIC(14, 2) GENERATED ALWAYS AS (
        ROUND((total_amount * advance_percentage) / 100.0, 2)
    ) STORED,
    delivery_timeline_days INT CHECK (delivery_timeline_days >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_case_stage_version UNIQUE (case_id, stage, version_no)
);

CREATE INDEX IF NOT EXISTS idx_deal_versions_case ON public.deal_versions(case_id);
CREATE INDEX IF NOT EXISTS idx_deal_versions_stage ON public.deal_versions(stage);

COMMENT ON TABLE public.deal_versions IS 'Extracted commercial milestones from RFQ, accepted quotation, to final PI.';

-- ------------------------------------------------------------------------------
-- 2. Public Research Runs (TinyFish Metadata)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.public_research_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.purchase_cases(id) ON DELETE CASCADE,
    case_supplier_id UUID REFERENCES public.case_suppliers(id) ON DELETE SET NULL,
    tinyfish_run_id TEXT NOT NULL,
    target_url TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    completed_at TIMESTAMPTZ,
    error_code TEXT,
    raw_result JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_research_runs_case ON public.public_research_runs(case_id);
CREATE INDEX IF NOT EXISTS idx_research_runs_run_id ON public.public_research_runs(tinyfish_run_id);

COMMENT ON TABLE public.public_research_runs IS 'Tracks TinyFish public web agent execution metadata safely (no secrets).';

-- ------------------------------------------------------------------------------
-- 3. Evidence Sources (Provenance Tracking)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.evidence_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.purchase_cases(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('PUBLIC_WEB', 'PRIVATE_PDF')),
    source_url TEXT,
    document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    page_number INT CHECK (page_number IS NULL OR page_number > 0),
    extracted_text TEXT,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    verification_status TEXT NOT NULL DEFAULT 'OBSERVED' CHECK (verification_status IN (
        'OBSERVED',
        'VERIFIED_MATCH',
        'DISCREPANCY',
        'INSUFFICIENT_EVIDENCE'
    )),
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT ck_evidence_provenance CHECK (
        (kind = 'PUBLIC_WEB' AND source_url IS NOT NULL) OR
        (kind = 'PRIVATE_PDF' AND document_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_evidence_sources_case ON public.evidence_sources(case_id);
CREATE INDEX IF NOT EXISTS idx_evidence_sources_doc ON public.evidence_sources(document_id);
CREATE INDEX IF NOT EXISTS idx_evidence_sources_kind ON public.evidence_sources(kind);

COMMENT ON TABLE public.evidence_sources IS 'Immutable provenance store linking findings directly to PDF pages or public URLs.';

-- ------------------------------------------------------------------------------
-- 4. Extracted Claims
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.purchase_cases(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES public.evidence_sources(id) ON DELETE CASCADE,
    field_key TEXT NOT NULL,
    claim_value JSONB NOT NULL,
    confidence_score NUMERIC(3, 2) CHECK (confidence_score >= 0 AND confidence_score <= 1.0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_claims_case ON public.claims(case_id);
CREATE INDEX IF NOT EXISTS idx_claims_source ON public.claims(source_id);
CREATE INDEX IF NOT EXISTS idx_claims_field ON public.claims(field_key);

-- ------------------------------------------------------------------------------
-- 5. Findings
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.purchase_cases(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'FLAGGED', 'RESOLVED', 'DISMISSED')),
    severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    summary TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_findings_case ON public.findings(case_id);
CREATE INDEX IF NOT EXISTS idx_findings_severity ON public.findings(severity);

COMMENT ON TABLE public.findings IS 'Categorized risk findings comparing quotations, final PI, and public claims.';

-- ------------------------------------------------------------------------------
-- 6. Deal Changes (USP Core: Pre-Advance Quotation vs PI Diffs)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deal_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    finding_id UUID REFERENCES public.findings(id) ON DELETE SET NULL,
    case_id UUID NOT NULL REFERENCES public.purchase_cases(id) ON DELETE CASCADE,
    baseline_version_id UUID NOT NULL REFERENCES public.deal_versions(id) ON DELETE CASCADE,
    final_version_id UUID NOT NULL REFERENCES public.deal_versions(id) ON DELETE CASCADE,
    field_key TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('TECHNICAL', 'COMMERCIAL')),
    baseline_field_id UUID,
    final_field_id UUID,
    before_value JSONB NOT NULL,
    after_value JSONB NOT NULL,
    baseline_page INT,
    final_page INT,
    financial_impact_inr NUMERIC(14, 2) DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'REJECTED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT ck_deal_changes_versions_differ CHECK (baseline_version_id <> final_version_id)
);

CREATE INDEX IF NOT EXISTS idx_deal_changes_case ON public.deal_changes(case_id);
CREATE INDEX IF NOT EXISTS idx_deal_changes_category ON public.deal_changes(category);
CREATE INDEX IF NOT EXISTS idx_deal_changes_status ON public.deal_changes(status);

COMMENT ON TABLE public.deal_changes IS 'Precise field differences between agreed baseline quotation and supplier final PI.';

-- ------------------------------------------------------------------------------
-- Consistency Trigger: Deal changes must compare versions from the SAME case
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_deal_changes_case_consistency()
RETURNS TRIGGER AS $$
DECLARE
    v_base_case UUID;
    v_final_case UUID;
BEGIN
    SELECT case_id INTO v_base_case FROM public.deal_versions WHERE id = NEW.baseline_version_id;
    SELECT case_id INTO v_final_case FROM public.deal_versions WHERE id = NEW.final_version_id;

    IF v_base_case IS NULL OR v_final_case IS NULL THEN
        RAISE EXCEPTION 'Referenced deal versions do not exist.';
    END IF;

    IF v_base_case <> NEW.case_id OR v_final_case <> NEW.case_id THEN
        RAISE EXCEPTION 'Deal change baseline and final versions must belong to the same purchase case (%).', NEW.case_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deal_changes_case_consistency ON public.deal_changes;
CREATE TRIGGER trg_deal_changes_case_consistency
BEFORE INSERT OR UPDATE ON public.deal_changes
FOR EACH ROW EXECUTE FUNCTION public.check_deal_changes_case_consistency();

-- ------------------------------------------------------------------------------
-- 7. Deal Change Reviews (PRD v0.2 USP: Line-Item Review Actions)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deal_change_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_change_id UUID NOT NULL REFERENCES public.deal_changes(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL, -- references auth.users(id)
    action TEXT NOT NULL CHECK (action IN ('ACKNOWLEDGED', 'REQUEST_INFO', 'NEEDS_ENGINEER')),
    note TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_deal_change_reviews_change ON public.deal_change_reviews(deal_change_id);
CREATE INDEX IF NOT EXISTS idx_deal_change_reviews_reviewer ON public.deal_change_reviews(reviewer_id);

COMMENT ON TABLE public.deal_change_reviews IS 'Human reviewer decisions recorded per individual deal discrepancy.';

-- ------------------------------------------------------------------------------
-- 8. Review Decisions (Overall Case Purchasing Authority Decision)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.review_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.purchase_cases(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN (
        'APPROVE_ADVANCE',
        'REJECT_PAYMENT',
        'REQUEST_SUPPLIER_CLARIFICATION',
        'ESCALATE_TO_MANAGEMENT'
    )),
    justification TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_review_decisions_case ON public.review_decisions(case_id);

COMMENT ON TABLE public.review_decisions IS 'Authorized human sign-off decision before advance release.';

-- ------------------------------------------------------------------------------
-- 9. Audit Events (Append-Only Tamper-Evident Trail)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL,
    action TEXT NOT NULL,
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_org ON public.audit_events(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON public.audit_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_action ON public.audit_events(action);
CREATE INDEX IF NOT EXISTS idx_audit_events_created ON public.audit_events(created_at DESC);

-- Prevent UPDATE or DELETE on audit_events to guarantee immutability
CREATE OR REPLACE FUNCTION public.prevent_audit_tampering()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit events are immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_update ON public.audit_events;
CREATE TRIGGER trg_prevent_audit_update
BEFORE UPDATE OR DELETE ON public.audit_events
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_tampering();

-- ------------------------------------------------------------------------------
-- 10. Financial Stored Function: Advance Exposure Calculator
-- ------------------------------------------------------------------------------
-- Example: Accepted Quote 480,000 INR @ 30% = 144,000 INR
--          Final PI       480,000 INR @ 80% = 384,000 INR
--          Exposure Delta = +240,000 INR
CREATE OR REPLACE FUNCTION public.calculate_advance_exposure(
    p_baseline_total NUMERIC,
    p_baseline_advance_pct NUMERIC,
    p_final_total NUMERIC,
    p_final_advance_pct NUMERIC
)
RETURNS TABLE (
    baseline_advance_amount NUMERIC,
    final_advance_amount NUMERIC,
    exposure_delta_amount NUMERIC,
    is_exposure_increased BOOLEAN
)
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT
        ROUND((p_baseline_total * p_baseline_advance_pct) / 100.0, 2) AS baseline_advance_amount,
        ROUND((p_final_total * p_final_advance_pct) / 100.0, 2) AS final_advance_amount,
        ROUND(((p_final_total * p_final_advance_pct) - (p_baseline_total * p_baseline_advance_pct)) / 100.0, 2) AS exposure_delta_amount,
        (((p_final_total * p_final_advance_pct) - (p_baseline_total * p_baseline_advance_pct)) > 0) AS is_exposure_increased;
$$;

-- ------------------------------------------------------------------------------
-- Row-Level Security (RLS) Configuration
-- ------------------------------------------------------------------------------
ALTER TABLE public.deal_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_research_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_change_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- 1. Deal Versions RLS
CREATE POLICY "org_member_read_deal_versions" ON public.deal_versions
    FOR SELECT TO authenticated
    USING (case_id IN (
        SELECT pc.id FROM public.purchase_cases pc
        WHERE pc.org_id IN (SELECT public.current_user_org_ids())
    ));

CREATE POLICY "buyer_admin_manage_deal_versions" ON public.deal_versions
    FOR ALL TO authenticated
    USING (case_id IN (
        SELECT pc.id FROM public.purchase_cases pc
        WHERE public.has_org_role(pc.org_id, ARRAY['buyer', 'admin'])
    ));

-- 2. Public Research Runs RLS
CREATE POLICY "org_member_read_research_runs" ON public.public_research_runs
    FOR SELECT TO authenticated
    USING (case_id IN (
        SELECT pc.id FROM public.purchase_cases pc
        WHERE pc.org_id IN (SELECT public.current_user_org_ids())
    ));

CREATE POLICY "authorized_manage_research_runs" ON public.public_research_runs
    FOR ALL TO authenticated
    USING (case_id IN (
        SELECT pc.id FROM public.purchase_cases pc
        WHERE public.has_org_role(pc.org_id, ARRAY['buyer', 'admin'])
    ));

-- 3. Evidence Sources RLS
CREATE POLICY "org_member_read_evidence_sources" ON public.evidence_sources
    FOR SELECT TO authenticated
    USING (case_id IN (
        SELECT pc.id FROM public.purchase_cases pc
        WHERE pc.org_id IN (SELECT public.current_user_org_ids())
    ));

CREATE POLICY "authorized_insert_evidence_sources" ON public.evidence_sources
    FOR INSERT TO authenticated
    WITH CHECK (case_id IN (
        SELECT pc.id FROM public.purchase_cases pc
        WHERE public.has_org_role(pc.org_id, ARRAY['buyer', 'admin'])
    ));

-- 4. Claims RLS
CREATE POLICY "org_member_read_claims" ON public.claims
    FOR SELECT TO authenticated
    USING (case_id IN (
        SELECT pc.id FROM public.purchase_cases pc
        WHERE pc.org_id IN (SELECT public.current_user_org_ids())
    ));

CREATE POLICY "authorized_insert_claims" ON public.claims
    FOR INSERT TO authenticated
    WITH CHECK (case_id IN (
        SELECT pc.id FROM public.purchase_cases pc
        WHERE public.has_org_role(pc.org_id, ARRAY['buyer', 'admin'])
    ));

-- 5. Findings RLS
CREATE POLICY "org_member_read_findings" ON public.findings
    FOR SELECT TO authenticated
    USING (case_id IN (
        SELECT pc.id FROM public.purchase_cases pc
        WHERE pc.org_id IN (SELECT public.current_user_org_ids())
    ));

CREATE POLICY "authorized_manage_findings" ON public.findings
    FOR ALL TO authenticated
    USING (case_id IN (
        SELECT pc.id FROM public.purchase_cases pc
        WHERE public.has_org_role(pc.org_id, ARRAY['buyer', 'admin'])
    ));

-- 6. Deal Changes RLS
CREATE POLICY "org_member_read_deal_changes" ON public.deal_changes
    FOR SELECT TO authenticated
    USING (case_id IN (
        SELECT pc.id FROM public.purchase_cases pc
        WHERE pc.org_id IN (SELECT public.current_user_org_ids())
    ));

CREATE POLICY "authorized_manage_deal_changes" ON public.deal_changes
    FOR ALL TO authenticated
    USING (case_id IN (
        SELECT pc.id FROM public.purchase_cases pc
        WHERE public.has_org_role(pc.org_id, ARRAY['buyer', 'admin', 'reviewer'])
    ));

-- 7. Deal Change Reviews RLS (Reviewers & Admins can write)
CREATE POLICY "org_member_read_deal_change_reviews" ON public.deal_change_reviews
    FOR SELECT TO authenticated
    USING (deal_change_id IN (
        SELECT dc.id FROM public.deal_changes dc
        JOIN public.purchase_cases pc ON dc.case_id = pc.id
        WHERE pc.org_id IN (SELECT public.current_user_org_ids())
    ));

CREATE POLICY "reviewer_admin_insert_deal_change_reviews" ON public.deal_change_reviews
    FOR INSERT TO authenticated
    WITH CHECK (deal_change_id IN (
        SELECT dc.id FROM public.deal_changes dc
        JOIN public.purchase_cases pc ON dc.case_id = pc.id
        WHERE public.has_org_role(pc.org_id, ARRAY['reviewer', 'admin'])
    ));

-- 8. Review Decisions RLS (Only Reviewers & Admins)
CREATE POLICY "org_member_read_review_decisions" ON public.review_decisions
    FOR SELECT TO authenticated
    USING (case_id IN (
        SELECT pc.id FROM public.purchase_cases pc
        WHERE pc.org_id IN (SELECT public.current_user_org_ids())
    ));

CREATE POLICY "reviewer_admin_insert_review_decisions" ON public.review_decisions
    FOR INSERT TO authenticated
    WITH CHECK (case_id IN (
        SELECT pc.id FROM public.purchase_cases pc
        WHERE public.has_org_role(pc.org_id, ARRAY['reviewer', 'admin'])
    ));

-- 9. Audit Events RLS (Append-Only)
CREATE POLICY "org_member_read_audit_events" ON public.audit_events
    FOR SELECT TO authenticated
    USING (org_id IN (SELECT public.current_user_org_ids()));

CREATE POLICY "authenticated_insert_audit_events" ON public.audit_events
    FOR INSERT TO authenticated
    WITH CHECK (org_id IN (SELECT public.current_user_org_ids()));
