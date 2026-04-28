ALTER TABLE public.template_fields
ADD COLUMN vertical_align TEXT NOT NULL DEFAULT 'middle';

ALTER TABLE public.template_fields
ADD CONSTRAINT template_fields_vertical_align_check
CHECK (vertical_align IN ('top', 'middle', 'bottom', 'baseline'));

COMMENT ON COLUMN public.template_fields.vertical_align IS 'Vertical anchor mode for certificate text fields: top, middle, bottom, or baseline.';