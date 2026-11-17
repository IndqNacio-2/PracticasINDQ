-- Ejecutar explícitamente después de respaldar y revisar el entorno.
-- No copia MongoDB, no renumera clientes ni modifica datos existentes.
BEGIN;
-- Si existen duplicados históricos por mayúsculas, abortar sin fusionarlos.
-- Este índice protege también altas y cambios concurrentes desde la web.
CREATE UNIQUE INDEX IF NOT EXISTS clientes_correo_normalizado_unique
    ON webcobro.clientes (LOWER(BTRIM(correo)))
    WHERE correo IS NOT NULL AND BTRIM(correo) <> '';

CREATE TABLE IF NOT EXISTS webcobro.clientes_acceso_movil (
    cliente_id INTEGER PRIMARY KEY REFERENCES webcobro.clientes(id) ON DELETE RESTRICT,
    password_hash TEXT,
    token_version INTEGER NOT NULL DEFAULT 0,
    activacion_hash TEXT,
    activacion_expira TIMESTAMPTZ
);

-- Una baja invalida sesiones incluso si el cliente vuelve a activarse después.
-- Un cambio de correo invalida códigos temporales ya entregados.
CREATE OR REPLACE FUNCTION webcobro.invalidar_acceso_cliente_movil()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.activo IS DISTINCT FROM OLD.activo OR NEW.correo IS DISTINCT FROM OLD.correo THEN
        UPDATE webcobro.clientes_acceso_movil
           SET token_version = token_version + 1,
               activacion_hash = NULL, activacion_expira = NULL
         WHERE cliente_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS invalidar_acceso_movil ON webcobro.clientes;
CREATE TRIGGER invalidar_acceso_movil AFTER UPDATE OF activo, correo ON webcobro.clientes
    FOR EACH ROW EXECUTE FUNCTION webcobro.invalidar_acceso_cliente_movil();
COMMIT;