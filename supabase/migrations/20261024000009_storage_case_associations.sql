-- Bind browser Storage policies to a real case and canonical document reservation.
-- Signed upload URLs are issued by the backend for the same reservation, without upsert.
CREATE FUNCTION public.can_access_case_document_object(p_name text,p_upload boolean)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_org uuid; v_case uuid; v_document uuid;
BEGIN
  IF p_name !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$' THEN RETURN false; END IF;
  BEGIN
    v_org:=split_part(p_name,'/',1)::uuid;
    v_case:=split_part(p_name,'/',2)::uuid;
    v_document:=replace(split_part(p_name,'/',3),'.pdf','')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN RETURN false;
  END;
  IF NOT EXISTS(SELECT 1 FROM public.purchase_cases pc JOIN public.organization_members m ON m.org_id=pc.org_id
      WHERE pc.id=v_case AND pc.org_id=v_org AND m.user_id=auth.uid() AND m.is_active) THEN RETURN false; END IF;
  IF p_upload THEN
    RETURN public.has_org_role(v_org,ARRAY['buyer','admin']) AND EXISTS(
      SELECT 1 FROM public.document_uploads u WHERE u.id=v_document AND u.org_id=v_org
      AND u.case_id=v_case AND u.user_id=auth.uid() AND u.storage_key=p_name
      AND u.confirmed_at IS NULL AND u.expires_at>clock_timestamp());
  END IF;
  RETURN EXISTS(SELECT 1 FROM public.documents d WHERE d.id=v_document AND d.case_id=v_case
      AND d.storage_key=p_name AND d.sha256 IS NOT NULL AND d.status IN ('UPLOADED','EXTRACTED','PROCESSING'));
END $$;

DROP POLICY "buyer_admin_upload_case_documents" ON storage.objects;
CREATE POLICY "buyer_admin_upload_case_documents" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK(bucket_id='case-documents' AND public.can_access_case_document_object(name,true));
DROP POLICY "org_member_read_case_documents" ON storage.objects;
CREATE POLICY "org_member_read_case_documents" ON storage.objects FOR SELECT TO authenticated
  USING((bucket_id='case-documents' AND public.can_access_case_document_object(name,false))
    OR (bucket_id='case-reports' AND (storage.foldername(name))[1]::uuid IN (SELECT public.current_user_org_ids())));
