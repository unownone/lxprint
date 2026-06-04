export type StudioMode = "text" | "draw" | "upload" | "bill";

const MODES: { id: StudioMode; label: string }[] = [
  { id: "text", label: "Text" },
  { id: "draw", label: "Draw" },
  { id: "upload", label: "Upload" },
  { id: "bill", label: "Bill" },
];

export function ModeTabs({
  mode,
  onModeChange,
}: {
  mode: StudioMode;
  onModeChange: (mode: StudioMode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Label mode"
      className="flex gap-1 overflow-x-auto rounded-xl bg-zinc-900 p-1"
    >
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          role="tab"
          aria-selected={mode === m.id}
          onClick={() => onModeChange(m.id)}
          className={`min-h-11 min-w-[4.5rem] flex-1 shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            mode === m.id
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
