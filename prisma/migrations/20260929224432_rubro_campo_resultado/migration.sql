-- CreateEnum
CREATE TYPE "CampoResultado" AS ENUM ('VENTAS', 'COSTOS_DIRECTOS', 'GASTOS_OPERATIVOS', 'EXPENSAS', 'OTRAS_GANANCIAS_PERDIDAS');

-- AlterTable
ALTER TABLE "Rubro" ADD COLUMN     "campoResultado" "CampoResultado";

-- Backfill: completa el campo según los nombres actuales que usaba
-- RUBRO_A_CAMPO en resultado-nominal.ts (mapeo por nombre, ahora
-- reemplazado por este campo explícito). Cualquier otro Rubro de
-- Resultado que no matchee ninguno de estos 5 nombres queda con
-- campoResultado NULL y hay que clasificarlo a mano en Configuración →
-- Rubro.
UPDATE "Rubro" SET "campoResultado" = 'VENTAS' WHERE "nomRubro" = 'VENTAS';
UPDATE "Rubro" SET "campoResultado" = 'COSTOS_DIRECTOS' WHERE "nomRubro" = 'Costos directos/variables';
UPDATE "Rubro" SET "campoResultado" = 'GASTOS_OPERATIVOS' WHERE "nomRubro" = 'Gastos Fijos Operativos';
UPDATE "Rubro" SET "campoResultado" = 'EXPENSAS' WHERE "nomRubro" = 'EXPENSAS';
UPDATE "Rubro" SET "campoResultado" = 'OTRAS_GANANCIAS_PERDIDAS' WHERE "nomRubro" = 'Otras Ganancias y Perdidas';
