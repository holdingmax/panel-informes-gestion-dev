-- Índice y Dólar pasan a ser opcionales: cada uno solo hace falta si alguna
-- Empresa que usa la tabla realmente lo necesita (Actualiza=Sí para Índice,
-- Moneda secundaria configurada para Dólar). No se tocan datos existentes —
-- solo se saca la restricción NOT NULL.
ALTER TABLE "SeriesEIndices" ALTER COLUMN "indice" DROP NOT NULL,
ALTER COLUMN "dolar" DROP NOT NULL;
