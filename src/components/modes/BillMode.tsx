import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { PreviewFrame } from "../layout/PreviewFrame.tsx";
import {
  billTotal,
  defaultBillDraft,
  formatMoney,
  newBillItem,
  renderBillToImageData,
  type BillCurrency,
  type BillDraft,
  type BillItem,
} from "../../lib/bill.ts";

function hasPrintableItems(items: BillItem[]): boolean {
  return items.some((item) => item.name.trim().length > 0);
}

function ToggleSection({
  id,
  label,
  checked,
  onChange,
  children,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900/50">
      <label
        htmlFor={id}
        className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-3"
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="size-4 accent-indigo-500"
        />
        <span className="text-sm font-medium text-zinc-200">{label}</span>
      </label>
      {checked && children && (
        <div className="space-y-3 border-t border-zinc-800 px-3 pb-3 pt-2">
          {children}
        </div>
      )}
    </div>
  );
}

export function BillMode({
  onBitmapChange,
  onValidityChange,
}: {
  onBitmapChange: (data: ImageData) => void;
  onValidityChange?: (valid: boolean) => void;
}) {
  const [draft, setDraft] = useState<BillDraft>(defaultBillDraft);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const valid = hasPrintableItems(draft.items);

  const patch = (partial: Partial<BillDraft>) => {
    setDraft((d) => ({ ...d, ...partial }));
  };

  useEffect(() => {
    onValidityChange?.(valid);
  }, [valid, onValidityChange]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!valid) return;
      const imageData = renderBillToImageData(draft);
      const preview = previewRef.current;
      if (preview) {
        preview.width = imageData.width;
        preview.height = imageData.height;
        const ctx = preview.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, preview.width, preview.height);
          ctx.putImageData(imageData, 0, 0);
        }
      }
      onBitmapChange(imageData);
    }, 150);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [draft, valid, onBitmapChange]);

  const updateItem = (id: string, partial: Partial<BillItem>) => {
    setDraft((d) => ({
      ...d,
      items: d.items.map((item) =>
        item.id === id ? { ...item, ...partial } : item,
      ),
    }));
  };

  const removeItem = (id: string) => {
    setDraft((d) => ({
      ...d,
      items: d.items.filter((item) => item.id !== id),
    }));
  };

  const addItem = () => {
    setDraft((d) => ({ ...d, items: [...d.items, newBillItem()] }));
  };

  const total = billTotal(draft.items);

  return (
    <div className="flex flex-col gap-4">
      <PreviewFrame>
        <canvas
          ref={previewRef}
          className="mx-auto block w-full bg-white"
          style={{ maxWidth: 384 }}
        />
        {!valid && (
          <p className="mt-2 text-center text-xs text-zinc-500">
            Add at least one item with a name to preview
          </p>
        )}
      </PreviewFrame>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Date
          <input
            type="date"
            value={draft.date}
            onChange={(e) => patch({ date: e.target.value })}
            className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Currency
          <select
            value={draft.currency}
            onChange={(e) =>
              patch({ currency: e.target.value as BillCurrency })
            }
            className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100"
          >
            <option value="USD">USD ($)</option>
            <option value="INR">INR (₹)</option>
          </select>
        </label>
      </div>

      <ToggleSection
        id="bill-header"
        label="Header"
        checked={draft.headerEnabled}
        onChange={(headerEnabled) => patch({ headerEnabled })}
      >
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Title
          <input
            type="text"
            value={draft.headerTitle}
            onChange={(e) => patch({ headerTitle: e.target.value })}
            placeholder="Business name or invoice title"
            className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Description / address
          <textarea
            value={draft.headerDescription}
            onChange={(e) => patch({ headerDescription: e.target.value })}
            placeholder="Address, phone, tagline…"
            rows={3}
            className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
        </label>
        <p className="text-xs text-zinc-500">Title and description print centered.</p>
      </ToggleSection>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Line items
        </p>
        {draft.items.map((item, index) => (
          <div
            key={item.id}
            className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-3 sm:grid sm:grid-cols-[2rem_1fr_6rem_auto] sm:items-end sm:gap-2"
          >
            <span className="mb-2 block text-xs text-zinc-500 sm:mb-0 sm:text-center sm:text-sm">
              #{index + 1}
            </span>
            <label className="mb-2 flex flex-col gap-1 text-xs text-zinc-400 sm:mb-0">
              Item name
              <input
                type="text"
                value={item.name}
                onChange={(e) =>
                  updateItem(item.id, { name: e.target.value })
                }
                placeholder="Name"
                className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
              />
            </label>
            <label className="mb-2 flex flex-col gap-1 text-xs text-zinc-400 sm:mb-0">
              Price
              <input
                type="number"
                min={0}
                step={0.01}
                value={item.price || ""}
                onChange={(e) =>
                  updateItem(item.id, {
                    price: parseFloat(e.target.value) || 0,
                  })
                }
                className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
              />
            </label>
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              disabled={draft.items.length <= 1}
              className="min-h-11 rounded-lg border border-zinc-700 px-3 text-sm text-zinc-400 hover:bg-zinc-800 disabled:opacity-30"
              aria-label={`Remove item ${index + 1}`}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addItem}
        className="min-h-11 rounded-lg border border-dashed border-zinc-600 text-sm text-zinc-300 hover:border-indigo-500 hover:bg-zinc-900"
      >
        + Add item
      </button>

      <div className="flex justify-end border-t border-zinc-800 pt-3 text-base font-semibold">
        Total: {formatMoney(total, draft.currency)}
      </div>

      <ToggleSection
        id="bill-footer"
        label="Footer"
        checked={draft.footerEnabled}
        onChange={(footerEnabled) => patch({ footerEnabled })}
      >
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Footer text
          <textarea
            value={draft.footerText}
            onChange={(e) => patch({ footerText: e.target.value })}
            placeholder="Thank you, payment terms, notes…"
            rows={3}
            className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
        </label>
        <p className="text-xs text-zinc-500">Footer prints centered below the total.</p>
      </ToggleSection>

      <ToggleSection
        id="bill-signature"
        label="Signature space"
        checked={draft.signatureEnabled}
        onChange={(signatureEnabled) => patch({ signatureEnabled })}
      >
        <p className="text-xs text-zinc-500">
          Adds a dashed box at the bottom for signing the receipt or cheque.
        </p>
      </ToggleSection>
    </div>
  );
}
