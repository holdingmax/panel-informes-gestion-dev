-- CreateEnum
CREATE TYPE "RolTipoPartida" AS ENUM ('ACTIVO', 'PASIVO', 'PATRIMONIO_NETO', 'RESULTADO');

-- CreateEnum
CREATE TYPE "CategoriaOrigenAplicacion" AS ENUM ('ORIGEN', 'APLICACION', 'AJUSTE');

-- CreateEnum
CREATE TYPE "BucketNOF" AS ENUM ('OPERATIVO', 'NO_OPERATIVO', 'FINANCIAMIENTO');

-- DropForeignKey
ALTER TABLE "Informe" DROP CONSTRAINT "Informe_empresaId_fkey";

-- DropForeignKey
ALTER TABLE "PlanDeCuentas" DROP CONSTRAINT "PlanDeCuentas_subrubro2Id_fkey";

-- DropForeignKey
ALTER TABLE "PlanDeCuentas" DROP CONSTRAINT "PlanDeCuentas_subrubro3Id_fkey";

-- DropForeignKey
ALTER TABLE "PlanDeCuentas" DROP CONSTRAINT "PlanDeCuentas_categoriaOyAId_fkey";

-- DropIndex
DROP INDEX "Informe_empresaId_periodoMes_periodoAnio_key";

-- AlterTable
ALTER TABLE "Empresa" DROP COLUMN "imagenEmp",
DROP COLUMN "imagenMime",
ADD COLUMN     "actualiza" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "monedaActualizaId" INTEGER,
ADD COLUMN     "monedaPrimariaId" INTEGER,
ADD COLUMN     "monedaSecundariaId" INTEGER,
ADD COLUMN     "presentaEnMiles" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "unidadNegocioId" INTEGER,
ALTER COLUMN "nombreEmp" SET DATA TYPE VARCHAR(60);

-- AlterTable
ALTER TABLE "Informe" DROP COLUMN "empresaId",
ADD COLUMN     "unidadNegocioId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "PartidaPatrimonial" ADD COLUMN     "tipoId" INTEGER;

-- AlterTable
ALTER TABLE "Rubro" ADD COLUMN     "bucketNOF" "BucketNOF",
ADD COLUMN     "categoriaOyA" "CategoriaOrigenAplicacion",
ADD COLUMN     "orden" INTEGER;

-- AlterTable
ALTER TABLE "CategoriaOyA" ADD COLUMN     "bucketNOF" "BucketNOF";

-- AlterTable
ALTER TABLE "PlanDeCuentas" ALTER COLUMN "subrubro2Id" DROP NOT NULL,
ALTER COLUMN "subrubro3Id" DROP NOT NULL,
ALTER COLUMN "categoriaOyAId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "UnidadNegocio" (
    "codUnidad" SERIAL NOT NULL,
    "nombreUnidad" VARCHAR(35) NOT NULL,
    "imagenUnidad" BYTEA,
    "imagenMime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "seriesTablaId" INTEGER,

    CONSTRAINT "UnidadNegocio_pkey" PRIMARY KEY ("codUnidad")
);

-- CreateTable
CREATE TABLE "Moneda" (
    "codMoneda" SERIAL NOT NULL,
    "nomMoneda" VARCHAR(60) NOT NULL,
    "simbolo" VARCHAR(5) NOT NULL,

    CONSTRAINT "Moneda_pkey" PRIMARY KEY ("codMoneda")
);

-- CreateTable
CREATE TABLE "TipoPartida" (
    "codTipo" SERIAL NOT NULL,
    "nomTipo" VARCHAR(40) NOT NULL,
    "rol" "RolTipoPartida",
    "exigeSaldoCero" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TipoPartida_pkey" PRIMARY KEY ("codTipo")
);

-- CreateTable
CREATE TABLE "SeriesEIndicesTabla" (
    "codTabla" SERIAL NOT NULL,
    "tipoTabla" VARCHAR(60) NOT NULL,

    CONSTRAINT "SeriesEIndicesTabla_pkey" PRIMARY KEY ("codTabla")
);

