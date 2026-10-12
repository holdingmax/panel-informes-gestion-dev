-- CTO/ONP/ARS de un Rubro pasa a elegirse por Unidad de Negocio: cambiarlo en
-- una unidad no afecta a las demás. Sin fila, la unidad usa el default del
-- Rubro (Rubro.bucketNOF), así que los informes existentes no cambian.
CREATE TABLE "RubroUnidadNOF" (
    "unidadNegocioId" INTEGER NOT NULL,
    "codRubro" INTEGER NOT NULL,
    "bucketNOF" "BucketNOF",

    CONSTRAINT "RubroUnidadNOF_pkey" PRIMARY KEY ("unidadNegocioId","codRubro")
);

CREATE INDEX "RubroUnidadNOF_codRubro_idx" ON "RubroUnidadNOF"("codRubro");

ALTER TABLE "RubroUnidadNOF" ADD CONSTRAINT "RubroUnidadNOF_unidadNegocioId_fkey" FOREIGN KEY ("unidadNegocioId") REFERENCES "UnidadNegocio"("codUnidad") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RubroUnidadNOF" ADD CONSTRAINT "RubroUnidadNOF_codRubro_fkey" FOREIGN KEY ("codRubro") REFERENCES "Rubro"("codRubro") ON DELETE CASCADE ON UPDATE CASCADE;
