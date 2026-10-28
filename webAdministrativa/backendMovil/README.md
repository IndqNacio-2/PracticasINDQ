# backend-clientes — API de la app móvil de clientes (GymFit)

API para la app de clientes (prototipo "App clientes"): ver las clases por día, reservar con el paquete o pagando en recepción, ver "Mis reservas" con su código QR, cancelar y reagendar.

Es un proyecto **separado** de la web administrativa:

- Tiene su propio puerto (`3005`), su propio secreto de tokens y su propio login de clientes. Un token de cliente no sirve en la API del personal, ni al revés.
- Usa la **misma base de Mongo** que la web administrativa y las mismas colecciones (`webadministrativa_clientes`, `_clases`, `_horarios`, `_reservaciones`). Así lo que el administrador crea en la web (clases, horarios, cupos) aparece en la app, y lo que reserva el cliente aparece en la web.
- No usa Postgres: el nombre del entrenador ya viene guardado en cada horario.

## Estructura

```
backend-clientes/
├─ src/
│  ├─ server.ts                  arranque, rutas y manejo de errores
│  ├─ lib/                       fecha.ts (zona del negocio), reglas.ts (reglas de negocio),
│  │                             vista.ts (formato de respuestas), validar.ts, codigo.ts, mongo.ts
│  ├─ middleware/                auth.ts (token de cliente), limitar.ts (límite de intentos)
│  ├─ models/                    cliente, clase, horario, reservacion
│  └─ routes/                    auth, perfil, clases, horarios, reservaciones
├─ Dockerfile, .env.example, package.json, tsconfig.json
```

## Puesta en marcha

1. Copia la carpeta como `movilClientes/backend` (junto a `webAdministrativa`) y crea el `.env` a partir de `.env.example`. **Usa un `CLIENTES_JWT_SECRET` distinto al `JWT_SECRET` de la web administrativa.**
2. Agrega el servicio al `docker-compose.yml` de la raíz (ajusta nombres si los tuyos son distintos):

```yaml
  movilclientes-backend:
    build:
      context: ./movilClientes/backend
    env_file: ./movilClientes/backend/.env
    ports:
      - "3005:3005"
    depends_on:
      - mongo
    networks:
      - PracticasINDQ
    restart: unless-stopped
```

3. `docker compose up -d --build movilclientes-backend` y revisa `http://localhost:3005/api/health`.

Sin Docker: `npm install`, luego `npm run dev` (con `MONGO_URI=mongodb://localhost:27017/sistema_reservacion_clases` en el `.env`).

## Cambios necesarios en la web administrativa

La API agrega unos campos opcionales a los documentos existentes. Para que la web administrativa también los conozca (y no los pierda al editar), agrégalos a sus modelos:

**`models/Clientes/cliente.ts`** — dentro de `membresiaSchema` y en `clienteSchema`:

```ts
// membresiaSchema (paquete de clases)
claseIncluida: { type: String },
clasesTotal: { type: Number },
clasesUsadas: { type: Number, default: 0 },

// clienteSchema (contraseña de la app; select:false evita que salga en las respuestas de la web)
passwordHash: { type: String, select: false },
```

**`models/Clases/clases.ts`** — precio de la clase suelta (si no existe se usa `PRECIO_CLASE_SUELTA`):

```ts
precio: { type: Number },
```

**`models/Reservaciones/reservacion.ts`**:

```ts
codigo: { type: String },
pagoTipo: { type: String, enum: ['paquete', 'recepcion'] },
monto: { type: Number, default: 0 },
reagendada: { type: Boolean, default: false },
fechaCancelacion: { type: String },
```

Las reservaciones creadas desde la web administrativa no tienen `codigo` (no tienen QR); las de la app sí.

## Variables de entorno

| Variable | Para qué |
|---|---|
| `PORT` | Puerto (3005) |
| `MONGO_URI` | Misma base que la web administrativa |
| `CLIENTES_JWT_SECRET` | Secreto de los tokens de cliente (obligatorio) |
| `JWT_EXPIRES_IN` | Duración del token (por defecto `30d`) |
| `APP_TZ` | Zona horaria del negocio (por defecto `America/Mazatlan`) |
| `PRECIO_CLASE_SUELTA` | Precio de una clase fuera del paquete (por defecto 180) |
| `CODIGO_PREFIJO` | Prefijo del código de reservación (por defecto `NU` → `NU-H2W7D`) |
| `AUTH_INTENTOS_MAX` | Intentos de login/registro por IP cada 15 min (por defecto 10) |

## Endpoints

Todos van bajo `/api`. Los de `auth` son públicos; el resto exige `Authorization: Bearer <token>`. Los errores siempre son `{ "error": "mensaje" }`.

