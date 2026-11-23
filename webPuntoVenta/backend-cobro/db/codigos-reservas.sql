-- Conversión idempotente: conserva RSV como alias, sin tocar pagos ni identidad.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('webcobro-codigos-reserva'));
LOCK TABLE webcobro.reservas IN SHARE ROW EXCLUSIVE MODE;
ALTER TABLE webcobro.reservas ADD COLUMN IF NOT EXISTS codigo_anterior TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS reservas_codigo_anterior_idx
  ON webcobro.reservas(codigo_anterior) WHERE codigo_anterior IS NOT NULL;

DO $$
DECLARE prefijo TEXT;
BEGIN
  FOREACH prefijo IN ARRAY ARRAY['NU', 'PQ'] LOOP
    IF (SELECT count(*) FROM webcobro.reservas
        WHERE (CASE WHEN membresia_compra_id IS NULL THEN 'NU' ELSE 'PQ' END) = prefijo
        AND (codigo IS NULL OR codigo LIKE 'RSV-%')) >
       (SELECT count(*) FROM generate_series(0, 99999) AS n
        WHERE NOT EXISTS (SELECT 1 FROM webcobro.reservas
          WHERE codigo = prefijo || '-' || lpad(n::text, 5, '0'))) THEN
      RAISE EXCEPTION 'No hay suficientes códigos disponibles para %', prefijo;
    END IF;
    WITH pendientes AS (
      SELECT id, row_number() OVER (ORDER BY id) AS posicion
      FROM webcobro.reservas
      WHERE (CASE WHEN membresia_compra_id IS NULL THEN 'NU' ELSE 'PQ' END) = prefijo
        AND (codigo IS NULL OR codigo LIKE 'RSV-%')
    ), disponibles AS (
      SELECT prefijo || '-' || lpad(n::text, 5, '0') AS nuevo,
        row_number() OVER (ORDER BY n) AS posicion
      FROM generate_series(0, 99999) AS n
      WHERE NOT EXISTS (SELECT 1 FROM webcobro.reservas
        WHERE codigo = prefijo || '-' || lpad(n::text, 5, '0'))
    )
    UPDATE webcobro.reservas r
      SET codigo_anterior = COALESCE(r.codigo_anterior, r.codigo), codigo = d.nuevo
      FROM pendientes p JOIN disponibles d USING (posicion)
      WHERE r.id = p.id;
  END LOOP;
END $$;
COMMIT;