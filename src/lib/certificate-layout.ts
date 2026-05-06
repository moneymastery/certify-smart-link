/**
 * Shared certificate layout engine.
 * Both the HTML preview and the PDF generator use these constants and
 * functions so that coordinates, wrapping, and alignment are identical.
 */

// ── Shared constants ──────────────────────────────────────────────
/** Line-height multiplier applied to fontSize. Both preview CSS and PDF must use this. */
export const LINE_HEIGHT_RATIO = 1.3;

/**
 * Approximate ascent ratio for Helvetica / Arial (used to convert
 * CSS-centred position → PDF baseline position).
 * Helvetica ascent = 718/1000 ≈ 0.718, descent = 207/1000 ≈ 0.207.
 */
const ASCENT_RATIO = 0.75; // slightly rounded for cross-browser safety

export type HorizontalTextAlign = "left" | "center" | "right";
export type VerticalTextAlign = "top" | "middle" | "bottom" | "baseline";

export const normalizeVerticalAlign = (verticalAlign: string | null | undefined): VerticalTextAlign => {
  return verticalAlign === "top" || verticalAlign === "bottom" || verticalAlign === "baseline"
    ? verticalAlign
    : "middle";
};

export const getBaselineOffset = (fontSize: number): number => {
  const lineHeight = fontSize * LINE_HEIGHT_RATIO;
  return (lineHeight - fontSize) / 2 + fontSize * ASCENT_RATIO;
};

export const getTextAnchorTransform = (
  textAlign: string | null | undefined,
  verticalAlign: string | null | undefined = "middle",
): string => {
  const y =
    normalizeVerticalAlign(verticalAlign) === "middle"
      ? "-50%"
      : normalizeVerticalAlign(verticalAlign) === "bottom"
        ? "-100%"
        : "0";
  switch (textAlign) {
    case "right":
      return `translate(-100%, ${y})`;
    case "center":
      return `translate(-50%, ${y})`;
    default:
      return `translate(0, ${y})`;
  }
};

export const getTextAnchorTop = (
  yPct: number,
  fontSize: number,
  verticalAlign: string | null | undefined = "middle",
): string => {
  if (normalizeVerticalAlign(verticalAlign) === "baseline") {
    return `calc(${yPct}% - ${getBaselineOffset(fontSize)}px)`;
  }
  return `${yPct}%`;
};

// ── Text sanitisation ────────────────────────────────────────────
/**
 * Strip control characters (newlines, tabs, etc.) that WinAnsi / pdf-lib
 * cannot encode.  Collapses runs of whitespace into a single space.
 */
export const sanitizeText = (text: unknown): string => {
  if (text === null || text === undefined) return "";
  const str = typeof text === "string" ? text : String(text);
  // Step 1: Hard-strip all control characters BEFORE NFKC normalization.
  // Some encodings can survive or be reintroduced by normalize(), so we do
  // this raw pass first.
  const stripped = str.replace(/[\x00-\x1F\x7F-\x9F\u2028\u2029]+/g, " ");
  return (
    stripped
      .normalize("NFKC")
      // Step 2: Strip again after normalization (NFKC can re-emit control chars
      // for certain exotic code points). This is the safety net that fixes the
      // WinAnsi 0x000a error in production.
      .replace(/[\x00-\x1F\x7F-\x9F\u2028\u2029]+/g, " ")
      .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
      .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
      .replace(/[\u2010-\u2015]/g, "-")
      .replace(/[\u2026]/g, "...")
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, "")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
};

// ── Field value resolution ────────────────────────────────────────
export interface FieldDescriptor {
  fieldKey: string;
  label: string;
}

export interface RecipientDescriptor {
  recipientName: string;
  recipientData: Record<string, string>;
}

/**
 * Single source of truth for resolving a field's display value.
 * Used identically in the preview component and the PDF generator.
 */
