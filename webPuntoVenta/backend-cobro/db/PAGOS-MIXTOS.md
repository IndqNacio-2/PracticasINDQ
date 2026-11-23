# Pago mixto de Recepción

El modal de cobro de reservas reutiliza `PaymentModal` del POS: primero se
indica cuánto se aplica en efectivo y cuánto se recibe; después se elige
tarjeta o transferencia para el restante. La referencia es opcional.

El servidor valida el desglose contra el precio de la reserva bloqueada,
registra un solo cobro y guarda sus partes en `webcobro.pagos.pagos` (JSONB).
El cambio se calcula únicamente sobre la parte en efectivo. El ticket en
pantalla, la impresión del navegador y el ticket físico muestran ambas partes.

## Activación en la base

Se debe aplicar, con autorización y respaldo previo, el archivo
`backend-cobro/db/pagos-mixtos.sql` a la misma base PostgreSQL de Cobro.
Agrega la columna nullable `pagos` y permite `mixto` en el CHECK del método.
No cambia pagos históricos ni está incluido en el arranque automático.

La migración se aplicó con autorización el 23 de noviembre de 2026, después
de crear un respaldo completo en formato pg_dump y verificar su índice con
pg_restore. Se comprobó dentro de la transacción que los 17 pagos, 25 reservas
y 26 ventas conservaran su contenido anterior (excluyendo la columna nueva).
La columna `pagos` es JSONB y el CHECK ya permite `mixto`.
El respaldo permanece fuera de los archivos publicables, en el directorio
local `.tmp-unionapp-validacion/.git/respaldos-mixto-recepcion`.
En otras bases sin esta migración, un cobro mixto devuelve HTTP 409 sin
registrar el pago ni marcar la reserva como pagada. Los métodos individuales
conservan su INSERT anterior.

No se modifican ventas de membresías ni se combinan sus cortes con el POS.
Esta implementación corresponde al modal de cobro de reservaciones solicitado.

Pruebas aisladas: `node --test pruebas/*.test.cjs`. La base, la impresora y
los servidores habituales no se arrancan durante estas pruebas. Falta prueba
manual de un cobro mixto en navegador; no se creó un cobro real de prueba.