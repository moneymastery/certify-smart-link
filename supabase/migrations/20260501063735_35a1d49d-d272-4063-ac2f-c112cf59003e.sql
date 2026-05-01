-- Backfill owner membership for organizations created while the owner-member trigger was missing
INSERT INTO public.organization_members (organization_id, user_id, role)
SELECT o.id, o.owner_id, 'owner'
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1
  FROM public.organization_members om
  WHERE om.organization_id = o.id
    AND om.user_id = o.owner_id
);

-- Ensure every new organization automatically gets an owner membership row
DROP TRIGGER IF EXISTS auto_add_org_owner_trigger ON public.organizations;
CREATE TRIGGER auto_add_org_owner_trigger
AFTER INSERT ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.auto_add_org_owner();