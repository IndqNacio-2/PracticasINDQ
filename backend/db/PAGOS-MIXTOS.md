# Activación de pagos mixtos

El frontend y el backend incluyen pago mixto de dos o tres métodos: efectivo,
tarjeta y transferencia. Los pagos electrónicos se verifican externamente:
esta función no procesa cargos bancarios ni comprueba transferencias.

## Base de datos existente

Antes de desplegar el backend nuevo, respaldar la base y revisar/aplicar
`L:\trabajo\punto de venta\backend\db\pagos-mixtos.sql` por el procedimiento
administrativo habitual. El script no ha sido ejecutado por el agente.
No utilizar `db:setup`: ese comando también ejecuta semillas.

El script agrega la columna JSONB `payments`, permite `mixto` y completa
el desglose histórico a partir del método y total ya guardados. No cambia
existencias ni importes históricos. Revisar previamente si la instalación
utiliza restricciones personalizadas de `payment_method` distintas de
`sales_payment_method_check`.

El backend es compatible con el esquema anterior al listar ventas, registrar
pagos individuales y cerrar caja. Sin la columna `payments`, el pago mixto
se rechaza con HTTP 409 y un aviso para aplicar el script. No se realizan
migraciones automáticas. La columna se comprueba en cada venta, por lo que
una actualización posterior se detecta sin cachear el esquema anterior.

## Validación realizada

Pruebas sin conexiones reales, con repositorios y PostgreSQL simulados:
`L:\trabajo\punto de venta\pruebas\pagos-mixtos.test.cjs`.
Incluyen importes, cambio, rechazos, compatibilidad de métodos individuales,
corte, resumen y renderizado estático del modal/ticket.
No sustituyen una prueba interactiva en navegador, PostgreSQL de pruebas
ni impresora física. Validar esos tres puntos antes del uso operativo.