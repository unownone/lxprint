import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ChangeEventHandler,
} from "react";

import { PreviewFrame } from "../layout/PreviewFrame.tsx";
import { RASTER_WIDTH } from "../../lib/raster.ts";

type AlignmentType = "left" | "center" | "right";

function LabelSvg({
  text,
  onChange,
  align,
  font,
}: {
  text: string;
  onChange: (svg: string, width: number, height: number) => void;
  align: AlignmentType;
  font: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    const textElement = ref.current.getElementById(
      "labelText",
    ) as SVGTextElement | null;
    if (!textElement) return;
    const bbox = textElement.getBoundingClientRect();
    const w = bbox.width;
    const h = Math.max(bbox.height, textElement.clientHeight);
    setWidth(w);
    setHeight(h);
    onChange(ref.current.outerHTML, w, h);
  }, [text, align, font, onChange]);

  const [xPos, textAnchor] = ((): [number, "start" | "middle" | "end"] => {
    switch (align) {
      case "left":
        return [0, "start"];
      case "center":
        return [width / 2, "middle"];
      case "right":
        return [width, "end"];
      default:
        return [0, "start"];
    }
  })();

  return (
    <div className="pointer-events-none absolute opacity-0" aria-hidden>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        ref={ref}
      >
        <text
          x={xPos}
          y="0"
          id="labelText"
          style={{ textAnchor, fontFamily: font }}
        >
          {text.split("\n").map((line, i) => (
            <tspan key={i} x={xPos} dy="1em">
              {line}
            </tspan>
          ))}
        </text>
      </svg>
    </div>
  );
}

function TextAlignButton({
  val,
  text,
  align,
  onChangeHandler,
}: {
  val: AlignmentType;
  text: string;
  align: AlignmentType;
  onChangeHandler: ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <label
      htmlFor={`align-${val}`}
      className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 ${
        align === val
          ? "border-indigo-500 bg-indigo-950/50"
          : "border-zinc-700"
      }`}
    >
      <input
        type="radio"
        name="align"
        value={val}
        id={`align-${val}`}
        checked={align === val}
        onChange={onChangeHandler}
        className="accent-indigo-500"
      />
      <span className="text-sm">{text}</span>
    </label>
  );
}

export function TextMode({
  onBitmapChange,
}: {
  onBitmapChange: (data: ImageData) => void;
}) {
  const [text, setText] = useState("Hello");
  const [align, setAlign] = useState<AlignmentType>("left");
  const [font, setFont] = useState("sans-serif");
  const [length, setLength] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [svgData, setSvgData] = useState("");
  const [contentW, setContentW] = useState(RASTER_WIDTH);
  const [contentH, setContentH] = useState(0);

  const onSvgChange = useCallback(
    (s: string, w: number, h: number) => {
      setSvgData(s);
      setContentW(w || RASTER_WIDTH);
      setContentH(h);
    },
    [],
  );

  const canvasHeight =
    length || (contentH > 0 ? Math.round(RASTER_WIDTH * (contentH / contentW)) : RASTER_WIDTH);

  useEffect(() => {
    if (!svgData || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;

    const image = new Image();
    image.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);

      const w = contentW || RASTER_WIDTH;
      const h = contentH || 1;
      const svgAspect = w / h;
      const canvasAspect = canvas.width / canvas.height;

      if (!length) {
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
      } else if (svgAspect > canvasAspect) {
        const virtualHeight = (canvas.width / w) * h;
        const offset = (canvas.height - virtualHeight) / 2;
        context.drawImage(image, 0, offset, canvas.width, virtualHeight);
      } else {
        const virtualWidth = (canvas.height / h) * w;
        const offset =
          align === "left"
            ? 0
            : (canvas.width - virtualWidth) / (align === "right" ? 1 : 2);
        context.drawImage(image, offset, 0, virtualWidth, canvas.height);
      }
      onBitmapChange(
        context.getImageData(0, 0, canvas.width, canvas.height),
      );
    };

    image.src = `data:image/svg+xml;base64,${btoa(
      unescape(encodeURIComponent(svgData)),
    )}`;
  }, [svgData, length, align, contentW, contentH, onBitmapChange]);

  const onOptionChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    const v = e.target.value;
    if (v === "left" || v === "center" || v === "right") setAlign(v);
  };

  return (
    <div className="flex flex-col gap-4">
      <LabelSvg text={text} onChange={onSvgChange} align={align} font={font} />
      <PreviewFrame>
        <canvas
          ref={canvasRef}
          width={RASTER_WIDTH}
          height={canvasHeight}
          className="mx-auto block w-full bg-white"
        />
      </PreviewFrame>

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          <TextAlignButton
            val="left"
            text="Left"
            align={align}
            onChangeHandler={onOptionChange}
          />
          <TextAlignButton
            val="center"
            text="Center"
            align={align}
            onChangeHandler={onOptionChange}
          />
          <TextAlignButton
            val="right"
            text="Right"
            align={align}
            onChangeHandler={onOptionChange}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            Font
            <select
              value={font}
              onChange={(e) => setFont(e.target.value)}
              className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100"
            >
              <option value="serif">serif</option>
              <option value="sans-serif">sans-serif</option>
              <option value="cursive">cursive</option>
              <option value="monospace">monospace</option>
              <option value="fantasy">fantasy</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            Length
            <select
              value={length ?? "auto"}
              onChange={(e) =>
                setLength(parseInt(e.target.value, 10) || null)
              }
              className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100"
            >
              <option value="auto">Auto</option>
              <option value="230">28mm</option>
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Label text
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          />
        </label>
      </div>
    </div>
  );
}
