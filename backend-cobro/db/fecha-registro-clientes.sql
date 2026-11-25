BEGIN;
SET LOCAL lock_timeout = '5s';
-- No reconstruir ni inventar fechas históricas. Solo nuevas altas reciben la fecha.
ALTER TABLE webcobro.clientes ADD COLUMN IF NOT EXISTS fecha_registro TIMESTAMPTZ;
ALTER TABLE webcobro.clientes ALTER COLUMN fecha_registro SET DEFAULT CURRENT_TIMESTAMP;
COMMIT;