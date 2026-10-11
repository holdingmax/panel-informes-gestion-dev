import { listUsers } from "@/lib/auth-actions";
import { listUnidadesNegocio } from "@/lib/unidad-negocio-actions";
import { listPermisosDeUsuario } from "@/lib/permiso-unidad-actions";
import { createUserAction } from "./actions";
import { ToggleActiveButton } from "./ToggleActiveButton";
import { UserRowActions } from "./UserRowActions";
import { EditDeleteUser } from "./EditDeleteUser";
import { PermisosUnidadPanel } from "./PermisosUnidadPanel";
import { CollapsibleAdd } from "@/components/CollapsibleAdd";

export default async function AdminUsersPage() {
  const [users, unidades] = await Promise.all([listUsers(), listUnidadesNegocio()]);
  const permisosPorUsuario = Object.fromEntries(
    await Promise.all(
      users.map(async (u) => [u.id, await listPermisosDeUsuario(u.id)] as const)
    )
  );

  return (
    <main className="flex w-full max-w-4xl flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">Usuarios</h1>

      <table className="w-full text-left text-lg">
        <thead>
          <tr>
            <th className="py-1">Usuario</th>
            <th className="py-1">Rol</th>
            <th className="py-1">Estado</th>
            <th className="py-1" />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t">
              <td className="py-2">{u.username}</td>
              <td className="py-2">{u.role}</td>
              <td className="py-2">{u.active ? "Activo" : "Inactivo"}</td>
              <td className="py-2">
                <div className="flex flex-col items-start gap-2">
                  <ToggleActiveButton id={u.id} active={u.active} />
                  <EditDeleteUser id={u.id} username={u.username} role={u.role} />
                  <UserRowActions id={u.id} />
                  {u.role === "USER" ? (
                    <>
                      {permisosPorUsuario[u.id].length === 0 && (
                        <p className="text-sm text-amber-700">
                          Sin permisos: todavía no ve ninguna unidad de negocio.
                        </p>
                      )}
                      <PermisosUnidadPanel
                        userId={u.id}
                        unidades={unidades}
                        permisos={permisosPorUsuario[u.id]}
                      />
                    </>
                  ) : (
                    <p className="text-sm text-zinc-500">Admin: acceso total a todas las unidades.</p>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <CollapsibleAdd label="Crear usuario">
        <form action={createUserAction} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-lg">Usuario</span>
            <input
              name="username"
              required
              className="rounded border px-3 py-2 text-lg"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-lg">Contraseña inicial</span>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              className="rounded border px-3 py-2 text-lg"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-lg">Rol</span>
            <select name="role" className="rounded border px-3 py-2 text-lg">
              <option value="USER">Usuario</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-lg">Pregunta de seguridad</span>
            <input
              name="securityQuestion"
              required
              className="rounded border px-3 py-2 text-lg"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-lg">Respuesta de seguridad</span>
            <input
              name="securityAnswer"
              required
              className="rounded border px-3 py-2 text-lg"
            />
          </label>
          <button
            type="submit"
            className="w-fit rounded-md bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Crear usuario
          </button>
        </form>
      </CollapsibleAdd>
    </main>
  );
}
