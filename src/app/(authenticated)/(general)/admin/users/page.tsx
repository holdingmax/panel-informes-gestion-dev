import { listUsers } from "@/lib/auth-actions";
import { createUserAction } from "./actions";
import { ToggleActiveButton } from "./ToggleActiveButton";

export default async function AdminUsersPage() {
  const users = await listUsers();

  return (
    <main className="flex w-full max-w-3xl flex-col gap-8 p-8">
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
                <ToggleActiveButton id={u.id} active={u.active} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-medium">Crear usuario</h2>
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
            className="rounded bg-black px-3 py-2 text-lg text-white"
          >
            Crear usuario
          </button>
        </form>
      </section>
    </main>
  );
}
