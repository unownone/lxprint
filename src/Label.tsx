import { use, useState, useCallback } from "react";

import { PrinterContext } from "./context.tsx";
import { prepareImageDataForPrint } from "./lib/raster.ts";
import { ModeTabs, type StudioMode } from "./components/layout/ModeTabs.tsx";
import { PrintBar } from "./components/layout/PrintBar.tsx";
import { TextMode } from "./components/modes/TextMode.tsx";
import { DrawMode } from "./components/modes/DrawMode.tsx";
import { UploadMode } from "./components/modes/UploadMode.tsx";
import { BillMode } from "./components/modes/BillMode.tsx";

export function LabelMaker() {
  const [mode, setMode] = useState<StudioMode>("text");
  const [bitmap, setBitmap] = useState<ImageData | undefined>();
  const [billValid, setBillValid] = useState(false);

  const { printer, printerStatus } = use(PrinterContext);

  const onBitmapChange = useCallback((data: ImageData) => {
    setBitmap(data);
  }, []);

  const onModeChange = (next: StudioMode) => {
    setMode(next);
    setBitmap(undefined);
    setBillValid(false);
  };

  const isPrinting = printerStatus.state === "printing";

  const canPrintBase =
    !!printer && printerStatus.state === "connected" && !!bitmap;
  const canPrint =
    canPrintBase && (mode !== "bill" || billValid) && !isPrinting;

  const printHint =
    isPrinting
      ? undefined
      : printerStatus.state !== "connected"
        ? "Connect a printer to print"
        : mode === "bill" && !billValid
          ? "Add at least one item with a name"
          : !bitmap
            ? "Create content in the active mode first"
            : undefined;

  const print = () => {
    if (!canPrint || !bitmap || !printer) return;
    void printer.print(prepareImageDataForPrint(bitmap));
  };

  const cancelPrint = () => {
    printer?.cancelPrint();
  };

  return (
    <section className="flex flex-col gap-5">
      <ModeTabs mode={mode} onModeChange={onModeChange} />

      <div className="flex flex-col gap-5">
        {mode === "text" && <TextMode onBitmapChange={onBitmapChange} />}
        {mode === "draw" && <DrawMode onBitmapChange={onBitmapChange} />}
        {mode === "upload" && <UploadMode onBitmapChange={onBitmapChange} />}
        {mode === "bill" && (
          <BillMode
            onBitmapChange={onBitmapChange}
            onValidityChange={setBillValid}
          />
        )}
      </div>

      <PrintBar
        canPrint={canPrint}
        isPrinting={isPrinting}
        onPrint={print}
        onCancelPrint={cancelPrint}
        hint={printHint}
      />
    </section>
  );
}

/** @deprecated Use LabelMaker — kept for compatibility */
export const LabelStudio = LabelMaker;
