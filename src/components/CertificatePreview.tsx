import { resolveFieldValue, LINE_HEIGHT_RATIO } from "@/lib/certificate-layout";

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
  logo_x: number;
  logo_y: number;
  signature_x: number;
  signature_y: number;
  seal_x: number;
  seal_y: number;
  logo_width: number;
  logo_height: number;
  signature_width: number;
  signature_height: number;
  seal_width: number;
  seal_height: number;
  show_qr_code: boolean;
  show_certificate_id: boolean;
  show_org_name: boolean;
  qr_code_x: number;
  qr_code_y: number;
  cert_id_x: number;
  cert_id_y: number;
  org_name_x: number;
  org_name_y: number;
}

interface CertificatePreviewProps {
  template: PreviewTemplate;
  fields: PreviewField[];
  recipientData: Record<string, string>;
  recipientName: string;
  orgName: string;
  /** Canvas width in px (default 842) */
  canvasWidth?: number;
  /** Canvas height in px (default 595) */
  canvasHeight?: number;
  /** Scale factor applied via CSS transform (default 0.7) */
  scale?: number;
}

/**
 * Shared certificate preview that uses the exact same positioning rules
 * as the PDF generator (shared LINE_HEIGHT_RATIO, resolveFieldValue,
 * and CSS translate(-50%, -50%) centring that the PDF formula mirrors).
 */
const CertificatePreview = ({
  template: t,
  fields,
  recipientData,
  recipientName,
  orgName,
  canvasWidth = 842,
  canvasHeight = 595,
  scale = 0.7,
}: CertificatePreviewProps) => {
  const data = { recipientName, recipientData };

  return (
    <div className="flex items-center justify-center p-4 overflow-auto">
      <div
        className="relative bg-background border border-border shadow"
        style={{
          width: canvasWidth,
          height: canvasHeight,
          transform: `scale(${scale})`,
          transformOrigin: "top center",
          backgroundImage: t.background_url ? `url(${t.background_url})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Dynamic text fields — uses shared resolveFieldValue */}
        {fields.map((f) => {
          const value = resolveFieldValue(
            { fieldKey: f.field_key, label: f.label },
            data
          );
          if (!value) return null;

          const isTemplateText = f.label?.includes("{{");
          return (
            <div
              key={f.id}
              className="absolute"
              style={{
                left: `${Number(f.x_position)}%`,
                top: `${Number(f.y_position)}%`,
                transform: "translate(-50%, -50%)",
                fontSize: f.font_size,
                lineHeight: LINE_HEIGHT_RATIO,
                fontWeight: f.font_weight || "normal",
                color: f.font_color || "#000",
                textAlign: f.text_align as any,
                maxWidth: f.max_width || undefined,
                whiteSpace: isTemplateText ? "normal" : "nowrap",
                wordBreak: isTemplateText ? "break-word" : undefined,
              }}
            >
              {value}
            </div>
          );
        })}

        {/* QR Code placeholder */}
        {t.show_qr_code !== false && (
          <div
            className="absolute flex flex-col items-center"
            style={{
              left: `${Number(t.qr_code_x ?? 90)}%`,
              top: `${Number(t.qr_code_y ?? 90)}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className="w-14 h-14 border-2 border-dashed border-muted-foreground/60 bg-background/50 rounded flex items-center justify-center">
              <span className="text-[9px] text-muted-foreground font-medium">QR</span>
            </div>
          </div>
        )}

        {/* Certificate ID */}
        {t.show_certificate_id !== false && (
          <div
            className="absolute"
            style={{
              left: `${Number(t.cert_id_x ?? 50)}%`,
              top: `${Number(t.cert_id_y ?? 90)}%`,
              transform: "translate(-50%, -50%)",
              lineHeight: LINE_HEIGHT_RATIO,
            }}
          >
            <span className="text-[9px] text-muted-foreground">Certificate ID: CERT-XXXXXX</span>
          </div>
        )}

        {/* Organization Name */}
        {t.show_org_name !== false && (
          <div
            className="absolute"
            style={{
              left: `${Number(t.org_name_x ?? 10)}%`,
              top: `${Number(t.org_name_y ?? 90)}%`,
              transform: "translate(-50%, -50%)",
              lineHeight: LINE_HEIGHT_RATIO,
            }}
          >
            <span className="text-[10px] font-bold text-foreground/70">{orgName || "Org Name"}</span>
          </div>
        )}

        {/* Logo */}
        {t.logo_url && (
          <img
            src={t.logo_url}
            alt="Logo"
            className="absolute object-contain"
            style={{
              left: `${Number(t.logo_x ?? 50)}%`,
              top: `${Number(t.logo_y ?? 5)}%`,
              transform: "translate(-50%, -50%)",
              height: t.logo_height > 0 ? t.logo_height : 50,
              width: t.logo_width > 0 ? t.logo_width : "auto",
            }}
          />
        )}

        {/* Signature */}
        {t.signature_url && (
          <img
            src={t.signature_url}
            alt="Signature"
            className="absolute object-contain"
            style={{
              left: `${Number(t.signature_x ?? 25)}%`,
              top: `${Number(t.signature_y ?? 85)}%`,
              transform: "translate(-50%, -50%)",
              height: t.signature_height > 0 ? t.signature_height : 40,
              width: t.signature_width > 0 ? t.signature_width : "auto",
            }}
          />
        )}

        {/* Seal */}
        {t.seal_url && (
          <img
            src={t.seal_url}
            alt="Seal"
            className="absolute object-contain"
            style={{
              left: `${Number(t.seal_x ?? 80)}%`,
              top: `${Number(t.seal_y ?? 82)}%`,
              transform: "translate(-50%, -50%)",
              height: t.seal_height > 0 ? t.seal_height : 60,
              width: t.seal_width > 0 ? t.seal_width : "auto",
            }}
          />
        )}
      </div>
    </div>
  );
};

export default CertificatePreview;