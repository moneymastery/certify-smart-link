import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import {
  buildQrDataUrl,
  type RenderTemplate,
  type RenderField,
} from "./certificate-html-renderer";
import {
  computeCoverDimensions,
  computePdfBaselineY,
  computePdfTextX,
  resolveFieldValue,
  sanitizeText,
  wrapText,
} from "./certificate-layout";

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
    verticalAlign?: "top" | "middle" | "bottom" | "baseline";
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
    vertical_align: f.verticalAlign ?? "middle",
    max_width: f.maxWidth ?? null,
  }));

// Helper to convert hex color to pdf-lib rgb
const hexToRgb = (hex: string) => {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
};

const fetchImageBytes = async (url: string) => {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`Failed to fetch image: ${url}`);
  return new Uint8Array(await res.arrayBuffer());
};

const embedImage = async (pdfDoc: PDFDocument, bytes: Uint8Array, url: string) => {
  // Check PNG magic bytes
  const isPng = bytes.length > 3 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (isPng || url.toLowerCase().includes("data:image/png")) {
    return await pdfDoc.embedPng(bytes);
  } else {
    return await pdfDoc.embedJpg(bytes);
  }
};

/**
 * Generate a certificate PDF using native pdf-lib rendering.
 * This guarantees pristine text rendering, accurate font sizes,
 * and fixes layout drift caused by html2canvas scaling issues.
 */
export const generateCertificatePDF = async (
  data: CertificateData,
  config: GenerationConfig,
  verifyBaseUrl: string
): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([config.width, config.height]);
  
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const a = config.assets || {};
  const t = config.displayToggles || {};

  // 1. Draw Background using cover dimensions
  if (a.backgroundUrl) {
    try {
      const bytes = await fetchImageBytes(a.backgroundUrl);
      const img = await embedImage(pdfDoc, bytes, a.backgroundUrl);
      const dims = computeCoverDimensions(img.width, img.height, config.width, config.height);
      page.drawImage(img, { x: dims.x, y: dims.y, width: dims.width, height: dims.height });
    } catch (e) {
      console.warn("Failed to embed background", e);
    }
  }

  // Helper for drawing positioned images
  const drawOverlay = async (url: string | null | undefined, xPct: number, yPct: number, wPx: number, hPx: number, defaultH: number) => {
    if (!url) return;
    try {
      const bytes = await fetchImageBytes(url);
      const img = await embedImage(pdfDoc, bytes, url);
      
      let drawH = hPx > 0 ? hPx : defaultH;
      let drawW = wPx > 0 ? wPx : (img.width / img.height) * drawH;
      
      const x = (xPct / 100) * config.width - drawW / 2;
      const y = config.height - ((yPct / 100) * config.height) - drawH / 2;
      page.drawImage(img, { x, y, width: drawW, height: drawH });
    } catch (e) {
      console.warn("Failed to embed overlay", url, e);
    }
  };

  // 2. Draw Overlays
  await drawOverlay(a.logoUrl, a.logoX ?? 50, a.logoY ?? 5, a.logoWidth ?? 0, a.logoHeight ?? 0, 50);
  await drawOverlay(a.signatureUrl, a.signatureX ?? 25, a.signatureY ?? 85, a.signatureWidth ?? 0, a.signatureHeight ?? 0, 40);
  await drawOverlay(a.sealUrl, a.sealX ?? 80, a.sealY ?? 82, a.sealWidth ?? 0, a.sealHeight ?? 0, 60);

  // 3. Draw QR Code
  if (t.showQrCode !== false) {
    const qrUrl = await buildQrDataUrl(`${verifyBaseUrl}/verify/${data.verificationToken}`);
    const qrBytes = Uint8Array.from(atob(qrUrl.split(",")[1]), (c) => c.charCodeAt(0));
    const qrImg = await pdfDoc.embedPng(qrBytes);
    
    // Web builder uses 80px for the final render, so match that explicitly
    const qrSize = 80;
    const qx = ((t.qrCodeX ?? 90) / 100) * config.width - qrSize / 2;
    // Remember PDF is bottom-up
    const qy = config.height - (((t.qrCodeY ?? 90) / 100) * config.height) - qrSize / 2;
    page.drawImage(qrImg, { x: qx, y: qy, width: qrSize, height: qrSize });
    
    // "Scan to verify" text
    const capFont = helvetica;
    const capSize = 7;
    const capText = "Scan to verify";
    const capW = capFont.widthOfTextAtSize(capText, capSize);
    page.drawText(capText, {
      x: qx + qrSize / 2 - capW / 2,
      y: qy - capSize - 2, // slightly below QR
      size: capSize,
      font: capFont,
      color: hexToRgb("#808080"),
    });
  }

  // 4. Draw Certificate ID
  if (t.showCertificateId !== false) {
    const certText = `Certificate ID: ${sanitizeText(data.serialNumber || "CERT-XXXXXX")}`;
    const cidFont = helvetica;
    const cidSize = 9;
    const cidW = cidFont.widthOfTextAtSize(certText, cidSize);
    const cx = ((t.certIdX ?? 50) / 100) * config.width - cidW / 2;
    const cy = config.height - (((t.certIdY ?? 90) / 100) * config.height);
    page.drawText(certText, { x: cx, y: cy, size: cidSize, font: cidFont, color: hexToRgb("#808080") });
  }

  // 5. Draw Org Name
  if (t.showOrgName !== false) {
    const orgText = sanitizeText(config.organizationName || "Org Name");
    const orgFont = helveticaBold;
    const orgSize = 10;
    const orgW = orgFont.widthOfTextAtSize(orgText, orgSize);
    const ox = ((t.orgNameX ?? 10) / 100) * config.width - orgW / 2;
    const oy = config.height - (((t.orgNameY ?? 90) / 100) * config.height);
    page.drawText(orgText, { x: ox, y: oy, size: orgSize, font: orgFont, color: hexToRgb("#141E32") });
  }

  // 6. Draw Dynamic Text Fields
  for (const f of config.fields) {
    const val = resolveFieldValue({ fieldKey: f.fieldKey, label: f.label }, { recipientName: data.recipientName, recipientData: data.recipientData });
    if (!val) continue;

    const font = f.fontWeight === "bold" ? helveticaBold : helvetica;
    const measure = (s: string) => font.widthOfTextAtSize(s, f.fontSize);
    
    // If it's a template field and has maxWidth, wrap it. Else use single line.
    const isTemplateText = f.label.includes("{{");
    const lines = (isTemplateText && f.maxWidth) ? wrapText(val, measure, f.maxWidth) : [val];

    for (let i = 0; i < lines.length; i++) {
      const line = sanitizeText(lines[i]);
      if (!line) continue;
      const lineW = measure(line);
      const px = computePdfTextX(config.width, f.xPosition, lineW, f.textAlign);
      const py = computePdfBaselineY(config.height, f.yPosition, f.fontSize, lines.length, i);

      page.drawText(line, {
        x: px,
        y: py,
        size: f.fontSize,
        font: font,
        color: hexToRgb(f.fontColor || "#000000"),
      });
    }
  }

  return pdfDoc.save();
};
