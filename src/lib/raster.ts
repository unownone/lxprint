export const RASTER_WIDTH = 384;

export type RasterAlign = "left" | "center" | "right";

export type FitImageOptions = {
  targetWidth?: number;
  targetHeight?: number | null;
  align?: RasterAlign;
  sourceWidth: number;
  sourceHeight: number;
};

export function imageDataFromCanvas(canvas: HTMLCanvasElement): ImageData {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2d context from canvas");
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function thresholdToMono(
  imageData: ImageData,
  threshold = 128,
): ImageData {
  const out = new ImageData(imageData.width, imageData.height);
  const src = imageData.data;
  const dst = out.data;
  for (let i = 0; i < src.length; i += 4) {
    const a = src[i + 3]!;
    const lum =
      a === 0
        ? 255
        : 0.299 * src[i]! + 0.587 * src[i + 1]! + 0.114 * src[i + 2]!;
    const on = lum < threshold;
    dst[i] = on ? 0 : 255;
    dst[i + 1] = on ? 0 : 255;
    dst[i + 2] = on ? 0 : 255;
    dst[i + 3] = on ? 255 : 0;
  }
  return out;
}

/** Scale to printer width and ensure pixels are print-ready. */
export function prepareImageDataForPrint(
  imageData: ImageData,
  targetWidth = RASTER_WIDTH,
): ImageData {
  let data = imageData;
  if (data.width !== targetWidth) {
    const canvas = document.createElement("canvas");
    const height = Math.max(
      1,
      Math.round((targetWidth / data.width) * data.height),
    );
    canvas.width = targetWidth;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2d context");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetWidth, height);
    ctx.drawImage(
      imageDataToCanvas(data),
      0,
      0,
      targetWidth,
      height,
    );
    data = imageDataFromCanvas(canvas);
  }
  return thresholdToMono(data);
}

function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2d context");
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function drawFittedImage(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  canvasW: number,
  canvasH: number,
  sourceW: number,
  sourceH: number,
  fixedHeight: number | null,
  align: RasterAlign,
) {
  ctx.clearRect(0, 0, canvasW, canvasH);

  if (!fixedHeight) {
    ctx.drawImage(source, 0, 0, canvasW, canvasH);
    return;
  }

  const svgAspect = sourceW / sourceH;
  const canvasAspect = canvasW / canvasH;

  if (svgAspect > canvasAspect) {
    const virtualHeight = (canvasW / sourceW) * sourceH;
    const offset = (canvasH - virtualHeight) / 2;
    ctx.drawImage(source, 0, offset, canvasW, virtualHeight);
  } else {
    const virtualWidth = (canvasH / sourceH) * sourceW;
    const offset =
      align === "left"
        ? 0
        : (canvasW - virtualWidth) / (align === "right" ? 1 : 2);
    ctx.drawImage(source, offset, 0, virtualWidth, canvasH);
  }
}

export function fitImageToRaster(
  source: CanvasImageSource,
  opts: FitImageOptions,
): ImageData {
  const targetWidth = opts.targetWidth ?? RASTER_WIDTH;
  const sourceW = opts.sourceWidth;
  const sourceH = opts.sourceHeight;
  const fixedHeight = opts.targetHeight ?? null;
  const align = opts.align ?? "left";

  const canvasH =
    fixedHeight ?? Math.max(1, Math.round((targetWidth / sourceW) * sourceH));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2d context");

  drawFittedImage(
    ctx,
    source,
    targetWidth,
    canvasH,
    sourceW,
    sourceH,
    fixedHeight,
    align,
  );

  return imageDataFromCanvas(canvas);
}

export function createRasterCanvas(
  height: number,
  width = RASTER_WIDTH,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }
  return canvas;
}
