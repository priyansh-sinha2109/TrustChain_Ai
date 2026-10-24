CREATE TABLE public.document_approvals (
    document_id uuid PRIMARY KEY REFERENCES public.documents(id),
    org_id uuid NOT NULL REFERENCES public.organizations(id),
    case_id uuid NOT NULL,
    approved_by uuid NOT NULL,
    sha256 text NOT NULL CHECK(length(sha256)=64),
    note text NOT NULL CHECK(length(note) BETWEEN 1 AND 2000),
    approved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    FOREIGN KEY(case_id,org_id) REFERENCES public.purchase_cases(id,org_id)
);
CREATE FUNCTION public.validate_document_approval() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.documents d JOIN public.purchase_cases pc ON pc.id=d.case_id
      WHERE d.id=NEW.document_id AND d.case_id=NEW.case_id AND pc.org_id=NEW.org_id
      AND d.sha256=NEW.sha256 AND d.status IN ('UPLOADED','EXTRACTED')
      AND d.doc_type IN ('ACCEPTED_QUOTE','PURCHASE_ORDER')) THEN
    RAISE EXCEPTION 'Approval requires a confirmed accepted quote/order with matching content hash';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.organization_members m WHERE m.user_id=NEW.approved_by
      AND m.org_id=NEW.org_id AND m.is_active AND m.role IN ('reviewer','admin')) THEN
    RAISE EXCEPTION 'Approval requires an active reviewer or admin';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validate_document_approval BEFORE INSERT ON public.document_approvals
  FOR EACH ROW EXECUTE FUNCTION public.validate_document_approval();
CREATE TRIGGER immutable_document_approvals BEFORE UPDATE OR DELETE ON public.document_approvals
  FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_change();
ALTER TABLE public.document_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.document_approvals FROM PUBLIC,anon,authenticated;
-- Existing browser credentials must not rewrite metadata under an approved content hash.
REVOKE UPDATE, DELETE ON public.documents FROM anon,authenticated;
