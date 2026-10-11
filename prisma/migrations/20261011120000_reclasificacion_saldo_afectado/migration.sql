-- Una Reclasificacion puede aplicarse al saldo final (como hasta hoy) o solo
-- al saldo inicial. Las existentes quedan en FINAL.
CREATE TYPE "SaldoReclasificacion" AS ENUM ('FINAL', 'INICIAL');

ALTER TABLE "Reclasificacion" ADD COLUMN     "saldoAfectado" "SaldoReclasificacion" NOT NULL DEFAULT 'FINAL';
