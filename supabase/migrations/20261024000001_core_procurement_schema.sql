-- ==============================================================================
-- TrustChain AI — Migration 000001: Core Procurement Schema & Organization Model
-- Team Ashwamedha (HackIIITD 2026) | Role: Member 3
-- ==============================================================================
-- Purpose:
-- 1. Multi-tenant organization boundaries and role memberships
-- 2. Suppliers directory linked to organizations
-- 3. Purchase cases with status workflow and currency defaults
-- 4. Case-to-supplier mappings
-- 5. Private document registry with storage keys and file integrity hashes
-- 6. Row-Level Security (RLS) policies enforcing complete tenant isolation
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. Organizations
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE public.organizations IS 'Tenant boundary for manufacturing MSMEs and buyer organizations.';

-- ------------------------------------------------------------------------------
-- 2. Organization Members (RBAC: buyer, reviewer, admin)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- references auth.users(id) in Supabase Auth
    role TEXT NOT NULL CHECK (role IN ('buyer', 'reviewer', 'admin')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_org_user UNIQUE (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(org_id);

COMMENT ON TABLE public.organization_members IS 'Maps Supabase Auth users to organizations with assigned purchasing/review roles.';

-- ------------------------------------------------------------------------------
-- Helper functions for RLS checks (prevents recursive RLS evaluation)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_org_ids()
RETURNS TABLE (org_id UUID) 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT om.org_id
    FROM public.organization_members om
    WHERE om.user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(p_org_id UUID, p_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.org_id = p_org_id
          AND om.user_id = auth.uid()
          AND om.role = ANY(p_roles)
    );
$$;

-- ------------------------------------------------------------------------------
-- 3. Suppliers
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    legal_name TEXT NOT NULL,
    trade_name TEXT,
    gstin TEXT,
    pan TEXT,
    website_url TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_org_id ON public.suppliers(org_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_legal_name ON public.suppliers(legal_name);

COMMENT ON TABLE public.suppliers IS 'Verified and candidate suppliers scoped to a buyer organization.';

-- ------------------------------------------------------------------------------
-- 4. Purchase Cases
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    case_number TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
        'DRAFT',
        'DOCS_UPLOADED',
        'RESEARCHING',
        'ANALYZED',
        'IN_REVIEW',
        'APPROVED',
        'REJECTED',
        'FLAGGED'
    )),
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    target_item TEXT,
    target_quantity NUMERIC(14, 2),
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_org_case_number UNIQUE (org_id, case_number)
);

CREATE INDEX IF NOT EXISTS idx_purchase_cases_org_id ON public.purchase_cases(org_id);
CREATE INDEX IF NOT EXISTS idx_purchase_cases_status ON public.purchase_cases(status);
CREATE INDEX IF NOT EXISTS idx_purchase_cases_created_at ON public.purchase_cases(created_at DESC);

COMMENT ON TABLE public.purchase_cases IS 'Pre-advance purchasing investigations owned by an organization.';

