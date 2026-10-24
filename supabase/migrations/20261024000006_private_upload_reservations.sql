CREATE TABLE public.document_uploads (
    id uuid PRIMARY KEY,
    org_id uuid NOT NULL REFERENCES public.organizations(id),
    case_id uuid NOT NULL,
    user_id uuid NOT NULL,
    doc_type text NOT NULL CHECK(doc_type IN ('RFQ','ACCEPTED_QUOTE','PURCHASE_ORDER','FINAL_PI')),
    file_name text NOT NULL,
    file_size bigint NOT NULL CHECK(file_size BETWEEN 1 AND 10000000),
    storage_key text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    confirmed_at timestamptz,
    sha256 text,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    FOREIGN KEY(case_id,org_id) REFERENCES public.purchase_cases(id,org_id),
    CHECK(storage_key=org_id::text||'/'||case_id::text||'/'||id::text||'.pdf'),
    CHECK(confirmed_at IS NULL OR sha256 IS NOT NULL)
);
ALTER TABLE public.document_uploads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.document_uploads FROM PUBLIC,anon,authenticated;
UPDATE storage.buckets SET public=false,file_size_limit=10000000,
    allowed_mime_types=ARRAY['application/pdf'] WHERE id='case-documents';
