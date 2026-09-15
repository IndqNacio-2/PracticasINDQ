Diseña el frontend de una **pantalla web de Punto de Venta (POS)** para un gimnasio o centro de entrenamiento.

IMPORTANTE: Diseña ÚNICAMENTE el módulo de **Venta / Punto de Venta**. No crear pantallas de inicio de sesión, registro, recuperación de contraseña, inventario, reportes, administración ni corte de caja.

La aplicación será utilizada principalmente desde una computadora en recepción por un recepcionista o administrador.

El objetivo de la pantalla es permitir seleccionar productos, agregarlos a una venta, modificar cantidades, calcular el total y realizar el cobro de manera rápida y sencilla.

## PANTALLA PRINCIPAL DEL PUNTO DE VENTA

Diseña una interfaz moderna de POS dividida en dos secciones principales.

### SECCIÓN IZQUIERDA — PRODUCTOS

Esta sección debe ocupar aproximadamente 65% de la pantalla.

En la parte superior colocar:

- Título "Punto de Venta"
- Barra de búsqueda con placeholder "Buscar producto..."
- Filtro por categoría
- Indicador pequeño de cantidad de productos disponibles

Agregar categorías como:

- Todos
- Bebidas
- Suplementos
- Snacks
- Ropa
- Accesorios

Debajo mostrar los productos mediante tarjetas visuales.

Cada tarjeta debe contener:

- Imagen del producto
- Nombre
- Categoría
- Precio
- Stock disponible
- Botón "Agregar"

Utilizar productos ficticios relacionados con gimnasio, por ejemplo:

- Agua 1 L — $25
- Bebida energética — $45
- Proteína Whey — $850
- Barra de proteína — $40
- Shaker — $120
- Toalla deportiva — $150
- Playera deportiva — $350
- Bebida isotónica — $35

Mostrar diferentes cantidades disponibles de stock.

Si un producto tiene poco stock mostrar una etiqueta:

"Stock bajo"

Si el producto no tiene existencias mostrar:

"Agotado"

y deshabilitar la opción para agregarlo.

Al seleccionar una categoría, mostrar únicamente los productos correspondientes.

La barra de búsqueda debe permitir representar visualmente cómo se filtrarían los productos por nombre.

---

# SECCIÓN DERECHA — VENTA ACTUAL

Esta sección debe ocupar aproximadamente 35% de la pantalla.

Debe permanecer claramente visible mientras se realiza una venta.

Título:

"Venta actual"

Cuando no existen productos mostrar:

"Agrega productos para comenzar una venta"

Cuando existan productos mostrar cada producto seleccionado con:

- Nombre
- Precio unitario
- Cantidad
- Botón +
- Botón -
- Botón eliminar
- Subtotal del producto

Ejemplo:

Agua 1 L
$25 × 2
[-] 2 [+]
Subtotal: $50

Permitir representar visualmente:

- Aumentar cantidad
- Disminuir cantidad
- Eliminar producto

No permitir seleccionar una cantidad superior al stock disponible.

---

# RESUMEN DE LA VENTA

En la parte inferior del carrito mostrar:

Subtotal: $0.00

Descuento: $0.00

Total: $0.00

El TOTAL debe tener mayor tamaño visual y destacar sobre los demás valores.

Agregar un botón principal grande:

"COBRAR"

El botón debe estar deshabilitado cuando el carrito esté vacío.

Agregar también una acción secundaria:

"Cancelar venta"

Al cancelar una venta mostrar un modal de confirmación:

"¿Deseas cancelar la venta actual?"

Botones:

"Continuar venta"
"Cancelar venta"

---

# PROCESO DE COBRO

Al presionar "COBRAR", abrir un modal o panel de pago.

Mostrar claramente:

TOTAL A PAGAR
$XXX.XX

Permitir seleccionar método de pago mediante botones grandes:

- Efectivo
- Tarjeta
- Transferencia

---

# PAGO EN EFECTIVO

Si se selecciona "Efectivo", mostrar:

Total a pagar: $XXX.XX

Campo:

"Efectivo recibido"

Calcular automáticamente:

Cambio = Efectivo recibido - Total

Ejemplo:

Total: $250.00
Recibido: $500.00
Cambio: $250.00