-- CreateTable
CREATE TABLE "SeriesEIndices" (
    "id" TEXT NOT NULL,
    "tablaId" INTEGER NOT NULL,
    "periodo" DATE NOT NULL,
    "indice" DECIMAL(18,6) NOT NULL,
    "dolar" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "SeriesEIndices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResultadosHistoricos" (
    "id" TEXT NOT NULL,
    "unidadNegocioId" INTEGER NOT NULL,
    "periodoMes" INTEGER NOT NULL,
    "periodoAnio" INTEGER NOT NULL,
    "ventas" DECIMAL(18,2) NOT NULL,
    "costosDirectos" DECIMAL(18,2) NOT NULL,
    "gastosOperativos" DECIMAL(18,2) NOT NULL,
    "expensas" DECIMAL(18,2) NOT NULL,
    "otrasGananciasYPerdidas" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResultadosHistoricos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Moneda_nomMoneda_key" ON "Moneda"("nomMoneda");

-- CreateIndex
CREATE UNIQUE INDEX "TipoPartida_nomTipo_key" ON "TipoPartida"("nomTipo");

-- CreateIndex
CREATE UNIQUE INDEX "SeriesEIndices_tablaId_periodo_key" ON "SeriesEIndices"("tablaId", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "ResultadosHistoricos_unidadNegocioId_periodoMes_periodoAnio_key" ON "ResultadosHistoricos"("unidadNegocioId", "periodoMes", "periodoAnio");

-- CreateIndex
CREATE UNIQUE INDEX "Informe_unidadNegocioId_periodoMes_periodoAnio_key" ON "Informe"("unidadNegocioId", "periodoMes", "periodoAnio");

-- CreateIndex
CREATE UNIQUE INDEX "PartidaPatrimonial_nomPartida_key" ON "PartidaPatrimonial"("nomPartida");

-- CreateIndex
CREATE UNIQUE INDEX "Rubro_nomRubro_key" ON "Rubro"("nomRubro");

-- CreateIndex
CREATE UNIQUE INDEX "Subrubro_nomSubrubro_key" ON "Subrubro"("nomSubrubro");

-- CreateIndex
CREATE UNIQUE INDEX "Subrubro2_nomSubrubro2_key" ON "Subrubro2"("nomSubrubro2");

-- CreateIndex
CREATE UNIQUE INDEX "Subrubro3_nomSubrubro3_key" ON "Subrubro3"("nomSubrubro3");

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaOyA_nomOyA_key" ON "CategoriaOyA"("nomOyA");

-- CreateIndex
CREATE UNIQUE INDEX "PlanDeCuentas_empresaId_cuenta_key" ON "PlanDeCuentas"("empresaId", "cuenta");

-- AddForeignKey
ALTER TABLE "UnidadNegocio" ADD CONSTRAINT "UnidadNegocio_seriesTablaId_fkey" FOREIGN KEY ("seriesTablaId") REFERENCES "SeriesEIndicesTabla"("codTabla") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Empresa" ADD CONSTRAINT "Empresa_unidadNegocioId_fkey" FOREIGN KEY ("unidadNegocioId") REFERENCES "UnidadNegocio"("codUnidad") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Empresa" ADD CONSTRAINT "Empresa_monedaPrimariaId_fkey" FOREIGN KEY ("monedaPrimariaId") REFERENCES "Moneda"("codMoneda") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Empresa" ADD CONSTRAINT "Empresa_monedaSecundariaId_fkey" FOREIGN KEY ("monedaSecundariaId") REFERENCES "Moneda"("codMoneda") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Empresa" ADD CONSTRAINT "Empresa_monedaActualizaId_fkey" FOREIGN KEY ("monedaActualizaId") REFERENCES "Moneda"("codMoneda") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Informe" ADD CONSTRAINT "Informe_unidadNegocioId_fkey" FOREIGN KEY ("unidadNegocioId") REFERENCES "UnidadNegocio"("codUnidad") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartidaPatrimonial" ADD CONSTRAINT "PartidaPatrimonial_tipoId_fkey" FOREIGN KEY ("tipoId") REFERENCES "TipoPartida"("codTipo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeriesEIndices" ADD CONSTRAINT "SeriesEIndices_tablaId_fkey" FOREIGN KEY ("tablaId") REFERENCES "SeriesEIndicesTabla"("codTabla") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultadosHistoricos" ADD CONSTRAINT "ResultadosHistoricos_unidadNegocioId_fkey" FOREIGN KEY ("unidadNegocioId") REFERENCES "UnidadNegocio"("codUnidad") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanDeCuentas" ADD CONSTRAINT "PlanDeCuentas_subrubro2Id_fkey" FOREIGN KEY ("subrubro2Id") REFERENCES "Subrubro2"("codSubrubro2") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanDeCuentas" ADD CONSTRAINT "PlanDeCuentas_subrubro3Id_fkey" FOREIGN KEY ("subrubro3Id") REFERENCES "Subrubro3"("codSubrubro3") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanDeCuentas" ADD CONSTRAINT "PlanDeCuentas_categoriaOyAId_fkey" FOREIGN KEY ("categoriaOyAId") REFERENCES "CategoriaOyA"("codOyA") ON DELETE SET NULL ON UPDATE CASCADE;

