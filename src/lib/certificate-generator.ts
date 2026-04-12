import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
import {
  LINE_HEIGHT_RATIO,
  resolveFieldValue,
  sanitizeText,
  computeCoverDimensions,
  computePdfBaselineY,
  computePdfTextX,
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
  logoX?: number;
  logoY?: number;
  signatureX?: number;
  signatureY?: number;
  sealX?: number;
  sealY?: number;
  logoWidth?: number;
  logoHeight?: number;
  signatureWidth?: number;
  signatureHeight?: number;
  sealWidth?: number;
  sealHeight?: number;
}

export interface DisplayToggles {
  showQrCode?: boolean;
  showCertificateId?: boolean;
  showOrgName?: boolean;
  qrCodeX?: number;
  qrCodeY?: number;
  certIdX?: number;
  certIdY?: number;
  orgNameX?: number;
  orgNameY?: number;
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

const hexToRgb = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return rgb(r, g, b);
};

export const generateSerialNumber = (prefix = "CERT"): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

export const generateQRCodeDataUrl = async (url: string): Promise<string> => {
  return QRCode.toDataURL(url, {
    width: 150,
    margin: 1,
    color: { dark: "#1a2540", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });
};

const fetchImageBytes = async (url: string): Promise<Uint8Array | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  } catch {
    return null;
  }
};

const embedImage = async (pdfDoc: PDFDocument, bytes: Uint8Array, url: string) => {
  const lower = url.toLowerCase();
  if (lower.endsWith(".png")) {
    return pdfDoc.embedPng(bytes);
  }
  return pdfDoc.embedJpg(bytes);
};

