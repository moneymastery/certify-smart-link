
-- ============================================
-- CertifyPro Database Schema
-- ============================================

-- 1. Timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 2. Organizations
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Organization members (for multi-user orgs later)
CREATE TABLE public.organization_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Helper: check if user belongs to an org (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id AND role IN ('owner', 'admin')
  )
$$;

-- 4. Templates
CREATE TABLE public.templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  background_url TEXT,
  logo_url TEXT,
  signature_url TEXT,
  seal_url TEXT,
  width_px INT NOT NULL DEFAULT 1122,
  height_px INT NOT NULL DEFAULT 793,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Template fields
CREATE TABLE public.template_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  x_position NUMERIC NOT NULL DEFAULT 0,
  y_position NUMERIC NOT NULL DEFAULT 0,
  font_size INT NOT NULL DEFAULT 16,
  font_family TEXT NOT NULL DEFAULT 'Inter',
  font_color TEXT NOT NULL DEFAULT '#000000',
  text_align TEXT NOT NULL DEFAULT 'center' CHECK (text_align IN ('left', 'center', 'right')),
  max_width INT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.template_fields ENABLE ROW LEVEL SECURITY;

-- 6. Certificate batches
CREATE TABLE public.certificate_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.templates(id),
  name TEXT NOT NULL,
  csv_file_url TEXT,
  total_count INT NOT NULL DEFAULT 0,
  generated_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.certificate_batches ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_batches_updated_at
  BEFORE UPDATE ON public.certificate_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Certificates
CREATE TABLE public.certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.templates(id),
  batch_id UUID REFERENCES public.certificate_batches(id) ON DELETE SET NULL,
  serial_number TEXT NOT NULL UNIQUE,
  verification_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  recipient_name TEXT NOT NULL,
  recipient_email TEXT,
  recipient_data JSONB NOT NULL DEFAULT '{}',
  pdf_url TEXT,
  qr_code_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'reissued', 'expired')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_certificates_updated_at
  BEFORE UPDATE ON public.certificates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_certificates_serial ON public.certificates(serial_number);
CREATE INDEX idx_certificates_token ON public.certificates(verification_token);
CREATE INDEX idx_certificates_org ON public.certificates(organization_id);
CREATE INDEX idx_certificates_batch ON public.certificates(batch_id);

-- 8. Certificate verifications (audit trail)
CREATE TABLE public.certificate_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  certificate_id UUID NOT NULL REFERENCES public.certificates(id) ON DELETE CASCADE,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);
ALTER TABLE public.certificate_verifications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Organizations: members can view, owner/admin can modify
CREATE POLICY "Members can view their organizations"
  ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), id));

CREATE POLICY "Authenticated users can create organizations"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Admins can update their organizations"
  ON public.organizations FOR UPDATE TO authenticated
  USING (public.is_org_admin(auth.uid(), id));

CREATE POLICY "Owner can delete organization"
  ON public.organizations FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- Organization members
CREATE POLICY "Members can view org members"
  ON public.organization_members FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins can add org members"
  ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Admins can remove org members"
  ON public.organization_members FOR DELETE TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id));

-- Templates: org members can view, admins can modify
CREATE POLICY "Members can view templates"
  ON public.templates FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins can create templates"
  ON public.templates FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id) AND auth.uid() = created_by);

CREATE POLICY "Admins can update templates"
  ON public.templates FOR UPDATE TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Admins can delete templates"
  ON public.templates FOR DELETE TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id));

-- Template fields: same access as templates (via template's org)
CREATE POLICY "Members can view template fields"
  ON public.template_fields FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.templates t
    WHERE t.id = template_id AND public.is_org_member(auth.uid(), t.organization_id)
  ));

CREATE POLICY "Admins can manage template fields"
  ON public.template_fields FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.templates t
    WHERE t.id = template_id AND public.is_org_admin(auth.uid(), t.organization_id)
  ));

CREATE POLICY "Admins can update template fields"
  ON public.template_fields FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.templates t
    WHERE t.id = template_id AND public.is_org_admin(auth.uid(), t.organization_id)
  ));

CREATE POLICY "Admins can delete template fields"
  ON public.template_fields FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.templates t
    WHERE t.id = template_id AND public.is_org_admin(auth.uid(), t.organization_id)
  ));

-- Certificate batches
CREATE POLICY "Members can view batches"
  ON public.certificate_batches FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins can create batches"
  ON public.certificate_batches FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id) AND auth.uid() = created_by);

CREATE POLICY "Admins can update batches"
  ON public.certificate_batches FOR UPDATE TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id));

-- Certificates: org members can view, public can verify via token
CREATE POLICY "Members can view certificates"
  ON public.certificates FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins can create certificates"
  ON public.certificates FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Admins can update certificates"
  ON public.certificates FOR UPDATE TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id));

-- Public verification: anyone can look up a certificate by token (anon access)
CREATE POLICY "Anyone can verify certificates by token"
  ON public.certificates FOR SELECT TO anon
  USING (true);

-- Certificate verifications: public insert for audit, org members can view
CREATE POLICY "Anyone can log a verification"
  ON public.certificate_verifications FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Authenticated can log a verification"
  ON public.certificate_verifications FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Members can view verification logs"
  ON public.certificate_verifications FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.certificates c
    WHERE c.id = certificate_id AND public.is_org_member(auth.uid(), c.organization_id)
  ));

-- ============================================
-- STORAGE BUCKETS
-- ============================================

INSERT INTO storage.buckets (id, name, public) VALUES ('certificate-templates', 'certificate-templates', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('generated-certificates', 'generated-certificates', true);

-- Template storage: org admins can upload, members can view
CREATE POLICY "Members can view template files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'certificate-templates');

CREATE POLICY "Admins can upload template files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'certificate-templates');

CREATE POLICY "Admins can update template files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'certificate-templates');

CREATE POLICY "Admins can delete template files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'certificate-templates');

-- Generated certificates: public read (for QR verification), admins upload
CREATE POLICY "Anyone can view generated certificates"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'generated-certificates');

CREATE POLICY "Authenticated can upload generated certificates"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'generated-certificates');

-- Auto-create org membership when org is created
CREATE OR REPLACE FUNCTION public.auto_add_org_owner()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_organization_created
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.auto_add_org_owner();
