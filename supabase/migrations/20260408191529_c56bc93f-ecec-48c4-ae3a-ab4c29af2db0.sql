
-- Add verification_fields column to templates
ALTER TABLE public.templates
ADD COLUMN verification_fields text[] NOT NULL DEFAULT '{}';

-- Create RPC to get org branding + verification fields for a certificate
CREATE OR REPLACE FUNCTION public.get_org_branding_for_certificate(_cert_id uuid)
RETURNS TABLE(org_name text, org_logo_url text, verification_fields text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT o.name, o.logo_url, t.verification_fields
  FROM certificates c
  JOIN organizations o ON o.id = c.organization_id
  JOIN templates t ON t.id = c.template_id
  WHERE c.id = _cert_id
  LIMIT 1;
$$;
