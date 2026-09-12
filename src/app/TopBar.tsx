"use client";

import { OptionsMenu } from "./OptionsMenu";
import { logout } from "./logout-action";

export function TopBar() {
  return (
    <div className="flex items-center justify-end gap-4 border-b bg-white/95 px-4 py-2">
      <OptionsMenu />
      <form action={logout}>
        <button
          type="submit"
          className="rounded-md px-2 py-1 text-sm text-slate-600 underline hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
