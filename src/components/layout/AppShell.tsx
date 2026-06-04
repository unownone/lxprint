import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 sm:px-6">
        <header className="border-b border-zinc-800 py-4">
          <h1 className="text-center text-xl font-semibold tracking-tight sm:text-left">
            Thermal Printer
          </h1>
        </header>
        <main className="flex flex-1 flex-col gap-5 py-5 pb-6">{children}</main>
        <footer
          id="footer"
          className="border-t border-zinc-800 py-3 text-center text-xs text-zinc-500"
        >
          <p>
            Version {__APP_VERSION__}+{__COMMIT_HASH__}
          </p>
        </footer>
      </div>
    </div>
  );
}
