# Guía de diseño de `recepcion-demo.html`

> Documento local de referencia para trasladar el lenguaje visual del prototipo de Recepción al módulo de Punto de Venta.
>
> Archivo fuente analizado: `L:\trabajo\punto de venta\recepcion-demo.html`
>
> Este documento describe la interfaz visual; no documenta las reglas de negocio ni propone copiar los datos de demostración.

---

## 1. Objetivo

El objetivo es utilizar `recepcion-demo.html` como referencia visual para rediseñar el Punto de Venta, especialmente su paleta de colores, sin perder consistencia entre pantallas y componentes.

La adaptación debe conservar:

- fondos cálidos y neutros;
- superficies blancas para tarjetas y paneles;
- navegación oscura de alto contraste;
- acento verde lima para acciones y estados destacados;
- bordes suaves y radios amplios;
- jerarquía tipográfica clara;
- estados semánticos diferenciados;
- controles compactos, pero con áreas de interacción cómodas;
- uso moderado de sombras;
- apariencia limpia, moderna y orientada a operación diaria.

---

## 2. Identidad visual general

### 2.1 Estilo

El diseño combina una base neutral cálida con una navegación oscura y un acento verde lima. La interfaz evita colores saturados en grandes superficies: los colores fuertes aparecen principalmente en acciones, indicadores y mensajes.

Características principales:

- **Fondo general:** gris beige muy claro.
- **Tarjetas:** blancas.
- **Texto principal:** negro carbón, no negro puro.
- **Texto secundario:** gris medio.
- **Texto auxiliar:** gris claro.
- **Acento principal:** verde lima.
- **Navegación:** negro carbón y gris oscuro.
- **Éxito:** verde.
- **Advertencia:** naranja/amarillo.
- **Error:** rojo.
- **Información:** azul o violeta suave.

### 2.2 Principios que deben aplicarse al Punto de Venta

1. Usar el verde lima para acciones prioritarias, selección activa y elementos que necesitan atención positiva.
2. Usar negro carbón para acciones de confirmación fuertes y navegación principal.
3. Evitar bordes negros permanentes; usar bordes neutros y oscurecerlos solo en selección o foco.
4. Mantener tarjetas blancas sobre un fondo ligeramente cálido.
5. Usar fondos pastel para estados en lugar de llenar componentes completos con colores intensos.
6. Reservar el rojo para errores, cancelaciones, faltantes o acciones destructivas.
7. Mantener una escala consistente de radios entre `10px` y `16px`.

---

## 3. Paleta de colores

## 3.1 Tokens principales

| Token original | Hexadecimal | Uso visual | Uso recomendado en Punto de Venta |
|---|---:|---|---|
| `--bg` | `#F5F4F0` | Fondo general de la aplicación | Fondo de páginas, área detrás de tarjetas, panel de catálogo |
| `--ink` | `#16181D` | Texto principal y bordes activos | Títulos, precios, totales, selección activa, botones oscuros |
| `--ink2` | `#5B606B` | Texto secundario | Descripciones, etiquetas, datos auxiliares |
| `--ink3` | `#9298A3` | Texto terciario | Placeholders, texto vacío, encabezados auxiliares |
| `--line` | `#E6E4DE` | Bordes y divisores | Bordes de tarjetas, inputs, tablas y separadores |
| `--card` | `#FFFFFF` | Superficies elevadas | Tarjetas, modales, panel de carrito, encabezados |
| `--soft` | `#F5F4F0` | Fondos neutros internos | Inputs sin foco, barras, pills neutrales |
| `--dark` | `#16181D` | Navegación y acción fuerte | Sidebar, botón principal de cobro o confirmación |
| `--dark2` | `#23262D` | Superficie oscura secundaria | Opción activa del menú, tarjeta de usuario |
| `--accent` | `#C6F24E` | Acento de marca | Botón de acción rápida, badge activo, iconos destacados |
| `--warn` | `#E8803A` | Advertencia fuerte | Indicadores de stock bajo o atención |
| `--warn-bg` | `#FDEEE2` | Fondo de advertencia | Mensajes de stock bajo, pagos pendientes |
| `--ok` | `#2E9E5B` | Éxito | Venta completada, pago correcto, inventario disponible |
| `--ok-bg` | `#EAF8C8` | Fondo de éxito | Alertas y confirmaciones positivas |
| `--ok-ink` | `#3C520C` | Texto sobre éxito suave | Texto dentro de alertas positivas |
| `--bad` | `#D64545` | Error | Faltantes, errores de cobro, acciones destructivas |
| `--bad-bg` | `#FCE8E8` | Fondo de error | Alertas, cancelaciones, mensajes críticos |

### 3.2 Colores complementarios usados directamente

| Color | Uso actual | Recomendación |
|---:|---|---|
| `#FFFFFF` | Texto sobre fondo oscuro y superficies | Blanco base |
| `#A8ADB7` | Texto secundario del sidebar | Texto apagado sobre fondo oscuro |
| `#C9CDD4` | Navegación inactiva y progreso reservado | Iconos/texto oscuro inactivo |
| `#3A3E47` | Avatar dentro del sidebar | Superficie oscura terciaria |
| `#CFCCC4` | Borde del buscador | Borde de input con mayor definición |
| `#D3D0C8` | Hover de filas | Borde neutral en hover |
| `#E3E0D8` | Avatar neutral | Fondo de avatar sin fotografía |
| `#ECEAE4` | Fondo del indicador circular | Track de progreso |
| `#EFEAFB` | Fondo violeta suave | Estado especial, etiqueta de menor o indicador “Hoy” |
| `#5B3FB0` | Texto violeta | Texto de estado especial |
| `#FCEFB4` | Fondo amarillo suave | Próximo, por cobrar, pendiente |
| `#7A5B00` | Texto amarillo oscuro | Texto sobre fondos amarillos |
| `#3FA34D` | Progreso positivo | Disponible, completado, asistencia |
| `#3D5A06` | Texto verde oscuro | Texto sobre verde lima transparente |
| `#EEF0F3` | Fondo gris frío | Estado neutral secundario |
| `#FFE0E0` | Fondo rojo claro | Lesión o advertencia específica |
| `#E02D2D` | Rojo intenso | Lesiones o alerta visible |
| `#E2EDFB` | Fondo azul suave | Reagendado o informativo |
| `#2459A3` | Texto azul | Texto sobre fondo informativo |
| `#ECEDF0` | Fondo gris de cancelación | Estado cancelado neutralizado |
| `#B42323` | Texto rojo oscuro | Mensaje crítico sobre fondo rojo claro |
| `#8A4415` | Texto naranja oscuro | Advertencia sobre fondo naranja claro |
| `#8E2B2B` | Texto rojo medio | Nota negativa |
| `#E03131` | Botón de eliminar y alerta | Acción destructiva |
| `#C92A2A` | Hover destructivo | Hover de botón de eliminar |
| `#F08C2E` | Progreso intermedio | Nivel medio o advertencia |
| `#E8A400` | Icono de advertencia | Iconografía amarilla |

### 3.3 Transparencias

| Valor | Uso |
|---|---|
| `rgba(198,242,78,.3)` | Fondo verde lima suave para estados pagados/asistencia |
| `rgba(22,24,29,.06)` | Anillo exterior de selección |
| `rgba(0,0,0,.2)` | Sombra del toast |

### 3.4 Variables recomendadas para centralizar la nueva paleta

Al llevar el diseño al Punto de Venta, se recomienda definir tokens semánticos y evitar colores hexadecimales repetidos dentro de los componentes.

```css
:root {
  --color-page: #F5F4F0;
  --color-surface: #FFFFFF;
  --color-surface-soft: #F5F4F0;

  --color-text-primary: #16181D;
  --color-text-secondary: #5B606B;
  --color-text-muted: #9298A3;
  --color-text-inverse: #FFFFFF;

  --color-border: #E6E4DE;
  --color-border-strong: #CFCCC4;
  --color-focus: #16181D;

  --color-nav: #16181D;
  --color-nav-active: #23262D;
  --color-accent: #C6F24E;
  --color-accent-ink: #16181D;

  --color-success: #2E9E5B;
  --color-success-bg: #EAF8C8;
  --color-success-ink: #3C520C;

  --color-warning: #E8803A;
  --color-warning-bg: #FDEEE2;
  --color-warning-ink: #8A4415;

  --color-danger: #D64545;
  --color-danger-bg: #FCE8E8;
  --color-danger-ink: #B42323;

  --color-info-bg: #E2EDFB;
  --color-info-ink: #2459A3;
  --color-special-bg: #EFEAFB;
  --color-special-ink: #5B3FB0;
}
```

