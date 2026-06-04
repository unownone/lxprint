export function PrintBar({
  canPrint,
  isPrinting,
  onPrint,
  onCancelPrint,
  hint,
}: {
  canPrint: boolean;
  isPrinting?: boolean;
  onPrint: () => void;
  onCancelPrint?: () => void;
  hint?: string;
}) {
  return (
    <div className="sticky bottom-0 z-40 -mx-4 border-t border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur-sm sm:-mx-0 sm:rounded-xl sm:border sm:pb-3">
      <div className="flex flex-col gap-2">
        {hint && !canPrint && !isPrinting && (
          <p className="text-center text-xs text-zinc-500">{hint}</p>
        )}
        {isPrinting && (
          <p className="text-center text-xs text-amber-400/90">
            Printing… tap Cancel to stop sending data
          </p>
        )}
        <div className="flex gap-2">
          {isPrinting && onCancelPrint && (
            <button
              type="button"
              onClick={onCancelPrint}
              className="min-h-12 flex-1 rounded-xl border border-zinc-600 bg-zinc-900 text-base font-semibold text-zinc-200 transition-colors hover:bg-zinc-800"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={onPrint}
            disabled={!canPrint || isPrinting}
            className="min-h-12 flex-1 rounded-xl bg-indigo-600 text-base font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPrinting ? "Printing…" : "Print"}
          </button>
        </div>
      </div>
    </div>
  );
}
