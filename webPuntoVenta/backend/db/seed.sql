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
    (2, 'P-002', 'Bebida energetica',
     'Bebida energizante con cafeina y vitaminas.',
     'Bebidas', 45, 25, 3, 5, 'active', 'bolt', '#FEF3C7'),
    (3, 'P-003', 'Bebida isotonica',
     'Bebida con electrolitos para hidratacion deportiva.',
     'Bebidas', 35, 19, 15, 6, 'active', 'local_drink', '#D1FAE5'),
    (4, 'P-004', 'Proteina de suero',
     'Suplemento de proteina de suero de leche, 1 kg.',
     'Suplementos', 850, 620, 8, 3, 'active', 'fitness_center', '#EDE9FE'),
    (5, 'P-005', 'Barra de proteina',
     'Barra energetica con 20 g de proteina.',
     'Botanas', 40, 21, 2, 5, 'active', 'nutrition', '#FEE2E2'),
    (6, 'P-006', 'Vaso mezclador',
     'Vaso mezclador de 600 ml con tapa de rosca.',
     'Accesorios', 120, 65, 0, 3, 'active', 'water_bottle', '#F3F4F6'),
    (7, 'P-007', 'Toalla deportiva',
     'Toalla de microfibra de secado rapido.',
     'Accesorios', 150, 80, 6, 3, 'active', 'dry_cleaning', '#FDF4FF'),
    (8, 'P-008', 'Playera deportiva',
     'Playera de entrenamiento con tecnologia dry-fit.',
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
-- Consulta de comprobacion (opcional)
-- =====================================================================

-- Para verificar que los productos se cargaron puedo ejecutar:
--   SELECT id, code, name, category, price, stock, status
--   FROM webpontoventa.products
--   ORDER BY id;
