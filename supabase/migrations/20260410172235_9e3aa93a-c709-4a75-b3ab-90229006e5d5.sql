
ALTER TABLE public.templates
  ADD COLUMN logo_width integer NOT NULL DEFAULT 0,
  ADD COLUMN logo_height integer NOT NULL DEFAULT 50,
  ADD COLUMN signature_width integer NOT NULL DEFAULT 0,
  ADD COLUMN signature_height integer NOT NULL DEFAULT 40,
  ADD COLUMN seal_width integer NOT NULL DEFAULT 0,
  ADD COLUMN seal_height integer NOT NULL DEFAULT 60,
  ADD COLUMN show_qr_code boolean NOT NULL DEFAULT true,
  ADD COLUMN show_certificate_id boolean NOT NULL DEFAULT true,
  ADD COLUMN show_org_name boolean NOT NULL DEFAULT true,
  ADD COLUMN qr_code_x numeric NOT NULL DEFAULT 90,
  ADD COLUMN qr_code_y numeric NOT NULL DEFAULT 90,
  ADD COLUMN cert_id_x numeric NOT NULL DEFAULT 50,
  ADD COLUMN cert_id_y numeric NOT NULL DEFAULT 90,
  ADD COLUMN org_name_x numeric NOT NULL DEFAULT 10,
  ADD COLUMN org_name_y numeric NOT NULL DEFAULT 90;
