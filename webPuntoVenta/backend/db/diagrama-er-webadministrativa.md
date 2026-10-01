# Diagrama entidad-relacion del esquema webadministrativa

Generado automaticamente con el comando `npm run db:diagrama` a partir de
la base de datos real, no dibujado a mano.

- Tablas: 10
- Relaciones: 12

Para verlo: pega el bloque de abajo en https://mermaid.live, o abrelo con
una extension de Mermaid en el editor.

```mermaid
erDiagram
    %% Esquema: webadministrativa (10 tablas)

    clases {
        integer id PK
        varchar[80] nombre
        varchar[250] descripcion
        integer capacidad
        varchar[20] color
        integer entrenador_id
        varchar[10] estatus
        timestamp with time zone creado_en
    }

    clientes {
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

    horarios {
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

    membresias {
        integer id PK
        integer cliente_id
        varchar[12] tipo
        date fecha_inicio
        date fecha_fin
        numeric[10,2] precio
        varchar[10] estatus
        timestamp with time zone creado_en
    }

    movimientos {
        integer id PK
        integer producto_id
        varchar[10] tipo
        integer cantidad
        varchar[200] motivo
        integer usuario_id
        timestamp with time zone creado_en
    }

    productos {
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

    reservaciones {
        integer id PK
        integer cliente_id
        integer horario_id
        date fecha_reservacion
        varchar[12] estatus
        boolean asistencia_confirmada
        timestamp with time zone creado_en
        timestamp with time zone actualizado_en
    }

    usuarios {
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

    venta_detalle {
        integer id PK
        integer venta_id
        integer producto_id
        varchar[120] nombre_producto
        integer cantidad
        numeric[10,2] precio_unitario
        numeric[10,2] importe
    }

    ventas {
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

    usuarios ||--o{ clases : "entrenador_id (SET NULL)"
    clases ||--o{ horarios : "clase_id (CASCADE)"
    usuarios ||--o{ horarios : "entrenador_id (RESTRICT)"
    clientes ||--o{ membresias : "cliente_id (CASCADE)"
    productos ||--o{ movimientos : "producto_id (RESTRICT)"
    usuarios ||--o{ movimientos : "usuario_id (SET NULL)"
    clientes ||--o{ reservaciones : "cliente_id (RESTRICT)"
    horarios ||--o{ reservaciones : "horario_id (CASCADE)"
    productos ||--o{ venta_detalle : "producto_id (SET NULL)"
    ventas ||--o{ venta_detalle : "venta_id (CASCADE)"
    clientes ||--o{ ventas : "cliente_id (SET NULL)"
    usuarios ||--o{ ventas : "recepcionista_id (RESTRICT)"

```
