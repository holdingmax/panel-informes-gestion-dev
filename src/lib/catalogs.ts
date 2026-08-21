import { prisma } from "@/lib/prisma";

export const CATALOGS = {
  partidaPatrimonial: {
    codeField: "codPartida",
    nameField: "nomPartida",
    model: prisma.partidaPatrimonial,
  },
  rubro: { codeField: "codRubro", nameField: "nomRubro", model: prisma.rubro },
  subrubro: {
    codeField: "codSubrubro",
    nameField: "nomSubrubro",
    model: prisma.subrubro,
  },
  subrubro2: {
    codeField: "codSubrubro2",
    nameField: "nomSubrubro2",
    model: prisma.subrubro2,
  },
  subrubro3: {
    codeField: "codSubrubro3",
    nameField: "nomSubrubro3",
    model: prisma.subrubro3,
  },
  categoriaOyA: { codeField: "codOyA", nameField: "nomOyA", model: prisma.categoriaOyA },
} as const;

export type CatalogKey = keyof typeof CATALOGS;

export const CATALOG_ROUTES: Record<
  string,
  { key: CatalogKey; title: string; fieldLabel: string }
> = {
  "partida-patrimonial": {
    key: "partidaPatrimonial",
    title: "Partida Patrimonial",
    fieldLabel: "Nombre de partida",
  },
  rubro: { key: "rubro", title: "Rubro", fieldLabel: "Nombre de rubro" },
  subrubro: { key: "subrubro", title: "Subrubro", fieldLabel: "Nombre de subrubro" },
  "subrubro-2": {
    key: "subrubro2",
    title: "Subrubro 2",
    fieldLabel: "Nombre de subrubro 2",
  },
  "subrubro-3": {
    key: "subrubro3",
    title: "Subrubro 3",
    fieldLabel: "Nombre de subrubro 3",
  },
  "categoria-oya": {
    key: "categoriaOyA",
    title: "Categoría OyA",
    fieldLabel: "Nombre de categoría OyA",
  },
};
