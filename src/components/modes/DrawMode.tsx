import { useCallback, useEffect, useRef, useState } from "react";

import { PreviewFrame } from "../layout/PreviewFrame.tsx";
import {
  RASTER_WIDTH,
  imageDataFromCanvas,
  prepareImageDataForPrint,
} from "../../lib/raster.ts";

const CANVAS_SIZE = RASTER_WIDTH;
const PEN_SIZES = [2, 4, 8] as const;

export function DrawMode({
  onBitmapChange,
}: {
  onBitmapChange: (data: ImageData) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [penSize, setPenSize] = useState<(typeof PEN_SIZES)[number]>(4);

  const emitBitmap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const raw = imageDataFromCanvas(canvas);
    onBitmapChange(prepareImageDataForPrint(raw));
  }, [onBitmapChange]);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    emitBitmap();
  }, [emitBitmap]);

  useEffect(() => {
    setupCanvas();
  }, [setupCanvas]);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const strokeTo = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const last = lastPointRef.current;
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = penSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    if (last) {
      ctx.moveTo(last.x, last.y);
    } else {
      ctx.moveTo(x, y);
    }
    ctx.lineTo(x, y);
    ctx.stroke();
    lastPointRef.current = { x, y };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastPointRef.current = null;
    const pt = getPoint(e);
    if (pt) strokeTo(pt.x, pt.y);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const pt = getPoint(e);
    if (pt) strokeTo(pt.x, pt.y);
  };

  const endStroke = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    emitBitmap();
  };

  const clear = () => {
    setupCanvas();
  };

  return (
    <div className="flex flex-col gap-4">
      <PreviewFrame>
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="mx-auto block touch-none bg-white"
          style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerLeave={endStroke}
          onPointerCancel={endStroke}
        />
      </PreviewFrame>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-400">Pen</span>
        {PEN_SIZES.map((size) => (
          <button
            key={size}
            type="button"
            onClick={() => setPenSize(size)}
            className={`min-h-11 min-w-11 rounded-lg border px-3 text-sm font-medium ${
              penSize === size
                ? "border-indigo-500 bg-indigo-950/50 text-white"
                : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            {size}px
          </button>
        ))}
        <button
          type="button"
          onClick={clear}
          className="min-h-11 rounded-lg border border-zinc-700 px-4 text-sm text-zinc-300 hover:bg-zinc-800"
        >
          Clear
        </button>
      </div>
      <p className="text-center text-xs text-zinc-500">
        Draw with finger or mouse on the canvas
      </p>
    </div>
  );
}
