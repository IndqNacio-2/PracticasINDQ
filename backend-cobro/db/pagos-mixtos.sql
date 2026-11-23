-- Aplicación manual autorizada. No modifica pagos históricos.
BEGIN;
ALTER TABLE webcobro.pagos ADD COLUMN IF NOT EXISTS pagos JSONB;
ALTER TABLE webcobro.pagos DROP CONSTRAINT IF EXISTS pagos_metodo_pago_check;
ALTER TABLE webcobro.pagos ADD CONSTRAINT pagos_metodo_pago_check
    CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'transferencia', 'mixto'));
COMMIT;