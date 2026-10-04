-- DropForeignKey
ALTER TABLE "PlanDeCuentas" DROP CONSTRAINT "PlanDeCuentas_rubroId_fkey";

-- AlterTable
ALTER TABLE "PlanDeCuentas" ALTER COLUMN "rubroId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "PlanDeCuentas" ADD CONSTRAINT "PlanDeCuentas_rubroId_fkey" FOREIGN KEY ("rubroId") REFERENCES "Rubro"("codRubro") ON DELETE SET NULL ON UPDATE CASCADE;

-- Unificación de metodología: el ESP se arma solo con cuentas que tienen
-- Rubro, el ER solo con cuentas que tienen Subrubro (ver computeInformeReport
-- / computeResultadoNominalDeEmpresaPure). Las cuentas de Resultado (Ingresos/
-- Egresos) ya no necesitan un Rubro — su campo del ER ya quedó resuelto por
-- Subrubro en el backfill anterior — así que se les saca el Rubro.
UPDATE "PlanDeCuentas"
SET "rubroId" = NULL
WHERE "rubroId" IN (
  SELECT "codRubro" FROM "Rubro"
  WHERE "nomRubro" IN ('VENTAS', 'Costos directos/variables', 'Gastos Fijos Operativos', 'EXPENSAS', 'Otras Ganancias y Perdidas')
);

-- Las 2 cuentas de orden (fuera de balance) pasan a integrar el balance real.
UPDATE "PlanDeCuentas"
SET "rubroId" = (SELECT "codRubro" FROM "Rubro" WHERE "nomRubro" = 'Otras deudas')
WHERE "rubroId" = (SELECT "codRubro" FROM "Rubro" WHERE "nomRubro" = 'Deudas Comerciales (Cuenta de Orden)');

UPDATE "PlanDeCuentas"
SET "rubroId" = (SELECT "codRubro" FROM "Rubro" WHERE "nomRubro" = 'Otros créditos')
WHERE "rubroId" = (SELECT "codRubro" FROM "Rubro" WHERE "nomRubro" = 'Créditos por Ventas (Cuenta de Orden)');

-- Los 7 rubros de arriba ya quedaron sin ninguna cuenta — se borran, tal
-- como se pidió.
DELETE FROM "Rubro"
WHERE "nomRubro" IN (
  'VENTAS', 'Costos directos/variables', 'Gastos Fijos Operativos', 'EXPENSAS', 'Otras Ganancias y Perdidas',
  'Deudas Comerciales (Cuenta de Orden)', 'Créditos por Ventas (Cuenta de Orden)'
);
