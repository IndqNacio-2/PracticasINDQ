# Diagrama entidad-relacion del esquema webpontoventa

Generado automaticamente con el comando `npm run db:diagrama` a partir de
la base de datos real, no dibujado a mano.

- Tablas: 5
- Relaciones: 3

Para verlo: pega el bloque de abajo en https://mermaid.live, o abrelo con
una extension de Mermaid en el editor.

```mermaid
erDiagram
    %% Esquema: webpontoventa (5 tablas)

    cash_closings {
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

    products {
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

    sale_items {
        integer id PK
        integer sale_id
        integer product_id
        varchar[120] product_name
        numeric[10,2] unit_price
        integer quantity
        numeric[10,2] line_total
    }

    sales {
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

    waste_records {
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

    products ||--o{ sale_items : "product_id (SET NULL)"
    sales ||--o{ sale_items : "sale_id (CASCADE)"
    products ||--o{ waste_records : "product_id (RESTRICT)"

```
