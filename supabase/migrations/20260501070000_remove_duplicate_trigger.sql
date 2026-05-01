-- Remove the old duplicate trigger that was causing 409 Conflict errors on organization creation
DROP TRIGGER IF EXISTS on_organization_created ON public.organizations;
