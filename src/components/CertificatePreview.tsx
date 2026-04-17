import { useEffect, useRef } from "react";
import { renderCertificateInto } from "@/lib/certificate-html-renderer";

export interface PreviewField {
  id: string;
  field_key: string;
  label: string;
  x_position: number;
  y_position: number;
  font_size: number;
  font_color: string;
  font_weight: string;
  text_align: string;
  max_width: number | null;
}

export interface PreviewTemplate {
  background_url: string | null;
  logo_url: string | null;
  signature_url: string | null;
  seal_url: string | null;
  logo_x: number; logo_y: number;
  signature_x: number; signature_y: number;
  seal_x: number; seal_y: number;
  logo_width: number; logo_height: number;
  signature_width: number; signature_height: number;
  seal_width: number; seal_height: number;
  show_qr_code: boolean;
  show_certificate_id: boolean;
  show_org_name: boolean;
  qr_code_x: number; qr_code_y: number;
  cert_id_x: number; cert_id_y: number;
  org_name_x: number; org_name_y: number;
}

interface CertificatePreviewProps {
  template: PreviewTemplate;
  fields: PreviewField[];
  recipientData: Record<string, string>;
  recipientName: string;
  orgName: string;
  canvasWidth?: number;
  canvasHeight?: number;
  scale?: number;
}

/**
 * Shared certificate preview — renders via the SAME `renderCertificateInto`
 * function that the PDF generator uses, then html2canvas captures it.
 * Single source of truth → preview and PDF are pixel-identical.
 */
const CertificatePreview = ({
  template,
  fields,
  recipientData,
  recipientName,
  orgName,
  canvasWidth = 842,
  canvasHeight = 595,
  scale = 0.7,
}: CertificatePreviewProps) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    renderCertificateInto(ref.current, {
      template,
      fields,
      recipientName,
      recipientData,
      orgName,
      canvasWidth,
      canvasHeight,
      // No qrDataUrl → renderer shows the dashed "QR" placeholder
      // No certificateId → renderer shows "CERT-XXXXXX" placeholder
    });
  }, [template, fields, recipientName, recipientData, orgName, canvasWidth, canvasHeight]);

  return (
    <div className="flex items-center justify-center p-4 overflow-auto">
      <div
        style={{
          width: canvasWidth * scale,
          height: canvasHeight * scale,
        }}
      >
        <div
          ref={ref}
          className="border border-border shadow"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        />
      </div>
    </div>
  );
};

export default CertificatePreview;
