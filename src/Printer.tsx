import { use, useState } from "react";
import "core-js/proposals/array-buffer-base64";

import { type PrinterStatus } from "./lib/printer.ts";
import { drivers } from "./lib/drivers.ts";
import { PrinterContext } from "./context.tsx";
import { type LXPrinterStatus } from "./lib/lxprinter.ts";
import { type YHKPrinterStatus } from "./lib/yhkprinter.ts";

function Battery({ level, charging }: { level?: number; charging?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <svg height={12} width={30} aria-hidden>
        <rect
          x={0}
          y={0}
          width={25}
          height={12}
          className="fill-none stroke-zinc-400"
          strokeWidth={2}
        />
        <rect x={26} y={3} width={2} height={6} className="fill-zinc-400" />
        <rect
          x={1}
          y={1}
          height={10}
          width={level ? (23 * level) / 100 : 0}
          className={level && level > 20 ? "fill-green-500" : "fill-red-500"}
        />
      </svg>
      <span className="text-xs text-zinc-400">
        {charging ? "⚡" : level != null ? `${level}%` : "—"}
      </span>
    </span>
  );
}

function ConnectedState({ state }: { state?: string }) {
  switch (state) {
    case "connected":
      return <span aria-label="Connected">✔️</span>;
    case "connecting":
      return <span aria-label="Connecting">🛜</span>;
    case "printing":
      return <span aria-label="Printing">🖨️</span>;
    default:
      return <span aria-label="Disconnected">🚫</span>;
  }
}

function DriverSelect({
  driver,
  setDriver,
}: {
  driver: string;
  setDriver: (x: string) => void;
}) {
  return (
    <select
      value={driver}
      onChange={(e) => setDriver(e.target.value)}
      className="min-h-10 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-sm text-zinc-100"
    >
      {drivers().map((x) => (
        <option value={x} key={x}>
          {x}
        </option>
      ))}
    </select>
  );
}

function ConnectControls({
  state,
  connect,
  disconnect,
}: {
  state?: string;
  connect: (driver: string) => void;
  disconnect: () => void;
}) {
  const [driver, setDriver] = useState(drivers()[0]);

  if (state && ["connected", "connecting", "printing"].includes(state))
    return (
      <button
        type="button"
        onClick={disconnect}
        disabled={state === "printing"}
        className="min-h-10 shrink-0 rounded-lg border border-zinc-600 px-3 text-sm hover:bg-zinc-800 disabled:opacity-40"
      >
        Disconnect
      </button>
    );

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
      <DriverSelect driver={driver} setDriver={setDriver} />
      <button
        type="button"
        onClick={() => connect(driver)}
        className="min-h-10 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-500"
      >
        Connect
      </button>
    </div>
  );
}

function LXPrinter({ status }: { status: LXPrinterStatus }) {
  return (
    <div className="flex flex-wrap gap-2 text-xs text-amber-400">
      <Battery level={status.battery} charging={status.charging} />
      {status.noPaper && <span>⚠️ No Paper</span>}
      {status.lowBatt && <span>⚠️ Low Battery</span>}
      {status.overheat && <span>⚠️ Overheat</span>}
    </div>
  );
}

function YHKPrinter({ status }: { status: YHKPrinterStatus }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
      <Battery level={status.battery} />
      <span>{status.voltage}mV</span>
    </div>
  );
}

function StatusExtras({
  driver,
  status,
}: {
  driver?: string;
  status: PrinterStatus;
}) {
  switch (driver) {
    case "lx":
      return <LXPrinter status={status as LXPrinterStatus} />;
    case "yhk":
      return <YHKPrinter status={status as YHKPrinterStatus} />;
    default:
      return null;
  }
}

function Printer() {
  const { printer, printerStatus, errors, connect } = use(PrinterContext);

  const disconnect = async () => {
    await printer?.disconnect();
  };

  return (
    <>
      {/* Mobile: collapsible */}
      <details className="rounded-xl border border-zinc-800 bg-zinc-900/80 sm:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <ConnectedState state={printerStatus.state} />
            <span className="truncate text-sm font-medium">
              {printer?.name || "No printer"}
            </span>
          </div>
          <span className="shrink-0 text-xs text-zinc-500">Details</span>
        </summary>
        <div className="space-y-3 border-t border-zinc-800 px-4 pb-4 pt-3">
          <ConnectControls
            state={printerStatus?.state}
            connect={connect}
            disconnect={disconnect}
          />
          <StatusExtras driver={printer?.driverName} status={printerStatus} />
          {errors.map((x, i) => (
            <p key={i} className="text-xs text-amber-400">
              ⚠️ {x}
            </p>
          ))}
        </div>
      </details>

      {/* Desktop: always-visible card */}
      <div className="hidden rounded-xl border border-zinc-800 bg-zinc-900/80 sm:block">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <ConnectedState state={printerStatus.state} />
            <span className="truncate text-sm font-medium">
              {printer?.name || "No printer"}
            </span>
          </div>
          <ConnectControls
            state={printerStatus?.state}
            connect={connect}
            disconnect={disconnect}
          />
        </div>
        <div className="space-y-2 border-t border-zinc-800 px-4 pb-3 pt-2">
          <StatusExtras driver={printer?.driverName} status={printerStatus} />
          {errors.map((x, i) => (
            <p key={i} className="text-xs text-amber-400">
              ⚠️ {x}
            </p>
          ))}
        </div>
      </div>
    </>
  );
}

export default Printer;
