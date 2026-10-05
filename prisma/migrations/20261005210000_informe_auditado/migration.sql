-- Un Informe puede estar Aprobado pero todavía no auditado externamente —
-- independiente del estado. Mientras auditado=false, el PDF muestra el
-- recuadro "INFORME PROVISORIO" en todas las hojas (ver informe-pdf.tsx).
-- Default false: todos los informes existentes (incluido el primero de
-- Bradenton) quedan sin auditar hasta que el operador lo marque.
ALTER TABLE "Informe" ADD COLUMN     "auditado" BOOLEAN NOT NULL DEFAULT false;
