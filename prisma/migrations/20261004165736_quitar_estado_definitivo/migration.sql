-- Aprobado pasa a ser el último estado de un Informe — Definitivo se
-- elimina, no agregaba ninguna distinción real (la congelación ya ocurre al
-- aprobar, ver Informe.snapshot). No hace falta migrar datos: no hay ningún
-- Informe en estado Definitivo hoy.
-- AlterEnum
BEGIN;
CREATE TYPE "EstadoInforme_new" AS ENUM ('PROCESO', 'EN_REVISION', 'APROBADO');
ALTER TABLE "Informe" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "Informe" ALTER COLUMN "estado" TYPE "EstadoInforme_new" USING ("estado"::text::"EstadoInforme_new");
ALTER TYPE "EstadoInforme" RENAME TO "EstadoInforme_old";
ALTER TYPE "EstadoInforme_new" RENAME TO "EstadoInforme";
DROP TYPE "EstadoInforme_old";
ALTER TABLE "Informe" ALTER COLUMN "estado" SET DEFAULT 'PROCESO';
COMMIT;
