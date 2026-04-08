
-- Add asset position columns to templates
ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS logo_x numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS logo_y numeric NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS signature_x numeric NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS signature_y numeric NOT NULL DEFAULT 85,
  ADD COLUMN IF NOT EXISTS seal_x numeric NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS seal_y numeric NOT NULL DEFAULT 82;

-- DELETE policy on certificate_batches for org admins
CREATE POLICY "Admins can delete batches"
ON public.certificate_batches
FOR DELETE
TO authenticated
USING (is_org_admin(auth.uid(), organization_id));

-- DELETE policy on certificates for org admins
CREATE POLICY "Admins can delete certificates"
ON public.certificates
FOR DELETE
TO authenticated
USING (is_org_admin(auth.uid(), organization_id));
