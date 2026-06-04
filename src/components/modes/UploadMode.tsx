import { useCallback, useRef, useState } from "react";

import { PreviewFrame } from "../layout/PreviewFrame.tsx";
import {
  fitImageToRaster,
  RASTER_WIDTH,
  prepareImageDataForPrint,
} from "../../lib/raster.ts";

type PdfJs = typeof import("pdfjs-dist");

let pdfJsPromise: Promise<PdfJs> | null = null;

async function loadPdfJs(): Promise<PdfJs> {
  if (!pdfJsPromise) {
    pdfJsPromise = import("pdfjs-dist").then(async (pdfjs) => {
      const workerSrc = (
        await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
      ).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
      return pdfjs;
    });
  }
  return pdfJsPromise;
}

async function renderPdfPage(
  data: ArrayBuffer,
): Promise<{ image: HTMLCanvasElement; width: number; height: number }> {
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const scale = RASTER_WIDTH / viewport.width;
  const scaled = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(scaled.width);
  canvas.height = Math.floor(scaled.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2d context");
  await page.render({ canvasContext: ctx, viewport: scaled, canvas }).promise;

  return { image: canvas, width: canvas.width, height: canvas.height };
}

function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

export function UploadMode({
  onBitmapChange,
}: {
  onBitmapChange: (data: ImageData) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pageHint, setPageHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const previewRef = useRef<HTMLCanvasElement>(null);

  const showPreview = useCallback((imageData: ImageData) => {
    const preview = previewRef.current;
    if (!preview) return;
    preview.width = imageData.width;
    preview.height = imageData.height;
    preview.style.width = "100%";
    preview.style.height = "auto";
    const ctx = preview.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, preview.width, preview.height);
      ctx.putImageData(imageData, 0, 0);
    }
    onBitmapChange(imageData);
  }, [onBitmapChange]);

  const processFile = async (file: File) => {
    setError(null);
    setLoading(true);
    setFileName(file.name);
    setPageHint(null);

    try {
      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        const buf = await file.arrayBuffer();
        const { image, width, height } = await renderPdfPage(buf);
        setPageHint("Page 1");
        const fitted = fitImageToRaster(image, {
          sourceWidth: width,
          sourceHeight: height,
          targetWidth: RASTER_WIDTH,
          targetHeight: null,
          align: "center",
        });
        showPreview(prepareImageDataForPrint(fitted));
      } else if (file.type.startsWith("image/")) {
        const img = await loadImageFile(file);
        const fitted = fitImageToRaster(img, {
          sourceWidth: img.naturalWidth,
          sourceHeight: img.naturalHeight,
          targetWidth: RASTER_WIDTH,
          targetHeight: null,
          align: "center",
        });
        showPreview(prepareImageDataForPrint(fitted));
      } else {
        setError("Unsupported file type. Use an image or PDF.");
        setFileName(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to process file");
      setFileName(null);
    } finally {
      setLoading(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processFile(file);
    e.target.value = "";
  };

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={onFileChange}
      />

      <button
        type="button"
        disabled={loading}
        onClick={() => inputRef.current?.click()}
        className="min-h-12 rounded-xl border border-dashed border-zinc-600 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-200 hover:border-indigo-500 hover:bg-zinc-800 disabled:opacity-50"
      >
        {loading ? "Processing…" : "Choose image or PDF"}
      </button>

      {fileName && (
        <p className="text-center text-xs text-zinc-400">
          {fileName}
          {pageHint ? ` · ${pageHint}` : ""}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-center text-sm text-red-300"
        >
          {error}
        </p>
      )}

      <PreviewFrame>
        <canvas
          ref={previewRef}
          width={RASTER_WIDTH}
          height={RASTER_WIDTH}
          className="mx-auto block min-h-[120px] w-full bg-white"
        />
        {!fileName && !loading && (
          <p className="mt-2 text-center text-xs text-zinc-500">
            Preview appears after upload
          </p>
        )}
      </PreviewFrame>
    </div>
  );
}
