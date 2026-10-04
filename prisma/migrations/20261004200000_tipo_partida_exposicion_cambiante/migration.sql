-- Un Tipo de Partida puede marcarse "exposicionCambiante": en vez de un Rol
-- fijo (Activo/Pasivo/Patrimonio Neto/Resultado), el motor de informes
-- decide cada período si el Rubro va al Activo o al Pasivo según el signo
-- de su saldo final (Debe = Activo, Haber = Pasivo) — ver
-- resolverTipoPartida en balance-oya-report.ts. Default false: no cambia
-- el comportamiento de ningún Tipo existente.
ALTER TABLE "TipoPartida" ADD COLUMN     "exposicionCambiante" BOOLEAN NOT NULL DEFAULT false;
