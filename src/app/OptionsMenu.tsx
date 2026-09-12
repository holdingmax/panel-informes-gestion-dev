"use client";

import { useState } from "react";
import { openInWindow } from "@/lib/openWindow";

const OPTIONS = [{ label: "Configuración", url: "/configuracion", name: "configuracion" }];

export function OptionsMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        Menu ▾
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-1 w-48 rounded-md border border-slate-200 bg-white shadow-sm">
          {OPTIONS.map((option) => (
            <button
              key={option.url}
              onClick={() => {
                openInWindow(option.url, option.name);
                setOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
