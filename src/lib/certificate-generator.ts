import { PDFDocument } from "pdf-lib";
import html2canvas from "html2canvas";
import {
  renderCertificateInto,
  waitForImages,
  buildQrDataUrl,
  type RenderTemplate,
  type RenderField,
} from "./certificate-html-renderer";

export interface CertificateData {
  recipientName: string;
  recipientEmail?: string;
  recipientData: Record<string, string>;
  serialNumber: string;
  verificationToken: string;
}

export interface TemplateAssets {
  backgroundUrl?: string | null;
  logoUrl?: string | null;
  signatureUrl?: string | null;
  sealUrl?: string | null;
  logoX?: number; logoY?: number;
  signatureX?: number; signatureY?: number;
  sealX?: number; sealY?: number;
  logoWidth?: number; logoHeight?: number;
  signatureWidth?: number; signatureHeight?: number;
  sealWidth?: number; sealHeight?: number;
}

export interface DisplayToggles {
  showQrCode?: boolean;
  showCertificateId?: boolean;
  showOrgName?: boolean;
  qrCodeX?: number; qrCodeY?: number;
  certIdX?: number; certIdY?: number;
  orgNameX?: number; orgNameY?: number;
}

export interface GenerationConfig {
  templateName: string;
  organizationName: string;
  width: number;
  height: number;
  issueDate?: string;
  fields: {
    fieldKey: string;
    label: string;
    xPosition: number;
    yPosition: number;
    fontSize: number;
    fontColor: string;
    fontWeight: string;
    textAlign: "left" | "center" | "right";
    maxWidth?: number;
  }[];
  assets?: TemplateAssets;
  displayToggles?: DisplayToggles;
}

export const generateSerialNumber = (prefix = "CERT"): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

/** Build the RenderTemplate / RenderField shapes the HTML renderer expects. */
const toRenderTemplate = (cfg: GenerationConfig): RenderTemplate => {
  const a = cfg.assets || {};
  const t = cfg.displayToggles || {};
  return {
    background_url: a.backgroundUrl ?? null,
    logo_url: a.logoUrl ?? null,
    signature_url: a.signatureUrl ?? null,
    seal_url: a.sealUrl ?? null,
    logo_x: a.logoX ?? 50, logo_y: a.logoY ?? 5,
    signature_x: a.signatureX ?? 25, signature_y: a.signatureY ?? 85,
    seal_x: a.sealX ?? 80, seal_y: a.sealY ?? 82,
    logo_width: a.logoWidth ?? 0, logo_height: a.logoHeight ?? 0,
    signature_width: a.signatureWidth ?? 0, signature_height: a.signatureHeight ?? 0,
    seal_width: a.sealWidth ?? 0, seal_height: a.sealHeight ?? 0,
    show_qr_code: t.showQrCode !== false,
    show_certificate_id: t.showCertificateId !== false,
    show_org_name: t.showOrgName !== false,
    qr_code_x: t.qrCodeX ?? 90, qr_code_y: t.qrCodeY ?? 90,
    cert_id_x: t.certIdX ?? 50, cert_id_y: t.certIdY ?? 90,
    org_name_x: t.orgNameX ?? 10, org_name_y: t.orgNameY ?? 90,
  };
};

const toRenderFields = (cfg: GenerationConfig): RenderField[] =>
  cfg.fields.map((f, i) => ({
    id: String(i),
    field_key: f.fieldKey,
    label: f.label,
    x_position: f.xPosition,
    y_position: f.yPosition,
    font_size: f.fontSize,
    font_color: f.fontColor,
    font_weight: f.fontWeight,
    text_align: f.textAlign,
    max_width: f.maxWidth ?? null,
  }));

/**
 * Generate a certificate PDF by rendering the same HTML used for the
 * preview, capturing it with html2canvas, and embedding the PNG.
 * Guarantees 100% visual parity with the in-app preview.
 */
export const generateCertificatePDF = async (
  data: CertificateData,
  config: GenerationConfig,
  verifyBaseUrl: string
): Promise<Uint8Array> => {
  // Build offscreen container at exact certificate dimensions
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-99999px";
  host.style.top = "0";
  host.style.zIndex = "-1";
  host.style.pointerEvents = "none";
  document.body.appendChild(host);

  try {
    const qrDataUrl = await buildQrDataUrl(`${verifyBaseUrl}/verify/${data.verificationToken}`);

    renderCertificateInto(host, {
      template: toRenderTemplate(config),
      fields: toRenderFields(config),
      recipientName: data.recipientName,
      recipientData: data.recipientData,
      orgName: config.organizationName,
      certificateId: data.serialNumber,
      qrDataUrl,
      canvasWidth: config.width,
      canvasHeight: config.height,
    });

    await waitForImages(host);
    // Allow layout to settle one frame
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    const canvas = await html2canvas(host, {
      backgroundColor: "#ffffff",
      scale: 2, // high-DPI for crisp PDF
      useCORS: true,
      allowTaint: false,
      logging: false,
      width: config.width,
      height: config.height,
      windowWidth: config.width,
      windowHeight: config.height,
    });

    const pngDataUrl = canvas.toDataURL("image/png");
    const pngBytes = Uint8Array.from(atob(pngDataUrl.split(",")[1]), (c) => c.charCodeAt(0));

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([config.width, config.height]);
    const pngImage = await pdfDoc.embedPng(pngBytes);
    page.drawImage(pngImage, { x: 0, y: 0, width: config.width, height: config.height });

    return pdfDoc.save();
  } finally {
    if (host.parentNode) host.parentNode.removeChild(host);
  }
};
