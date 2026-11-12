# Propuesta de flujo — Clases, horarios y reservaciones

> Documento de análisis y diseño funcional.
>
> Fecha: 27-oct-2026.
>
> Alcance de este documento: proponer cómo unir **Clases** y **Horarios** en un
> solo módulo administrativo y cómo manejar una programación semanal fija que
> pueda modificarse sin romper las reservaciones.
>
> La Fase 1 de interfaz fue implementada el 27-oct-2026: existe el módulo visible
> **Clases y horarios**, reutiliza los flujos actuales y redirige las rutas
> anteriores. El 28-oct-2026 se agregó la edición de reglas semanales: el cambio
> se aplica a sesiones futuras libres y respeta las que ya tienen reservaciones.
>
> Decisiones confirmadas el 27-oct-2026: la duración mínima permitida para una
> sesión es de **30 minutos** y **Force Room / Reset Room son salas**, no clases.
> La programación operativa se tomó del prototipo móvil: Pilates y Yoga, con
> sesiones de 50 minutos. Open Gym solo indica que el gimnasio está abierto y
> no se maneja como clase ni como reservación.

---

## 1. Objetivo

Mejorar el flujo de reservaciones para que:

1. El gimnasio pueda registrar sus clases y su programación semanal fija.
2. Administración tenga una sola opción de menú llamada **Clases y horarios**.
3. Los horarios se repitan automáticamente cada semana, sin capturar cada fecha
   manualmente.
4. Una sesión específica pueda moverse, cancelarse o cambiar de entrenador sin
   alterar necesariamente las semanas siguientes.
5. Recepción y la futura aplicación móvil consulten sesiones reales por fecha.
6. Las reservaciones sigan apuntando a una sesión concreta y no solamente al
   nombre de una clase y una hora escrita como texto.

---

## 2. Lectura de la imagen proporcionada

La imagen muestra dos bloques de programación: **Force Room** y **Reset Room**.

### 2.1 Force Room

| Días | Horarios |
|---|---|
| Lunes a jueves | 06:00, 07:00, 08:00, 09:00 y 10:00 |
| Lunes a jueves | 11:00 a 17:00 — gimnasio abierto, sin clase reservable |
| Lunes a jueves | 17:00, 18:00 y 19:00 |
| Viernes | 06:00, 07:00, 08:00, 09:00 y 10:00 |
| Viernes | 11:00 a 17:00 — gimnasio abierto, sin clase reservable |
| Viernes | 17:00 y 18:00 |
| Sábado | 08:00, 09:00 y 10:00 |
| Domingo | 09:00 y 10:00 |

### 2.2 Reset Room

| Días | Horarios |
|---|---|
| Lunes a jueves | 06:00, 07:00, 08:00 y 09:00 |
| Lunes a jueves | 17:00, 18:00 y 19:00 |
| Viernes | 06:00, 07:00, 08:00, 09:00 y 10:00 |
| Viernes | 17:00 y 18:00 |
| Sábado | 08:00 y 09:00 |
| Domingo | 09:00 y 10:00 |

### 2.3 Interpretación operativa confirmada

La imagen inicial definió la disponibilidad de las salas y el prototipo móvil
aportó el catálogo reservable. La representación aplicada es:

1. **Force Room** y **Reset Room** son salas físicas.
2. **Pilates** se programa en Force Room, con capacidad 12.
3. **Yoga** se programa en Reset Room, con capacidad 10 y precio de $180.
4. Las clases guiadas duran 50 minutos.
5. Los entrenadores son Andrea Solís, Luis Herrera, Paola Ibarra y Diego Mora.
6. **Open Gym** representa el horario de apertura del gimnasio y no se guarda
   como clase, plantilla o sesión reservable.
7. La programación entra en vigor el 27-oct-2026.

`Force Room` y `Reset Room` ya no forman parte del catálogo de clases. Se
guardan únicamente en el campo `salon` de plantillas y sesiones.

---

## 3. Problema del flujo actual

Actualmente existen dos pantallas administrativas separadas:

- **Clases:** registra el catálogo con nombre, descripción, capacidad, precio,
  color, entrenador y estatus.
- **Horarios:** registra clase, entrenador, fecha, hora inicial, hora final,
  capacidad, sala y estatus.

El modelo actual de horario exige una `fecha` concreta. Esto funciona para una
sesión aislada, pero obliga a capturar manualmente cada día cuando el horario es
semanal y permanente.

Ejemplo del problema:

- Para registrar Force Room a las 06:00 de lunes a jueves durante tres meses se
  tendrían que crear decenas de horarios con fechas distintas.
- Si el horario de un solo martes cambia a las 07:30, no existe el concepto
  claro de “cambiar únicamente esta sesión”.
- Si se edita un horario que ya tiene reservaciones, se puede perder la relación
  entre lo que reservó el cliente y la sesión que finalmente se impartirá.
- Recepción actualmente busca horarios por una fecha exacta. Si no se crearon
  manualmente para esa fecha, la pantalla indica que no hay disponibilidad.

---

## 4. Solución recomendada

Usar tres conceptos relacionados:

