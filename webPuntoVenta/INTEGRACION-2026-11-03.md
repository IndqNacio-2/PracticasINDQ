# Integración selectiva — 3 de noviembre de 2026

## Ampliación posterior — Carlos `948c1a5` (03-nov-2026)

Commit exacto: `948c1a5ca0dc1f05902ec5d4198255541ea66de7`,
«Modificacion para los ajustes de inansistencia y retardos».
Consultado directamente en GitHub y descargados sus tres archivos modificados
dentro de `.tmp-integracion-20261103/carlos-948c1a5/`. Respaldo de archivos locales
en `.tmp-integracion-20261103/respaldo-948c1a5/`.

- Incorporado diseño del checador, hora de inicio y etiquetas de puntualidad,
  compatibilidad de historial y bloqueo del botón al marcar. Corregidas respuestas
  tardías para no mezclar personas al cambiar el código durante una petición.
- Incorporado únicamente el bloque visual KPI del dashboard; no se reemplazó
  el archivo completo ni se tocaron reservas, cobro, horarios, lista de espera o ticket.
- El backend original omitía `getTurnoHoy`, `clasificarAsistencia`, reglas y
  `turnoHoy`, además del esquema. Se adaptó en `backend-cobro/asistenciaService.js`
  con clasificación configurable por turno (sin asumir tolerancias por rol).
- Entradas de empleados: puntual antes del umbral de retardo, retardo desde ese
  umbral e inasistencia desde el umbral de falta. Salidas/socios sin clasificación;
  empleado sin turno: `sin_turno`. Se usa el reloj y día de PostgreSQL.
- Bloqueo transaccional por código evita marcas simultáneas. Se conserva antispam
  de 60 segundos sobre marcas reales. Falta automática no equivale a entrada física:
  no cambia el siguiente botón ni bloquea la llegada posterior del empleado.
- Cron opcional cada minuto: primer turno del día, una incidencia automática si
  venció el umbral y no hay entrada/incidencia hoy; sin recuperación de días pasados.

### Activación pendiente (NO ejecutada)

1. Autorizar y aplicar **solo** `backend-cobro/db/asistencia-turnos.sql` en un
   entorno acordado. Es aditiva e idempotente; no ejecutar `db:setup` para este cambio.
2. Configurar turnos de empleados existentes en `webcobro.turnos`: día 0=domingo
   hasta 6=sábado, hora local de inicio y umbrales en minutos (falta > retardo).
   No hay datos demo, seed ni nueva pantalla de gestión de turnos.
3. Confirmar la zona horaria de las sesiones PostgreSQL antes de activarlo;
   el día y las horas del turno se interpretan en esa zona. Validar en navegador.
4. Activar `ASISTENCIA_TURNOS_HABILITADOS=true`. Activar aparte
   `ASISTENCIA_FALTAS_AUTOMATICAS=true` solo si se autoriza escribir incidencias.
   Reiniciar el servicio con esos valores. `.env` real no modificado.

Por defecto ambos flags están apagados: el checador sigue funcionando sin migrar,
pero todavía no clasifica puntualidad ni genera faltas. No se arrancaron servicios,
no se ejecutó SQL contra bases reales y no se modificaron datos existentes.
No se soportan múltiples turnos diarios, retroactividad ni justificaciones de faltas.

### Verificación de esta ampliación

- `node --check serverWebCobro.js` y `node --check asistenciaService.js`: correctos.
- `node --test pruebas-asistencia.test.js pruebas-ticket.test.js pruebas-cobro-integracion.test.js`:
  17/17 correctas, con PostgreSQL simulado; no equivale a validar SQL contra PostgreSQL.
- Build Vite y typecheck frontend: correctos; persiste aviso previo de bundle >500 kB.

El informe inferior describe la integración anterior y se conserva como histórico.

## Fuentes verificadas

- Alexis: `2c201098c764c79da14f07e1c8fed93788ec542f` (29-oct-2026).
- Carlos: `85d06d4bd92c7176f407939a71efc0aa5a19c7f1` (29-oct-2026).
- Descarga directa del remoto `IndqNacio-2/PracticasINDQ`, sin tocar clones externos.

## Incorporado

- Catálogo de membresías de Alexis, integrado en la administrativa existente.
- Controladores y rutas protegidas, validaciones, baja lógica y seed explícito
  no destructivo. No hay carga automática de datos.
- Mejoras compatibles del login: normalizar correo y esperar validación de sesión.
- Servicio térmico de Carlos adaptado a TCP nativo, opcional y apagado por defecto.
  Se ejecuta después de confirmar el cobro y no condiciona su resultado.
- Correcciones pequeñas de typecheck preexistentes en ticket POS y sección JSX.

## Conservado sin reemplazar

- Login único, usuarios MongoDB y duración configurable de sesión.
- Horarios, programación semanal, excepciones, horizonte, cupo y lista de espera.
- Cobro transaccional, tarifas calculadas en servidor, folios y ticket de navegador.
- Asistencia actual: la pantalla de Carlos ya coincide con la copia local.

## Pendiente deliberadamente

- Conectar catálogo de membresías a contratación, cobro y derechos de clientes.
- Portar perfil profesional del entrenador (Alexis usa usuarios PostgreSQL).
- Adaptar reportes a PostgreSQL operativo, no a colecciones paralelas de MongoDB.
- Unificar backend móvil sin duplicar servicios ni perder reglas de horarios/cupo.
- Impresión física y flujo completo en navegador con datos reales.
- Impresión térmica TCP desde POS: no conectada; POS conserva navegador.

**Esto es una integración parcial y compatible, no una fusión completa de ramas.**
No hay garantía de regresión cero sin pruebas de extremo a extremo sobre un entorno
de pruebas autorizado. No se cambiaron dependencias, Docker ni esquemas existentes.

## Verificación reproducible sin datos reales

Desde `L:\trabajo\punto de venta`:

```powershell
npm.cmd run build
.\node_modules\.bin\tsc.cmd --noEmit
```

Desde `L:\trabajo\punto de venta\backend-administrativa`:

```powershell
npm.cmd run typecheck
npm.cmd run test:integracion
```

Desde `L:\trabajo\punto de venta\backend`:

```powershell
npm.cmd run typecheck
```

Desde `L:\trabajo\punto de venta\backend-cobro`:

```powershell
node --check serverWebCobro.js
node --check ticketService.js
node --test pruebas-ticket.test.js pruebas-cobro-integracion.test.js
```

No se ejecutaron migraciones, seeds ni operaciones contra bases reales. Los tests
HTTP usan modelos simulados; el test de impresora usa TCP en loopback. El gateway
no se arrancó porque activa mantenimiento de sesiones con posibles escrituras.
La advertencia de bundle Vite mayor a 500 kB existía antes de integrar.