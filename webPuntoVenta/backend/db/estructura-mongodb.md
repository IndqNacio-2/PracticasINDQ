# Estructura de MongoDB (datos menos estrictos)

Este archivo **describe nada mas la estructura**, todavia no se implementa.
Sirve para tener claro que informacion se va a guardar en MongoDB cuando
toque ese paso.

## Por que MongoDB para estos datos

La actividad pide repartir la informacion asi:

- **PostgreSQL**: los datos sensibles y los que necesitan relacionarse
  (usuarios, clientes, membresias, reservaciones, ventas y su detalle).
  Ya quedaron en el archivo `esquema-completo.sql`.
- **MongoDB**: los datos menos estrictos, o sea los **catalogos** y los
  **movimientos**, porque su estructura cambia seguido y no necesita
  relaciones estrictas entre tablas.

## Convencion del equipo

Cada aplicacion prefija sus colecciones con el nombre de la aplicacion en
minusculas, para no chocar con las colecciones de las demas. Como estos
datos son del modulo administrativo, todas las colecciones empiezan con
`webadministrativa_`.

## Colecciones

### 1. webadministrativa_clases  (catalogo)

```json
{
  "_id": "66f1a2b3c4d5e6f7a8b9c0d1",
  "nombre": "Spinning",
  "descripcion": "Clase de bicicleta fija",
  "capacidad": 20,
  "color": "#10b981",
  "estatus": "activo",
  "entrenadorId": "66f1a2b3c4d5e6f7a8b9c0d2",
  "fechaCreacion": "2026-01-15T10:00:00.000Z"
}
```

Campos: `nombre` y `capacidad` obligatorios; `estatus` solo acepta
`activo` o `inactivo`. **La clase NO tiene hora fija**: la fecha y el
intervalo (`horaInicio`/`horaFin`) se programan en la coleccion de horarios.

### 2. webadministrativa_horarios  (catalogo, agenda)

```json
{
  "_id": "66f1a2b3c4d5e6f7a8b9c0d3",
  "idClase": "66f1a2b3c4d5e6f7a8b9c0d1",
  "nombreClase": "Spinning",
  "entrenadorId": "66f1a2b3c4d5e6f7a8b9c0d2",
  "nombreEntrenador": "Ana Torres",
  "fecha": "2026-02-10",
  "horaInicio": "07:00",
  "horaFin": "08:00",
  "capacidadTotal": 20,
  "capacidadDisponible": 12,
  "salon": "Salon A",
  "estatus": "activo",
  "idPlantilla": "66f1a2b3c4d5e6f7a8b9c0d9",
  "claveGeneracion": "66f1a2b3c4d5e6f7a8b9c0d9:2026-02-10",
  "origen": "plantilla"
}
```

En MongoDB se guarda tambien el nombre de la clase y del entrenador porque
en un documento no hay relaciones: se lee todo junto y mas rapido.

Reglas de la agenda (validadas en `horarios.routes.ts`):

- `fecha` (YYYY-MM-DD), `horaInicio` y `horaFin` (HH:MM) son obligatorios.
- La duracion minima de una sesion es de **30 minutos**
  (`horaFin - horaInicio >= 30`).
- Un entrenador no puede tener dos horarios que se solapen en la misma fecha
  (solapamiento de rango, excluyendo el propio horario al editar). Un horario
  sin `entrenadorId` puede coexistir con cualquiera.
- Tampoco puede haber dos horarios en la misma `salon` y el mismo intervalo.

### 3. webadministrativa_plantillas_horarios  (programacion semanal)

```json
{
  "_id": "66f1a2b3c4d5e6f7a8b9c0d9",
  "clave": "Force Room|Force Room|1|06:00|2026-10-27",
  "idClase": "66f1a2b3c4d5e6f7a8b9c0d1",
  "nombreClase": "Force Room",
  "entrenadorId": "",
  "nombreEntrenador": "Sin asignar",
  "diaSemana": 1,
  "horaInicio": "06:00",
  "horaFin": "07:00",
  "capacidadTotal": 15,
  "salon": "Force Room",
  "vigenteDesde": "2026-10-27",
  "vigenteHasta": "",
  "estatus": "activo"
}
```

`diaSemana` usa 0=domingo y 6=sabado. Cada regla activa genera sesiones
fechadas con una `claveGeneracion` unica (`idPlantilla:fecha`), de modo que el
proceso se puede repetir sin crear duplicados.

### 4. webadministrativa_productos  (catalogo)

```json
{
  "_id": "66f1a2b3c4d5e6f7a8b9c0d4",
  "nombre": "Proteina whey 1 kg",
  "descripcion": "Suplemento de chocolate",
  "precio": 850,
  "stock": 12,
  "categoria": "Suplementos",
  "estatus": "activo"
}
```

### 5. webadministrativa_movimientos  (movimientos)

```json
{
  "_id": "66f1a2b3c4d5e6f7a8b9c0d5",
  "idProducto": "66f1a2b3c4d5e6f7a8b9c0d4",
  "nombreProducto": "Proteina whey 1 kg",
  "tipo": "merma",
  "cantidad": 2,
  "fecha": "2026-02-10",
  "motivo": "Producto caducado"
}
```

`tipo` solo acepta `entrada`, `salida` o `merma`, y `cantidad` siempre va
en positivo.

## Comparacion con PostgreSQL

| Dato | PostgreSQL (esquema `webadministrativa`) | MongoDB (coleccion) |
|---|---|---|
| Clases | tabla `clases` | `webadministrativa_clases` |
| Horarios | tabla `horarios` | `webadministrativa_horarios` |
| Plantillas semanales | pendiente | `webadministrativa_plantillas_horarios` |
| Productos | tabla `productos` | `webadministrativa_productos` |
| Movimientos | tabla `movimientos` | `webadministrativa_movimientos` |
| Usuarios, clientes, membresias, reservaciones, ventas | tablas `usuarios`, `clientes`, `membresias`, `reservaciones`, `ventas`, `venta_detalle` | no van a MongoDB |

## Nota importante

Por ahora la informacion completa vive en **PostgreSQL**, porque asi lo pedi
en la actividad y porque es la version que ya se puede ejecutar. Cuando se
implemente MongoDB, esas cuatro colecciones van a quedar dentro de la base
de datos `punto_venta_documentos` del contenedor `punto-venta-mongodb`, y
los catalogos y movimientos se seguiran guardando tambien en PostgreSQL
hasta que se decida moverlos del todo.