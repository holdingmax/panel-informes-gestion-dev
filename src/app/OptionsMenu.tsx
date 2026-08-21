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
        className="rounded border px-3 py-2 text-sm"
      >
        Menu ▾
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-1 w-48 rounded border bg-white shadow-md">
          {OPTIONS.map((option) => (
            <button
              key={option.url}
              onClick={() => {
                openInWindow(option.url, option.name);
                setOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-50"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
