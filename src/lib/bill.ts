import { RASTER_WIDTH, imageDataFromCanvas } from "./raster.ts";

export type BillCurrency = "USD" | "INR";

export type BillItem = {
  id: string;
  name: string;
  price: number;
};

export type BillDraft = {
  date: string;
  currency: BillCurrency;
  items: BillItem[];
  headerEnabled: boolean;
  headerTitle: string;
  headerDescription: string;
  footerEnabled: boolean;
  footerText: string;
  signatureEnabled: boolean;
};

const PADDING = 16;
const TITLE_SIZE = 18;
const BODY_SIZE = 12;
const LINE_HEIGHT = 14;
const ROW_HEIGHT = 22;
const SIGNATURE_HEIGHT = 52;
const SECTION_GAP = 10;

export function billTotal(items: BillItem[]): number {
  return items.reduce((sum, item) => sum + (item.price || 0), 0);
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatMoney(amount: number, currency: BillCurrency): string {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function newBillItem(): BillItem {
  return { id: crypto.randomUUID(), name: "", price: 0 };
}

export function defaultBillDraft(): BillDraft {
  return {
    date: todayIsoDate(),
    currency: "USD",
    items: [newBillItem()],
    headerEnabled: false,
    headerTitle: "",
    headerDescription: "",
    footerEnabled: false,
    footerText: "",
    signatureEnabled: false,
  };
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const paragraphs = text.split("\n");
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.trim() ? paragraph.split(/\s+/) : [""];
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (ctx.measureText(next).width <= maxWidth) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current || paragraph === "") lines.push(current);
  }
  return lines.length > 0 ? lines : [];
}

function measureWrappedHeight(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  font: string,
  lineHeight: number,
): number {
  if (!text.trim()) return 0;
  ctx.font = font;
  const lines = wrapText(ctx, text, maxWidth);
  return lines.length * lineHeight;
}

function drawCenteredBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  maxWidth: number,
  font: string,
  lineHeight: number,
): number {
  if (!text.trim()) return y;
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.fillStyle = "#000000";
  const lines = wrapText(ctx, text, maxWidth);
  for (const line of lines) {
    y += lineHeight;
    ctx.fillText(line, centerX, y);
  }
  return y;
}

function drawDashedLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  ctx.save();
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

export function billCanvasHeight(
  draft: BillDraft,
  width = RASTER_WIDTH,
): number {
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) {
    const rows = Math.max(draft.items.length, 1);
    return PADDING * 2 + 120 + rows * ROW_HEIGHT + 80;
  }

  const contentWidth = width - PADDING * 2;
  let h = PADDING;

  if (draft.headerEnabled) {
    if (draft.headerTitle.trim()) h += TITLE_SIZE + 6;
    h += measureWrappedHeight(
      measure,
      draft.headerDescription,
      contentWidth,
      `${BODY_SIZE}px system-ui, sans-serif`,
      LINE_HEIGHT,
    );
    h += SECTION_GAP;
  }

  h += BODY_SIZE + 14 + SECTION_GAP + ROW_HEIGHT + 8;
  h += Math.max(draft.items.length, 1) * ROW_HEIGHT;
  h += 14 + BODY_SIZE + 10;

  if (draft.footerEnabled) {
    h += SECTION_GAP;
    h += measureWrappedHeight(
      measure,
      draft.footerText,
      contentWidth,
      `${BODY_SIZE}px system-ui, sans-serif`,
      LINE_HEIGHT,
    );
  }

  if (draft.signatureEnabled) {
    h += SECTION_GAP + SIGNATURE_HEIGHT;
  }

  return h + PADDING;
}