| Método y ruta | Qué hace | Pantalla |
|---|---|---|
| `POST /auth/registro` | Crea la cuenta: `nombre, apellidos, fechaNacimiento (AAAA-MM-DD), correo, telefono, password, confirmarPassword, foto?` → `{ token, cliente }` | Registro |
| `POST /auth/login` | `{ correo, password }` → `{ token, cliente }` | Inicio de sesión |
| `POST /auth/activar-cuenta` | Para clientes dados de alta en recepción: `{ correo, codigoAcceso, password, confirmarPassword }` | Primer ingreso |
| `GET /me` | Nombre, iniciales, foto y membresía con el paquete ("Pilates · 12 clases", `restantes`, `porcentajeRestante` para el aro) | Encabezado y tarjeta de membresía |
| `PATCH /me` | Edita `telefono`, `foto`, `direccion` | Perfil |
| `PATCH /me/password` | `{ passwordActual, password, confirmarPassword }` | Perfil |
| `GET /clases` | Tipos de clase activos con precio (para los filtros Todas / Pilates / Yoga) | Reservar clase |
| `GET /horarios/dias?cantidad=14` | Tira de días (hoy incluido) con cuántas clases hay | Reservar clase |
| `GET /horarios?fecha=AAAA-MM-DD&clase=Pilates` | Clases del día: hora, entrenador, cupo (`ocupados/capacidad`, `nivelCupo`), `estado` (`disponible`/`llena`/`finalizada`), si va en el paquete o cuesta `precio`, y el `horarioAtencion` del día | Reservar clase |
| `GET /horarios/:id` | Hoja de confirmación: detalle, `pago` (paquete → "te quedarán N"; o paga en recepción) y las 4 `politicas` | Reservar clase |
| `POST /reservaciones` | `{ idHorario }` → reserva, descuenta lugar y (si aplica) un acceso del paquete, devuelve `codigo` para el QR y `accesosRestantes` | ¡Lugar reservado! |
| `GET /reservaciones?tipo=proximas\|historial` | `{ conteo, proximas, historial }` con `estado` (`proxima`/`asistio`/`no_asistio`/`cancelada`), `reagendada`, `puedeCancelar`, `puedeReagendar`, `penalizacion` | Mis reservas |
| `GET /reservaciones/:id` | Una reservación (el QR contiene `codigo`) | Ver QR |
| `POST /reservaciones/:id/cancelar` | Cancela (solo con 24 h o más) y libera el lugar | Mis reservas |
| `GET /reservaciones/:id/opciones-reagendar` | Hasta 6 horarios de la misma clase con lugar | Reagendar |
| `POST /reservaciones/:id/reagendar` | `{ idHorario }` — una sola vez y sin costo | Reagendar |

Ejemplo de `POST /reservaciones` (201):

```json
{
  "idReservacion": "6720…", "codigo": "NU-H2W7D", "clase": "Pilates",
  "entrenador": "Paola Ibarra", "fechaClase": "2026-10-30", "horaInicio": "19:00", "horaFin": "19:50",
  "estado": "proxima", "reagendada": false,
  "pago": { "tipo": "paquete", "monto": 0 },
  "puedeCancelar": true, "puedeReagendar": true, "penalizacion": false,
  "accesosRestantes": 6
}
```

## Reglas del prototipo que implementa

- Una clase se cobra con el paquete solo si el paquete está vigente, es de ese tipo de clase y quedan accesos; si no, se paga en recepción (`precio` de la clase o `PRECIO_CLASE_SUELTA`). El acceso se descuenta de forma atómica: nunca se pasa del total aunque se reserve dos veces al mismo tiempo.
- El último lugar de una clase lo gana una sola persona (descuento atómico del cupo); si algo falla se devuelven el lugar y el acceso.
- No se puede reservar una clase que ya empezó, llena o inactiva, ni reservar dos veces la misma clase.
- Cancelar: solo con 24 h o más; libera el lugar y **no** devuelve el acceso ni el pago.
- Reagendar: una sola vez, sin costo, solo a otro horario de la misma clase; conserva el código y no consume otro acceso.
- Una reservación pasada queda como `asistio` si recepción marcó `asistenciaConfirmada`, o `no_asistio` (con `penalizacion: true`) si no.

## Lo que no hace esta API (por diseño)

- **Confirmar la asistencia** (hasta 10 minutos antes) lo hace recepción desde la web administrativa al escanear el código; la API solo lo refleja.
- **La penalización** solo se marca (`penalizacion`); aplicarla (cobro, bloqueo) queda por definir.
- **Asignar o vender el paquete** (`claseIncluida`, `clasesTotal`, `clasesUsadas` en la membresía) corresponde a la app de cobro / web administrativa.
- **Notificaciones** (la campana) y las pantallas Inicio y Perfil aún no están diseñadas.
- Recuperación de contraseña.

## Pruebas

`npm test` ejecuta las pruebas de las reglas de negocio (fechas con zona horaria, 24 h, reagendar, paquete).
