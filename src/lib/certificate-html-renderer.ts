/**
 * Shared HTML renderer for certificates.
 * Both the React preview component and the PDF generator use this
 * to produce identical layouts. The PDF generator captures the
 * resulting DOM with html2canvas to guarantee pixel-perfect parity.
 */
import QRCode from "qrcode";
import { resolveFieldValue, LINE_HEIGHT_RATIO, sanitizeText, getTextAnchorTransform, getTextAnchorTop } from "./certificate-layout";

export interface RenderField {
  id?: string;
  field_key: string;
  label: string;
  x_position: number;
  y_position: number;
  font_size: number;
  font_color: string;
  font_weight: string;
  text_align: string;
  vertical_align?: string | null;
  max_width: number | null;
}

export interface RenderTemplate {
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

export interface RenderOptions {
  template: RenderTemplate;
  fields: RenderField[];
  recipientName: string;
  recipientData: Record<string, string>;
  orgName: string;
  /** Real cert id to display (preview can pass placeholder) */
  certificateId?: string;
  /** Real QR code data URL — when omitted, a dashed placeholder box is shown */
  qrDataUrl?: string;
  canvasWidth: number;
  canvasHeight: number;
}

const setStyles = (el: HTMLElement, styles: Partial<CSSStyleDeclaration>) => {
  Object.assign(el.style, styles);
};

const absDiv = (styles: Partial<CSSStyleDeclaration>) => {
  const d = document.createElement("div");
  setStyles(d, { position: "absolute", ...styles });
  return d;
};

/**
 * Build the certificate DOM into the given container.
 * Container is sized to canvasWidth x canvasHeight at 1:1 (no scale).
 * Caller is responsible for any wrapper scaling/positioning.
 */
export const renderCertificateInto = (container: HTMLElement, opts: RenderOptions) => {
  const { template: t, fields, recipientName, recipientData, orgName, certificateId, qrDataUrl, canvasWidth, canvasHeight } = opts;

  // Reset container
  container.innerHTML = "";
  setStyles(container, {
    position: "relative",
    width: `${canvasWidth}px`,
    height: `${canvasHeight}px`,
    backgroundColor: "#ffffff",
    backgroundImage: t.background_url ? `url("${t.background_url}")` : "none",
    backgroundSize: "cover",
    backgroundPosition: "center",
    overflow: "hidden",
    fontFamily: "Arial, Helvetica, sans-serif",
  });

  const data = { recipientName, recipientData };

  // Dynamic text fields
  for (const f of fields) {
    const value = resolveFieldValue({ fieldKey: f.field_key, label: f.label }, data);
    if (!value) continue;
    const isTemplateText = f.label?.includes("{{");
    const textAlign = (f.text_align as any) || "left";
    const verticalAlign = f.vertical_align || "middle";
    const el = absDiv({
      left: `${Number(f.x_position)}%`,
      top: getTextAnchorTop(Number(f.y_position), Number(f.font_size), verticalAlign),
      transform: getTextAnchorTransform(textAlign, verticalAlign),
      fontSize: `${f.font_size}px`,
      lineHeight: String(LINE_HEIGHT_RATIO),
      fontWeight: f.font_weight || "normal",
      color: f.font_color || "#000",
      textAlign,
      maxWidth: f.max_width ? `${f.max_width}px` : "",
      whiteSpace: isTemplateText ? "normal" : "nowrap",
      wordBreak: isTemplateText ? "break-word" : "normal",
    });
    el.textContent = value;
    container.appendChild(el);
  }

  // QR code
  if (t.show_qr_code !== false) {
    const wrap = absDiv({
      left: `${Number(t.qr_code_x ?? 90)}%`,
      top: `${Number(t.qr_code_y ?? 90)}%`,
      transform: "translate(-50%, -50%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    });
    if (qrDataUrl) {
      const img = document.createElement("img");
      img.src = qrDataUrl;
      setStyles(img, { width: "80px", height: "80px", display: "block" });
      wrap.appendChild(img);
      const cap = document.createElement("div");
      cap.textContent = "Scan to verify";
      setStyles(cap, { fontSize: "7px", color: "#808080", marginTop: "2px" });
      wrap.appendChild(cap);
    } else {
      const box = document.createElement("div");
      setStyles(box, {
        width: "56px", height: "56px",
        border: "2px dashed rgba(100,100,100,0.6)",
        backgroundColor: "rgba(255,255,255,0.5)",
        borderRadius: "4px",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "9px", color: "#808080", fontWeight: "500",
      });
      box.textContent = "QR";
      wrap.appendChild(box);
    }
    container.appendChild(wrap);
  }

  // Certificate ID
  if (t.show_certificate_id !== false) {
    const idEl = absDiv({
      left: `${Number(t.cert_id_x ?? 50)}%`,
      top: `${Number(t.cert_id_y ?? 90)}%`,
      transform: "translate(-50%, -50%)",
      lineHeight: String(LINE_HEIGHT_RATIO),
      fontSize: "9px",
      color: "#808080",
      whiteSpace: "nowrap",
    });
    idEl.textContent = `Certificate ID: ${sanitizeText(certificateId || "CERT-XXXXXX")}`;
    container.appendChild(idEl);
  }

  // Organization name
  if (t.show_org_name !== false) {
    const orgEl = absDiv({
      left: `${Number(t.org_name_x ?? 10)}%`,
      top: `${Number(t.org_name_y ?? 90)}%`,
      transform: "translate(-50%, -50%)",
      lineHeight: String(LINE_HEIGHT_RATIO),
      fontSize: "10px",
      fontWeight: "bold",
      color: "rgba(20,30,50,0.7)",
      whiteSpace: "nowrap",
    });
    orgEl.textContent = sanitizeText(orgName || "Org Name");
    container.appendChild(orgEl);
  }

  // Logo
  if (t.logo_url) {
    const img = document.createElement("img");
    img.src = t.logo_url;
    img.crossOrigin = "anonymous";
    setStyles(img, {
      position: "absolute",
      left: `${Number(t.logo_x ?? 50)}%`,
      top: `${Number(t.logo_y ?? 5)}%`,
      transform: "translate(-50%, -50%)",
      height: t.logo_height > 0 ? `${t.logo_height}px` : "50px",
      width: t.logo_width > 0 ? `${t.logo_width}px` : "auto",
      objectFit: "contain",
    });
    container.appendChild(img);
  }

  // Signature
  if (t.signature_url) {
    const img = document.createElement("img");
    img.src = t.signature_url;
    img.crossOrigin = "anonymous";
    setStyles(img, {
      position: "absolute",
      left: `${Number(t.signature_x ?? 25)}%`,
      top: `${Number(t.signature_y ?? 85)}%`,
      transform: "translate(-50%, -50%)",
      height: t.signature_height > 0 ? `${t.signature_height}px` : "40px",
      width: t.signature_width > 0 ? `${t.signature_width}px` : "auto",
      objectFit: "contain",
    });
    container.appendChild(img);
  }

  // Seal
  if (t.seal_url) {
    const img = document.createElement("img");
    img.src = t.seal_url;
    img.crossOrigin = "anonymous";
    setStyles(img, {
      position: "absolute",
      left: `${Number(t.seal_x ?? 80)}%`,
      top: `${Number(t.seal_y ?? 82)}%`,
      transform: "translate(-50%, -50%)",
      height: t.seal_height > 0 ? `${t.seal_height}px` : "60px",
      width: t.seal_width > 0 ? `${t.seal_width}px` : "auto",
      objectFit: "contain",
    });
    container.appendChild(img);
  }
};

/** Wait for all <img> children inside container to load (or error). */
export const waitForImages = (container: HTMLElement): Promise<void> => {
  const imgs = Array.from(container.querySelectorAll("img"));
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) return resolve();
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        })
    )
  ).then(() => undefined);
};

/** Helper: build a QR code data URL for embedding. */
export const buildQrDataUrl = (url: string) =>
  QRCode.toDataURL(url, {
    width: 200,
    margin: 1,
    color: { dark: "#1a2540", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });
