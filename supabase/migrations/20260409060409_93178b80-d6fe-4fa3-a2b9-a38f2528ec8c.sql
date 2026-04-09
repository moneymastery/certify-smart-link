
-- Drop existing INSERT policy if it conflicts
DROP POLICY IF EXISTS "Anyone can log a verification" ON public.certificate_verifications;

-- Re-create with both anon and authenticated roles
CREATE POLICY "Anyone can log a verification" ON public.certificate_verifications
FOR INSERT TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM certificates
    WHERE certificates.id = certificate_verifications.certificate_id
    AND certificates.status = 'active'
  )
);
