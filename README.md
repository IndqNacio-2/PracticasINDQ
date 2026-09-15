# sistemaReservacionClases - 6 Aplicaciones

Monorepo con 6 aplicaciones que comparten la misma base de datos
(PostgreSQL para datos sensibles, MongoDB para datos menos estrictos).

## Estructura

- `webAdministrativa/`, `webCobro/`, `webPuntoVenta/`, `webAsistencia/` : cada una con su propia API (backend/) y su frontend
- `movilClientes/`, `movilOperativa/` : apps Flutter (mobile/), SIN backend propio, consumen las 4 APIs de arriba
- `database/` : datos/inicializacion compartida
- `docker/` : plantillas de infraestructura (Dockerfile de backend)
- `docker-compose.yml` : levanta la BD compartida y, una vez descomentados, los 4 backends

Cada carpeta de app esta vacia por ahora; cada integrante agrega su
backend/frontend/proyecto Flutter dentro de la carpeta correspondiente,
en su propia rama. Cada app web ya trae un `.env.example` con su puerto
fijo asignado.

## Puertos fijos por app

| App | Puerto |
|-----|--------|
| webAdministrativa | 3001 |
| webAsistencia | 3004 |
| webCobro | 3002 |
| webPuntoVenta | 3003 |

## Convenciones de la base de datos compartida

Para evitar choques entre apps dentro de la misma BD:

- **Postgres**: cada app usa su propio schema (ej. `webadministrativa.*`,
  `webcobro.*`) en vez de crear tablas sueltas en `public`.
- **Mongo**: cada app prefija sus colecciones con el nombre de la app en
  minusculas (ej. `webcobro_pagos`, `webadministrativa_usuarios`).
- Ningun backend debe leer/escribir directamente en el schema o coleccion
  de otra app; si necesita datos de otra app, debe consumir su API.

## Como conectarse entre apps

- Los 4 backends web exponen su propia API en su puerto fijo (ver tabla).
- Las apps Flutter (`movilClientes`, `movilOperativa`) NO tienen backend
  propio: consumen las APIs de arriba usando las URLs definidas en su
  `.env.example`.
- CORS: cada backend trae `CORS_ORIGIN` en su `.env.example`; restringir
  a los origenes reales en vez de dejarlo abierto (`*`) antes de entregar
  el proyecto.
- Documentar los endpoints de cada API (Swagger/OpenAPI o Postman) queda
  a cargo de cada equipo dentro de su propia carpeta.

## Flujo de ramas

feature/webAdministrativa
feature/movilClientes
feature/movilOperativa
feature/webCobro
feature/webPuntoVenta
feature/webAsistencia

Cada integrante trabaja solo dentro de la carpeta de su app, en su propia rama,
y abre un Pull Request hacia `main` al terminar.

## Levantar el proyecto

# Solo la BD compartida:
docker-compose up postgres mongo

# BD + backends (una vez que existan y esten descomentados en docker-compose.yml):
docker-compose up --build
