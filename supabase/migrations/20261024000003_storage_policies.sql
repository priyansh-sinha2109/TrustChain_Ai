-- ==============================================================================
-- TrustChain AI — Migration 000003: Supabase Storage Configuration & Policies
-- Team Ashwamedha (HackIIITD 2026) | Role: Member 3
-- ==============================================================================
-- Purpose:
-- 1. Create private buckets: 'case-documents' and 'case-reports'
-- 2. Restrict public access (public = false)
-- 3. Enforce path convention: {org_id}/{case_id}/{document_uuid}.pdf
-- 4. Storage Row-Level Security (RLS) on storage.objects:
--    - Multi-tenant path verification
--    - Expiring signed URLs for private downloads
--    - Mime type and file size validation
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Create Private Storage Buckets (if storage schema exists)
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    (
        'case-documents',
        'case-documents',
        false,
        15728640, -- 15 MB limit
        ARRAY['application/pdf']
    ),
    (
        'case-reports',
        'case-reports',
        false,
        20971520, -- 20 MB limit
        ARRAY['application/pdf', 'application/json']
    )
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ------------------------------------------------------------------------------
-- 2. Storage RLS Policies on storage.objects
-- ------------------------------------------------------------------------------
-- Ensure RLS is enabled on storage.objects
-- Hosted Supabase already enables RLS and owns this table with its Storage role.
-- Do not issue a redundant ALTER against a provider-owned table.
DO $$
BEGIN
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'storage.objects'::regclass) THEN
        ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Policy 1: Organization Members can READ private documents in their organization path
-- Path structure: {org_id}/{case_id}/{document_uuid}.pdf
DROP POLICY IF EXISTS "org_member_read_case_documents" ON storage.objects;
CREATE POLICY "org_member_read_case_documents" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id IN ('case-documents', 'case-reports')
        AND (
            (storage.foldername(name))[1]::uuid IN (SELECT public.current_user_org_ids())
        )
    );

-- Policy 2: Buyers and Admins can UPLOAD documents into their organization path
DROP POLICY IF EXISTS "buyer_admin_upload_case_documents" ON storage.objects;
CREATE POLICY "buyer_admin_upload_case_documents" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'case-documents'
        AND public.has_org_role((storage.foldername(name))[1]::uuid, ARRAY['buyer', 'admin'])
        AND (LOWER(storage.extension(name)) = 'pdf')
    );

-- Policy 3: Reviewers and Admins can UPLOAD generated case reports
DROP POLICY IF EXISTS "reviewer_admin_upload_case_reports" ON storage.objects;
CREATE POLICY "reviewer_admin_upload_case_reports" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'case-reports'
        AND public.has_org_role((storage.foldername(name))[1]::uuid, ARRAY['reviewer', 'admin'])
    );

-- Policy 4: Admins can DELETE documents in their organization path
DROP POLICY IF EXISTS "admin_delete_case_documents" ON storage.objects;
CREATE POLICY "admin_delete_case_documents" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id IN ('case-documents', 'case-reports')
        AND public.has_org_role((storage.foldername(name))[1]::uuid, ARRAY['admin'])
    );
