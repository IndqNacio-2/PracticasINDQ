-- Datos iniciales de la aplicación de cobro: los mismos clientes, clases,
-- reservaciones y empleados de ejemplo que traía el backend original.
-- Se puede ejecutar varias veces sin duplicar registros.

INSERT INTO webcobro.clientes (id, nombre, membresia, telefono) VALUES
    (1, 'Juan Pérez', 'Premium', '555-0101'),
    (2, 'María López', 'Básica',  '555-0102'),
    (3, 'Carlos Ruiz', 'Premium', '555-0103')
ON CONFLICT (id) DO UPDATE SET
    nombre    = EXCLUDED.nombre,
    membresia = EXCLUDED.membresia,
    telefono  = EXCLUDED.telefono;

INSERT INTO webcobro.clases (id, nombre, precio) VALUES
    (1, 'Spinning', 150),
    (2, 'Yoga',     120),
    (3, 'CrossFit', 200)
ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    precio = EXCLUDED.precio;

INSERT INTO webcobro.reservas (id, cliente, tipo, clase, hora, estado, precio) VALUES
    (1, 'Ana García',   'cliente',   'Yoga Vinyasa', '10:00', 'pendiente', 150),
    (2, 'Carlos López', 'cliente',   'CrossFit',     '10:30', 'pagado',    200)
ON CONFLICT (id) DO UPDATE SET
    cliente = EXCLUDED.cliente,
    tipo    = EXCLUDED.tipo,
    clase   = EXCLUDED.clase,
    hora    = EXCLUDED.hora,
    estado  = EXCLUDED.estado,
    precio  = EXCLUDED.precio;

INSERT INTO webcobro.empleados (codigo, nombre, rol) VALUES
    ('EMP-101', 'Ana Torres', 'entrenador'),
    ('EMP-102', 'Luis Gómez', 'recepción')
ON CONFLICT (codigo) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    rol    = EXCLUDED.rol;

-- Las tablas pagos y asistencias empiezan vacías: se llenan con el uso.

-- Ajusta las secuencias para que los registros nuevos continúen la
-- numeración aunque los ejemplos hayan traído identificadores fijos.
SELECT setval(pg_get_serial_sequence('webcobro.clientes', 'id'), COALESCE((SELECT MAX(id) FROM webcobro.clientes), 1), (SELECT COUNT(*) FROM webcobro.clientes) > 0);
SELECT setval(pg_get_serial_sequence('webcobro.clases', 'id'), COALESCE((SELECT MAX(id) FROM webcobro.clases), 1), (SELECT COUNT(*) FROM webcobro.clases) > 0);
SELECT setval(pg_get_serial_sequence('webcobro.reservas', 'id'), COALESCE((SELECT MAX(id) FROM webcobro.reservas), 1), (SELECT COUNT(*) FROM webcobro.reservas) > 0);
SELECT setval(pg_get_serial_sequence('webcobro.pagos', 'id'), COALESCE((SELECT MAX(id) FROM webcobro.pagos), 1), (SELECT COUNT(*) FROM webcobro.pagos) > 0);
SELECT setval(pg_get_serial_sequence('webcobro.asistencias', 'id'), COALESCE((SELECT MAX(id) FROM webcobro.asistencias), 1), (SELECT COUNT(*) FROM webcobro.asistencias) > 0);
