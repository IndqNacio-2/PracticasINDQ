-- Copias de documentos entregadas por clientes menores de edad: acta de nacimiento,
-- INE del tutor, CURP y credencial escolar. Ejemplo: {"actaNacimiento": true, "ineTutor": false, ...}
-- Idempotente: se puede ejecutar más de una vez. Mientras no se aplique, el backend
-- ignora los documentos y solo conserva el estado de validación (estado_documentacion).
ALTER TABLE webcobro.clientes ADD COLUMN IF NOT EXISTS documentos_menor JSONB;
