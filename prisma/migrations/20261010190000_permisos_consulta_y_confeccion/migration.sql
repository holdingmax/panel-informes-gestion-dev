-- Los permisos por unidad pasan a dos árboles independientes: Consulta
-- (puedeConsultar + revisar/aprobar/adjuntar) y Confección
-- (puedeConfeccionar + configuración/reclasificar/eliminar). Antes la sola
-- existencia de la fila daba acceso a ambas ventanas y cualquier usuario con
-- acceso podía confeccionar, reclasificar y eliminar.
ALTER TABLE "UserUnidadPermiso" ADD COLUMN     "puedeConsultar" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "puedeConfeccionar" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "puedeReclasificar" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "puedeEliminar" BOOLEAN NOT NULL DEFAULT false;

-- Las filas existentes conservan lo que podían hacer hasta hoy: acceso a
-- ambas ventanas y las capacidades que antes eran implícitas.
UPDATE "UserUnidadPermiso" SET
  "puedeConsultar" = true,
  "puedeConfeccionar" = true,
  "puedeReclasificar" = true,
  "puedeEliminar" = true;
