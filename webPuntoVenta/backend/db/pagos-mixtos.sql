-- Ejecutar explícitamente antes de utilizar esta versión del POS.
-- No elimina ventas ni modifica los importes históricos. No ejecuta semillas.
BEGIN;
ALTER TABLE webpontoventa.sales ADD COLUMN IF NOT EXISTS payments JSONB;
ALTER TABLE webpontoventa.sales DROP CONSTRAINT IF EXISTS sales_payment_method_check;
ALTER TABLE webpontoventa.sales ADD CONSTRAINT sales_payment_method_check
  CHECK (payment_method IN ('efectivo', 'tarjeta', 'transferencia', 'mixto'));
UPDATE webpontoventa.sales SET payments = jsonb_build_array(
  jsonb_build_object('method', payment_method, 'amount', total))
  WHERE payments IS NULL AND payment_method <> 'mixto';
COMMIT;