-- DropForeignKey
ALTER TABLE "PlanDeCuentas" DROP CONSTRAINT "PlanDeCuentas_partidaPatrimonialId_fkey";

-- DropForeignKey
ALTER TABLE "PlanDeCuentas" DROP CONSTRAINT "PlanDeCuentas_subrubroId_fkey";

-- AlterTable
ALTER TABLE "Informe" ADD COLUMN     "snapshot" JSONB;

-- AlterTable: Rubro.campoResultado y categoriaOyA se sacan más abajo, una
-- vez hecho el backfill de partidaPatrimonialId (que todavía necesita leer
-- PlanDeCuentas.partidaPatrimonialId, antes de que esa columna se borre).
ALTER TABLE "Rubro" ADD COLUMN     "partidaPatrimonialId" INTEGER;

-- AlterTable
ALTER TABLE "Subrubro" ADD COLUMN     "campoResultado" "CampoResultado";

-- Backfill: a cada Rubro se le asigna la Partida Patrimonial que usa la
-- mayoría de sus cuentas hoy (vía PlanDeCuentas, todavía con su columna
-- partidaPatrimonialId). Esto corrige de raíz el caso ya confirmado de
-- Handyway Cargo ("CREDITOS POR VENTAS": 23 cuentas ACTIVO contra 1
-- PASIVO suelta) — gana ACTIVO automáticamente por mayoría. Un Rubro sin
-- ninguna cuenta cargada queda con partidaPatrimonialId NULL, a clasificar
-- a mano en Configuración → Rubro.
WITH conteos AS (
  SELECT
    "rubroId",
    "partidaPatrimonialId",
    COUNT(*) AS cantidad,
    ROW_NUMBER() OVER (
      PARTITION BY "rubroId"
      ORDER BY COUNT(*) DESC, "partidaPatrimonialId" ASC
    ) AS rn
  FROM "PlanDeCuentas"
  GROUP BY "rubroId", "partidaPatrimonialId"
)
UPDATE "Rubro" r
SET "partidaPatrimonialId" = c."partidaPatrimonialId"
FROM conteos c
WHERE c."rubroId" = r."codRubro" AND c.rn = 1;

-- AlterTable: ahora sí, con el backfill ya hecho, se sacan los campos
-- viejos.
ALTER TABLE "Rubro" DROP COLUMN "campoResultado",
DROP COLUMN "categoriaOyA";

-- AlterTable
ALTER TABLE "PlanDeCuentas" DROP COLUMN "partidaPatrimonialId",
ALTER COLUMN "subrubroId" DROP NOT NULL;

-- DropEnum
DROP TYPE "CategoriaOrigenAplicacion";

-- AddForeignKey
ALTER TABLE "Rubro" ADD CONSTRAINT "Rubro_partidaPatrimonialId_fkey" FOREIGN KEY ("partidaPatrimonialId") REFERENCES "PartidaPatrimonial"("codPartida") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanDeCuentas" ADD CONSTRAINT "PlanDeCuentas_subrubroId_fkey" FOREIGN KEY ("subrubroId") REFERENCES "Subrubro"("codSubrubro") ON DELETE SET NULL ON UPDATE CASCADE;