1. **Clase o servicio:** qué se ofrece.
2. **Plantilla semanal:** cuándo se ofrece normalmente.
3. **Sesión:** la ocurrencia real de una fecha específica que se puede reservar.

La idea central es:

```text
Clase o servicio
      │
      ├── Plantilla semanal fija
      │       ├── lunes 06:00
      │       ├── martes 06:00
      │       ├── miércoles 06:00
      │       └── jueves 06:00
      │
      └── Sesiones concretas generadas por fecha
              ├── lunes 02-nov-2026 06:00
              ├── martes 03-nov-2026 06:00
              └── miércoles 04-nov-2026 06:00
```

La reservación debe relacionarse con la **sesión concreta**, no directamente
con la plantilla semanal.

### 4.1 Por qué no conviene unir todo en un solo registro

Aunque en la interfaz habrá un solo módulo, los datos no deben convertirse en
una sola entidad. Si cada horario repite nombre, descripción, precio y demás
datos de la clase:

- se duplica información;
- cambiar el precio o el nombre requiere actualizar muchos registros;
- aparecen diferencias entre horarios de la misma clase;
- se dificulta inactivar una clase completa;
- se complica consultar reportes por clase.

Por lo tanto, se recomienda **unificar la experiencia de usuario**, pero
mantener separados el catálogo y la programación en el modelo interno.

---

## 5. Un solo módulo administrativo: “Clases y horarios”

En el menú lateral se reemplazarían las opciones independientes **Clases** y
**Horarios** por una sola:

```text
Clases y horarios
```

Ruta sugerida:

```text
/administrativa/clases-horarios
```

Las rutas anteriores podrían redirigir temporalmente a la nueva ruta para no
romper accesos guardados:

```text
/administrativa/clases   → /administrativa/clases-horarios
/administrativa/horarios → /administrativa/clases-horarios
```

### 5.1 Estructura de la pantalla

La página tendría un encabezado y tres vistas internas:

#### Vista 1 — Agenda semanal

Es la vista principal. Debe mostrar columnas de lunes a domingo y filas por
hora. Cada bloque debe enseñar:

- nombre de clase o servicio;
- sala;
- hora de inicio y fin;
- entrenador;
- capacidad;
- estado;
- indicador de reservaciones cuando se esté viendo una semana concreta.

Acciones principales:

- **Nueva clase y horario**;
- **Agregar horario a una clase existente**;
- cambiar semana;
- filtrar por sala, clase, entrenador o estado;
- seleccionar un bloque para editarlo.

#### Vista 2 — Catálogo de clases

Lista compacta de clases y servicios disponibles. Cada tarjeta o fila mostraría:

- nombre;
- descripción;
- precio;
- capacidad predeterminada;
- entrenador predeterminado, si aplica;
- color identificador;
- estatus;
- cantidad de horarios semanales asociados.

Desde aquí se podrá:

- crear una clase;
- editar sus datos generales;
- activarla o inactivarla;
- abrir directamente su programación semanal.

#### Vista 3 — Excepciones y cambios

Lista de sesiones que no siguen la plantilla original:

- movida de hora;
- cambio de entrenador;
- cambio de sala;
- cancelada;
- sesión extraordinaria agregada manualmente.

Esto permite al personal identificar rápidamente qué cambió en una semana.

### 5.2 Diseño del modal principal

El botón **Nueva clase y horario** abriría un flujo de dos pasos dentro del
mismo modal o panel lateral.

#### Paso 1 — Datos de la clase

- Nombre de clase o servicio.
- Descripción.
- Precio.
- Capacidad predeterminada.
- Color.
- Estatus.
- Entrenador predeterminado opcional.

También debe existir la opción:

```text
Usar una clase existente
```

para no duplicar el catálogo al agregar más horarios.

#### Paso 2 — Programación semanal

- Sala.
- Entrenador para este horario.
- Días de la semana mediante selección múltiple.
- Hora de inicio.
- Hora de fin o duración.
- Fecha de inicio de vigencia.
- Fecha de fin opcional.
- Capacidad heredada de la clase, sin volver a capturarla en la programación.
- Visibilidad para reservaciones.
- Lista de espera habilitada o deshabilitada.
- Opción de agregar varios bloques antes de guardar.

Ejemplo:

```text
Días: lunes, martes, miércoles y jueves
Inicio: 06:00
Duración: 60 minutos
Sala: Force Room
Vigente desde: 02-nov-2026
```

Al guardar, el backend crea una plantilla interna por cada día seleccionado,
vinculadas por un mismo `serieId`. No se crean reglas manuales por fecha: las
sesiones fechadas se generan automáticamente desde esas plantillas.

### 5.3 Captura rápida de varios horarios

La programación de la imagen tiene muchas horas consecutivas. Capturarlas una
por una sería lento. El formulario debe ofrecer dos maneras:

#### A. Horas individuales

```text
06:00, 07:00, 08:00, 09:00 y 10:00
```

El sistema genera una sesión de 60 minutos por cada hora seleccionada.

#### B. Bloque continuo no reservable

```text
11:00 a 17:00 — gimnasio abierto
```