-- ------------------------------------------------------------------------------
-- 5. Case Suppliers (Mapping cases to suppliers)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.purchase_cases(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_case_supplier UNIQUE (case_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_case_suppliers_case ON public.case_suppliers(case_id);
CREATE INDEX IF NOT EXISTS idx_case_suppliers_supplier ON public.case_suppliers(supplier_id);

-- ------------------------------------------------------------------------------
-- 6. Private Documents
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.purchase_cases(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    doc_type TEXT NOT NULL CHECK (doc_type IN (
        'RFQ',
        'ACCEPTED_QUOTE',
        'PURCHASE_ORDER',
        'FINAL_PI',
        'OTHER'
    )),
    storage_key TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT 'application/pdf',
    file_size BIGINT NOT NULL CHECK (file_size > 0),
    sha256 TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
        'PENDING',
        'UPLOADED',
        'PROCESSING',
        'EXTRACTED',
        'ERROR'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_documents_case ON public.documents(case_id);
CREATE INDEX IF NOT EXISTS idx_documents_supplier ON public.documents(supplier_id);
CREATE INDEX IF NOT EXISTS idx_documents_doc_type ON public.documents(doc_type);

COMMENT ON TABLE public.documents IS 'Private commercial procurement documents stored in Supabase Storage.';

-- ------------------------------------------------------------------------------
-- Triggers for updated_at
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = clock_timestamp();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_organizations_updated_at ON public.organizations;
CREATE TRIGGER trg_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER trg_suppliers_updated_at
BEFORE UPDATE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_purchase_cases_updated_at ON public.purchase_cases;
CREATE TRIGGER trg_purchase_cases_updated_at
BEFORE UPDATE ON public.purchase_cases
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- Row-Level Security (RLS) Configuration
-- ------------------------------------------------------------------------------
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- 1. Organizations Policies
CREATE POLICY "org_member_read_org" ON public.organizations
    FOR SELECT TO authenticated
    USING (id IN (SELECT public.current_user_org_ids()));

-- 2. Organization Members Policies
CREATE POLICY "org_member_read_members" ON public.organization_members
    FOR SELECT TO authenticated
    USING (org_id IN (SELECT public.current_user_org_ids()));

-- 3. Suppliers Policies
CREATE POLICY "org_member_read_suppliers" ON public.suppliers
    FOR SELECT TO authenticated
    USING (org_id IN (SELECT public.current_user_org_ids()));

CREATE POLICY "buyer_admin_insert_suppliers" ON public.suppliers
    FOR INSERT TO authenticated
    WITH CHECK (public.has_org_role(org_id, ARRAY['buyer', 'admin']));

CREATE POLICY "buyer_admin_update_suppliers" ON public.suppliers
    FOR UPDATE TO authenticated
    USING (public.has_org_role(org_id, ARRAY['buyer', 'admin']))
    WITH CHECK (public.has_org_role(org_id, ARRAY['buyer', 'admin']));

-- 4. Purchase Cases Policies
CREATE POLICY "org_member_read_cases" ON public.purchase_cases
    FOR SELECT TO authenticated
    USING (org_id IN (SELECT public.current_user_org_ids()));

CREATE POLICY "buyer_admin_insert_cases" ON public.purchase_cases
    FOR INSERT TO authenticated
    WITH CHECK (public.has_org_role(org_id, ARRAY['buyer', 'admin']));

CREATE POLICY "authorized_update_cases" ON public.purchase_cases
    FOR UPDATE TO authenticated
    USING (org_id IN (SELECT public.current_user_org_ids()))
    WITH CHECK (org_id IN (SELECT public.current_user_org_ids()));

-- 5. Case Suppliers Policies
CREATE POLICY "org_member_read_case_suppliers" ON public.case_suppliers
    FOR SELECT TO authenticated
    USING (case_id IN (
        SELECT pc.id FROM public.purchase_cases pc
        WHERE pc.org_id IN (SELECT public.current_user_org_ids())
    ));

CREATE POLICY "buyer_admin_manage_case_suppliers" ON public.case_suppliers
    FOR ALL TO authenticated
    USING (case_id IN (
        SELECT pc.id FROM public.purchase_cases pc
        WHERE public.has_org_role(pc.org_id, ARRAY['buyer', 'admin'])
    ));

-- 6. Documents Policies
CREATE POLICY "org_member_read_documents" ON public.documents
    FOR SELECT TO authenticated
    USING (case_id IN (
        SELECT pc.id FROM public.purchase_cases pc
        WHERE pc.org_id IN (SELECT public.current_user_org_ids())
    ));

CREATE POLICY "buyer_admin_insert_documents" ON public.documents
    FOR INSERT TO authenticated
    WITH CHECK (case_id IN (
        SELECT pc.id FROM public.purchase_cases pc
        WHERE public.has_org_role(pc.org_id, ARRAY['buyer', 'admin'])
    ));

CREATE POLICY "authorized_update_documents" ON public.documents
    FOR UPDATE TO authenticated
    USING (case_id IN (
        SELECT pc.id FROM public.purchase_cases pc
        WHERE pc.org_id IN (SELECT public.current_user_org_ids())
    ));
