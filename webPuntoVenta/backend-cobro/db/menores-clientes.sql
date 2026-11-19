-- Migración aditiva: ejecutar una vez en la base compartida, sin usar seed.sql.
BEGIN;
ALTER TABLE webcobro.clientes ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE;
ALTER TABLE webcobro.clientes ADD COLUMN IF NOT EXISTS nombre_tutor TEXT NOT NULL DEFAULT '';
ALTER TABLE webcobro.clientes ADD COLUMN IF NOT EXISTS clave_elector_tutor TEXT NOT NULL DEFAULT '';
ALTER TABLE webcobro.clientes ADD COLUMN IF NOT EXISTS estado_documentacion TEXT NOT NULL DEFAULT 'pendiente'
  CHECK (estado_documentacion IN ('pendiente', 'validada'));
COMMIT;