Este bloque es información operativa del horario de apertura. No genera clases,
plantillas, sesiones ni espacios reservables.

---

## 6. Cómo mover un horario

Al seleccionar una sesión de una fecha concreta, la interfaz debe preguntar el
alcance del cambio:

```text
¿Qué deseas modificar?

○ Solo esta sesión
○ Esta sesión y las siguientes
○ Toda la programación semanal
```

### 6.1 Solo esta sesión

Ejemplo: la clase del martes 3 de noviembre pasa de 06:00 a 07:30.

- Se crea una excepción para esa fecha.
- Las demás sesiones siguen a las 06:00.
- Las reservaciones existentes permanecen ligadas a la misma sesión.
- Los clientes afectados deben poder ser identificados para notificación.

### 6.2 Esta sesión y las siguientes

Ejemplo: desde el 9 de noviembre el horario cambia definitivamente.

- La plantilla anterior termina el 8 de noviembre.
- Se crea una nueva versión de la plantilla desde el 9 de noviembre.
- Las sesiones pasadas conservan su información histórica.
- Las futuras sesiones sin reservaciones adoptan el nuevo horario.
- Si ya existen reservaciones futuras afectadas, se debe advertir antes de
  confirmar y conservar una lista de clientes afectados.

### 6.3 Toda la programación semanal

Se usa cuando la plantilla se capturó incorrectamente y todavía no hay sesiones
realizadas ni reservaciones que deban conservarse.

Si existen reservaciones, el sistema no debe hacer un cambio silencioso. Debe
mostrar una advertencia y aplicar una estrategia segura de reprogramación.

---

## 7. Cancelación y eliminación

No se recomienda borrar físicamente sesiones que ya tienen reservaciones.

### 7.1 Sesión sin reservaciones

- Se puede eliminar o cancelar.
- Para conservar trazabilidad, es preferible marcarla como cancelada.

### 7.2 Sesión con reservaciones

- Solo se puede cancelar, no borrar.
- Debe conservarse la sesión original.
- Las reservaciones deben quedar identificadas como afectadas.
- Posteriormente se aplicarán las reglas de cancelación o reagendado definidas
  para clientes.

### 7.3 Inactivar una clase

Inactivar el catálogo de una clase debe:

- impedir crear nuevas plantillas;
- ocultarla de nuevas reservaciones;
- no borrar sesiones ni reservaciones históricas;
- pedir confirmación si existen sesiones futuras activas.

---

## 8. Modelo de datos propuesto

Los nombres son conceptuales y pueden adaptarse a las convenciones actuales.

### 8.1 Clase o servicio

Mantiene el propósito del modelo actual de clases:

```ts
interface Clase {
  idClase: string;
  nombre: string;
  descripcion: string;
  capacidadPredeterminada: number;
  precio: number;
  color: string;
  entrenadorPredeterminadoId?: string;
  estatus: "activo" | "inactivo";
}
```

Recomendación: el entrenador de la clase debe ser solo un valor predeterminado.
La asignación definitiva debe vivir en cada plantilla o sesión, porque un mismo
servicio puede ser impartido por personas distintas según día y hora.

### 8.2 Sala

Actualmente la sala es texto libre. Conviene convertirla en catálogo para
evitar variantes como `Force`, `Force room` y `FORCE ROOM`.

```ts
interface Sala {
  idSala: string;
  nombre: string;
  capacidadMaxima: number;
  estatus: "activo" | "inactivo";
}
```

Datos iniciales probables, pendientes de confirmación:

- Force Room.
- Reset Room.

### 8.3 Plantilla semanal

Representa la programación fija:

```ts
interface PlantillaHorario {
  idPlantilla: string;
  idClase: string;
  idSala: string;
  entrenadorId?: string;
  diasSemana: number[]; // 1=lunes ... 7=domingo
  horaInicio: string;
  horaFin: string;
  capacidad: number;
  vigenteDesde: string;
  vigenteHasta?: string;
  estatus: "activo" | "inactivo";
}
```

Una plantilla puede tener varios días cuando todos comparten los mismos datos.
Por ejemplo, lunes a jueves a las 06:00.

### 8.4 Sesión de clase

Representa lo que realmente ocurre en una fecha:

```ts
interface SesionClase {
  idSesion: string;
  idPlantilla?: string;
  idClase: string;
  idSala: string;
  entrenadorId?: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  capacidadTotal: number;
  estatus: "programada" | "cancelada" | "completada";
  tipo: "regular" | "extraordinaria" | "reprogramada";
}
```

Una sesión extraordinaria puede no tener `idPlantilla`.

### 8.5 Excepción de calendario

Puede guardarse como una sesión modificada o en una colección explícita:

```ts
interface ExcepcionHorario {
  idExcepcion: string;
  idPlantilla: string;
  fecha: string;
  accion: "mover" | "cancelar" | "cambiar_entrenador" | "cambiar_sala";
  horaInicioNueva?: string;
  horaFinNueva?: string;
  entrenadorIdNuevo?: string;
  idSalaNueva?: string;
  motivo?: string;
}
```