export const generateCertificatePDF = async (
  data: CertificateData,
  config: GenerationConfig,
  verifyBaseUrl: string
): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([config.width, config.height]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const assets = config.assets;

  // Background
   if (assets?.backgroundUrl) {
    const bgBytes = await fetchImageBytes(assets.backgroundUrl);
    if (bgBytes) {
      try {
        const bgImage = await embedImage(pdfDoc, bgBytes, assets.backgroundUrl);
        const cover = computeCoverDimensions(bgImage.width, bgImage.height, config.width, config.height);
        page.drawImage(bgImage, { x: cover.x, y: cover.y, width: cover.width, height: cover.height });
      } catch {
        page.drawRectangle({ x: 0, y: 0, width: config.width, height: config.height, color: rgb(1, 1, 1) });
      }
    } else {
      page.drawRectangle({ x: 0, y: 0, width: config.width, height: config.height, color: rgb(1, 1, 1) });
    }
  } else {
    page.drawRectangle({ x: 0, y: 0, width: config.width, height: config.height, color: rgb(1, 1, 1) });
    const borderColor = rgb(0.1, 0.15, 0.25);
    page.drawRectangle({ x: 20, y: 20, width: config.width - 40, height: config.height - 40, borderColor, borderWidth: 3 });
    page.drawRectangle({ x: 30, y: 30, width: config.width - 60, height: config.height - 60, borderColor: rgb(0.6, 0.75, 0.65), borderWidth: 1 });

    const titleText = "CERTIFICATE";
    const titleSize = 36;
    const titleWidth = fontBold.widthOfTextAtSize(titleText, titleSize);
    page.drawText(titleText, { x: (config.width - titleWidth) / 2, y: config.height - 120, size: titleSize, font: fontBold, color: rgb(0.1, 0.15, 0.25) });

    const subtitleText = "OF COMPLETION";
    const subtitleSize = 14;
    const subtitleWidth = font.widthOfTextAtSize(subtitleText, subtitleSize);
    page.drawText(subtitleText, { x: (config.width - subtitleWidth) / 2, y: config.height - 145, size: subtitleSize, font, color: rgb(0.4, 0.4, 0.4) });

    const certifyText = "This is to certify that";
    const certifyWidth = font.widthOfTextAtSize(certifyText, 12);
    page.drawText(certifyText, { x: (config.width - certifyWidth) / 2, y: config.height - 200, size: 12, font, color: rgb(0.4, 0.4, 0.4) });
  }

  // Logo — use saved position and size
  if (assets?.logoUrl) {
    const logoBytes = await fetchImageBytes(assets.logoUrl);
    if (logoBytes) {
      try {
        const logoImage = await embedImage(pdfDoc, logoBytes, assets.logoUrl);
        const logoH = assets.logoHeight && assets.logoHeight > 0 ? assets.logoHeight : 50;
        const logoW = assets.logoWidth && assets.logoWidth > 0 ? assets.logoWidth : (logoImage.width / logoImage.height) * logoH;
        const lx = (assets.logoX ?? 50) / 100 * config.width - logoW / 2;
        const ly = config.height - (assets.logoY ?? 5) / 100 * config.height - logoH / 2;
        page.drawImage(logoImage, { x: lx, y: ly, width: logoW, height: logoH });
      } catch { /* skip */ }
    }
  }

  // Dynamic fields — unified loop, no special-casing
  for (const field of config.fields) {
    const value = resolveFieldValue(field, data);
    if (!value.trim()) continue;

    const fieldSize = field.fontSize || 12;
    const fieldColor = hexToRgb(field.fontColor || "#333333");
    const fieldFont = field.fontWeight === "bold" ? fontBold : font;
    const measure = (s: string) => fieldFont.widthOfTextAtSize(s, fieldSize);
    const maxW = field.maxWidth;
    // Only wrap if the template explicitly sets a max_width — matches preview's nowrap default
    const lines = maxW ? wrapText(value, measure, maxW) : [value];

    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const lineWidth = measure(line);

      const xPos = computePdfTextX(config.width, field.xPosition, lineWidth, field.textAlign);
      const yPos = computePdfBaselineY(config.height, field.yPosition, fieldSize, lines.length, li);

      page.drawText(line, {
        x: Math.max(20, xPos),
        y: yPos,
        size: fieldSize,
        font: fieldFont,
        color: fieldColor,
      });
    }
  }

  // Signature — use saved position and size
  if (assets?.signatureUrl) {
    const sigBytes = await fetchImageBytes(assets.signatureUrl);
    if (sigBytes) {
      try {
        const sigImage = await embedImage(pdfDoc, sigBytes, assets.signatureUrl);
        const sigH = assets.signatureHeight && assets.signatureHeight > 0 ? assets.signatureHeight : 40;
        const sigW = assets.signatureWidth && assets.signatureWidth > 0 ? assets.signatureWidth : (sigImage.width / sigImage.height) * sigH;
        const sx = (assets.signatureX ?? 25) / 100 * config.width - sigW / 2;
        const sy = config.height - (assets.signatureY ?? 85) / 100 * config.height - sigH / 2;
        page.drawImage(sigImage, { x: sx, y: sy, width: sigW, height: sigH });
      } catch { /* skip */ }
    }
  }

  // Seal — use saved position and size
  if (assets?.sealUrl) {
    const sealBytes = await fetchImageBytes(assets.sealUrl);
    if (sealBytes) {
      try {
        const sealImage = await embedImage(pdfDoc, sealBytes, assets.sealUrl);
        const sealH = assets.sealHeight && assets.sealHeight > 0 ? assets.sealHeight : 60;
        const sealW = assets.sealWidth && assets.sealWidth > 0 ? assets.sealWidth : (sealImage.width / sealImage.height) * sealH;
        const sx = (assets.sealX ?? 80) / 100 * config.width - sealW / 2;
        const sy = config.height - (assets.sealY ?? 82) / 100 * config.height - sealH / 2;
        page.drawImage(sealImage, { x: sx, y: sy, width: sealW, height: sealH });
      } catch { /* skip */ }
    }
  }

  const toggles = config.displayToggles;
  const showCertId = toggles?.showCertificateId !== false;
  const showQr = toggles?.showQrCode !== false;
  const showOrg = toggles?.showOrgName !== false;

  // Certificate ID
  if (showCertId) {
    const idText = `Certificate ID: ${sanitizeText(data.serialNumber)}`;
    const idSize = 9;
    const idWidth = font.widthOfTextAtSize(idText, idSize);
    const cidX = computePdfTextX(config.width, toggles?.certIdX ?? 50, idWidth, "center");
    const cidY = computePdfBaselineY(config.height, toggles?.certIdY ?? 90, idSize, 1, 0);
    page.drawText(idText, { x: Math.max(10, cidX), y: cidY, size: idSize, font, color: rgb(0.5, 0.5, 0.5) });
  }

  // QR Code
  if (showQr) {
    const verifyUrl = `${verifyBaseUrl}/verify/${data.verificationToken}`;
    const qrDataUrl = await generateQRCodeDataUrl(verifyUrl);
    const qrImageBytes = Uint8Array.from(atob(qrDataUrl.split(",")[1]), (c) => c.charCodeAt(0));
    const qrImage = await pdfDoc.embedPng(qrImageBytes);
    const qrSize = 80;
    const qrXPct = (toggles?.qrCodeX ?? 90) / 100;
    const qrYPct = (toggles?.qrCodeY ?? 90) / 100;
    const qrX = qrXPct * config.width - qrSize / 2;
    const qrY = config.height - qrYPct * config.height - qrSize / 2;
    page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });

    const scanText = "Scan to verify";
    const scanWidth = font.widthOfTextAtSize(scanText, 7);
    page.drawText(scanText, { x: qrX + (qrSize - scanWidth) / 2, y: qrY - 8, size: 7, font, color: rgb(0.5, 0.5, 0.5) });
  }

  // Organization name
  if (showOrg && config.organizationName) {
    const orgNameWidth = fontBold.widthOfTextAtSize(config.organizationName, 10);
    const orgX = computePdfTextX(config.width, toggles?.orgNameX ?? 10, orgNameWidth, "center");
    const orgY = computePdfBaselineY(config.height, toggles?.orgNameY ?? 90, 10, 1, 0);
    page.drawText(config.organizationName, { x: Math.max(10, orgX), y: orgY, size: 10, font: fontBold, color: rgb(0.1, 0.15, 0.25) });
    if (!assets?.signatureUrl && !assets?.backgroundUrl) {
      page.drawLine({ start: { x: orgX, y: orgY + 15 }, end: { x: orgX + fontBold.widthOfTextAtSize(config.organizationName, 10), y: orgY + 15 }, thickness: 0.5, color: rgb(0.3, 0.3, 0.3) });
      page.drawText("Authorized Signatory", { x: orgX, y: orgY + 22, size: 7, font, color: rgb(0.5, 0.5, 0.5) });
    }
  }

  return pdfDoc.save();
};
