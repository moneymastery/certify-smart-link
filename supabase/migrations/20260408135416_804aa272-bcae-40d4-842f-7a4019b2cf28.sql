CREATE OR REPLACE FUNCTION public.get_org_name_for_certificate(_cert_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT o.name FROM organizations o
  JOIN certificates c ON c.organization_id = o.id
  WHERE c.id = _cert_id
  LIMIT 1;
$$;