Para este proyecto, la implementación más sencilla puede ser materializar la
sesión y marcarla como reprogramada, siempre que se conserve el vínculo con la
plantilla y la información original para auditoría.

### 8.6 Reservación

La reservación debería evolucionar hacia:

```ts
interface Reservacion {
  idReservacion: string;
  idSesion: string;
  idCliente?: string;
  nombreCliente: string;
  tipoCliente: "cliente" | "visitante";
  estatus: "pendiente" | "pagado" | "asistido" | "cancelado";
  precioAplicado: number;
  fechaCreacion: string;
}
```

El nombre de clase, fecha y hora se pueden guardar también como instantánea
histórica si se necesita que un ticket antiguo no cambie cuando se edite el
catálogo. Sin embargo, la validación principal debe usar `idSesion`.

---

## 9. Generación de sesiones

Recepción necesita consultar horarios por una fecha exacta. Por ello existen
dos estrategias posibles.

### Estrategia A — Calcular las sesiones al consultar

Al pedir una fecha, el servidor busca las plantillas aplicables y combina sus
excepciones.

Ventaja:

- no se crean miles de documentos por anticipado.

Desventajas:

- reservar requiere materializar o identificar de forma estable la sesión;
- el manejo de cambios y concurrencia es más complejo.

### Estrategia B — Generar sesiones futuras

El servidor genera sesiones concretas para una ventana móvil, por ejemplo los
próximos 60 o 90 días.

Ventajas:

- recepción siempre obtiene sesiones reales por fecha;
- cada sesión tiene un identificador estable;
- las reservaciones, cupos y cambios son más simples;
- facilita reportes y asistencia.

Desventaja:

- requiere una tarea idempotente que genere las fechas faltantes.

### Recomendación

Para este proyecto recomiendo la **Estrategia B**, porque el sistema ya trabaja
con horarios fechados y el flujo de reservaciones necesita una ocurrencia real.

Proceso sugerido:

1. Al crear o editar una plantilla, generar sesiones para los próximos 90 días.
2. Ejecutar diariamente una tarea que mantenga siempre 90 días disponibles.
3. Usar una clave única por plantilla y fecha para no duplicar sesiones.
4. No sobrescribir sesiones que tengan reservaciones o una excepción manual.
5. Al cambiar “esta sesión y las siguientes”, cerrar la vigencia anterior y
   regenerar únicamente las sesiones futuras que sea seguro modificar.

---

## 10. Flujo de reservación propuesto

### 10.1 En Recepción

1. Elegir fecha.
2. Consultar sesiones activas de esa fecha.
3. Filtrar opcionalmente por sala.
4. Mostrar cada sesión con:
   - nombre de clase o servicio;
   - sala;
   - horario;
   - entrenador;
   - lugares disponibles;
   - precio;
   - estado.
5. Elegir cliente o visitante.
6. Confirmar la reservación.
7. El servidor valida nuevamente:
   - que la sesión exista;
   - que esté activa y no haya pasado;
   - que tenga cupo;
   - que el cliente no tenga duplicado;
   - que cumpla membresía y reglas de negocio.
8. Guardar la reservación con `idSesion`.

### 10.2 Cuando cambia una sesión reservada

Si administración mueve una sesión con clientes registrados:

1. Mostrar el número de reservaciones afectadas.
2. Solicitar motivo del cambio.
3. Mantener el mismo identificador de sesión cuando solo cambian hora, sala o
   entrenador.
4. Marcarla como reprogramada.
5. Conservar valores anteriores en una bitácora.
6. Dejar preparada la lista de clientes para notificación.

Mantener `idSesion` evita cancelar y recrear todas las reservaciones solo porque
cambió la hora.

### 10.3 Cuando se cancela una sesión reservada

1. Marcar la sesión como cancelada.
2. Impedir nuevas reservaciones.
3. Conservar las reservaciones existentes.
4. Marcar las reservaciones como afectadas o aplicar el flujo de cancelación
   definido por negocio.
5. Registrar quién canceló, cuándo y por qué.

### 10.4 Referencia funcional de la aplicación para clientes

El prototipo HTML proporcionado el 27-oct-2026 se toma únicamente como
**referencia funcional y visual** de la futura aplicación móvil de clientes.
No forma parte del alcance de implementación de este módulo administrativo y no
se debe copiar como una nueva aplicación web.

El prototipo confirma que el cliente necesita consumir sesiones concretas, no
solo una lista general de clases. La pantalla de disponibilidad muestra:

- calendario de días próximos;
- mes correspondiente a la fecha seleccionada;
- filtro por tipo de clase;
- horario de operación del día;
- hora de inicio;
- nombre de la clase;
- entrenador;
- indicación de clase incluida o no en el paquete;
- precio cuando no está incluida;
- lugares ocupados y disponibles;
- estado de sesión llena, finalizada o reservable.

Esto refuerza la propuesta de que la unidad pública y reservable sea la
**sesión fechada identificada con `idSesion`**.

### 10.5 Información requerida para mostrar una sesión al cliente

La consulta para la aplicación móvil debería devolver, como mínimo:

```ts
interface SesionDisponibleCliente {
  idSesion: string;
  idClase: string;
  nombreClase: string;
  descripcion?: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  duracionMinutos: number;
  idSala: string;
  nombreSala: string;
  entrenador: {
    idEntrenador: string;
    nombre: string;
    imagen?: string;
  };
  capacidadTotal: number;
  lugaresDisponibles: number;
  precio: number;
  incluidaEnPaquete: boolean;
  costoParaCliente: number;
  estatus: "disponible" | "llena" | "finalizada" | "cancelada";
}
```

`incluidaEnPaquete` y `costoParaCliente` dependen del cliente autenticado, su
paquete, vigencia y accesos restantes. No deben calcularse únicamente en la
interfaz ni deducirse por el nombre de la clase.

### 10.6 Reservación desde la aplicación del cliente

Flujo esperado según el prototipo:

1. El cliente inicia sesión.
2. Selecciona un día.
3. Consulta las sesiones disponibles de esa fecha.
4. Abre el detalle de una sesión.
5. Revisa entrenador, duración, cupo y forma de cobro.
6. Confirma la reservación.
7. El servidor valida cupo, paquete, vigencia, duplicados y reglas de negocio.
8. Se crea la reservación ligada a `idSesion`.
9. El servidor genera un código único de reservación.
10. La aplicación muestra el código y su representación QR.

El QR del prototipo es válido como referencia de experiencia, pero el contenido
real debe generarse en el servidor. No debe contener solamente un texto fácil
de inventar. Se recomienda que represente un código opaco o firmado que el
sistema pueda validar y relacionar con una reservación activa.

### 10.7 “Mis reservas” y estados requeridos

La aplicación separa **Próximas** e **Historial**. Cada reservación necesita
mostrar:

- fecha y hora;
- clase;
- entrenador;
- código de reservación;
- condición de pago o paquete;
- estado;
- acción para consultar el QR;
- acción para reagendar cuando todavía esté permitido;
- acción para cancelar cuando todavía esté permitido.

Estados visibles sugeridos:

| Estado interno | Texto para el cliente |
|---|---|
| `confirmada` | Confirmada |
| `reagendada` | Reagendada |
| `pagada` | Pagada |
| `asistida` | Asistió |
| `inasistencia` | No asistió |
| `cancelada_cliente` | Cancelada |
| `cancelada_gimnasio` | Cancelada por el gimnasio |
| `afectada_cambio` | Horario actualizado |

No conviene usar un único estado para representar pago, asistencia y situación
de la reservación. A futuro sería más claro separar:

```ts
estadoReserva: "confirmada" | "reagendada" | "cancelada_cliente" |
  "cancelada_gimnasio";
estadoPago: "incluida" | "pendiente" | "pagada" | "sin_costo";
estadoAsistencia: "pendiente" | "asistida" | "inasistencia";
```

### 10.8 Reagendado desde la aplicación

El prototipo confirma la regla del documento de requisitos: una reservación se
puede reagendar **una sola vez y sin costo**.

El flujo recomendado es:

1. Consultar alternativas de la misma clase o servicio.
2. Mostrar únicamente sesiones futuras, activas y con cupo.
3. No ofrecer la misma sesión de origen.
4. Confirmar el cambio mostrando la nueva fecha, hora y entrenador.
5. Ejecutar el cambio de manera transaccional:
   - bloquear temporalmente origen y destino;
   - volver a validar cupo del destino;
   - liberar el cupo de origen;
   - ocupar el cupo del destino;
   - conservar el mismo código o generar una nueva versión según la política;
   - marcar `reagendada = true` y registrar fecha, origen y destino.
6. Impedir un segundo reagendado.

La búsqueda de alternativas no debe limitarse a los siguientes 14 días solo
porque el prototipo usa esa cantidad como demostración. El rango final debe ser
una regla configurable.

### 10.9 Cancelación desde la aplicación

El prototipo aplica la regla de cancelar con al menos 24 horas de anticipación y
sin reembolso. El servidor, no el teléfono, debe decidir si la acción todavía
está permitida.

Al cancelar:

- se conserva el registro;
- se libera el cupo de la sesión;
- se registra quién canceló y cuándo;
- no se devuelve automáticamente el acceso ni el pago si la regla oficial
  establece que no hay reembolso;
- la reservación pasa al historial;
- el QR deja de ser válido.

Se debe confirmar si una clase incluida en paquete devuelve o no el acceso al
cancelarse con más de 24 horas. El prototipo no resuelve explícitamente esta
diferencia.

### 10.10 Efecto de cambios administrativos en la aplicación

Cuando Administración modifica una sesión, la aplicación del cliente debe
reflejar el cambio sin perder la reservación.

#### Cambio de hora, entrenador o sala

- La reservación conserva `idSesion`.
- El cliente ve los nuevos datos.
- La reservación se marca como afectada o actualizada.
- Se genera una notificación pendiente para el cliente.
- Se conserva una bitácora con los valores anteriores.

#### Cancelación por el gimnasio

- La sesión deja de aceptar reservaciones.
- Las reservaciones asociadas se marcan como canceladas por el gimnasio.
- Los QR quedan invalidados.
- Los clientes deben aparecer en la lista de afectados.
- Debe definirse si se devuelve acceso, saldo o derecho de reagendado.

