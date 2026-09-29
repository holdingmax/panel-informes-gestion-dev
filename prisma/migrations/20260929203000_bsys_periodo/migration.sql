-- AlterTable: agregar como nullable primero para poder completar las filas
-- existentes antes de exigir el valor.
ALTER TABLE "BalanceSumasYSaldos" ADD COLUMN "periodoMes" INTEGER;
ALTER TABLE "BalanceSumasYSaldos" ADD COLUMN "periodoAnio" INTEGER;

-- Backfill: a cada fila existente se le asigna el período del Informe más
-- cercano a su fechaCarga dentro de la misma Unidad de Negocio (vía
-- Empresa) — "más cercano" en cantidad de meses de diferencia; ante empate,
-- el período más reciente.
WITH candidatos AS (
  SELECT
    b.id,
    i."periodoMes",
    i."periodoAnio",
    ROW_NUMBER() OVER (
      PARTITION BY b.id
      ORDER BY
        ABS(
          (EXTRACT(YEAR FROM b."fechaCarga")::int * 12 + EXTRACT(MONTH FROM b."fechaCarga")::int)
          - (i."periodoAnio" * 12 + i."periodoMes")
        ),
        i."periodoAnio" DESC,
        i."periodoMes" DESC
    ) AS rn
  FROM "BalanceSumasYSaldos" b
  JOIN "Empresa" e ON e."codEmp" = b."empresaId"
  JOIN "Informe" i ON i."unidadNegocioId" = e."unidadNegocioId"
)
UPDATE "BalanceSumasYSaldos" b
SET "periodoMes" = c."periodoMes", "periodoAnio" = c."periodoAnio"
FROM candidatos c
WHERE c.id = b.id AND c.rn = 1;

-- Filas sin ningún Informe candidato (empresa sin Unidad de Negocio
-- vinculada, o unidad sin ningún informe todavía): se usa mes/año de la
-- propia fechaCarga, como pide la Fase 1 para este caso.
UPDATE "BalanceSumasYSaldos"
SET "periodoMes" = EXTRACT(MONTH FROM "fechaCarga")::int,
    "periodoAnio" = EXTRACT(YEAR FROM "fechaCarga")::int
WHERE "periodoMes" IS NULL;

-- Ahora que todas las filas tienen valor, se exige.
ALTER TABLE "BalanceSumasYSaldos" ALTER COLUMN "periodoMes" SET NOT NULL;
ALTER TABLE "BalanceSumasYSaldos" ALTER COLUMN "periodoAnio" SET NOT NULL;

-- CreateIndex
CREATE INDEX "BalanceSumasYSaldos_empresaId_tipo_periodoAnio_periodoMes_f_idx" ON "BalanceSumasYSaldos"("empresaId", "tipo", "periodoAnio", "periodoMes", "fechaCarga");