---

## 4. Tipografía

### 4.1 Familia tipográfica

- Principal: `Plus Jakarta Sans`.
- Respaldo: `system-ui`, `sans-serif`.
- Código o folios: `ui-monospace`, `Menlo`, `monospace`.

Importación utilizada:

```html
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

Pesos usados:

| Peso | Uso |
|---:|---|
| `400` | Texto normal, notas y datos secundarios |
| `500` | Valores de detalle y códigos |
| `600` | Tabs, etiquetas, botones secundarios |
| `700` | Botones, nombres, títulos menores |
| `800` | Logo, cifras KPI, totales y datos destacados |

### 4.2 Escala tipográfica

| Tamaño | Uso observado |
|---:|---|
| `11px` | Etiquetas uppercase, subtítulo de marca, hints |
| `12px` | Badges, estados, metadatos compactos |
| `12.5px` | Botones compactos de métodos de pago |
| `13px` | Navegación, fechas, textos auxiliares |
| `14px` | Tamaño base del documento y datos secundarios |
| `14.5px` | Mensajes y botones del panel de detalle |
| `15px` | Subtítulos, filas de detalle, acción secundaria |
| `16px` | Nombre/hora de clase, código, celdas de tabla |
| `17px` | Controles principales del panel derecho |
| `18px` | Resumen de cobro |
| `19px` | Nombre del perfil antes del ajuste específico |
| `20px` | Título de página y resumen destacado |
| `21px` | Nombre del cliente en detalle |
| `22px` | Encabezados de sección y KPI |
| `24px` | Número del indicador circular en detalle |
| `26–28px` | Símbolo de ilimitado y logo |
| `32–34px` | Total a cobrar |

### 4.3 Jerarquías recomendadas

```css
.text-page-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.text-section-title {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.text-card-title {
  font-size: 16px;
  font-weight: 700;
}

.text-body {
  font-size: 14px;
  font-weight: 400;
}

.text-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.text-total {
  font-size: 34px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
```

---

## 5. Escala de espaciado

El prototipo no define variables de espaciado, pero repite una escala consistente.

| Token sugerido | Valor | Uso frecuente |
|---|---:|---|
| `--space-1` | `2px` | Separación mínima entre título y subtítulo |
| `--space-2` | `4px` | Separación interna mínima |
| `--space-3` | `6px` | Filas, tabs y pequeños gaps |
| `--space-4` | `8px` | Gap estándar entre controles |
| `--space-5` | `10px` | Separación media compacta |
| `--space-6` | `12px` | Padding de tarjetas pequeñas |
| `--space-7` | `14px` | Padding de cajas y mensajes |
| `--space-8` | `16px` | Separación entre secciones o controles |
| `--space-9` | `18px` | Padding de topbar y separación de perfil |
| `--space-10` | `22px` | Padding de columnas |
| `--space-11` | `24px` | Separación de bloques principales |
| `--space-12` | `28px` | Padding horizontal del encabezado |

Regla para el Punto de Venta:

- Controles internos: `6px` a `12px`.
- Tarjetas: `12px` a `16px`.
- Separación de bloques: `18px` a `24px`.
- Márgenes exteriores de página: `22px` a `28px`.

---

## 6. Radios, bordes y sombras

### 6.1 Radios

| Radio | Uso |
|---:|---|
| `9px` | Barra de progreso y scrollbar |
| `10px` | Logo e inputs de pago |
| `12px` | Navegación, botones, notas, métodos de pago |
| `14px` | KPI, buscador, toast, tarjeta de usuario |
| `16px` | Tarjetas de clase y cajas de detalle |
| `50%` | Avatares y botones circulares |
| `99px` | Pills, tabs redondeados y contadores |

Tokens sugeridos:

```css
:root {
  --radius-sm: 10px;
  --radius-md: 12px;
  --radius-lg: 14px;
  --radius-xl: 16px;
  --radius-pill: 999px;
  --radius-circle: 50%;
}
```

### 6.2 Bordes

- Borde normal de tarjeta: `1px solid #E6E4DE`.
- Borde de tarjeta interactiva: `1.5px solid #E6E4DE`.
- Borde de input: `1.5px solid #CFCCC4` o `#E6E4DE`.
- Borde seleccionado/focus: `#16181D`.
- Divisores de columnas: `1px solid #E6E4DE`.
- Resumen de cobro: borde superior `1px dashed #E6E4DE`.

### 6.3 Sombras

El diseño usa pocas sombras. La jerarquía depende principalmente de bordes y contraste.

| Sombra | Uso |
|---|---|
| `0 0 0 3px rgba(22,24,29,.06)` | Selección de tarjeta |
| `0 12px 30px rgba(0,0,0,.2)` | Toast flotante |

Recomendación:

- No añadir sombras pesadas a todas las tarjetas.
- Usar borde neutro en reposo.
- Usar anillo suave en selección.
- Reservar sombras fuertes para modales, menús flotantes y toasts.

---

## 7. Layout general

### 7.1 Contenedor principal

```css
.app {
  display: grid;
  grid-template-columns: 232px 1fr;
  height: 100vh;
  min-width: 1180px;
}
```

- Sidebar fijo visualmente: `232px`.
- Contenido principal: ocupa el resto.
- Altura: `100vh`.
- Ancho mínimo del diseño: `1180px`.

### 7.2 Estructura del contenido

El área principal usa tres columnas:

```css
.cols {
  display: grid;
  grid-template-columns: 324px 1fr 372px;
}
```

| Columna | Ancho | Función en demo | Equivalencia posible en Punto de Venta |
|---|---:|---|---|
| Izquierda | `324px` | Clases y KPIs | Categorías, accesos rápidos, resumen del turno |
| Centro | Flexible | Reservaciones | Catálogo de productos o listado de ventas |
| Derecha | `372px` | Detalle y cobro | Carrito, resumen de venta y pago |

### 7.3 Paddings de columnas

- Columna izquierda: `22px`.
- Columna central: `22px 10px`.
- Columna derecha: `22px 18px`.
- Separador entre columnas: `1px solid #E6E4DE`.
- Scrollbar: `6px`, thumb `#E6E4DE`, radio `9px`.

### 7.4 Encabezado superior

- Fondo: blanco.
- Padding: `18px 28px`.
- Borde inferior: `1px solid #E6E4DE`.
- Título: `20px`.
- Fecha/subtítulo: `13px`, color secundario, margen superior `6px`.

---

## 8. Sidebar

### 8.1 Contenedor

- Ancho: `232px`.
- Fondo: `#16181D`.
- Color de texto: blanco.
- Padding: `22px 14px`.
- Distribución vertical con usuario al final.

### 8.2 Marca

- Gap entre logo y texto: `10px`.
- Padding: `0 8px 26px`.
- Logo: `34px × 34px`.
- Radio del logo: `10px`.
- Fondo del logo: `#C6F24E`.
- Texto del logo: `28px`, peso `800`.
- Nombre de marca: `16px`.
- Subtítulo: `11px`, color `#A8ADB7`.

### 8.3 Opciones de navegación

- Padding: `11px 12px`.
- Radio: `12px`.
- Gap icono/texto: `10px`.
- Margen inferior: `4px`.
- Fuente: peso `600`.
- Icono: `19px × 19px`.
- Inactivo: `#C9CDD4`.
- Activo: fondo `#23262D`, texto blanco e icono lima.

### 8.4 Contador del menú

- Se alinea al extremo derecho.
- Tamaño de texto: `11px`.
- Fondo: verde lima.
- Texto: negro carbón.
- Padding: `1px 8px`.
- Forma: pill.

### 8.5 Tarjeta de usuario

- Fondo: `#23262D`.
- Padding: `12px`.
- Radio: `14px`.
- Gap: `10px`.
- Avatar: `34px × 34px`.
- Fondo del avatar: `#3A3E47`.
- Nombre: `13px`, peso `700`.
- Rol: `12px`, color `#A8ADB7`.

---

## 9. Botones

## 9.1 Botón base

```css
.btn {
  border-radius: 12px;
  padding: 11px 16px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
```

Altura aproximada con texto base: `40–42px`.

### 9.2 Variantes

#### Botón oscuro principal

- Fondo: `#16181D`.
- Texto: blanco.
- Uso: confirmar asistencia, cobrar, finalizar venta.

```css
.btn-dark {
  background: #16181D;
  color: #FFFFFF;
}
```

#### Botón de acento

- Fondo: `#C6F24E`.
- Texto: `#16181D`.
- Uso: nuevo registro, nueva venta, agregar producto o acción rápida.

#### Botón delineado

- Fondo: blanco.
- Borde: `1.5px solid #E6E4DE`.
- Hover: borde `#9298A3`.
- Uso: cancelar, reagendar, volver, acción secundaria.

#### Botón principal de ancho completo

- Ancho: `100%`.
- Padding: `15px`.
- Fuente en detalle: `17px`.
- Margen superior: `4px`.
- Uso en Punto de Venta: “Cobrar”, “Completar venta”, “Confirmar pago”.

#### Botón destructivo circular

- Tamaño: `22px × 22px`.
- Forma: círculo.
- Fondo: `#E03131`.
- Hover: `#C92A2A`.
- Texto/icono: blanco.
- Uso: eliminar método de pago o artículo.

### 9.3 Estado deshabilitado

- Opacidad: `.4`.
- Cursor: `not-allowed`.
- No cambiar la estructura o tamaño al deshabilitarse.

### 9.4 Estados que conviene añadir al Punto de Venta

El prototipo no define todos los estados. Al implementarlo deben incluirse:

```css
.btn:focus-visible {
  outline: 3px solid rgba(198, 242, 78, 0.45);
  outline-offset: 2px;
}

.btn-dark:hover {
  background: #23262D;
}

.btn-accent:hover {
  filter: brightness(0.96);
}

.btn:active {
  transform: translateY(1px);
}
```

---

## 10. Tarjetas y superficies

### 10.1 Tarjeta KPI

- Fondo: blanco.
- Borde: `1px solid #E6E4DE`.
- Radio: `14px`.
- Padding: `12px`.
- Valor: `22px`, peso fuerte.
- Etiqueta: `12px`, gris secundario.
- Contenedor: dos columnas con gap de `8px`.
- Margen inferior del conjunto: `22px`.

Equivalencias para Punto de Venta:

- ventas del día;
- total cobrado;
- productos vendidos;
- artículos con bajo stock;
- efectivo esperado;
- número de tickets.

### 10.2 Tarjeta interactiva de clase

- Fondo: blanco.
- Borde: `1.5px solid #E6E4DE`.
- Radio: `16px`.
- Padding: `12px 14px`.
- Margen inferior: `8px`.
- Estado seleccionado:
  - borde `#16181D`;
  - anillo `0 0 0 3px rgba(22,24,29,.06)`.
- Estado pasado/inactivo: opacidad `.55`.

Equivalencia para Punto de Venta:

- tarjeta de producto seleccionada;
- venta pendiente seleccionada;
- categoría activa;
- cliente seleccionado.

### 10.3 Caja de detalle

- Borde: `1px solid #E6E4DE`.
- Radio: `16px`.
- Padding: `14px`.
- Margen inferior: `12px`.
- Sin sombra permanente.

Uso recomendado:

- resumen del cliente;
- resumen de venta;
- desglose de pago;
- información de producto;
- datos del turno.

---

## 11. Buscador e inputs

### 11.1 Buscador

- Ancho: `100%`.
- Ancho máximo general: `420px`.
- En barra de filtros: `400px`.
- Padding: `12px 14px 12px 42px`.
- Radio: `14px`.
- Borde: `1.5px solid #CFCCC4`.
- Fondo en reposo: `#F5F4F0`.
- Fondo en foco: blanco.
- Borde en foco: `#16181D`.
- Icono: `18px`.
- Icono colocado a `14px` del lado izquierdo.

### 11.2 Input de monto

- Ancho: `120px`.
- Alineación del texto: derecha.
- Padding: `9px 10px`.
- Radio: `10px`.
- Borde: `1.5px solid #E6E4DE`.
- Peso: `700`.
- Tamaño dentro del detalle: `16px`.
- Foco: borde `#16181D`, sin outline predeterminado.

### 11.3 Recomendación de accesibilidad

No depender únicamente del cambio de borde. Añadir un anillo visible:

```css
input:focus-visible,
button:focus-visible,
a:focus-visible {
  outline: 3px solid rgba(198, 242, 78, 0.45);
  outline-offset: 2px;
}
```

---

## 12. Tabs y filtros

### 12.1 Tab base

- Padding: `7px 13px`.
- Radio: pill (`99px` o `999px`).
- Texto: `13px`, peso `600`.
- Fondo: blanco.
- Borde: `1px solid #E6E4DE`.
- Gap entre tabs: `6px`.

### 12.2 Tab activo

- Fondo: `#16181D`.
- Texto: blanco.
- Borde: `#16181D`.

### 12.3 Uso en Punto de Venta

- Todos / Disponibles / Bajo stock / Agotados.
- Venta actual / Pendientes / Completadas / Canceladas.
- Efectivo / Tarjeta / Transferencia.
- Productos / Servicios / Paquetes.

---

## 13. Badges, pills y estados

### 13.1 Pill base

- Display: inline-block.
- Texto: `12px`.
- Peso: `600`.
- Padding: `3px 7px`.
- Radio: `12px`.
- Line-height: `1.35`.
- Texto centrado.

### 13.2 Variantes

| Estado | Fondo | Texto | Uso sugerido en Punto de Venta |
|---|---:|---:|---|
| Neutral | `#F5F4F0` | `#5B606B` | Sin estado, pendiente neutral |
| Éxito lima | `rgba(198,242,78,.3)` | `#3D5A06` | Pagado, disponible, completado |
| Pendiente | `#FCEFB4` | `#7A5B00` | Por cobrar, bajo stock, próximo |
| Informativo | `#E2EDFB` | `#2459A3` | Reprogramado, transferencia |
| Cancelado | `#ECEDF0` | `#5B606B` | Cancelado, desactivado |
| Especial | `#EFEAFB` | `#5B3FB0` | Hoy, membresía, dato especial |
| Lesión/error puntual | `#FFE0E0` | `#E02D2D` | Error específico o restricción |

### 13.3 Regla semántica

- No usar el verde lima para errores.
- No usar rojo para estados neutrales.
- Mantener la misma combinación fondo/texto para el mismo significado.
- No depender solo del color: incluir texto o icono.

---

## 14. Tabla y filas de datos

### 14.1 Tabla

- Ancho: `100%`.
- `border-collapse: separate`.
- Separación vertical entre filas: `6px`.

### 14.2 Encabezados

- Tamaño: `13px`.
- Texto uppercase.
- Letter spacing: `.06em`.
- Color: `#5B606B`.
- Peso: `700`.
- Padding horizontal: `4px`.
- Primera columna: padding izquierdo `18px`.

### 14.3 Celdas

- Fondo: blanco.
- Tamaño principal: `16px`.
- Padding: `10px 4px`.
- Borde superior e inferior: `1.5px solid #E6E4DE`.
- Primera celda:
  - borde izquierdo;
  - radio izquierdo `14px`;
  - padding izquierdo `18px`.
- Última celda:
  - borde derecho;
  - radio derecho `14px`;
  - padding derecho `10px`.

### 14.4 Interacción

- Hover: borde `#D3D0C8`.
- Seleccionado: borde `#16181D`.
- Cursor: pointer para filas interactivas.

### 14.5 Aplicación en Punto de Venta

Esta estructura funciona para:

- historial de ventas;
- productos de inventario;
- movimientos de caja;
- cortes;
- pagos;
- mermas;
- clientes.

---

## 15. Avatares e identidad de usuario

### 15.1 Avatar pequeño

- Tamaño: `30px × 30px`.
- Forma: círculo.
- Fondo: `#E3E0D8`.
- Texto: `12px`, peso `700`.

### 15.2 Avatar de detalle

- Tamaño: `54px × 54px`.
- Fondo: `#16181D`.
- Texto: `#C6F24E`.
- Tamaño de iniciales: `17px`.

Uso en Punto de Venta:

- cajero actual;
- cliente asociado a la venta;
- usuario que realizó un movimiento;
- responsable del corte.

---

## 16. Indicadores y progreso

### 16.1 Barra horizontal

- Altura: `5px`.
- Radio: `9px`.
- Fondo: `#F5F4F0`.
- Margen superior: `10px`.
- Segmento positivo: `#3FA34D`.
- Segmento secundario: `#C9CDD4`.

Uso en Punto de Venta:

- porcentaje de stock;
- avance de meta diaria;
- capacidad de inventario;
- progreso de corte o conciliación.

### 16.2 Indicador circular

- Contenedor: `88px × 88px`.
- Centro: `72px × 72px`.
- Fondo interno: blanco.
- Track: `#ECEAE4`.
- Progreso por `conic-gradient`.
- Número: `24px` en detalle.
- Etiqueta: `13px`.

Colores dinámicos del prototipo:

- normal: `#3FA34D`;
- intermedio: `#F08C2E`;
- crítico: `#E03131`.

Uso recomendado:

- inventario restante;
- porcentaje de meta;
- capacidad de caja;
- crédito o saldo disponible.

---

## 17. Mensajes, alertas y notas

### 17.1 Nota base

- Radio: `12px`.
- Padding: `10px 12px`.
- Line-height: `1.45`.
- Margen inferior: `12px`.
- Tamaño en detalle: `14.5px`.

### 17.2 Nota positiva

- Fondo: `#EAF8C8`.
- Texto: `#3C520C`.
- Uso: venta completada, pago aprobado, asistencia confirmada.

### 17.3 Advertencia

- Fondo: `#FDEEE2`.
- Texto: `#8A4415`.
- Uso: stock bajo, método de pago pendiente, paquete no válido.

### 17.4 Error

- Fondo: `#FCE8E8`.
- Texto: `#8E2B2B` o `#B42323`.
- Uso: pago rechazado, stock insuficiente, cancelación, diferencia de caja.

### 17.5 Mensaje con icono

- Display flex.
- Gap: `10px`.
- Padding: `12px 14px`.
- Radio: `12px`.
- Texto: `14.5px`.
- Icono: `20px × 20px`.
- Margen inferior: `8px`.

---

## 18. Toast

- Posición: fija, centrado horizontalmente.
- Distancia inferior: `28px`.
- Fondo: `#16181D`.
- Texto: blanco.
- Padding: `13px 18px`.
- Radio: `14px`.
- Peso: `600`.
- Gap entre icono y texto: `10px`.
- Sombra: `0 12px 30px rgba(0,0,0,.2)`.
- Icono: verde lima.
- Animación: `250ms`.
- Estado oculto: opacidad `0` y desplazamiento vertical `30px`.
- Estado visible: opacidad `1` y desplazamiento `0`.
- Duración actual en JavaScript: `2600ms`.

Uso en Punto de Venta:

- producto agregado;
- venta registrada;
- ticket generado;
- pago guardado;
- cambio calculado;
- error de búsqueda.

---

## 19. Panel de cobro

### 19.1 Total

- Distribución horizontal entre etiqueta y monto.
- Alineación por línea base.
- Margen: `2px 0 12px`.
- Etiqueta: `17px` dentro del detalle.
- Total: `34px`, peso fuerte, letter spacing negativo.

### 19.2 Métodos de pago

- Contenedor flex.
- Gap: `6px`.
- Cada botón ocupa el mismo ancho.
- Borde: `1.5px solid #E6E4DE`.
- Radio: `12px`.
- Padding: `9px 4px`.
- Fondo: blanco.
- Fuente: `14.5px` en detalle.
- Hover: borde `#16181D`.

### 19.3 Línea de pago

- Display flex.
- Alineación vertical centrada.
- Gap: `8px`.
- Margen inferior: `8px`.
- Nombre del método: flexible.
- Input del monto: `120px`.
- Botón eliminar: `22px` circular.

### 19.4 Resumen

- Borde superior discontinuo.
- Margen superior: `8px`.
- Padding superior: `8px`.
- Fila: `18px` en detalle.
- Valor: `20px`.
- Pendiente/error: rojo.
- Cambio/resultado positivo: verde.

### 19.5 Aplicación directa al Punto de Venta

Esta es una de las secciones que conviene trasladar casi sin cambios:

- total de la venta;
- botones de efectivo, crédito y débito;
- múltiples métodos de pago;
- efectivo recibido;
- monto faltante;
- cambio;
- validación antes de habilitar el cobro.

---

## 20. Iconografía

- Formato: SVG en línea.
- Estilo: outline.
- `fill="none"`.
- `stroke="currentColor"` cuando el color depende del componente.
- Grosor normal: `2`.
- Grosor de alertas: `2.2`.
- Tamaño de navegación: `19px`.
- Tamaño de buscador: `18px`.
- Tamaño de mensajes: `20px`.

Para React se pueden usar iconos de `lucide-react`, que ya forma parte del proyecto, manteniendo tamaños y grosores equivalentes.

---

## 21. Estados interactivos

### 21.1 Seleccionado

- Borde oscuro.
- Anillo exterior suave.
- No cambiar el tamaño del componente.

### 21.2 Hover

- Botones delineados: oscurecer borde.
- Filas: oscurecer borde.
- Métodos de pago: borde oscuro.
- Botón destructivo: rojo más oscuro.

### 21.3 Focus

El prototipo usa principalmente cambio de borde. En la implementación final se debe añadir `focus-visible` para teclado.

### 21.4 Disabled

- Opacidad `.4`.
- Cursor `not-allowed`.
- Mantener colores y dimensiones base.

### 21.5 Inactivo o histórico

- Opacidad `.55`.
- Mantener legibilidad suficiente.

---

## 22. Responsive

El prototipo actual está pensado para escritorio:

- `min-width: 1180px`;
- sidebar de `232px`;
- contenido en tres columnas;
- no incluye media queries.

Para adaptar el diseño al Punto de Venta se recomienda:

### Escritorio amplio: `>= 1180px`

- Sidebar visible.
- Catálogo/listado flexible.
- Carrito o detalle con ancho aproximado de `372px`.

### Escritorio reducido/tablet horizontal: `900px–1179px`

- Sidebar colapsable a iconos.
- Panel derecho entre `320px` y `360px`.
- Filtros con wrap.
- Tabla con scroll horizontal.

### Tablet vertical/móvil: `< 900px`

- Navegación tipo drawer.
- Una sola columna principal.
- Carrito como panel deslizable o página separada.
- Acciones de cobro fijas en la parte inferior.
- Tarjetas y tabla transformadas en listas.

Ejemplo orientativo:

```css
@media (max-width: 1179px) {
  .app {
    min-width: 0;
    grid-template-columns: 76px 1fr;
  }

  .cols {
    grid-template-columns: minmax(0, 1fr) 340px;
  }
}

@media (max-width: 899px) {
  .app {
    display: block;
  }

  .cols {
    display: block;
  }
}
```

---

## 23. Accesibilidad y contraste

Antes de aplicar la paleta definitivamente:

1. Validar contraste de `#9298A3` sobre `#F5F4F0`, especialmente en tamaños de `11px` y `12px`.
2. No usar el verde lima como texto pequeño sobre blanco.
3. Usar `#16181D` como texto sobre `#C6F24E`.
4. Mantener texto oscuro sobre fondos pastel.
5. Añadir estados `focus-visible` a botones, links e inputs.
6. Mantener áreas táctiles de al menos `40px` para acciones principales.
7. Añadir etiquetas accesibles a botones que solo contienen iconos.
8. No comunicar estados únicamente mediante color.
9. Respetar `prefers-reduced-motion` para toast y transiciones.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
```

---

## 24. Mapeo de componentes al Punto de Venta

| Diseño de Recepción | Componente equivalente en Punto de Venta | Tratamiento recomendado |
|---|---|---|
| Sidebar oscuro | Menú principal | Mantener fondo oscuro, opción activa y acento lima |
| KPI de asistencias | Ventas del día | Tarjeta blanca de `14px` de radio |
| KPI de cobrado | Total vendido | Valor grande de `22px` |
| Lista de clases | Categorías o ventas recientes | Tarjetas interactivas de `16px` |
| Tabla de reservaciones | Historial/inventario | Filas blancas separadas y seleccionables |
| Panel de detalle | Carrito/resumen de venta | Panel blanco de aproximadamente `372px` |
| Membresía | Datos del cliente | Caja con borde, sin sombra |
| Métodos de pago | Cobro de venta | Botones delineados equivalentes |
| Confirmar asistencia | Cobrar/finalizar venta | Botón oscuro de ancho completo |
| Nuevo registro | Nueva venta/agregar producto | Botón verde lima |
| Estado asistió | Pagado/completado | Pill verde suave |
| Estado por cobrar | Pago pendiente | Pill amarilla |
| Mensaje de lesión | Advertencia de inventario | Alerta roja o naranja suave |
| Toast | Confirmación de operación | Toast oscuro con icono lima |

---

## 25. Tokens completos sugeridos para la implementación

```css
:root {
  /* Color */
  --color-page: #F5F4F0;
  --color-surface: #FFFFFF;
  --color-surface-soft: #F5F4F0;
  --color-text-primary: #16181D;
  --color-text-secondary: #5B606B;
  --color-text-muted: #9298A3;
  --color-text-inverse: #FFFFFF;
  --color-border: #E6E4DE;
  --color-border-strong: #CFCCC4;
  --color-nav: #16181D;
  --color-nav-active: #23262D;
  --color-accent: #C6F24E;
  --color-success: #2E9E5B;
  --color-success-bg: #EAF8C8;
  --color-success-ink: #3C520C;
  --color-warning: #E8803A;
  --color-warning-bg: #FDEEE2;
  --color-warning-ink: #8A4415;
  --color-danger: #D64545;
  --color-danger-bg: #FCE8E8;
  --color-danger-ink: #B42323;
  --color-info-bg: #E2EDFB;
  --color-info-ink: #2459A3;
  --color-special-bg: #EFEAFB;
  --color-special-ink: #5B3FB0;

  /* Typography */
  --font-sans: "Plus Jakarta Sans", system-ui, sans-serif;
  --font-mono: ui-monospace, Menlo, monospace;

  /* Spacing */
  --space-1: 2px;
  --space-2: 4px;
  --space-3: 6px;
  --space-4: 8px;
  --space-5: 10px;
  --space-6: 12px;
  --space-7: 14px;
  --space-8: 16px;
  --space-9: 18px;
  --space-10: 22px;
  --space-11: 24px;
  --space-12: 28px;

  /* Radius */
  --radius-sm: 10px;
  --radius-md: 12px;
  --radius-lg: 14px;
  --radius-xl: 16px;
  --radius-pill: 999px;

  /* Border */
  --border-subtle: 1px solid var(--color-border);
  --border-control: 1.5px solid var(--color-border);
  --border-input: 1.5px solid var(--color-border-strong);

  /* Shadow */
  --shadow-selected: 0 0 0 3px rgba(22, 24, 29, 0.06);
  --shadow-floating: 0 12px 30px rgba(0, 0, 0, 0.20);

  /* Motion */
  --duration-fast: 150ms;
  --duration-normal: 250ms;
}
```

---

## 26. Componentes base sugeridos

Al trasladar el diseño a React/Tailwind conviene centralizar estos componentes:

1. `Button`
   - variantes: `dark`, `accent`, `outline`, `danger`;
   - tamaños: `sm`, `md`, `lg`;
   - estados: loading, disabled.
2. `Card`
   - variantes: estática, seleccionable, KPI, detalle.
3. `Badge`
   - estados: neutral, success, warning, danger, info, special.
4. `Input`
   - normal, búsqueda y monto.
5. `Tabs`
   - tab normal y activo.
6. `Alert`
   - success, warning, danger.
7. `Toast`
   - confirmación y error.
8. `DataTable`
   - encabezado, fila, hover y selección.
9. `SidebarItem`
   - normal, activo y contador.
10. `PaymentMethodButton`
    - reposo, hover y seleccionado.

---

## 27. Lista de sustituciones visuales prioritarias

Para cambiar la apariencia del Punto de Venta sin mezclar demasiados cambios a la vez:

### Fase 1: fundamentos

- Cambiar fondo general a `#F5F4F0`.
- Cambiar texto principal a `#16181D`.
- Cambiar tarjetas a blanco con borde `#E6E4DE`.
- Incorporar `Plus Jakarta Sans`.
- Centralizar radios y espaciado.

### Fase 2: navegación y acciones

- Aplicar sidebar `#16181D`.
- Aplicar activo `#23262D`.
- Usar `#C6F24E` como acento.
- Cambiar botones principales a oscuro o lima según jerarquía.
- Normalizar botones secundarios delineados.

### Fase 3: componentes transaccionales

- Rediseñar catálogo y tarjetas de producto.
- Rediseñar carrito y panel de cobro.
- Aplicar inputs de monto.
- Aplicar botones de métodos de pago.
- Rediseñar total y resumen de cambio.

### Fase 4: estados y retroalimentación

- Unificar badges.
- Unificar alertas.
- Aplicar toast oscuro.
- Revisar estados hover, focus, disabled y error.

### Fase 5: validación

- Validar contraste.
- Validar escritorio y responsive.
- Validar tablas con datos extensos.
- Validar nombres y precios largos.
- Validar carrito vacío y estados sin resultados.
- Ejecutar build del frontend.

---

## 28. Reglas para mantener consistencia

1. No crear nuevos tonos si uno existente cumple el mismo propósito.
2. No usar más de una variante de radio para componentes equivalentes.
3. Toda tarjeta debe usar fondo blanco y borde neutral, salvo casos semánticos.
4. Toda acción principal debe ser oscura o verde lima.
5. Toda acción secundaria debe ser delineada.
6. Toda acción destructiva debe usar rojo y confirmación cuando sea irreversible.
7. Los totales deben destacar más que las etiquetas.
8. Los textos auxiliares deben usar `--color-text-secondary` o `--color-text-muted`.
9. Los estados deben tener nombre, no solo color.
10. Los colores deben salir de tokens centralizados.
11. Evitar estilos inline en la implementación final.
12. Evitar duplicar reglas de tipografía específicas por pantalla cuando puedan convertirse en variantes.

---

## 29. Checklist de aceptación visual

### Paleta

- [ ] Fondo general cálido aplicado.
- [ ] Tarjetas blancas aplicadas.
- [ ] Texto principal carbón aplicado.
- [ ] Verde lima reservado para acento.
- [ ] Estados de éxito, advertencia y error consistentes.

### Tipografía

- [ ] `Plus Jakarta Sans` aplicada.
- [ ] Títulos y totales mantienen jerarquía.
- [ ] Textos secundarios y placeholders son distinguibles.
- [ ] No hay texto menor de `11px`.

### Componentes

- [ ] Botones usan radios y paddings consistentes.
- [ ] Tarjetas usan bordes neutrales.
- [ ] Inputs muestran foco visible.
- [ ] Badges usan combinaciones semánticas.
- [ ] Tablas muestran hover y selección.
- [ ] Panel de cobro mantiene claridad del total.

### Interacción

- [ ] Hover visible.
- [ ] Focus visible mediante teclado.
- [ ] Disabled claramente diferenciado.
- [ ] Errores no dependen solo del color.
- [ ] Toast no bloquea la interacción.

### Responsive

- [ ] El layout funciona a partir de `1180px`.
- [ ] Existe estrategia por debajo de `1180px`.
- [ ] El carrito sigue accesible en pantallas pequeñas.
- [ ] Las tablas permiten scroll o cambian a lista.

### Validación técnica

- [ ] No hay colores repetidos innecesariamente en componentes.
- [ ] La paleta está centralizada.
- [ ] No hay estilos inline nuevos.
- [ ] El frontend compila correctamente.
- [ ] Se revisó el diff antes del commit.

---

## 30. Resumen rápido para implementar

Si se necesita una referencia corta durante el rediseño:

- **Fondo:** `#F5F4F0`.
- **Tarjetas:** `#FFFFFF`.
- **Texto principal:** `#16181D`.
- **Texto secundario:** `#5B606B`.
- **Texto apagado:** `#9298A3`.
- **Bordes:** `#E6E4DE`.
- **Sidebar:** `#16181D`.
- **Sidebar activo:** `#23262D`.
- **Acento:** `#C6F24E`.
- **Éxito:** `#2E9E5B` / fondo `#EAF8C8`.
- **Advertencia:** `#E8803A` / fondo `#FDEEE2`.
- **Error:** `#D64545` / fondo `#FCE8E8`.
- **Fuente:** Plus Jakarta Sans.
- **Botón normal:** `11px 16px`, radio `12px`.
- **Botón principal grande:** padding `15px`, ancho completo.
- **Tarjeta normal:** padding `12–14px`, radio `14–16px`.
- **Input:** borde `1.5px`, radio `10–14px`.
- **Pill:** `3px 7px`, radio completo.
- **Sidebar:** `232px`.
- **Panel derecho:** `372px`.
- **Sombra:** solo selección y elementos flotantes.

---

## 31. Sistema de clases reutilizables

Para evitar escribir el mismo CSS en cada módulo, el diseño debe declararse una sola vez como una biblioteca de clases globales. Después, cada pantalla únicamente combina clases existentes.

La aplicación actual usa React y Tailwind CSS 4. Por eso estas clases pueden colocarse en un archivo compartido, por ejemplo:

`src/styles/recepcion-ui.css`

Luego se importa una sola vez desde `src/index.css`:

```css
@import './styles/recepcion-ui.css';
```

También es posible pegar todo el bloque directamente al final de `src/index.css`. Se recomienda usar el prefijo `rx-` para evitar conflictos con los estilos existentes de otros módulos.

### 31.1 Hoja de estilos completa

```css
/* recepcion-ui.css
   Sistema visual reutilizable para Recepción, Punto de Venta y otros módulos. */

@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

:root {
  --rx-page: #F5F4F0;
  --rx-surface: #FFFFFF;
  --rx-surface-soft: #F5F4F0;
  --rx-ink: #16181D;
  --rx-ink-2: #5B606B;
  --rx-ink-3: #9298A3;
  --rx-line: #E6E4DE;
  --rx-line-strong: #CFCCC4;
  --rx-dark: #16181D;
  --rx-dark-2: #23262D;
  --rx-accent: #C6F24E;
  --rx-success: #2E9E5B;
  --rx-success-bg: #EAF8C8;
  --rx-success-ink: #3C520C;
  --rx-warning: #E8803A;
  --rx-warning-bg: #FDEEE2;
  --rx-warning-ink: #8A4415;
  --rx-danger: #D64545;
  --rx-danger-bg: #FCE8E8;
  --rx-danger-ink: #B42323;
  --rx-info-bg: #E2EDFB;
  --rx-info-ink: #2459A3;
  --rx-special-bg: #EFEAFB;
  --rx-special-ink: #5B3FB0;
  --rx-font: 'Plus Jakarta Sans', system-ui, sans-serif;
  --rx-radius-sm: 10px;
  --rx-radius-md: 12px;
  --rx-radius-lg: 14px;
  --rx-radius-xl: 16px;
  --rx-shadow-selected: 0 0 0 3px rgba(22, 24, 29, 0.06);
  --rx-shadow-floating: 0 12px 30px rgba(0, 0, 0, 0.20);
}

@layer components {
  /* Página y estructura */
  .rx-page {
    min-height: 100%;
    color: var(--rx-ink);
    background: var(--rx-page);
    font-family: var(--rx-font);
  }

  .rx-page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 18px 28px;
    background: var(--rx-surface);
    border-bottom: 1px solid var(--rx-line);
  }

  .rx-page-title {
    margin: 0;
    color: var(--rx-ink);
    font-size: 20px;
    font-weight: 700;
    line-height: 1.25;
    letter-spacing: -0.02em;
  }

  .rx-page-subtitle {
    margin: 6px 0 0;
    color: var(--rx-ink-2);
    font-size: 13px;
    line-height: 1.45;
  }

  .rx-section {
    padding: 22px;
  }

  .rx-section-title {
    margin: 0 0 16px;
    color: var(--rx-ink);
    font-size: 22px;
    font-weight: 700;
    line-height: 1.25;
    letter-spacing: -0.02em;
  }

  .rx-stack {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .rx-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .rx-row--between {
    justify-content: space-between;
  }

  .rx-grid-kpi {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 8px;
  }

  /* Tarjetas */
  .rx-card {
    color: var(--rx-ink);
    background: var(--rx-surface);
    border: 1px solid var(--rx-line);
    border-radius: var(--rx-radius-lg);
    padding: 14px;
  }

  .rx-card--interactive {
    border-width: 1.5px;
    border-radius: var(--rx-radius-xl);
    cursor: pointer;
    transition: border-color 150ms ease, box-shadow 150ms ease,
      transform 150ms ease;
  }

  .rx-card--interactive:hover {
    border-color: #D3D0C8;
  }

  .rx-card--interactive:active {
    transform: translateY(1px);
  }

  .rx-card--selected,
  .rx-card--interactive[aria-selected='true'] {
    border-color: var(--rx-ink);
    box-shadow: var(--rx-shadow-selected);
  }

  .rx-card--muted {
    opacity: 0.55;
  }

  .rx-card-title {
    margin: 0;
    color: var(--rx-ink);
    font-size: 16px;
    font-weight: 700;
    line-height: 1.35;
  }

  .rx-card-text {
    margin: 4px 0 0;
    color: var(--rx-ink-2);
    font-size: 14px;
    line-height: 1.5;
  }

  .rx-kpi-value {
    color: var(--rx-ink);
    font-size: 22px;
    font-weight: 800;
    line-height: 1.2;
    letter-spacing: -0.02em;
  }

  .rx-kpi-label {
    margin-top: 2px;
    color: var(--rx-ink-2);
    font-size: 12px;
    line-height: 1.4;
  }

  /* Botones */
  .rx-btn {
    min-height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 1.5px solid transparent;
    border-radius: var(--rx-radius-md);
    padding: 10px 16px;
    font-family: var(--rx-font);
    font-size: 14px;
    font-weight: 700;
    line-height: 1.2;
    white-space: nowrap;
    cursor: pointer;
    transition: background-color 150ms ease, border-color 150ms ease,
      color 150ms ease, transform 150ms ease, opacity 150ms ease;
  }

  .rx-btn:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  .rx-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .rx-btn:focus-visible {
    outline: 3px solid rgba(198, 242, 78, 0.45);
    outline-offset: 2px;
  }

  .rx-btn:disabled,
  .rx-btn[aria-disabled='true'] {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .rx-btn--dark {
    color: #FFFFFF;
    background: var(--rx-dark);
    border-color: var(--rx-dark);
  }

  .rx-btn--dark:hover:not(:disabled) {
    background: var(--rx-dark-2);
    border-color: var(--rx-dark-2);
  }

  .rx-btn--accent {
    color: var(--rx-ink);
    background: var(--rx-accent);
    border-color: var(--rx-accent);
  }

  .rx-btn--accent:hover:not(:disabled) {
    filter: brightness(0.96);
  }

  .rx-btn--outline {
    color: var(--rx-ink);
    background: var(--rx-surface);
    border-color: var(--rx-line);
  }

  .rx-btn--outline:hover:not(:disabled) {
    border-color: var(--rx-ink-3);
  }

  .rx-btn--danger {
    color: #FFFFFF;
    background: #E03131;
    border-color: #E03131;
  }

  .rx-btn--danger:hover:not(:disabled) {
    background: #C92A2A;
    border-color: #C92A2A;
  }

  .rx-btn--sm {
    min-height: 34px;
    padding: 7px 12px;
    font-size: 13px;
  }

  .rx-btn--lg {
    min-height: 50px;
    padding: 14px 18px;
    font-size: 17px;
  }

  .rx-btn--block {
    width: 100%;
  }

  .rx-icon-btn {
    width: 40px;
    height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 40px;
    color: var(--rx-ink);
    background: var(--rx-surface);
    border: 1.5px solid var(--rx-line);
    border-radius: 50%;
    cursor: pointer;
  }

  /* Formularios */
  .rx-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .rx-label {
    color: var(--rx-ink-2);
    font-size: 11px;
    font-weight: 700;
    line-height: 1.3;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .rx-input,
  .rx-select,
  .rx-textarea {
    width: 100%;
    color: var(--rx-ink);
    background: var(--rx-surface-soft);
    border: 1.5px solid var(--rx-line-strong);
    border-radius: var(--rx-radius-lg);
    padding: 11px 14px;
    font-family: var(--rx-font);
    font-size: 14px;
    outline: none;
    transition: background-color 150ms ease, border-color 150ms ease,
      box-shadow 150ms ease;
  }

  .rx-input::placeholder,
  .rx-textarea::placeholder {
    color: var(--rx-ink-3);
  }

  .rx-input:focus,
  .rx-select:focus,
  .rx-textarea:focus {
    background: var(--rx-surface);
    border-color: var(--rx-ink);
    box-shadow: 0 0 0 3px rgba(22, 24, 29, 0.06);
  }

  .rx-input:disabled,
  .rx-select:disabled,
  .rx-textarea:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .rx-input--amount {
    max-width: 120px;
    border-radius: var(--rx-radius-sm);
    text-align: right;
    font-size: 16px;
    font-weight: 700;
  }

  .rx-search {
    position: relative;
    width: 100%;
    max-width: 420px;
  }

  .rx-search .rx-input {
    padding-left: 42px;
  }

  .rx-search-icon {
    position: absolute;
    top: 50%;
    left: 14px;
    width: 18px;
    height: 18px;
    color: var(--rx-ink-2);
    pointer-events: none;
    transform: translateY(-50%);
  }

  .rx-help-text {
    color: var(--rx-ink-3);
    font-size: 12px;
    line-height: 1.4;
  }

  .rx-error-text {
    color: var(--rx-danger-ink);
    font-size: 12px;
    font-weight: 600;
  }

  /* Badges */
  .rx-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    border-radius: 999px;
    padding: 3px 8px;
    color: var(--rx-ink-2);
    background: var(--rx-surface-soft);
    font-size: 12px;
    font-weight: 600;
    line-height: 1.35;
    white-space: nowrap;
  }

  .rx-badge--success {
    color: #3D5A06;
    background: rgba(198, 242, 78, 0.30);
  }

  .rx-badge--warning {
    color: #7A5B00;
    background: #FCEFB4;
  }

  .rx-badge--danger {
    color: var(--rx-danger-ink);
    background: var(--rx-danger-bg);
  }

  .rx-badge--info {
    color: var(--rx-info-ink);
    background: var(--rx-info-bg);
  }

  .rx-badge--special {
    color: var(--rx-special-ink);
    background: var(--rx-special-bg);
  }

  /* Tabs */
  .rx-tabs {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow-x: auto;
  }

  .rx-tab {
    min-height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 7px 13px;
    color: var(--rx-ink-2);
    background: var(--rx-surface);
    border: 1px solid var(--rx-line);
    border-radius: 999px;
    font-family: var(--rx-font);
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
  }

  .rx-tab--active,
  .rx-tab[aria-selected='true'] {
    color: #FFFFFF;
    background: var(--rx-dark);
    border-color: var(--rx-dark);
  }

  /* Alertas */
  .rx-alert {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    border-radius: var(--rx-radius-md);
    padding: 12px 14px;
    color: var(--rx-ink-2);
    background: var(--rx-surface-soft);
    font-size: 14px;
    line-height: 1.45;
  }

  .rx-alert--success {
    color: var(--rx-success-ink);
    background: var(--rx-success-bg);
  }

  .rx-alert--warning {
    color: var(--rx-warning-ink);
    background: var(--rx-warning-bg);
  }

  .rx-alert--danger {
    color: var(--rx-danger-ink);
    background: var(--rx-danger-bg);
  }

  .rx-alert--info {
    color: var(--rx-info-ink);
    background: var(--rx-info-bg);
  }

  /* Tabla */
  .rx-table-wrap {
    width: 100%;
    overflow-x: auto;
  }

  .rx-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0 6px;
  }

  .rx-table th {
    padding: 0 10px 4px;
    color: var(--rx-ink-2);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-align: left;
    text-transform: uppercase;
  }

  .rx-table td {
    padding: 10px;
    color: var(--rx-ink);
    background: var(--rx-surface);
    border-top: 1.5px solid var(--rx-line);
    border-bottom: 1.5px solid var(--rx-line);
    font-size: 14px;
  }

  .rx-table td:first-child {
    padding-left: 18px;
    border-left: 1.5px solid var(--rx-line);
    border-radius: var(--rx-radius-lg) 0 0 var(--rx-radius-lg);
  }

  .rx-table td:last-child {
    padding-right: 18px;
    border-right: 1.5px solid var(--rx-line);
    border-radius: 0 var(--rx-radius-lg) var(--rx-radius-lg) 0;
  }

  .rx-table tbody tr:hover td {
    border-color: #D3D0C8;
  }

  .rx-table tbody tr[aria-selected='true'] td {
    border-color: var(--rx-ink);
  }

  /* Sidebar */
  .rx-sidebar {
    width: 232px;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    padding: 22px 14px;
    color: #FFFFFF;
    background: var(--rx-dark);
  }

  .rx-nav-item {
    width: 100%;
    min-height: 42px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    color: #C9CDD4;
    background: transparent;
    border: 0;
    border-radius: var(--rx-radius-md);
    font-family: var(--rx-font);
    font-size: 13px;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
  }

  .rx-nav-item:hover {
    color: #FFFFFF;
    background: rgba(255, 255, 255, 0.05);
  }

  .rx-nav-item--active,
  .rx-nav-item[aria-current='page'] {
    color: #FFFFFF;
    background: var(--rx-dark-2);
  }

  .rx-nav-item--active svg,
  .rx-nav-item[aria-current='page'] svg {
    color: var(--rx-accent);
  }

  .rx-nav-count {
    margin-left: auto;
    padding: 1px 8px;
    color: var(--rx-ink);
    background: var(--rx-accent);
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
  }

  /* Cobro */
  .rx-payment-methods {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }

  .rx-payment-method {
    min-height: 42px;
    padding: 9px 4px;
    color: var(--rx-ink);
    background: var(--rx-surface);
    border: 1.5px solid var(--rx-line);
    border-radius: var(--rx-radius-md);
    font-family: var(--rx-font);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }

  .rx-payment-method:hover,
  .rx-payment-method--active,
  .rx-payment-method[aria-pressed='true'] {
    border-color: var(--rx-ink);
  }

  .rx-total {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
  }

  .rx-total-label {
    color: var(--rx-ink-2);
    font-size: 17px;
    font-weight: 600;
  }

  .rx-total-value {
    color: var(--rx-ink);
    font-size: 34px;
    font-weight: 800;
    line-height: 1.15;
    letter-spacing: -0.03em;
  }

  .rx-payment-summary {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px dashed var(--rx-line);
  }

  .rx-value--success {
    color: var(--rx-success);
  }

  .rx-value--danger {
    color: var(--rx-danger);
  }

  /* Toast */
  .rx-toast {
    position: fixed;
    z-index: 1000;
    left: 50%;
    bottom: 28px;
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: min(420px, calc(100vw - 32px));
    padding: 13px 18px;
    color: #FFFFFF;
    background: var(--rx-dark);
    border-radius: var(--rx-radius-lg);
    box-shadow: var(--rx-shadow-floating);
    font-size: 14px;
    font-weight: 600;
    transform: translate(-50%, 30px);
    opacity: 0;
    pointer-events: none;
    transition: opacity 250ms ease, transform 250ms ease;
  }

  .rx-toast--visible {
    transform: translate(-50%, 0);
    opacity: 1;
  }

  .rx-toast svg {
    color: var(--rx-accent);
  }

  /* Vacíos y divisores */
  .rx-empty {
    display: grid;
    place-items: center;
    gap: 8px;
    min-height: 180px;
    padding: 24px;
    color: var(--rx-ink-2);
    text-align: center;
  }

  .rx-divider {
    width: 100%;
    height: 1px;
    margin: 16px 0;
    background: var(--rx-line);
    border: 0;
  }
}

@media (max-width: 899px) {
  .rx-page-header {
    align-items: flex-start;
    flex-direction: column;
    padding: 16px;
  }

  .rx-section {
    padding: 16px;
  }

  .rx-payment-methods {
    grid-template-columns: 1fr;
  }

  .rx-total-value {
    font-size: 28px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .rx-btn,
  .rx-card--interactive,
  .rx-input,
  .rx-select,
  .rx-textarea,
  .rx-toast {
    transition: none;
  }
}
```

### 31.2 Regla de composición

Las clases están separadas en tres tipos:

1. **Clase base:** define estructura y comportamiento general.
2. **Variante:** cambia color, tamaño o estado y usa `--`.
3. **Clase de composición:** organiza varios componentes.

Ejemplos:

```tsx
// Base + variante de color + variante de tamaño
<button className="rx-btn rx-btn--accent rx-btn--lg">
  Nueva venta
</button>

// Base + estado seleccionado
<article className="rx-card rx-card--interactive rx-card--selected">
  Producto seleccionado
</article>

// Base + variante semántica
<span className="rx-badge rx-badge--success">Pagado</span>
```

No se debe crear una clase distinta para cada pantalla. Por ejemplo, en lugar de `.boton-cobro`, `.boton-inventario` y `.boton-recepcion`, todos deben usar `.rx-btn` y la variante que corresponda.

---

## 32. Ejemplos listos para React

### 32.1 Encabezado de módulo

```tsx
<header className="rx-page-header">
  <div>
    <h1 className="rx-page-title">Punto de Venta</h1>
    <p className="rx-page-subtitle">Lunes, 26 de octubre de 2026</p>
  </div>

  <button type="button" className="rx-btn rx-btn--accent">
    Nueva venta
  </button>
</header>
```

### 32.2 Tarjetas KPI

```tsx
<section className="rx-grid-kpi">
  <article className="rx-card">
    <div className="rx-kpi-value">24</div>
    <div className="rx-kpi-label">Ventas de hoy</div>
  </article>

  <article className="rx-card">
    <div className="rx-kpi-value">$8,450.00</div>
    <div className="rx-kpi-label">Total cobrado</div>
  </article>
</section>
```

### 32.3 Producto seleccionable

```tsx
<button
  type="button"
  className="rx-card rx-card--interactive"
  aria-selected={selected}
  onClick={onSelect}
>
  <div className="rx-row rx-row--between">
    <div>
      <h3 className="rx-card-title">Bebida energética</h3>
      <p className="rx-card-text">Stock: 18 unidades</p>
    </div>

    <strong>$45.00</strong>
  </div>
</button>
```

El atributo `aria-selected={selected}` activa automáticamente el borde oscuro y el anillo de selección, sin tener que construir manualmente el nombre de una clase.

### 32.4 Buscador

```tsx
import { Search } from 'lucide-react';

<label className="rx-search">
  <Search className="rx-search-icon" aria-hidden="true" />
  <input
    className="rx-input"
    type="search"
    placeholder="Buscar producto..."
    aria-label="Buscar producto"
  />
</label>
```

### 32.5 Campo de formulario

```tsx
<label className="rx-field">
  <span className="rx-label">Nombre del producto</span>
  <input className="rx-input" type="text" />
  <span className="rx-help-text">Escribe el nombre que aparecerá en el ticket.</span>
</label>
```

### 32.6 Tabs de inventario

```tsx
<div className="rx-tabs" role="tablist" aria-label="Estado del inventario">
  {['Todos', 'Disponibles', 'Bajo stock', 'Agotados'].map((tab) => (
    <button
      key={tab}
      type="button"
      role="tab"
      className="rx-tab"
      aria-selected={activeTab === tab}
      onClick={() => setActiveTab(tab)}
    >
      {tab}
    </button>
  ))}
</div>
```

### 32.7 Estados y alertas

```tsx
<span className="rx-badge rx-badge--success">Pagado</span>
<span className="rx-badge rx-badge--warning">Bajo stock</span>
<span className="rx-badge rx-badge--danger">Cancelado</span>
<span className="rx-badge rx-badge--info">Transferencia</span>

<div className="rx-alert rx-alert--warning" role="alert">
  Quedan pocas unidades de este producto.
</div>
```

### 32.8 Tabla reutilizable

```tsx
<div className="rx-table-wrap">
  <table className="rx-table">
    <thead>
      <tr>
        <th>Folio</th>
        <th>Cliente</th>
        <th>Estado</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      <tr aria-selected={selectedSaleId === sale.id}>
        <td>{sale.folio}</td>
        <td>{sale.customer}</td>
        <td><span className="rx-badge rx-badge--success">Pagado</span></td>
        <td>{formatCurrency(sale.total)}</td>
      </tr>
    </tbody>
  </table>
</div>
```

### 32.9 Panel de cobro

```tsx
<aside className="rx-card rx-stack">
  <div className="rx-total">
    <span className="rx-total-label">Total</span>
    <strong className="rx-total-value">$580.00</strong>
  </div>

  <div className="rx-payment-methods">
    <button className="rx-payment-method" aria-pressed={method === 'cash'}>
      Efectivo
    </button>
    <button className="rx-payment-method" aria-pressed={method === 'card'}>
      Tarjeta
    </button>
    <button className="rx-payment-method" aria-pressed={method === 'transfer'}>
      Transferencia
    </button>
  </div>

  <label className="rx-field">
    <span className="rx-label">Monto recibido</span>
    <input className="rx-input rx-input--amount" type="number" />
  </label>

  <div className="rx-payment-summary">
    <div className="rx-row rx-row--between">
      <span>Cambio</span>
      <strong className="rx-value--success">$20.00</strong>
    </div>
  </div>

  <button className="rx-btn rx-btn--dark rx-btn--lg rx-btn--block">
    Cobrar venta
  </button>
</aside>
```

### 32.10 Toast

```tsx
import { CheckCircle2 } from 'lucide-react';

<div
  className={`rx-toast ${visible ? 'rx-toast--visible' : ''}`}
  role="status"
  aria-live="polite"
>
  <CheckCircle2 size={20} aria-hidden="true" />
  Venta registrada correctamente
</div>
```

---

## 33. Componentes React opcionales

Las clases anteriores ya pueden usarse directamente. Sin embargo, para reducir todavía más la repetición, se pueden crear componentes pequeños que seleccionen las clases correctas.

### 33.1 Componente `Button`

```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'dark' | 'accent' | 'outline' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}

export function Button({
  children,
  variant = 'dark',
  size = 'md',
  block = false,
  className = '',
  ...props
}: ButtonProps) {
  const classes = [
    'rx-btn',
    `rx-btn--${variant}`,
    size !== 'md' ? `rx-btn--${size}` : '',
    block ? 'rx-btn--block' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
```

Uso:

```tsx
<Button variant="accent">Nueva venta</Button>
<Button variant="outline" size="sm">Cancelar</Button>
<Button variant="dark" size="lg" block>Cobrar</Button>
```

### 33.2 Componente `Badge`

```tsx
import type { ReactNode } from 'react';

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'special';

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
}

export function Badge({ children, tone = 'neutral' }: BadgeProps) {
  const toneClass = tone === 'neutral' ? '' : `rx-badge--${tone}`;

  return (
    <span className={`rx-badge ${toneClass}`.trim()}>
      {children}
    </span>
  );
}
```

Uso:

```tsx
<Badge tone="success">Pagado</Badge>
<Badge tone="warning">Bajo stock</Badge>
<Badge tone="danger">Cancelado</Badge>
```

### 33.3 Cuándo crear un componente y cuándo usar una clase

Crear un componente React cuando:

- el elemento se repite con la misma estructura;
- necesita variantes controladas;
- contiene comportamiento;
- requiere atributos de accesibilidad consistentes;
- tiene iconos, loading o validaciones.

Usar solamente clases cuando:

- es una composición específica de una pantalla;
- únicamente se necesita aplicar color, borde o espaciado;
- crear un componente no reduciría código ni errores.

---

## 34. Flujo recomendado para usarlo en varios módulos

1. Declarar los tokens y clases `rx-` una sola vez.
2. Importar la hoja global una sola vez desde `src/index.css`.
3. Crear componentes compartidos para `Button`, `Badge`, `Card`, `Input`, `Alert` y `DataTable`.
4. Usar esos componentes desde Punto de Venta, Recepción, Inventario y Administración.
5. Cambiar la paleta únicamente desde las variables `--rx-*`.
6. No copiar el bloque CSS dentro de cada módulo.
7. No crear variantes visuales nuevas sin agregarlas primero al sistema compartido.

Con esta estructura, un cambio como modificar el verde lima o el radio de las tarjetas se realiza una sola vez y se refleja en todos los módulos que utilicen las clases `rx-`.
