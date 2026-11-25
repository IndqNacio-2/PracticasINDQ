-- Aplicar manualmente después de revisar y respaldar la base. No ejecutado por este cambio.
-- No convierte validaciones históricas en copias entregadas: deben revisarse individualmente.
BEGIN;
ALTER TABLE webcobro.clientes ADD COLUMN IF NOT EXISTS documentos_menor JSONB NOT NULL
  DEFAULT '{"actaNacimiento":false,"ineTutor":false,"curp":false,"credencialEscolar":false}'::jsonb
  CHECK (jsonb_typeof(documentos_menor) = 'object');
COMMIT;