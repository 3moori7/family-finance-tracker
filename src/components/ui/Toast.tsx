"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type ToastKind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
  action?: { label: string; run: () => void };
}
interface ToastApi {
  show: (message: string, opts?: { kind?: ToastKind; action?: ToastItem["action"]; ms?: number }) => void;
}

const Ctx = createContext<ToastApi>({ show: () => {} });
export const useToast = () => useContext(Ctx);

const tone: Record<ToastKind, string> = {
  success: "bg-ink text-white",
  error: "bg-danger text-white",
  info: "bg-ink text-white",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);

  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const show = useCallback<ToastApi["show"]>(
    (message, opts) => {
      const id = next.current++;
      setItems((l) => [...l.slice(-2), { id, message, kind: opts?.kind ?? "success", action: opts?.action }]);
      setTimeout(() => dismiss(id), opts?.ms ?? 5000);
    },
    [dismiss],
  );
  const api = useMemo(() => ({ show }), [show]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="no-print pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full max-w-sm items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm shadow-lg ${tone[t.kind]}`}
          >
            <span>{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="min-h-8 rounded-md px-2 font-semibold underline"
                onClick={() => {
                  t.action?.run();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
