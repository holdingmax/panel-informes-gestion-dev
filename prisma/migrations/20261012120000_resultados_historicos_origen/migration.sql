-- Las filas de Resultados Históricos que genera la aprobación de un informe
-- pasan a ser inmodificables por el usuario (origen INFORME); las cargas
-- iniciales siguen siendo editables (origen MANUAL).
CREATE TYPE "OrigenResultadoHistorico" AS ENUM ('MANUAL', 'INFORME');

ALTER TABLE "ResultadosHistoricos" ADD COLUMN     "origen" "OrigenResultadoHistorico" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "versionInforme" INTEGER,
ADD COLUMN     "observaciones" TEXT;

-- Filas existentes: son de origen INFORME las que corresponden a un período
-- con un informe Aprobado en el sistema (la aprobación completa esa fila); el
-- resto son cargas iniciales.
UPDATE "ResultadosHistoricos" rh SET
  "origen" = 'INFORME',
  "versionInforme" = a.version,
  "observaciones" = 'aprobado versión ' || a.version || ' – informe ' ||
    (ARRAY['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'])[rh."periodoMes"] ||
    '-' || right(rh."periodoAnio"::text, 2)
FROM (
  SELECT "unidadNegocioId", "periodoMes", "periodoAnio", MAX("version") AS version
  FROM "Informe"
  WHERE "estado" = 'APROBADO'
  GROUP BY "unidadNegocioId", "periodoMes", "periodoAnio"
) a
WHERE rh."unidadNegocioId" = a."unidadNegocioId"
  AND rh."periodoMes" = a."periodoMes"
  AND rh."periodoAnio" = a."periodoAnio";
