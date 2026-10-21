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
`activo` o `inactivo`.

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
  "estatus": "activo"
}
```

En MongoDB se guarda tambien el nombre de la clase y del entrenador porque
en un documento no hay relaciones: se lee todo junto y mas rapido.

### 3. webadministrativa_productos  (catalogo)

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

### 4. webadministrativa_movimientos  (movimientos)

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