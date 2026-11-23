# Adaptación parcial de UnionApp — 23 de noviembre de 2026

Referencia revisada: `origin/UnionApp`, commit `ab9772f3f6e5d1f6de7fc7a609cc9ce85b75b74f`.
No se realizó un merge completo: se adaptaron consultas compatibles con la
arquitectura local. Los clientes, compras y reservas siguen en PostgreSQL;
los catálogos de clases, horarios y membresías conservan los modelos existentes.

## Consultas incorporadas

Prefijo del router: `/api/movil`. Cuando se monta Administración bajo `/admin`,
el prefijo externo es `/admin/api/movil`.

Todas requieren `Authorization: Bearer <token de cliente>` obtenido mediante
el login móvil existente. No admiten tokens de personal. Se comprueba cliente
activo y versión de token en cada solicitud. Las respuestas llevan `Cache-Control: no-store`.

| Método y ruta relativa | Resultado |
| --- | --- |
| GET `/clases` | Clases activas, sin información privada del entrenador. |
| GET `/horarios?desde=YYYY-MM-DD&hasta=YYYY-MM-DD` | Sesiones activas y visibles, con clase y entrenador activos; cupo calculado con reservas PostgreSQL. Por defecto, día actual del servidor; intervalo máximo de 31 días. Filtro opcional `idClase`. |
| GET `/membresias` | Catálogo activo existente. |
| GET `/membresias/mis-compras` | Contratos pagados del cliente autenticado y sus condiciones originales. No calcula cartera ni saldo de entradas. |
| GET `/reservaciones` | Reservaciones del cliente autenticado, incluidos sus estados históricos. |

Horarios, compras y reservaciones devuelven arreglos paginados mediante
`pagina` (1 por defecto, máximo 10000) y `limite` (50 por defecto, máximo 100).
No se acepta un identificador de cliente para consultar registros ajenos.
Los cupos son informativos: consultar un horario no garantiza un lugar.
Los códigos de reservación existentes `RSV-…` no se cambian por códigos `NU-…`.

## Alcance pendiente

- No se modificó la app móvil para consumir estas rutas; su integración requiere comprobar su contrato y URL base.
- No se incorporaron las escrituras de reservaciones, cancelación/reagenda, asistencia ni los apartados de membresías de UnionApp. Se conserva el flujo de Recepción existente.
- Un apartado sin pago no cabe en el esquema local de compras, que exige `pago_id`, fechas de vigencia y condiciones. Requiere un diseño adicional, no insertar compras ficticias.
- No se incorporaron los catálogos de salud, dashboard, cambios de menores ni otras pantallas de UnionApp.
- Las respuestas usan el contrato descrito aquí; no son una sustitución transparente de todos los endpoints MongoDB de UnionApp.
- No se ejecutaron migraciones, semillas, consultas contra datos reales ni servidores habituales.
- Las pruebas HTTP usan modelos y consultas simulados. Falta validación con base de pruebas y navegación móvil real.

## Pruebas aisladas

Desde la raíz del proyecto:

```text
node --test pruebas/pagos-mixtos.test.cjs pruebas/correcciones-integridad.test.cjs pruebas/endpoints-movil.test.cjs
```

El nuevo archivo cubre autenticación, revocación por versión, aislamiento por
identidad, catálogos activos, ocupación real simulada y validación de parámetros.