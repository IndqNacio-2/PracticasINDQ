-- Migración aditiva: el ID y el historial CLI-<id> no cambian.
BEGIN;
ALTER TABLE webcobro.clientes ADD COLUMN IF NOT EXISTS codigo_usuario TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS clientes_codigo_usuario_unique
    ON webcobro.clientes (UPPER(BTRIM(codigo_usuario))) WHERE codigo_usuario IS NOT NULL;
CREATE OR REPLACE FUNCTION webcobro.validar_codigo_cliente()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.codigo_usuario := NULLIF(UPPER(BTRIM(NEW.codigo_usuario)), '');
    IF NEW.codigo_usuario = 'CLI-' || NEW.id::text THEN NEW.codigo_usuario := NULL; END IF;
    IF NEW.codigo_usuario IS NOT NULL AND (
        NEW.codigo_usuario !~ '^[A-Z0-9][A-Z0-9-]{2,29}$'
        OR NEW.codigo_usuario ~ '^[0-9]+$'
        OR NEW.codigo_usuario LIKE 'CLI-%'
        OR NEW.codigo_usuario LIKE 'EMP-%'
    ) THEN
        RAISE EXCEPTION 'Código de usuario inválido o reservado' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS validar_codigo_cliente ON webcobro.clientes;
CREATE TRIGGER validar_codigo_cliente BEFORE INSERT OR UPDATE OF codigo_usuario ON webcobro.clientes
    FOR EACH ROW EXECUTE FUNCTION webcobro.validar_codigo_cliente();
COMMIT;