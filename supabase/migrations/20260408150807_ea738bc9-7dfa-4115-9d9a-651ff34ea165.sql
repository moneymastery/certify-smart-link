
-- 1. Create secure RPC for certificate verification (replaces open anon SELECT)
CREATE OR REPLACE FUNCTION public.verify_certificate_by_token(_token text)
RETURNS TABLE (
  id uuid,
  serial_number text,
  recipient_name text,
  recipient_data jsonb,
  status text,
  issued_at timestamptz,
  organization_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.serial_number, c.recipient_name, c.recipient_data, c.status, c.issued_at, c.organization_id
  FROM certificates c
  WHERE c.verification_token = _token OR c.serial_number = _token
  LIMIT 1;
$$;

-- 2. Drop the overly permissive anon SELECT policy on certificates
DROP POLICY IF EXISTS "Anyone can verify certificates by token" ON public.certificates;

-- 3. Tighten certificate_verifications INSERT to validate certificate_id exists
DROP POLICY IF EXISTS "Anyone can log a verification" ON public.certificate_verifications;

CREATE POLICY "Anyone can log a verification"
ON public.certificate_verifications
FOR INSERT
TO anon
WITH CHECK (
  EXISTS (SELECT 1 FROM certificates WHERE id = certificate_id AND status = 'active')
);

-- 4. Fix storage policies for certificate-templates bucket (org admin check via folder path)
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can upload template files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update template files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete template files" ON storage.objects;

-- Recreate with org admin check (files stored as {org_id}/filename)
CREATE POLICY "Org admins can upload template files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'certificate-templates'
  AND is_org_admin(auth.uid(), (storage.foldername(name))[1]::uuid)
);

CREATE POLICY "Org admins can update template files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'certificate-templates'
  AND is_org_admin(auth.uid(), (storage.foldername(name))[1]::uuid)
);

CREATE POLICY "Org admins can delete template files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'certificate-templates'
  AND is_org_admin(auth.uid(), (storage.foldername(name))[1]::uuid)
);
