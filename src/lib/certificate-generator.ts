import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";

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
    textAlign: "left" | "center" | "right";
    maxWidth?: number;
  }[];
  assets?: TemplateAssets;
  displayToggles?: DisplayToggles;
}

/** Word-wrap text to fit within maxWidth pixels */
const wrapText = (text: string, fontObj: any, fontSize: number, maxWidth: number): string[] => {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = fontObj.widthOfTextAtSize(testLine, fontSize);
    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [""];
};

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
        page.drawImage(bgImage, { x: 0, y: 0, width: config.width, height: config.height });
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

  // Recipient name
  const nameField = config.fields.find(f => f.fieldKey === "recipient_name");
  if (nameField) {
    const nameSize = nameField.fontSize || 28;
    const nameWidth = fontBold.widthOfTextAtSize(data.recipientName, nameSize);
    const xPct = nameField.xPosition / 100;
    const yPct = nameField.yPosition / 100;
    let xPos: number;
    if (nameField.textAlign === "center") {
      xPos = xPct * config.width - nameWidth / 2;
    } else if (nameField.textAlign === "right") {
      xPos = xPct * config.width - nameWidth;
    } else {
      xPos = xPct * config.width;
    }
    // Offset by half font size to match CSS translate(-50%, -50%) centering
    const yPos = config.height - yPct * config.height + nameSize / 2;
    page.drawText(data.recipientName, {
      x: Math.max(20, xPos),
      y: yPos,
      size: nameSize,
      font: fontBold,
      color: hexToRgb(nameField.fontColor || "#1a1a2e"),
    });
  } else if (!assets?.backgroundUrl) {
    const nameSize = 28;
    const nameWidth = fontBold.widthOfTextAtSize(data.recipientName, nameSize);
    page.drawText(data.recipientName, { x: (config.width - nameWidth) / 2, y: config.height - 245, size: nameSize, font: fontBold, color: rgb(0.1, 0.15, 0.25) });
    const lineWidth = Math.min(nameWidth + 60, config.width - 200);
    page.drawLine({ start: { x: (config.width - lineWidth) / 2, y: config.height - 260 }, end: { x: (config.width + lineWidth) / 2, y: config.height - 260 }, thickness: 1, color: rgb(0.6, 0.75, 0.65) });
  }

  // Dynamic fields
  for (const field of config.fields) {
    if (field.fieldKey === "recipient_name") continue;

    // Check if label contains {{placeholders}} — treat as template text
    const isTemplateText = field.label.includes("{{");
    let value: string;
    if (isTemplateText) {
      value = field.label.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
        // Try exact key first, then case-insensitive
        const k = key.trim();
        return data.recipientData[k] || 
               Object.entries(data.recipientData).find(([rk]) => rk.toLowerCase() === k.toLowerCase())?.[1] || 
               "";
      });
    } else {
      // Try exact key first, then case-insensitive
      value = data.recipientData[field.fieldKey] || 
              Object.entries(data.recipientData).find(([rk]) => rk.toLowerCase() === field.fieldKey.toLowerCase())?.[1] || 
              "";
    }
    if (!value.trim()) continue;

    const fieldSize = field.fontSize || 12;
    const fieldColor = hexToRgb(field.fontColor || "#333333");
    const xPct = field.xPosition / 100;
    const yPct = field.yPosition / 100;
    const maxW = field.maxWidth ?? config.width - 80;

    // Word-wrap: split value into lines that fit within maxWidth
    const lines = wrapText(value, font, fieldSize, maxW);
    const lineHeight = fieldSize * 1.4;

    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const lineWidth = font.widthOfTextAtSize(line, fieldSize);
      let xPos: number;
      if (field.textAlign === "center") {
        xPos = xPct * config.width - lineWidth / 2;
      } else if (field.textAlign === "right") {
        xPos = xPct * config.width - lineWidth;
      } else {
        xPos = xPct * config.width;
      }
      const yPos = config.height - yPct * config.height + fieldSize / 2 - li * lineHeight;
      page.drawText(line, {
        x: Math.max(20, xPos),
        y: yPos,
        size: fieldSize,
        font,
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
    const idText = `Certificate ID: ${data.serialNumber}`;
    const idSize = 9;
    const idWidth = font.widthOfTextAtSize(idText, idSize);
    const cidXPct = toggles?.certIdX ?? 50;
    const cidYPct = toggles?.certIdY ?? 90;
    const cidX = (cidXPct / 100) * config.width - idWidth / 2;
    const cidY = config.height - (cidYPct / 100) * config.height + idSize / 2;
    page.drawText(idText, { x: Math.max(10, cidX), y: cidY, size: idSize, font, color: rgb(0.5, 0.5, 0.5) });
  }

  // QR Code
  if (showQr) {
    const verifyUrl = `${verifyBaseUrl}/verify/${data.verificationToken}`;
    const qrDataUrl = await generateQRCodeDataUrl(verifyUrl);
    const qrImageBytes = Uint8Array.from(atob(qrDataUrl.split(",")[1]), (c) => c.charCodeAt(0));
    const qrImage = await pdfDoc.embedPng(qrImageBytes);
    const qrSize = 80;
    const qrXPct = toggles?.qrCodeX ?? 90;
    const qrYPct = toggles?.qrCodeY ?? 90;
    const qrX = (qrXPct / 100) * config.width - qrSize / 2;
    const qrY = config.height - (qrYPct / 100) * config.height - qrSize / 2;
    page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });

    const scanText = "Scan to verify";
    const scanWidth = font.widthOfTextAtSize(scanText, 7);
    page.drawText(scanText, { x: qrX + (qrSize - scanWidth) / 2, y: qrY - 8, size: 7, font, color: rgb(0.5, 0.5, 0.5) });
  }

  // Organization name
  if (showOrg && config.organizationName) {
    const orgXPct = toggles?.orgNameX ?? 10;
    const orgYPct = toggles?.orgNameY ?? 90;
    const orgNameWidth = fontBold.widthOfTextAtSize(config.organizationName, 10);
    const orgX = (orgXPct / 100) * config.width - orgNameWidth / 2;
    const orgY = config.height - (orgYPct / 100) * config.height + 5;
    page.drawText(config.organizationName, { x: Math.max(10, orgX), y: orgY, size: 10, font: fontBold, color: rgb(0.1, 0.15, 0.25) });
    // Only draw "Authorized Signatory" line on default (no background) templates
    if (!assets?.signatureUrl && !assets?.backgroundUrl) {
      page.drawLine({ start: { x: orgX, y: orgY + 15 }, end: { x: orgX + fontBold.widthOfTextAtSize(config.organizationName, 10), y: orgY + 15 }, thickness: 0.5, color: rgb(0.3, 0.3, 0.3) });
      page.drawText("Authorized Signatory", { x: orgX, y: orgY + 22, size: 7, font, color: rgb(0.5, 0.5, 0.5) });
    }
  }

  return pdfDoc.save();
};
