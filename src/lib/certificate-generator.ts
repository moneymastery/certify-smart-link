import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";

export interface CertificateData {
  recipientName: string;
  recipientEmail?: string;
  recipientData: Record<string, string>;
  serialNumber: string;
  verificationToken: string;
}

export interface GenerationConfig {
  templateName: string;
  organizationName: string;
  width: number;
  height: number;
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

export const generateCertificatePDF = async (
  data: CertificateData,
  config: GenerationConfig,
  verifyBaseUrl: string
): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([config.width, config.height]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Background
  page.drawRectangle({
    x: 0,
    y: 0,
    width: config.width,
    height: config.height,
    color: rgb(1, 1, 1),
  });

  // Decorative border
  const borderColor = rgb(0.1, 0.15, 0.25);
  const borderWidth = 3;
  page.drawRectangle({
    x: 20,
    y: 20,
    width: config.width - 40,
    height: config.height - 40,
    borderColor,
    borderWidth,
  });
  page.drawRectangle({
    x: 30,
    y: 30,
    width: config.width - 60,
    height: config.height - 60,
    borderColor: rgb(0.6, 0.75, 0.65),
    borderWidth: 1,
  });

  // Title: "CERTIFICATE OF COMPLETION"
  const titleText = "CERTIFICATE";
  const titleSize = 36;
  const titleWidth = fontBold.widthOfTextAtSize(titleText, titleSize);
  page.drawText(titleText, {
    x: (config.width - titleWidth) / 2,
    y: config.height - 120,
    size: titleSize,
    font: fontBold,
    color: rgb(0.1, 0.15, 0.25),
  });

  const subtitleText = "OF COMPLETION";
  const subtitleSize = 14;
  const subtitleWidth = font.widthOfTextAtSize(subtitleText, subtitleSize);
  page.drawText(subtitleText, {
    x: (config.width - subtitleWidth) / 2,
    y: config.height - 145,
    size: subtitleSize,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  // "This is to certify that"
  const certifyText = "This is to certify that";
  const certifyWidth = font.widthOfTextAtSize(certifyText, 12);
  page.drawText(certifyText, {
    x: (config.width - certifyWidth) / 2,
    y: config.height - 200,
    size: 12,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  // Recipient name
  const nameSize = 28;
  const nameWidth = fontBold.widthOfTextAtSize(data.recipientName, nameSize);
  page.drawText(data.recipientName, {
    x: (config.width - nameWidth) / 2,
    y: config.height - 245,
    size: nameSize,
    font: fontBold,
    color: rgb(0.1, 0.15, 0.25),
  });

  // Decorative line under name
  const lineWidth = Math.min(nameWidth + 60, config.width - 200);
  page.drawLine({
    start: { x: (config.width - lineWidth) / 2, y: config.height - 260 },
    end: { x: (config.width + lineWidth) / 2, y: config.height - 260 },
    thickness: 1,
    color: rgb(0.6, 0.75, 0.65),
  });

  // Dynamic fields from config
  let fieldY = config.height - 300;
  for (const field of config.fields) {
    const value = data.recipientData[field.fieldKey] || "";
    if (!value || field.fieldKey === "recipient_name") continue;

    const labelText = `${field.label}: ${value}`;
    const labelWidth = font.widthOfTextAtSize(labelText, field.fontSize || 12);
    const fieldSize = field.fontSize || 12;

    let xPos: number;
    if (field.textAlign === "center") {
      xPos = (config.width - labelWidth) / 2;
    } else if (field.textAlign === "right") {
      xPos = config.width - labelWidth - 60;
    } else {
      xPos = 60;
    }

    page.drawText(labelText, {
      x: xPos,
      y: fieldY,
      size: fieldSize,
      font,
      color: hexToRgb(field.fontColor || "#333333"),
    });
    fieldY -= fieldSize + 12;
  }

  // Certificate ID
  const idText = `Certificate ID: ${data.serialNumber}`;
  const idWidth = font.widthOfTextAtSize(idText, 9);
  page.drawText(idText, {
    x: (config.width - idWidth) / 2,
    y: 80,
    size: 9,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  // QR Code
  const verifyUrl = `${verifyBaseUrl}/verify/${data.verificationToken}`;
  const qrDataUrl = await generateQRCodeDataUrl(verifyUrl);
  const qrImageBytes = Uint8Array.from(atob(qrDataUrl.split(",")[1]), (c) => c.charCodeAt(0));
  const qrImage = await pdfDoc.embedPng(qrImageBytes);

  const qrSize = 80;
  page.drawImage(qrImage, {
    x: config.width - qrSize - 45,
    y: 35,
    width: qrSize,
    height: qrSize,
  });

  const scanText = "Scan to verify";
  const scanWidth = font.widthOfTextAtSize(scanText, 7);
  page.drawText(scanText, {
    x: config.width - qrSize - 45 + (qrSize - scanWidth) / 2,
    y: 27,
    size: 7,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  // Organization name bottom left
  if (config.organizationName) {
    page.drawText(config.organizationName, {
      x: 45,
      y: 50,
      size: 10,
      font: fontBold,
      color: rgb(0.1, 0.15, 0.25),
    });
    page.drawLine({
      start: { x: 45, y: 65 },
      end: { x: 45 + fontBold.widthOfTextAtSize(config.organizationName, 10), y: 65 },
      thickness: 0.5,
      color: rgb(0.3, 0.3, 0.3),
    });
    page.drawText("Authorized Signatory", {
      x: 45,
      y: 72,
      size: 7,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  return pdfDoc.save();
};
