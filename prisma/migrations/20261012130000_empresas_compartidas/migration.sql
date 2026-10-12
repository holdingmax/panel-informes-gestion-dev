-- Empresas que comparten BSyS entre varias Unidades de Negocio.
--  - Empresa.comparteBsys (default false).
--  - El vínculo Empresa -> Unidad pasa a una tabla (EmpresaUnidad) para poder
--    tener varias; se copia el vínculo actual de cada Empresa.
--  - Cada carga de BSyS guarda la Unidad que la hizo (se completa con la
--    Unidad actual de la Empresa, que hasta hoy era la única).
--  - PlanDeCuentas.unidadNegocioId ("Cuit compartido"): solo se usa en
--    Empresas que comparten BSyS; reemplaza a la Categoría OyA, que se da de
--    baja (ninguna cuenta la tiene asignada).

ALTER TABLE "Empresa" ADD COLUMN     "comparteBsys" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "EmpresaUnidad" (
    "empresaId" INTEGER NOT NULL,
    "unidadNegocioId" INTEGER NOT NULL,

    CONSTRAINT "EmpresaUnidad_pkey" PRIMARY KEY ("empresaId","unidadNegocioId")
);

CREATE INDEX "EmpresaUnidad_unidadNegocioId_idx" ON "EmpresaUnidad"("unidadNegocioId");

ALTER TABLE "EmpresaUnidad" ADD CONSTRAINT "EmpresaUnidad_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("codEmp") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmpresaUnidad" ADD CONSTRAINT "EmpresaUnidad_unidadNegocioId_fkey" FOREIGN KEY ("unidadNegocioId") REFERENCES "UnidadNegocio"("codUnidad") ON DELETE CASCADE ON UPDATE CASCADE;

-- Copia del vínculo actual (antes de borrar la columna).
INSERT INTO "EmpresaUnidad" ("empresaId", "unidadNegocioId")
SELECT "codEmp", "unidadNegocioId" FROM "Empresa" WHERE "unidadNegocioId" IS NOT NULL;

ALTER TABLE "BalanceSumasYSaldos" ADD COLUMN     "unidadNegocioId" INTEGER;

UPDATE "BalanceSumasYSaldos" b
SET "unidadNegocioId" = e."unidadNegocioId"
FROM "Empresa" e
WHERE e."codEmp" = b."empresaId";

ALTER TABLE "BalanceSumasYSaldos" ADD CONSTRAINT "BalanceSumasYSaldos_unidadNegocioId_fkey" FOREIGN KEY ("unidadNegocioId") REFERENCES "UnidadNegocio"("codUnidad") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Empresa" DROP CONSTRAINT "Empresa_unidadNegocioId_fkey";
ALTER TABLE "Empresa" DROP COLUMN "unidadNegocioId";

ALTER TABLE "PlanDeCuentas" DROP CONSTRAINT "PlanDeCuentas_categoriaOyAId_fkey";
ALTER TABLE "PlanDeCuentas" DROP COLUMN "categoriaOyAId",
ADD COLUMN     "unidadNegocioId" INTEGER;

ALTER TABLE "PlanDeCuentas" ADD CONSTRAINT "PlanDeCuentas_unidadNegocioId_fkey" FOREIGN KEY ("unidadNegocioId") REFERENCES "UnidadNegocio"("codUnidad") ON DELETE SET NULL ON UPDATE CASCADE;

DROP TABLE "CategoriaOyA";