export function renderBillToCanvas(
  draft: BillDraft,
  width = RASTER_WIDTH,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = billCanvasHeight(draft, width);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2d context");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000000";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;

  const contentWidth = width - PADDING * 2;
  const centerX = width / 2;
  let y = PADDING;

  if (draft.headerEnabled) {
    if (draft.headerTitle.trim()) {
      ctx.font = `bold ${TITLE_SIZE}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(draft.headerTitle.trim(), centerX, y + TITLE_SIZE);
      y += TITLE_SIZE + 6;
    }
    y = drawCenteredBlock(
      ctx,
      draft.headerDescription,
      centerX,
      y,
      contentWidth,
      `${BODY_SIZE}px system-ui, sans-serif`,
      LINE_HEIGHT,
    );
    y += SECTION_GAP;
  }

  ctx.font = `${BODY_SIZE}px system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText(`Date: ${draft.date}`, PADDING, y + BODY_SIZE);
  y += BODY_SIZE + 14;

  drawDashedLine(ctx, PADDING, y, width - PADDING, y);
  y += 10;

  ctx.font = `bold ${BODY_SIZE}px system-ui, sans-serif`;
  ctx.fillText("#", PADDING, y + BODY_SIZE);
  ctx.fillText("Item", PADDING + 28, y + BODY_SIZE);
  ctx.textAlign = "right";
  ctx.fillText("Price", width - PADDING, y + BODY_SIZE);
  ctx.textAlign = "left";
  y += ROW_HEIGHT - 4;

  drawDashedLine(ctx, PADDING, y, width - PADDING, y);
  y += 8;

  ctx.font = `${BODY_SIZE}px system-ui, sans-serif`;
  const items = draft.items.length > 0 ? draft.items : [];

  if (items.length === 0) {
    ctx.fillStyle = "#666666";
    ctx.fillText("(no items)", PADDING + 28, y + BODY_SIZE);
    y += ROW_HEIGHT;
  } else {
    items.forEach((item, index) => {
      ctx.fillStyle = "#000000";
      ctx.textAlign = "left";
      ctx.fillText(String(index + 1), PADDING, y + BODY_SIZE);
      const name = item.name.trim() || "(unnamed)";
      const maxNameWidth = width - PADDING * 2 - 100;
      let displayName = name;
      while (
        displayName.length > 1 &&
        ctx.measureText(displayName).width > maxNameWidth
      ) {
        displayName = displayName.slice(0, -1);
      }
      if (displayName !== name) displayName += "…";
      ctx.fillText(displayName, PADDING + 28, y + BODY_SIZE);
      ctx.textAlign = "right";
      ctx.fillText(
        formatMoney(item.price, draft.currency),
        width - PADDING,
        y + BODY_SIZE,
      );
      ctx.textAlign = "left";
      y += ROW_HEIGHT;
    });
  }

  y += 4;
  drawDashedLine(ctx, PADDING, y, width - PADDING, y);
  y += 14;

  const total = billTotal(draft.items);
  ctx.font = `bold ${BODY_SIZE + 2}px system-ui, sans-serif`;
  ctx.textAlign = "right";
  ctx.fillText(
    `Total: ${formatMoney(total, draft.currency)}`,
    width - PADDING,
    y + BODY_SIZE,
  );
  y += BODY_SIZE + 10;

  if (draft.footerEnabled) {
    y += SECTION_GAP;
    drawDashedLine(ctx, PADDING, y, width - PADDING, y);
    y += 8;
    y = drawCenteredBlock(
      ctx,
      draft.footerText,
      centerX,
      y,
      contentWidth,
      `${BODY_SIZE}px system-ui, sans-serif`,
      LINE_HEIGHT,
    );
  }

  if (draft.signatureEnabled) {
    y += SECTION_GAP;
    const boxTop = y;
    const boxH = SIGNATURE_HEIGHT - 8;
    ctx.strokeStyle = "#000000";
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(PADDING, boxTop, contentWidth, boxH);
    ctx.setLineDash([]);
    ctx.font = `${BODY_SIZE}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = "#666666";
    ctx.fillText("Signature", centerX, boxTop + boxH / 2 + 4);
    y = boxTop + boxH;
  }

  return canvas;
}

export function renderBillToImageData(draft: BillDraft): ImageData {
  const canvas = renderBillToCanvas(draft);
  return imageDataFromCanvas(canvas);
}
