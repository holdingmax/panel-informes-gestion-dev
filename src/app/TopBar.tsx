"use client";

import { OptionsMenu } from "./OptionsMenu";
import { logout } from "./logout-action";

export function TopBar() {
  return (
    <div className="flex items-center justify-end gap-4 border-b bg-white/95 px-4 py-2">
      <OptionsMenu />
      <form action={logout}>
        <button type="submit" className="text-sm underline">
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
