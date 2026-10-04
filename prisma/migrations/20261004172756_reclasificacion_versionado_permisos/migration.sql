-- Fase A del Panel de Reclasificación / versionado de Informe / permisos
-- por Unidad de Negocio / adjuntos de Consulta. Puramente aditivo — no hay
-- ningún Informe cargado hoy, así que agregar "version" con default 1 y
-- cambiar la unique constraint no pierde ni reinterpreta ningún dato.

-- DropIndex
DROP INDEX "Informe_unidadNegocioId_periodoMes_periodoAnio_key";

-- AlterTable
ALTER TABLE "Informe" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "UserUnidadPermiso" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "unidadNegocioId" INTEGER,
    "puedeConfiguracion" BOOLEAN NOT NULL DEFAULT false,
    "puedeRevisar" BOOLEAN NOT NULL DEFAULT false,
    "puedeAprobar" BOOLEAN NOT NULL DEFAULT false,
    "puedeAdjuntar" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UserUnidadPermiso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reclasificacion" (
    "id" TEXT NOT NULL,
    "informeId" TEXT NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "detalle" VARCHAR(500) NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reclasificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReclasificacionLinea" (
    "id" TEXT NOT NULL,
    "reclasificacionId" TEXT NOT NULL,
    "planDeCuentaId" TEXT NOT NULL,
    "debe" DECIMAL(18,2) NOT NULL,
    "haber" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "ReclasificacionLinea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReclasificacionAdjunto" (
    "id" TEXT NOT NULL,
    "reclasificacionId" TEXT NOT NULL,
    "nombreArchivo" VARCHAR(255) NOT NULL,
    "mimeType" TEXT NOT NULL,
    "contenido" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReclasificacionAdjunto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InformeAdjunto" (
    "id" TEXT NOT NULL,
    "informeId" TEXT NOT NULL,
    "nombreArchivo" VARCHAR(255) NOT NULL,
    "mimeType" TEXT NOT NULL,
    "contenido" BYTEA NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InformeAdjunto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserUnidadPermiso_userId_unidadNegocioId_key" ON "UserUnidadPermiso"("userId", "unidadNegocioId");

-- CreateIndex
CREATE UNIQUE INDEX "Informe_unidadNegocioId_periodoMes_periodoAnio_version_key" ON "Informe"("unidadNegocioId", "periodoMes", "periodoAnio", "version");

-- AddForeignKey
ALTER TABLE "UserUnidadPermiso" ADD CONSTRAINT "UserUnidadPermiso_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserUnidadPermiso" ADD CONSTRAINT "UserUnidadPermiso_unidadNegocioId_fkey" FOREIGN KEY ("unidadNegocioId") REFERENCES "UnidadNegocio"("codUnidad") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reclasificacion" ADD CONSTRAINT "Reclasificacion_informeId_fkey" FOREIGN KEY ("informeId") REFERENCES "Informe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reclasificacion" ADD CONSTRAINT "Reclasificacion_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("codEmp") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReclasificacionLinea" ADD CONSTRAINT "ReclasificacionLinea_reclasificacionId_fkey" FOREIGN KEY ("reclasificacionId") REFERENCES "Reclasificacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReclasificacionLinea" ADD CONSTRAINT "ReclasificacionLinea_planDeCuentaId_fkey" FOREIGN KEY ("planDeCuentaId") REFERENCES "PlanDeCuentas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReclasificacionAdjunto" ADD CONSTRAINT "ReclasificacionAdjunto_reclasificacionId_fkey" FOREIGN KEY ("reclasificacionId") REFERENCES "Reclasificacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InformeAdjunto" ADD CONSTRAINT "InformeAdjunto_informeId_fkey" FOREIGN KEY ("informeId") REFERENCES "Informe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
