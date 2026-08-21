-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "EstadoInforme" AS ENUM ('PROCESO', 'EN_REVISION', 'APROBADO', 'DEFINITIVO');

-- CreateEnum
CREATE TYPE "TipoBSyS" AS ENUM ('MES', 'ACUMULADO');

-- CreateEnum
CREATE TYPE "EstadoBSyS" AS ENUM ('PROVISORIO', 'DEFINITIVO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "securityQuestion" TEXT NOT NULL,
    "securityAnswerHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empresa" (
    "codEmp" SERIAL NOT NULL,
    "nombreEmp" VARCHAR(35) NOT NULL,
    "imagenEmp" BYTEA,
    "imagenMime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("codEmp")
);

-- CreateTable
CREATE TABLE "Informe" (
    "id" TEXT NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "periodoMes" INTEGER NOT NULL,
    "periodoAnio" INTEGER NOT NULL,
    "estado" "EstadoInforme" NOT NULL DEFAULT 'PROCESO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Informe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BalanceSumasYSaldos" (
    "id" TEXT NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "tipo" "TipoBSyS" NOT NULL,
    "fechaCarga" TIMESTAMP(3) NOT NULL,
    "cuenta" VARCHAR(90) NOT NULL,
    "saldoIniDebe" DECIMAL(18,2) NOT NULL,
    "saldoIniHaber" DECIMAL(18,2) NOT NULL,
    "sumasDebe" DECIMAL(18,2) NOT NULL,
    "sumasHaber" DECIMAL(18,2) NOT NULL,
    "saldoCierreDebe" DECIMAL(18,2) NOT NULL,
    "saldoCierreHaber" DECIMAL(18,2) NOT NULL,
    "estado" "EstadoBSyS" NOT NULL DEFAULT 'PROVISORIO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BalanceSumasYSaldos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartidaPatrimonial" (
    "codPartida" SERIAL NOT NULL,
    "nomPartida" VARCHAR(40) NOT NULL,

    CONSTRAINT "PartidaPatrimonial_pkey" PRIMARY KEY ("codPartida")
);

-- CreateTable
CREATE TABLE "Rubro" (
    "codRubro" SERIAL NOT NULL,
    "nomRubro" VARCHAR(60) NOT NULL,

    CONSTRAINT "Rubro_pkey" PRIMARY KEY ("codRubro")
);

-- CreateTable
CREATE TABLE "Subrubro" (
    "codSubrubro" SERIAL NOT NULL,
    "nomSubrubro" VARCHAR(60) NOT NULL,

    CONSTRAINT "Subrubro_pkey" PRIMARY KEY ("codSubrubro")
);

-- CreateTable
CREATE TABLE "Subrubro2" (
    "codSubrubro2" SERIAL NOT NULL,
    "nomSubrubro2" VARCHAR(60) NOT NULL,

    CONSTRAINT "Subrubro2_pkey" PRIMARY KEY ("codSubrubro2")
);

-- CreateTable
CREATE TABLE "Subrubro3" (
    "codSubrubro3" SERIAL NOT NULL,
    "nomSubrubro3" VARCHAR(60) NOT NULL,

    CONSTRAINT "Subrubro3_pkey" PRIMARY KEY ("codSubrubro3")
);

-- CreateTable
CREATE TABLE "CategoriaOyA" (
    "codOyA" SERIAL NOT NULL,
    "nomOyA" VARCHAR(60) NOT NULL,

    CONSTRAINT "CategoriaOyA_pkey" PRIMARY KEY ("codOyA")
);

-- CreateTable
CREATE TABLE "PlanDeCuentas" (
    "id" TEXT NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "cuenta" VARCHAR(90) NOT NULL,
    "partidaPatrimonialId" INTEGER NOT NULL,
    "rubroId" INTEGER NOT NULL,
    "subrubroId" INTEGER NOT NULL,
    "subrubro2Id" INTEGER NOT NULL,
    "subrubro3Id" INTEGER NOT NULL,
    "categoriaOyAId" INTEGER NOT NULL,

    CONSTRAINT "PlanDeCuentas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Informe_empresaId_periodoMes_periodoAnio_key" ON "Informe"("empresaId", "periodoMes", "periodoAnio");

-- AddForeignKey
ALTER TABLE "Informe" ADD CONSTRAINT "Informe_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("codEmp") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceSumasYSaldos" ADD CONSTRAINT "BalanceSumasYSaldos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("codEmp") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanDeCuentas" ADD CONSTRAINT "PlanDeCuentas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("codEmp") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanDeCuentas" ADD CONSTRAINT "PlanDeCuentas_partidaPatrimonialId_fkey" FOREIGN KEY ("partidaPatrimonialId") REFERENCES "PartidaPatrimonial"("codPartida") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanDeCuentas" ADD CONSTRAINT "PlanDeCuentas_rubroId_fkey" FOREIGN KEY ("rubroId") REFERENCES "Rubro"("codRubro") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanDeCuentas" ADD CONSTRAINT "PlanDeCuentas_subrubroId_fkey" FOREIGN KEY ("subrubroId") REFERENCES "Subrubro"("codSubrubro") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanDeCuentas" ADD CONSTRAINT "PlanDeCuentas_subrubro2Id_fkey" FOREIGN KEY ("subrubro2Id") REFERENCES "Subrubro2"("codSubrubro2") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanDeCuentas" ADD CONSTRAINT "PlanDeCuentas_subrubro3Id_fkey" FOREIGN KEY ("subrubro3Id") REFERENCES "Subrubro3"("codSubrubro3") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanDeCuentas" ADD CONSTRAINT "PlanDeCuentas_categoriaOyAId_fkey" FOREIGN KEY ("categoriaOyAId") REFERENCES "CategoriaOyA"("codOyA") ON DELETE RESTRICT ON UPDATE CASCADE;