#### Reducción de capacidad

- Nunca puede quedar por debajo de las reservaciones activas.
- El sistema administrativo debe bloquear el cambio y explicar cuántos lugares
  ya están ocupados.

### 10.11 Datos de demostración que no son reglas confirmadas

Los siguientes elementos del prototipo no deben convertirse automáticamente en
datos reales ni reglas de negocio:

- cliente “Mariana Ríos”;
- paquete “Pilates · 12 clases”;
- siete accesos restantes;
- clases Pilates y Yoga;
- entrenadores de demostración;
- precio fijo de $180;
- capacidades de 10 o 12 personas;
- rango visible de 14 días;
- horarios de operación declarados en el arreglo `HOURS`;
- confirmación de asistencia diez minutos antes;
- penalización genérica por inasistencia;
- duración de 50 minutos;
- códigos aleatorios generados únicamente en el navegador.

En particular, la referencia muestra sesiones de **50 minutos**. Esta duración
es válida porque la regla confirmada del sistema es:

- duración mínima permitida: **30 minutos**;
- duración concreta configurable mediante `horaInicio` y `horaFin`;
- las sesiones de 50 o 60 minutos son válidas siempre que no exista otra regla
  de negocio específica para la clase.

La validación de 30 minutos debe mantenerse coordinada en frontend, backend,
pruebas, migraciones y documentación.

### 10.12 Endpoints móviles que deberá soportar el diseño

Sin implementar todavía la aplicación Flutter, el modelo de clases y horarios
debe permitir posteriormente endpoints equivalentes a:

```text
GET  /api/movil/sesiones?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
GET  /api/movil/sesiones/:idSesion
GET  /api/movil/mis-reservaciones?grupo=proximas|historial
POST /api/movil/reservaciones
PATCH /api/movil/reservaciones/:id/reagendar
PATCH /api/movil/reservaciones/:id/cancelar
GET  /api/movil/reservaciones/:id/codigo
```

Los nombres definitivos pueden cambiar, pero las operaciones son necesarias.
Todos estos endpoints deben autenticar al cliente y obtener su identidad desde
la sesión o token; no deben aceptar libremente otro `idCliente` enviado por la
aplicación.

---

## 11. Validaciones necesarias

### Clase

- Nombre obligatorio.
- Precio igual o mayor a cero.
- Capacidad predeterminada mayor a cero.
- No duplicar nombres activos sin advertencia.

### Plantilla y sesión

- Días de semana válidos.
- Hora de fin posterior a la hora de inicio.
- Duración mínima de 30 minutos.
- Capacidad no mayor que la capacidad máxima de la sala.
- La sala no puede tener dos sesiones solapadas.
- El entrenador no puede tener dos sesiones solapadas.
- La vigencia final no puede ser anterior a la inicial.
- No generar duplicados para la misma plantilla y fecha.
- No reducir la capacidad por debajo del número de reservaciones activas.

### Cambio de horario

- No mover una sesión a una hora pasada.
- Volver a validar sala y entrenador.
- Advertir si existen reservaciones.
- No modificar silenciosamente el historial de sesiones ya impartidas.

### Reservación

- La sesión debe existir y estar disponible.
- El cupo se valida en el servidor.
- Una cancelación debe liberar cupo.
- La misma persona no puede reservar dos veces la misma sesión.
- Se debe usar el precio del servidor, no el enviado por el navegador.
- La identidad del cliente debe salir de su sesión autenticada.
- El código de reservación debe ser único y validable por el servidor.
- Un QR cancelado, usado indebidamente o perteneciente a otra reservación debe
  rechazarse.
- El reagendado debe ejecutarse de forma transaccional para no perder ni duplicar
  cupos.
- Las reglas de anticipación deben calcularse con la zona horaria oficial del
  gimnasio, no con la hora configurable del dispositivo del cliente.

---

## 12. Permisos sugeridos por rol

| Acción | Administrador | Recepción | Entrenador |
|---|---:|---:|---:|
| Consultar agenda | Sí | Sí | Sí |
| Crear clase | Sí | Opcional | No |
| Editar datos de clase | Sí | Opcional | No |
| Crear plantilla semanal | Sí | Opcional | No |
| Mover una sesión | Sí | Opcional | Solo propia, si negocio lo permite |
| Cancelar una sesión | Sí | Opcional | No o solo propia con autorización |
| Consultar reservados | Sí | Sí | Solo sus sesiones |

La decisión final sobre permisos de recepción y entrenadores debe confirmarse
con el responsable del gimnasio. La interfaz no debe mostrar botones que el rol
no pueda utilizar.

---

## 13. Propuesta para cargar la programación de la imagen

No se recomienda crear manualmente una fila por fecha. Se crearían reglas
semanales agrupadas. Las sesiones de 60 minutos descritas en esta sección son
una propuesta para esta parrilla concreta; no cambian el mínimo general de
30 minutos y pueden ajustarse si se confirma otra duración para una clase.

### 13.1 Force Room

#### Lunes a jueves

