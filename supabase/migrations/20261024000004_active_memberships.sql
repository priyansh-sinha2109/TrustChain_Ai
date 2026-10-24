-- Additive integration migration. Existing members remain active; revocation is explicit.
ALTER TABLE public.organization_members ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.current_user_org_ids()
RETURNS TABLE(org_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$ SELECT om.org_id FROM public.organization_members om
      WHERE om.user_id=auth.uid() AND om.is_active $$;

CREATE OR REPLACE FUNCTION public.has_org_role(p_org_id uuid,p_roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$ SELECT EXISTS(SELECT 1 FROM public.organization_members om
      WHERE om.org_id=p_org_id AND om.user_id=auth.uid() AND om.is_active AND om.role=ANY(p_roles)) $$;

-- Membership/role changes are administrative. No browser may insert its own role.
REVOKE INSERT, UPDATE, DELETE ON public.organization_members FROM anon, authenticated;
COMMENT ON COLUMN public.organization_members.is_active IS
  'Revocation flag checked by backend context resolution and tenant RLS helpers.';