Si el efectivo recibido es menor al total mostrar:

"Efectivo insuficiente"

y deshabilitar el botón para confirmar.

Agregar botón:

"Confirmar pago"

---

# PAGO CON TARJETA

Si se selecciona "Tarjeta", mostrar:

Total a cobrar

Método:
"Tarjeta"

Agregar botón:

"Confirmar pago"

No solicitar datos de la tarjeta porque el pago se realizará mediante una terminal física externa.

---

# TRANSFERENCIA

Si se selecciona "Transferencia", mostrar:

Total a cobrar

Método:
"Transferencia"

Agregar campo opcional:

"Referencia de transferencia"

Agregar botón:

"Confirmar pago"

---

# VENTA EXITOSA

Después de confirmar el pago mostrar una pantalla o modal de éxito.

Mostrar un icono grande de confirmación.

Texto:

"Venta realizada correctamente"

Mostrar:

Folio: V-000125
Fecha
Hora
Total pagado
Método de pago
Cambio, únicamente si fue efectivo

Agregar botones:

"Imprimir ticket"

"Nueva venta"

Al seleccionar "Nueva venta":

- Cerrar confirmación
- Vaciar carrito
- Regresar al catálogo de productos
- Dejar el sistema listo para la siguiente venta

---

# TICKET

Diseñar también una vista previa sencilla del ticket.

Ejemplo:

CENTRO DE ENTRENAMIENTO

Folio: V-000125
Fecha: 15/09/2026
Hora: 11:30

--------------------------------

Agua 1 L
2 x $25              $50

Barra de proteína
2 x $40              $80

Shaker
1 x $120            $120

--------------------------------

TOTAL                 $250

Método: Efectivo
Recibido: $500
Cambio: $250

Gracias por su compra.

Agregar botón:

"Imprimir"

y botón:

"Cerrar"

---

# FLUJO DEL PUNTO DE VENTA

El prototipo debe representar claramente este proceso:

Seleccionar producto
→ Agregar al carrito
→ Verificar stock disponible
→ Modificar cantidades si es necesario
→ Calcular subtotal
→ Calcular total
→ Presionar COBRAR
→ Seleccionar método de pago
→ Confirmar pago
→ Registrar venta
→ Actualizar visualmente el stock
→ Mostrar venta exitosa
→ Generar ticket
→ Iniciar nueva venta.

---

# CASOS ESPECIALES

Diseñar los estados necesarios para los siguientes casos:

1. Carrito vacío.
2. Producto disponible.
3. Producto con stock bajo.
4. Producto agotado.
5. Intento de agregar una cantidad superior al stock.
6. Efectivo recibido insuficiente.
7. Venta cancelada.
8. Pago procesado correctamente.

Utilizar mensajes pequeños tipo toast o alertas para acciones como:

"Producto agregado"

"Producto eliminado"

"No hay suficiente stock"

"Venta cancelada"

"Venta realizada correctamente"

---

# DISEÑO VISUAL

El diseño debe ser moderno, limpio y profesional.

La temática debe relacionarse con fitness y gimnasio, pero sin utilizar demasiados elementos decorativos.

Priorizar velocidad de operación porque será utilizado como punto de venta.

Utilizar:

- Tarjetas de productos fáciles de identificar
- Botones grandes
- Tipografía clara
- Excelente contraste
- Bordes ligeramente redondeados
- Iconos sencillos
- Espaciado consistente
- Diseño profesional

Utilizar una paleta principalmente neutra con un color de acento energético.

La interfaz debe diseñarse principalmente para pantallas de computadora de escritorio y laptop.

---

# COMPONENTES REUTILIZABLES

Crear componentes reutilizables para:

- ProductCard
- ProductGrid
- SearchBar
- CategoryFilter
- Cart
- CartItem
- QuantitySelector
- SaleSummary
- PaymentModal
- PaymentMethodSelector
- CashPayment
- CardPayment
- TransferPayment
- SaleSuccessModal
- TicketPreview
- ConfirmationModal
- Toast / Alert

Mantener un diseño consistente entre todos los componentes.

El resultado debe ser un prototipo completo y navegable exclusivamente del módulo **Punto de Venta**, que posteriormente pueda utilizarse como referencia para desarrollar el frontend en React y conectarlo a un backend.