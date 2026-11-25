-- =====================================================================
-- Datos iniciales del sistema web de Punto de Venta
-- =====================================================================
--
-- Aqui cargo el catalogo con el que el sistema ya trabajaba en el
-- frontend (los 8 productos del archivo src/data.ts), para que cualquier
-- integrante del equipo tenga los mismos datos al levantar la base.
--
-- Guardo los mismos ids y codigos que usaba el frontend porque las
-- pantallas de Venta, Mermas y Reportes todavia los usan como referencia.
--
-- Las categorias (Bebidas, Suplementos, Botanas, Ropa y Accesorios) no van
-- en una tabla aparte: salen de la columna "category" de cada producto,
-- igual que en el frontend, donde CATEGORIES se construye a partir de los
-- productos y "Todos" es solo el filtro para verlos todos.
--
-- El archivo se puede ejecutar las veces que haga falta: si el producto ya
-- existe (por su codigo), actualizo sus datos en lugar de duplicarlo.
-- =====================================================================

-- Me coloco en el esquema de la aplicacion.
SET search_path TO webpontoventa;

-- Inserto los 8 productos iniciales con sus datos completos.
INSERT INTO products
    (id, code, name, description, category, price, cost,
     stock, minimum_stock, status, icon, bg_color)
VALUES
    (1, 'P-001', 'Agua 1 L',
     'Agua natural purificada de 1 litro.',
     'Bebidas', 25, 12, 48, 10, 'active', 'water_drop', '#DBEAFE'),
    (2, 'P-002', 'Bebida energética',
     'Bebida energizante con cafeína y vitaminas.',
     'Bebidas', 45, 25, 3, 5, 'active', 'bolt', '#FEF3C7'),
    (3, 'P-003', 'Bebida isotónica',
     'Bebida con electrolitos para hidratación deportiva.',
     'Bebidas', 35, 19, 15, 6, 'active', 'local_drink', '#D1FAE5'),
    (4, 'P-004', 'Proteína de suero',
     'Suplemento de proteína de suero de leche, 1 kg.',
     'Suplementos', 850, 620, 8, 3, 'active', 'fitness_center', '#EDE9FE'),
    (5, 'P-005', 'Barra de proteína',
     'Barra energética con 20 g de proteína.',
     'Botanas', 40, 21, 2, 5, 'active', 'nutrition', '#FEE2E2'),
    (6, 'P-006', 'Vaso mezclador',
     'Vaso mezclador de 600 ml con tapa de rosca.',
     'Accesorios', 120, 65, 0, 3, 'active', 'water_bottle', '#F3F4F6'),
    (7, 'P-007', 'Toalla deportiva',
     'Toalla de microfibra de secado rápido.',
     'Accesorios', 150, 80, 6, 3, 'active', 'dry_cleaning', '#FDF4FF'),
    (8, 'P-008', 'Playera deportiva',
     'Playera de entrenamiento con tecnología dry-fit.',
     'Ropa', 350, 190, 1, 2, 'inactive', 'apparel', '#ECFDF5')
-- Si el codigo ya existe, actualizo la fila en lugar de marcar error.
ON CONFLICT (code) DO UPDATE SET
    id = EXCLUDED.id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    price = EXCLUDED.price,
    cost = EXCLUDED.cost,
    stock = EXCLUDED.stock,
    minimum_stock = EXCLUDED.minimum_stock,
    status = EXCLUDED.status,
    icon = EXCLUDED.icon,
    bg_color = EXCLUDED.bg_color,
    updated_at = NOW();

-- Dejo la secuencia del id apuntando al valor mas alto, para que los
-- productos nuevos que se creen desde el sistema no repitan un id.
SELECT setval(
    pg_get_serial_sequence('webpontoventa.products', 'id'),
    (SELECT MAX(id) FROM webpontoventa.products)
);

-- =====================================================================
-- Mermas iniciales
-- =====================================================================
--
-- Cargo las cuatro mermas que estaban escritas en el frontend
-- (INITIAL_WASTE_RECORDS de src/data.ts) para que la pantalla de Mermas
-- muestre el mismo historial que ya tenia.
--
-- Las inserto directamente en la tabla y NO descuento existencias: los
-- productos ya vienen con la existencia que tiene el sistema hoy, o sea
-- que estas mermas ya estan consideradas en esos numeros. Si las
-- descontara otra vez, el inventario quedaria mas bajo que el real.
--
-- El costo de cada merma es el del producto en el catalogo, porque ese
-- costo es el que se usa para calcular la perdida en los reportes.

INSERT INTO waste_records
    (id, folio, product_id, quantity, reason, observations,
     unit_cost, created_at, registered_by)
VALUES
    (1, 'M-000001', 2, 1, 'damaged',
     'La lata presentó un golpe durante el acomodo.',
     25, TIMESTAMPTZ '2026-09-23 09:35:00-06', 'Edgar Rodríguez'),
    (2, 'M-000002', 5, 2, 'expired',
     'El producto superó su fecha recomendada de consumo.',
     21, TIMESTAMPTZ '2026-09-23 11:10:00-06', 'Edgar Rodríguez'),
    (3, 'M-000003', 1, 3, 'internal-use',
     'Productos utilizados durante un evento interno.',
     12, TIMESTAMPTZ '2026-09-23 13:20:00-06', 'Edgar Rodríguez'),
    (4, 'M-000004', 7, 1, 'lost',
     'No se encontró el producto durante el conteo.',
     80, TIMESTAMPTZ '2026-09-23 15:05:00-06', 'Edgar Rodríguez')
-- Si el folio ya existe, actualizo la fila en lugar de marcarla como repetida.
ON CONFLICT (folio) DO UPDATE SET
    id = EXCLUDED.id,
    product_id = EXCLUDED.product_id,
    quantity = EXCLUDED.quantity,
    reason = EXCLUDED.reason,
    observations = EXCLUDED.observations,
    unit_cost = EXCLUDED.unit_cost,
    created_at = EXCLUDED.created_at,
    registered_by = EXCLUDED.registered_by;

-- Dejo la secuencia de las mermas lista para el siguiente folio (M-000005).
SELECT setval(
    pg_get_serial_sequence('webpontoventa.waste_records', 'id'),
    (SELECT MAX(id) FROM webpontoventa.waste_records)
);

-- =====================================================================
-- Consulta de comprobacion (opcional)
-- =====================================================================

-- Para verificar que los productos se cargaron puedo ejecutar:
--   SELECT id, code, name, category, price, stock, status
--   FROM webpontoventa.products
--   ORDER BY id;
