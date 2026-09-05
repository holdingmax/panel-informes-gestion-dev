"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseBsysRawFile } from "@/lib/bsys-raw-parser";

export async function importBsys(formData: FormData) {
  const empresaId = Number(formData.get("empresaId"));
  const tipo = formData.get("tipo") === "ACUMULADO" ? "ACUMULADO" : "MES";
  const periodoMes = Number(formData.get("periodoMes"));
  const periodoAnio = Number(formData.get("periodoAnio"));
  const file = formData.get("archivo");

  if (!Number.isInteger(periodoMes) || periodoMes < 1 || periodoMes > 12) {
    return { error: "Mes inválido." };
  }
  if (!Number.isInteger(periodoAnio) || periodoAnio < 2000) {
    return { error: "Año inválido." };
  }

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Seleccioná un archivo." };
  }

  const html = await file.text();
  const rows = parseBsysRawFile(html);

  if (rows.length === 0) {
    return {
      error: "No se encontraron cuentas en el archivo. Verificá que sea el export correcto del sistema contable.",
    };
  }

  const clasificadas = await prisma.planDeCuentas.findMany({
    where: { empresaId, cuenta: { in: rows.map((r) => r.cuenta) } },
    select: { cuenta: true },
  });
  const clasificadasSet = new Set(clasificadas.map((p) => p.cuenta));
  const faltantes = rows.map((r) => r.cuenta).filter((c) => !clasificadasSet.has(c));

  if (faltantes.length > 0) {
    return {
      error: `Hay ${faltantes.length} cuenta(s) del archivo que no están en el Plan de Cuentas de esta empresa. Agregalas en Configuración → Plan de Cuentas y reintentá.`,
      cuentasFaltantes: faltantes,
    };
  }

  await prisma.balanceSumasYSaldos.createMany({
    data: rows.map((r) => ({
      empresaId,
      tipo,
      fechaCarga: new Date(),
      cuenta: r.cuenta,
      saldoIniDebe: r.saldoIniDebe,
      saldoIniHaber: r.saldoIniHaber,
      sumasDebe: r.sumasDebe,
      sumasHaber: r.sumasHaber,
      saldoCierreDebe: r.saldoCierreDebe,
      saldoCierreHaber: r.saldoCierreHaber,
    })),
  });

  await prisma.informe.upsert({
    where: { empresaId_periodoMes_periodoAnio: { empresaId, periodoMes, periodoAnio } },
    update: {},
    create: { empresaId, periodoMes, periodoAnio },
  });

  revalidatePath(`/empresa/${empresaId}/bsys-${tipo === "MES" ? "mes" : "acumulado"}`);
  revalidatePath(`/empresa/${empresaId}/historico`);
  return { success: true as const, cantidad: rows.length };
}