- Horas individuales de 60 minutos: 06:00, 07:00, 08:00, 09:00 y 10:00.
- Gimnasio abierto de 11:00 a 17:00, sin generar sesiones reservables.
- Horas individuales de 60 minutos: 17:00, 18:00 y 19:00.

#### Viernes

- Horas individuales de 60 minutos: 06:00, 07:00, 08:00, 09:00 y 10:00.
- Gimnasio abierto de 11:00 a 17:00, sin generar sesiones reservables.
- Horas individuales de 60 minutos: 17:00 y 18:00.

#### Sábado

- Horas individuales de 60 minutos: 08:00, 09:00 y 10:00.

#### Domingo

- Horas individuales de 60 minutos: 09:00 y 10:00.

### 13.2 Reset Room

#### Lunes a jueves

- Horas individuales de 60 minutos: 06:00, 07:00, 08:00 y 09:00.
- Horas individuales de 60 minutos: 17:00, 18:00 y 19:00.

#### Viernes

- Horas individuales de 60 minutos: 06:00, 07:00, 08:00, 09:00 y 10:00.
- Horas individuales de 60 minutos: 17:00 y 18:00.

#### Sábado

- Horas individuales de 60 minutos: 08:00 y 09:00.

#### Domingo

- Horas individuales de 60 minutos: 09:00 y 10:00.

### 13.3 Forma recomendada de seed

El seed debe ser idempotente y usar una clave de negocio estable, por ejemplo:

```text
clase + sala + días + horaInicio + vigenteDesde
```

Si la plantilla ya existe, el seed no debe duplicarla.

**Estado corregido al 28-oct-2026:** la carga mantiene 40 reglas semanales de
Pilates y Yoga y 513 sesiones fechadas hasta el 24-ene-2027. Open Gym fue
retirado porque representa la apertura general del gimnasio, no una clase.

---

## 14. Cambios técnicos esperados en una implementación futura

### Frontend administrativo

- Crear una página unificada `ClasesHorariosPage`.
- Reemplazar dos elementos del sidebar por uno.
- Agregar agenda semanal.
- Mantener una vista de catálogo dentro de la misma página.
- Crear formulario de programación recurrente.
- Agregar diálogo para elegir alcance al editar.
- Mostrar advertencia de reservaciones afectadas.
- Mantener redirecciones desde las rutas anteriores.

### Backend administrativo

- Mantener el catálogo de clases.
- Agregar catálogo de salas o validar salas contra una lista administrable.
- Crear modelo y rutas de plantillas semanales.
- Evolucionar el horario fechado actual a sesión concreta.
- Generar sesiones futuras de forma idempotente.
- Agregar validaciones de solapamiento para plantillas y sesiones.
- Evitar borrar sesiones con reservaciones.
- Agregar consulta de sesiones por rango de fechas, sala, entrenador y clase.

### Backend de Cobro

- Cambiar la creación de reservación para recibir `idSesion`.
- Dejar de identificar el horario únicamente con nombre, fecha y hora.
- Consultar precio, capacidad y estado usando la sesión y su clase.
- Mantener temporalmente compatibilidad con el formato actual durante la
  migración, si es necesario.

### API para la aplicación móvil de clientes

- Consultar sesiones por rango de fechas.
- Filtrar por clase, sala y disponibilidad.
- Calcular si la sesión está incluida en el paquete del cliente.
- Crear la reservación por `idSesion`.
- Listar próximas reservaciones e historial.
- Reagendar una sola vez.
- Cancelar aplicando la anticipación oficial.
- Entregar y validar el código de reservación/QR.
- Exponer cambios o cancelaciones administrativas que afecten al cliente.
- Preparar notificaciones sin acoplarlas a la pantalla administrativa.

### Base de reservaciones

- Agregar `sesion_id` a las reservaciones.
- Migrar las reservaciones futuras que puedan relacionarse de manera inequívoca.
- Conservar las reservaciones históricas antiguas aunque no sea posible
  relacionarlas automáticamente.
- Crear índices para sesión, cliente y estado.

---

## 15. Migración segura desde el modelo actual

La implementación debe hacerse por etapas para no romper Cobro.

### Fase 1 — Unificar únicamente la interfaz

- ~~Crear el módulo visible **Clases y horarios**.~~ ✅ Implementado 27-oct-2026.
- ~~Reutilizar temporalmente los endpoints actuales de clases y horarios.~~ ✅
- ~~Mantener los horarios por fecha mientras se construye la recurrencia.~~ ✅
- ~~Redirigir las rutas antiguas.~~ ✅

### Fase 2 — Agregar plantillas semanales

- ~~Crear el modelo de plantilla.~~ ✅ Implementado 27-oct-2026.
- ~~Permitir representar días y horas recurrentes.~~ ✅ El endpoint de creación
  acepta varios días y crea una serie vinculada; falta conectarlo al formulario.
- ~~Generar horarios fechados compatibles con el endpoint actual.~~ ✅ Ventana de
  56 días para nuevas series sin fecha final, con `idPlantilla`,
  `claveGeneracion` única y `origen: plantilla`.
