import type { ReactNode } from "react";

export function PreviewFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-center">
      <div className="w-full max-w-[384px] rounded-lg border border-zinc-700 bg-zinc-800 p-3 shadow-lg">
        {children}
      </div>
    </div>
  );
}
