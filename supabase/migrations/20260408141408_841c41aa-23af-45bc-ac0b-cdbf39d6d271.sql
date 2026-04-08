-- Make certificate-templates bucket public
UPDATE storage.buckets SET public = true WHERE id = 'certificate-templates';

-- Drop duplicate INSERT policy on certificate_verifications
DROP POLICY IF EXISTS "Authenticated can log a verification" ON public.certificate_verifications;