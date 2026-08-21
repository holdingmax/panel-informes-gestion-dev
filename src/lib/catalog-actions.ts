"use server";

import { revalidatePath } from "next/cache";
import { CATALOGS, CATALOG_ROUTES, type CatalogKey } from "@/lib/catalogs";

export async function listCatalog(key: CatalogKey) {
  const { model, nameField } = CATALOGS[key];
  // Las 6 tablas catálogo comparten la misma forma (código + nombre), pero
  // cada delegate de Prisma tiene un tipo de entrada distinto; el `any` queda
  // acotado a este único helper genérico en vez de repetirse en cada tabla.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (model as any).findMany({ orderBy: { [nameField]: "asc" } });
}

export async function createCatalogItem(formData: FormData) {
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
