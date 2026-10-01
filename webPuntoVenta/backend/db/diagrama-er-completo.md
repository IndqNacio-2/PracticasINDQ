# Diagrama entidad-relacion de la aplicacion completa

Generado automaticamente con el comando `npm run db:diagrama` a partir de
la base de datos real, no dibujado a mano.

- Tablas: 21
- Relaciones: 17

Para verlo: pega el bloque de abajo en https://mermaid.live, o abrelo con
una extension de Mermaid en el editor.

```mermaid
erDiagram
    %% Aplicacion completa (webadministrativa, webpontoventa, webcobro) (21 tablas)

    webadministrativa_clases {
        integer id PK
        varchar[80] nombre
        varchar[250] descripcion
        integer capacidad
        varchar[20] color
        integer entrenador_id
        varchar[10] estatus
        timestamp with time zone creado_en
    }

    webadministrativa_clientes {
        integer id PK
        varchar[80] nombre
        varchar[80] apellidos
        varchar[150] correo
        varchar[255] contrasena_hash
        varchar[30] telefono
        varchar[20] codigo_acceso
        varchar[10] estatus
        varchar[255] avatar
        date fecha_nacimiento
        varchar[200] direccion
        date fecha_registro
        numeric[5,2] peso
        integer altura
        varchar[5] tipo_sangre
        text[] alergias
        text[] enfermedades
        text[] lesiones
        varchar[300] observaciones_salud
        varchar[15] nivel_actividad
        varchar[200] objetivo
        varchar[80] frecuencia_ejercicio
        text[] hobbies
        timestamp with time zone fecha_creacion
        timestamp with time zone fecha_actualizacion
    }

    webadministrativa_horarios {
        integer id PK
        integer clase_id
        integer entrenador_id
        date fecha
        time without time zone hora_inicio
        time without time zone hora_fin
        integer capacidad_total
        integer capacidad_disponible
        varchar[40] salon
        varchar[10] estatus
        timestamp with time zone creado_en
    }

    webadministrativa_membresias {
        integer id PK
        integer cliente_id
        varchar[12] tipo
        date fecha_inicio
        date fecha_fin
        numeric[10,2] precio
        varchar[10] estatus
        timestamp with time zone creado_en
    }

    webadministrativa_movimientos {
        integer id PK
        integer producto_id
        varchar[10] tipo
        integer cantidad
        varchar[200] motivo
        integer usuario_id
        timestamp with time zone creado_en
    }

    webadministrativa_productos {
        integer id PK
        varchar[120] nombre
        varchar[250] descripcion
        numeric[10,2] precio
        integer stock
        varchar[60] categoria
        varchar[10] estatus
        timestamp with time zone creado_en
        timestamp with time zone actualizado_en
    }

    webadministrativa_reservaciones {
        integer id PK
        integer cliente_id
        integer horario_id
        date fecha_reservacion
        varchar[12] estatus
        boolean asistencia_confirmada
        timestamp with time zone creado_en
        timestamp with time zone actualizado_en
    }

    webadministrativa_usuarios {
        integer id PK
        varchar[80] nombre
        varchar[80] apellidos
        varchar[150] correo
        varchar[255] contrasena_hash
        varchar[30] telefono
        varchar[20] codigo_acceso
        varchar[15] rol
        varchar[10] estatus
        varchar[255] avatar
        timestamp with time zone fecha_creacion
        timestamp with time zone fecha_actualizacion
    }

    webadministrativa_venta_detalle {
        integer id PK
        integer venta_id
        integer producto_id
        varchar[120] nombre_producto
        integer cantidad
        numeric[10,2] precio_unitario
        numeric[10,2] importe
    }

    webadministrativa_ventas {
        integer id PK
        varchar[20] folio
        integer cliente_id
        integer recepcionista_id
        timestamp with time zone fecha
        numeric[10,2] subtotal
        numeric[10,2] descuento
        numeric[10,2] total
        varchar[15] forma_pago
        varchar[10] estatus
    }

    webpontoventa_cash_closings {
        integer id PK
        varchar[20] folio
        timestamp with time zone closed_at
        integer sales_count
        numeric[10,2] total_sales
        numeric[10,2] cash_sales
        numeric[10,2] card_sales
        numeric[10,2] transfer_sales
        numeric[10,2] initial_fund
        numeric[10,2] expected_cash
        numeric[10,2] counted_cash
        numeric[10,2] difference
        varchar[80] registered_by
    }

    webpontoventa_products {
        integer id PK
        varchar[20] code
        varchar[120] name
        varchar[250] description
        varchar[60] category
        numeric[10,2] price
        numeric[10,2] cost
        integer stock
        integer minimum_stock
        varchar[10] status
        varchar[40] icon
        varchar[20] bg_color
        timestamp with time zone created_at
        timestamp with time zone updated_at
    }

    webpontoventa_sale_items {
        integer id PK
        integer sale_id
        integer product_id
        varchar[120] product_name
        numeric[10,2] unit_price
        integer quantity
        numeric[10,2] line_total
    }

    webpontoventa_sales {
        integer id PK
        varchar[20] folio
        timestamp with time zone sold_at
        numeric[10,2] subtotal
        numeric[10,2] discount
        numeric[10,2] total
        varchar[15] payment_method
        numeric[10,2] cash_received
        numeric[10,2] change_amount
        varchar[60] transfer_ref
        varchar[10] status
    }

    webpontoventa_waste_records {
        integer id PK
        varchar[20] folio
        integer product_id
        integer quantity
        varchar[20] reason
        varchar[300] observations
        numeric[10,2] unit_cost
        timestamp with time zone created_at
        varchar[80] registered_by
    }

    webcobro_asistencias {
        bigint id PK
        text codigo
        text nombre
        text tipo
        timestamp with time zone creado_en
    }

    webcobro_clases {
        integer id PK
        text nombre
        numeric[10,2] precio
    }

    webcobro_clientes {
        integer id PK
        text nombre
        text membresia
        text telefono
    }

    webcobro_empleados {
        text codigo PK
        text nombre
        text rol
    }

    webcobro_pagos {
        bigint id PK
        integer cliente_id
        text cliente_nombre
        numeric[10,2] monto
        timestamp with time zone creado_en
    }

    webcobro_reservas {
        integer id PK
        text cliente
        text clase
        text hora
        text estado
        numeric[10,2] precio
        text tipo
    }

    webadministrativa_usuarios ||--o{ webadministrativa_clases : "entrenador_id (SET NULL)"
    webadministrativa_clases ||--o{ webadministrativa_horarios : "clase_id (CASCADE)"
    webadministrativa_usuarios ||--o{ webadministrativa_horarios : "entrenador_id (RESTRICT)"
    webadministrativa_clientes ||--o{ webadministrativa_membresias : "cliente_id (CASCADE)"
    webadministrativa_productos ||--o{ webadministrativa_movimientos : "producto_id (RESTRICT)"
    webadministrativa_usuarios ||--o{ webadministrativa_movimientos : "usuario_id (SET NULL)"
    webadministrativa_clientes ||--o{ webadministrativa_reservaciones : "cliente_id (RESTRICT)"
    webadministrativa_horarios ||--o{ webadministrativa_reservaciones : "horario_id (CASCADE)"
    webadministrativa_productos ||--o{ webadministrativa_venta_detalle : "producto_id (SET NULL)"
    webadministrativa_ventas ||--o{ webadministrativa_venta_detalle : "venta_id (CASCADE)"
    webadministrativa_clientes ||--o{ webadministrativa_ventas : "cliente_id (SET NULL)"
    webadministrativa_usuarios ||--o{ webadministrativa_ventas : "recepcionista_id (RESTRICT)"
    webpontoventa_products ||--o{ webpontoventa_sale_items : "product_id (SET NULL)"
    webpontoventa_sales ||--o{ webpontoventa_sale_items : "sale_id (CASCADE)"
    webpontoventa_products ||--o{ webpontoventa_waste_records : "product_id (RESTRICT)"
    webcobro_empleados ||--o{ webcobro_asistencias : "codigo (RESTRICT)"
    webcobro_clientes ||--o{ webcobro_pagos : "cliente_id (RESTRICT)"

```
