-- Un Informe solo se puede borrar mientras está En proceso — que es también
-- la única etapa en la que puede tener Reclasificaciones cargadas. Antes
-- fallaba con un error de FK crudo al intentar borrar un informe con
-- reclasificaciones; ahora se borran en cascada junto con él.
-- DropForeignKey
ALTER TABLE "Reclasificacion" DROP CONSTRAINT "Reclasificacion_informeId_fkey";

-- AddForeignKey
ALTER TABLE "Reclasificacion" ADD CONSTRAINT "Reclasificacion_informeId_fkey" FOREIGN KEY ("informeId") REFERENCES "Informe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