- ~~Cobro continúa consultando horarios por fecha sin romperse.~~ ✅ 18/18 pruebas
  E2E de reservaciones y 48/48 de horarios.

### Fase 3 — Convertir horarios en sesiones identificables

- Garantizar que cada ocurrencia tenga `idSesion`.
- Actualizar Cobro para reservar por ese identificador.
- Mantener nombre, fecha y hora en las respuestas para mostrar la información.

### Fase 4 — Excepciones y cambios con reservaciones

- Implementar “solo esta sesión”, “esta y las siguientes” y “toda la serie”.
- Agregar bitácora de cambios.
- Mostrar clientes afectados.

### Fase 5 — Carga de la programación oficial

- Confirmar precios, capacidades y entrenadores definitivos.
- ~~Crear seed idempotente.~~ ✅ `npm run db:cargar-programacion`.
- ~~Generar sesiones futuras.~~ ✅ 90 días desde el 27-oct-2026.
- ~~Validar el flujo completo en Administración y Cobro.~~ ✅ Typecheck, build y
  suites E2E correctas.

---

## 16. Casos de prueba principales

1. Crear una clase y asignarle lunes a jueves a las 06:00.
2. Ver las sesiones generadas en varias semanas.
3. Reservar una sesión desde Cobro.
4. Comprobar que el cupo disminuye solo en esa sesión.
5. Mover una sesión sin reservaciones.
6. Mover una sesión con reservaciones y conservarlas.
7. Cambiar toda la serie desde una fecha futura.
8. Cancelar una sola fecha sin cancelar las demás.
9. Evitar el solapamiento de sala.
10. Evitar el solapamiento de entrenador.
11. Evitar reducir capacidad por debajo de los lugares ocupados.
12. Inactivar una clase con sesiones futuras.
13. Crear una sesión extraordinaria que no pertenezca a una plantilla.
14. Confirmar que el horario de apertura no aparezca como clase reservable.
15. Confirmar que una cancelación libera cupo.
16. Confirmar que una reservación histórica conserva clase, precio, fecha y hora.
17. Consultar sesiones móviles por un rango de fechas.
18. Mostrar correctamente si una sesión está incluida en el paquete del cliente.
19. Reservar desde móvil usando `idSesion`, sin aceptar un precio manipulado.
20. Generar un código único y validar su QR.
21. Reagendar una vez y bloquear un segundo intento.
22. Reagendar concurrentemente cuando queda un solo lugar y aceptar únicamente
    una operación.
23. Cancelar con más de 24 horas y liberar el cupo.
24. Rechazar la cancelación cuando faltan menos de 24 horas.
25. Invalidar el QR después de cancelar.
26. Reflejar en “Mis reservas” un cambio de hora hecho en Administración.
27. Reflejar una cancelación hecha por el gimnasio y listar al cliente afectado.
28. Verificar los cálculos con la zona horaria oficial del gimnasio.

---

## 17. Decisiones que deben confirmarse antes de implementar

1. ¿Force Room y Reset Room son salas, clases, paquetes o membresías?
2. ¿Qué clases específicas se imparten en cada hora?
3. ¿Cuál es la duración concreta de cada clase, respetando el mínimo confirmado
   de 30 minutos?
4. ¿Cuál es la capacidad de cada sala?
5. ¿Qué entrenador corresponde a cada horario?
6. ¿Desde qué fecha inicia la programación?
7. ¿La programación tiene fecha de término?
8. ¿Recepción puede crear o mover horarios, o solo el administrador?
9. ¿Un entrenador puede modificar sus propias sesiones?
10. ¿Qué debe ocurrir con clientes ya reservados cuando cambia la hora?
11. ¿La regla de confirmar asistencia diez minutos antes es oficial?
12. ¿Cuál es la penalización exacta por inasistencia?
13. ¿Al cancelar a tiempo se devuelve un acceso del paquete?
14. ¿El código se conserva o cambia después de reagendar?
15. ¿Cuál es el rango máximo para consultar y reagendar sesiones?
16. ¿Qué zona horaria oficial debe usar el gimnasio?
17. ¿Cómo se notificará al cliente cuando Administración mueva o cancele una
    sesión?

---

## 18. Recomendación final

La mejor solución no es guardar la hora dentro de la clase ni crear manualmente
todos los días del calendario. La propuesta recomendada es:

1. **Un solo módulo visible:** `Clases y horarios`.
2. **Catálogo separado internamente:** define qué se ofrece.
3. **Plantilla semanal:** define el horario fijo y su vigencia.
4. **Sesión fechada:** es la unidad real de cupo, reservación y asistencia.
5. **Excepciones:** permiten mover o cancelar una fecha sin alterar toda la serie.
6. **Reservación por `idSesion`:** evita ambigüedad y mantiene la relación aunque
   cambien hora, entrenador o sala.
7. **Generación anticipada de 90 días:** conserva compatibilidad con el flujo
   actual que consulta horarios por fecha.

Con este enfoque, el gimnasio captura una sola vez la programación de la imagen,
puede cambiar horarios cuando sea necesario y conserva correctamente cupos,
reservaciones, asistencia e historial.