export const resolveFieldValue = (field: FieldDescriptor, data: RecipientDescriptor): string => {
  if (field.fieldKey === "recipient_name") {
    const raw =
      data.recipientName && data.recipientName !== "Unknown"
        ? data.recipientName
        : data.recipientData["recipient_name"] ||
          data.recipientData["name"] ||
          data.recipientData["NAME"] ||
          Object.entries(data.recipientData).find(
            ([k]) => k.toLowerCase().includes("name") && !k.toLowerCase().includes("org"),
          )?.[1] ||
          "Unknown";
    return sanitizeText(raw);
  }

  const isTemplateText = field.label.includes("{{");
  if (isTemplateText) {
    const result = field.label.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
      const k = key.trim();
      return (
        data.recipientData[k] ||
        Object.entries(data.recipientData).find(([rk]) => rk.toLowerCase() === k.toLowerCase())?.[1] ||
        ""
      );
    });
    return sanitizeText(result);
  }

  const raw =
    data.recipientData[field.fieldKey] ||
    Object.entries(data.recipientData).find(([rk]) => rk.toLowerCase() === field.fieldKey.toLowerCase())?.[1] ||
    "";
  return sanitizeText(raw);
};

// ── Background "cover" scaling ────────────────────────────────────
export interface CoverDimensions {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Compute draw dimensions that replicate CSS `background-size: cover`.
 * The image is scaled so that the shortest axis fills the canvas and
 * the overflow is cropped equally on both sides.
 */
export const computeCoverDimensions = (
  imgWidth: number,
  imgHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): CoverDimensions => {
  const imgRatio = imgWidth / imgHeight;
  const canvasRatio = canvasWidth / canvasHeight;

  let drawWidth: number;
  let drawHeight: number;

  if (imgRatio > canvasRatio) {
    // Image is wider than canvas → match heights, crop sides
    drawHeight = canvasHeight;
    drawWidth = drawHeight * imgRatio;
  } else {
    // Image is taller → match widths, crop top/bottom
    drawWidth = canvasWidth;
    drawHeight = drawWidth / imgRatio;
  }

  return {
    x: (canvasWidth - drawWidth) / 2,
    y: (canvasHeight - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
  };
};

// ── Text baseline computation (PDF) ──────────────────────────────
/**
 * Convert a CSS-style centre-anchor (top: Y%, left: X% with
 * transform translate(-50%,-50%)) into a pdf-lib baseline position.
 *
 * PDF y-axis runs bottom→up while CSS runs top→down.
 *
 * @param canvasH   Total canvas height (px / PDF units)
 * @param yPct      Y percentage (0–100) from CSS top
 * @param fontSize  Font size (px / PDF units)
 * @param totalLines Number of wrapped lines
 * @param lineIndex  Current line index (0-based)
 * @returns y coordinate for pdf-lib drawText (baseline)
 */
export const computePdfBaselineY = (
  canvasH: number,
  yPct: number,
  fontSize: number,
  totalLines: number,
  lineIndex: number,
): number => {
  const lineHeight = fontSize * LINE_HEIGHT_RATIO;
  const totalH = totalLines * lineHeight;
  const anchorY = canvasH - (yPct / 100) * canvasH;

  // Derivation:
  //   CSS centre of text block = yPct% from top
  //   CSS baseline of line i  = centre - totalH/2 + i*lineHeight + (lineHeight-fontSize)/2 + ascent
  //   PDF baseline             = canvasH - CSS_baseline
  //     = anchorY + totalH/2 - i*lineHeight - (lineHeight-fontSize)/2 - fontSize*ASCENT_RATIO
  return anchorY + totalH / 2 - lineIndex * lineHeight - (lineHeight - fontSize) / 2 - fontSize * ASCENT_RATIO;
};

// ── Text X position (PDF) ────────────────────────────────────────
/**
 * Compute x position for a line of text matching CSS text-align +
 * translate(-50%) centring on the anchor point.
 */
export const computePdfTextX = (
  canvasW: number,
  xPct: number,
  lineWidth: number,
  textAlign: "left" | "center" | "right",
): number => {
  const anchor = (xPct / 100) * canvasW;
  switch (textAlign) {
    case "center":
      return anchor - lineWidth / 2;
    case "right":
      return anchor - lineWidth;
    default:
      return anchor;
  }
};

// ── Word-wrap (shared) ───────────────────────────────────────────
/**
 * Word-wrap text to fit within maxWidth.
 * `measure` is a function that returns the pixel width of a string
 * (injected so both the PDF font and browser canvas can be used).
 */
export const wrapText = (text: string, measure: (s: string) => number, maxWidth: number): string[] => {
  const words = sanitizeText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (measure(testLine) > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [""];
};
