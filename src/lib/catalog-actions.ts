"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { CATALOGS, CATALOG_ROUTES, type CatalogKey } from "@/lib/catalogs";
import type { DeleteCheckResult } from "@/components/ConfirmDeleteButton";
import { requireUser, requireAdmin } from "@/lib/authz";

export async function listCatalog(key: CatalogKey) {
  await requireUser();
  const { model, codeField } = CATALOGS[key];
  // Las 6 tablas catálogo comparten la misma forma (código + nombre), pero
  // cada delegate de Prisma tiene un tipo de entrada distinto; el `any` queda
  // acotado a este único helper genérico en vez de repetirse en cada tabla.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (model as any).findMany({ orderBy: { [codeField]: "asc" } });
}

export async function createCatalogItem(formData: FormData) {
  await requireAdmin();
  const slug = String(formData.get("tabla") ?? "");
  const route = CATALOG_ROUTES[slug];
  if (!route) throw new Error("Tabla inválida");

  const { model, nameField } = CATALOGS[route.key];
  const value = String(formData.get("nombre") ?? "").trim();
  if (!value) throw new Error("El nombre es obligatorio");
  if (value.length > 60) throw new Error("El nombre no puede superar 60 caracteres");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (model as any).create({ data: { [nameField]: value } });

  revalidatePath(`/configuracion/${slug}`);
}

export async function updateCatalogItem(key: CatalogKey, id: number, nombre: string) {
  await requireAdmin();
  const { model, nameField, codeField } = CATALOGS[key];
  const value = nombre.trim();
  if (!value) throw new Error("El nombre es obligatorio");
  if (value.length > 60) throw new Error("El nombre no puede superar 60 caracteres");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (model as any).update({ where: { [codeField]: id }, data: { [nameField]: value } });

  for (const slug of Object.keys(CATALOG_ROUTES)) {
    if (CATALOG_ROUTES[slug].key === key) revalidatePath(`/configuracion/${slug}`);
  }
  revalidatePath("/configuracion/plan-de-cuentas");
}

export async function checkDeleteCatalogItem(
  key: CatalogKey,
  id: number
): Promise<DeleteCheckResult> {
  await requireUser();
  const { planDeCuentasField } = CATALOGS[key];
  const cantidad = await prisma.planDeCuentas.count({ where: { [planDeCuentasField]: id } });
  if (cantidad === 0) return { blocked: false };
  return {
    blocked: true,
    reason: `No se puede eliminar: ${cantidad} cuenta(s) del Plan de Cuentas todavía lo usan. Reclasificalas primero en Configuración → Plan de Cuentas.`,
  };
}

export async function deleteCatalogItem(key: CatalogKey, id: number) {
  await requireAdmin();
  const { model, codeField } = CATALOGS[key];
  const check = await checkDeleteCatalogItem(key, id);
  if (check.blocked) throw new Error(check.reason);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (model as any).delete({ where: { [codeField]: id } });

  for (const slug of Object.keys(CATALOG_ROUTES)) {
    if (CATALOG_ROUTES[slug].key === key) revalidatePath(`/configuracion/${slug}`);
  }
}
