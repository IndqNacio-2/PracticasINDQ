# Diagrama entidad-relacion del esquema webcobro

Generado automaticamente con el comando `npm run db:diagrama` a partir de
la base de datos real, no dibujado a mano.

- Tablas: 6
- Relaciones: 2

Para verlo: pega el bloque de abajo en https://mermaid.live, o abrelo con
una extension de Mermaid en el editor.

```mermaid
erDiagram
    %% Esquema: webcobro (6 tablas)

    asistencias {
        bigint id PK
        text codigo
        text nombre
        text tipo
        timestamp with time zone creado_en
    }

    clases {
        integer id PK
        text nombre
        numeric[10,2] precio
    }

    clientes {
        integer id PK
        text nombre
        text membresia
        text telefono
    }

    empleados {
        text codigo PK
        text nombre
        text rol
    }

    pagos {
        bigint id PK
        integer cliente_id
        text cliente_nombre
        numeric[10,2] monto
        timestamp with time zone creado_en
    }

    reservas {
        integer id PK
        text cliente
        text clase
        text hora
        text estado
        numeric[10,2] precio
        text tipo
    }

    empleados ||--o{ asistencias : "codigo (RESTRICT)"
    clientes ||--o{ pagos : "cliente_id (RESTRICT)"

```
