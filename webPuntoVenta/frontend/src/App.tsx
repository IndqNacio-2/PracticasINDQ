import { useCallback, useEffect, useMemo, useState, } from "react";
// Importo el tipo CSSProperties de forma explicita en lugar de usar el global React.
import type { CSSProperties } from "react";
import type { Product, CartItem, ToastMessage, SaleRecord, AppModule, WasteRecord, CashClosingRecord, } from './types';
import { CATEGORIES } from './data';
import ProductCard from './components/ProductCard';
import CartPanel from './components/CartPanel';
import PaymentModal from './components/PaymentModal';
import SaleSuccessModal from './components/SaleSuccessModal';
import TicketModal from './components/TicketModal';
import ConfirmCancelModal from './components/ConfirmCancelModal';
import ToastContainer from './components/Toast';
import {
  // Consulto el estado del backend para confirmar la conexion.
  getHealth,
  // Productos: consulta, alta, edicion, estado y existencias.
  getProducts,
  createProduct,
  updateProduct as updateProductApi,
  changeProductStatus,
  adjustProductStock,
  // Mermas del inventario.
  getWasteRecords,
  createWasteRecord,
  // Ventas del punto de venta.
  getSales,
  createSale,
  // Cortes de caja.
  getCashClosings,
  createCashClosing,
  // Error con el mensaje que manda el backend.
  ApiError,
} from "./services/api";
import Sidebar from "./components/Sidebar";
import MaterialIcon from "./components/MaterialIcon";
import InventoryPage from "./components/InventoryPage";
import WastePage from "./components/WastePage";
// Importo la primera pantalla funcional del Corte de caja.
import CashClosingPage from "./components/CashClosingPage";
import ReportsPage from "./components/ReportsPage";
import type { WasteFormData } from "./components/waste/WasteFormModal";

let _toastId = 0;

/**
 * Convierto cualquier error de la API en un mensaje listo para el toast.
 *
 * Si el backend mando una explicacion (ApiError) la uso tal cual; si no,
 * aviso que no se pudo conectar con el servidor.
 */
const mensajeDeError = (error: unknown): string =>
  error instanceof ApiError
    ? error.message
    : "No fue posible conectar con el servidor";

export default function App() {
  const [activeModule, setActiveModule] = useState<AppModule>("sale");
  /**
   * Arranco con las listas vacias: la informacion se carga desde la
   * base de datos apenas aparece la pantalla, ya no vive en el navegador.
   */
  const [products, setProducts] = useState<Product[]>([]);
  /**
   * Guardo los registros de mermas en el estado principal
   * para compartirlos despues con inventario y reportes.
   */
  const [wasteRecords, setWasteRecords] = useState<WasteRecord[]>([]);
  /**
   * Mientras cargo la informacion desde la API oculto las pantallas
   * para que no se vean listas vacias por un segundo.
   */
  const [isLoading, setIsLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [modal, setModal] = useState<'payment' | 'success' | 'cancel' | 'ticket' | null>(null);
  const [lastSale, setLastSale] = useState<SaleRecord | null>(null);
  /**
   * Guardo el historial de ventas que viene de la base de datos:
   * lo usan el Corte de caja (turno) y el modulo de Reportes.
   */
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  /**
   * Guardo los cortes de caja que vienen de la base de datos
   * para mostrarlos en el historial del modulo.
   */
  const [cashClosings, setCashClosings] = useState<CashClosingRecord[]>([]);
  /**
   * Cuento cuántas ventas ya quedaron incluidas en un corte.
   * Así puedo saber cuáles pertenecen al turno vigente.
   */
  const [closedSalesCount, setClosedSalesCount] = useState(0);
  /**
   * Conservo el fondo inicial y el efectivo contado del turno actual
   * para no perderlos cuando el usuario cambia de módulo.
   */
  const [initialFund, setInitialFund] = useState(0);
  const [countedCash, setCountedCash] = useState(0);

  /**
   * comprueba la cominicacion con el backend una sola vez
   * cuando el componente principal aparece en pantalla
   */
  useEffect(() => {
    async function checkBackend(): Promise<void> {
      try {
        const health = await getHealth();

        console.log("Estado del backend:", health);
      } catch (error) {
        console.error(
          "No fue posible conectar con el backend:",
          error,
        );
      }
    }

    void checkBackend();
  }, []);

  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'success') => {
    const id = String(++_toastId);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  /**
   * Cargo toda la informacion de la base de datos una sola vez
   * cuando la aplicacion abre: productos, mermas, ventas y cortes.
   *
   * Si el backend no responde, aviso con un toast y dejo las listas
   * vacias para que la pantalla no se rompa.
   */
  useEffect(() => {
    async function loadDatabase(): Promise<void> {
      try {
        const [loadedProducts, loadedWaste, loadedSales, loadedClosings] =
          await Promise.all([
            getProducts(),
            getWasteRecords(),
            getSales(),
            getCashClosings(),
          ]);

        setProducts(loadedProducts);
        setWasteRecords(loadedWaste);
        setSales(loadedSales);
        setCashClosings(loadedClosings);

        /**
         * Marco las ventas que ya vienen del historial como parte de un
         * turno cerrado, para que el Corte de caja solo empiece a contar
         * las ventas nuevas que haga hoy el usuario.
         */
        setClosedSalesCount(loadedSales.length);
      } catch (error) {
        console.error("No fue posible cargar la información:", error);
        addToast(mensajeDeError(error), "error");
      } finally {
        setIsLoading(false);
      }
    }

    void loadDatabase();
  }, [addToast]);

  /**
   * Obtengo las ventas que pertenecen al turno vigente.
   *
   * Las ventas anteriores se conservan en el historial general
   * para que los reportes puedan consultarlas más adelante.
   */
  const shiftSales = useMemo(
    () => sales.slice(closedSalesCount),
    [sales, closedSalesCount],
  );

  /**
   * Registro el corte de caja en la base de datos.
   *
   * Envio solamente los datos del turno: el folio y la fecha los genera
   * el backend. Si la respuesta sale bien, agrego el corte al historial,
   * marco las ventas del turno como cerradas y reinicio el fondo y el
   * efectivo contado para que el siguiente turno comience desde cero.
   */
  const confirmCashClosing = async (closing: CashClosingRecord) => {
    try {
      const registeredClosing = await createCashClosing({
        salesCount: closing.salesCount,
        totalSales: closing.totalSales,
        cashSales: closing.cashSales,
        cardSales: closing.cardSales,
        transferSales: closing.transferSales,
        initialFund: closing.initialFund,
        expectedCash: closing.expectedCash,
        countedCash: closing.countedCash,
        difference: closing.difference,
        registeredBy: closing.registeredBy,
      });

      setCashClosings((currentClosings) => [
        ...currentClosings,
        registeredClosing,
      ]);

      setClosedSalesCount(sales.length);
      setInitialFund(0);
      setCountedCash(0);

      addToast(
        `Corte ${registeredClosing.folio} registrado correctamente`,
        'success',
      );
    } catch (error) {
      addToast(mensajeDeError(error), 'error');
    }
  };

  /**
   * Guardo la edicion de un producto en la base de datos.
   *
   * El backend conserva la existencia actual (solo cambia con entradas
   * de inventario o mermas), asi el precio o el nombre se pueden
   * corregir sin afectar el stock. Devuelvo true cuando salio bien.
   */
  const updateProduct = async (updatedProduct: Product): Promise<boolean> => {
    try {
      const savedProduct = await updateProductApi(updatedProduct.id, updatedProduct);

      setProducts((currentProducts) =>
        currentProducts.map((product) =>
          product.id === savedProduct.id ? savedProduct : product,
        ),
      );

      return true;
    } catch (error) {
      addToast(mensajeDeError(error), "error");
      return false;
    }
  };

  /**
   * Creo un producto nuevo en la base de datos.
   *
   * El identificador lo asigna PostgreSQL, por eso el backend me
   * devuelve el producto completo y ese es el que agrego a la lista.
   */
  const addProduct = async (productData: Omit<Product, "id">): Promise<boolean> => {
    try {
      const createdProduct = await createProduct(productData);

      setProducts((currentProducts) => [
        ...currentProducts,
        createdProduct,
      ]);

      return true;
    } catch (error) {
      addToast(mensajeDeError(error), "error");
      return false;
    }
  };

  /**
   * Ajusto existencias con una cantidad firmada: positivo para entrada
   * y negativo para salida. El backend rechaza bajar de cero.
   */
  const adjustStock = async (productId: number, quantity: number): Promise<boolean> => {
    try {
      const updatedProduct = await adjustProductStock(productId, quantity);

      setProducts((currentProducts) =>
        currentProducts.map((product) =>
          product.id === updatedProduct.id ? updatedProduct : product,
        ),
      );

      return true;
    } catch (error) {
      addToast(mensajeDeError(error), "error");
      return false;
    }
  };

  /**
   * Activo o desactivo el producto en la base de datos sin borrarlo:
   * el inactivo deja de aparecer en el punto de venta, pero sigue
   * visible en inventario y en los reportes.
   */
  const toggleStatus = async (productId: number, status: Product["status"]): Promise<boolean> => {
    try {
      const updatedProduct = await changeProductStatus(productId, status);

      setProducts((currentProducts) =>
        currentProducts.map((product) =>
          product.id === updatedProduct.id ? updatedProduct : product,
        ),
      );

      return true;
    } catch (error) {
      addToast(mensajeDeError(error), "error");
      return false;
    }
  };

  /*
  * Registro una merma en la base de datos y actualizo el inventario.
  *
  * El backend genera el folio y descuenta las existencias dentro de una
  * misma transaccion, asi que si algo falla no queda nada a medias.
  * Devuelvo true cuando el registro se completa correctamente
  * y false cuando encuentro algún dato inválido.
  */
  const addWasteRecord = async (
    wasteData: WasteFormData,
  ): Promise<boolean> => {
    /*
    * Busco el producto relacionado con la merma para conocer
    * su existencia actual antes de modificar el inventario.
    */
    const selectedProduct = products.find(
      (product) => product.id === wasteData.productId,
    );

    /*
    * Aunque el formulario solamente muestra productos válidos,
    * vuelvo a comprobar que el producto exista porque esta función
    * es la responsable final de actualizar el inventario.
    */
    if (!selectedProduct) {
      addToast(
        "No fue posible encontrar el producto seleccionado",
        "error",
      );

      return false;
    }

    /*
    * Verifico que la cantidad sea un número entero y mayor que cero.
    * No permito cantidades decimales porque manejo unidades completas.
    */
    if (
      !Number.isInteger(wasteData.quantity) ||
      wasteData.quantity <= 0
    ) {
      addToast(
        "La cantidad de la merma debe ser un número entero mayor que cero",
        "error",
      );

      return false;
    }

    /*
    * Evito que el descuento genere una existencia negativa.
    */
    if (wasteData.quantity > selectedProduct.stock) {
      addToast(
        `Solamente hay ${selectedProduct.stock} unidades disponibles`,
        "error",
      );

      return false;
    }

    /*
    * Calculo la existencia que tendrá el producto después
    * de aplicar la merma.
    */
    const resultingStock =
      selectedProduct.stock - wasteData.quantity;

    /*
    * Envio la merma al backend: el folio lo genera la base de datos y,
    * dentro de la misma transaccion, descuenta la existencia del producto.
    */
    try {
      const newRecord = await createWasteRecord({
        productId: wasteData.productId,
        quantity: wasteData.quantity,
        reason: wasteData.reason,
        observations: wasteData.observations,
      });

      /*
      * Agrego la merma que devuelve el servidor al historial que
      * comparten las pantallas de Mermas y Reportes.
      */
      setWasteRecords((currentRecords) => [
        ...currentRecords,
        newRecord,
      ]);

      /*
      * Recargo los productos desde la base de datos para que Venta,
      * Inventario y Reportes vean la existencia que dejo la merma.
      */
      setProducts(await getProducts());
    } catch (error) {
      /*
      * Si el backend rechazó la merma (por ejemplo porque ya no quedan
      * existencias), muestro su mensaje y dejo todo como estaba.
      */
      addToast(mensajeDeError(error), "error");
      return false;
    }

    /*
    * Si el producto se encontraba en el carrito, reviso que la
    * cantidad apartada no sea mayor que la existencia resultante.
    *
    * Si el stock llegó a cero, retiro el producto del carrito.
    * Si todavía existe stock, reduzco la cantidad al máximo disponible.
    */
    const cartItem = cart.find(
      (item) => item.productId === selectedProduct.id,
    );

    const cartNeedsAdjustment =
      cartItem !== undefined &&
      cartItem.quantity > resultingStock;

    if (cartNeedsAdjustment) {
      setCart((currentCart) =>
        currentCart.flatMap((item) => {
          if (item.productId !== selectedProduct.id) {
            return [item];
          }

          if (resultingStock === 0) {
            return [];
          }

          return [
            {
              ...item,
              quantity: resultingStock,
            },
          ];
        }),
      );
    }

    /*
    * Informo al usuario que el registro y el descuento
    * de inventario se realizaron correctamente.
    */
    addToast(
      `Merma registrada. Nuevo stock de ${selectedProduct.name}: ${resultingStock}`,
      "success",
    );

    /*
    * Si fue necesario modificar el carrito, también aviso al usuario
    * para que conozca el cambio antes de continuar con la venta.
    */
    if (cartNeedsAdjustment) {
      addToast(
        resultingStock === 0
          ? `${selectedProduct.name} se retiró del carrito porque quedó agotado`
          : `La cantidad de ${selectedProduct.name} en el carrito se ajustó a ${resultingStock}`,
        "warning",
      );
    }

    /*
    * Devuelvo true para indicar que la operación terminó correctamente
    * y permitir que el formulario de merma se cierre.
    */
    return true;
  };


  const getProduct = (id: number) => products.find(p => p.id === id)!;
  const getCartItem = (productId: number) => cart.find(i => i.productId === productId);

  /**
   * En el punto de venta solamente se muestran productos activos
   * los inactivos permanecen visibles en inventario
   */
  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      activeCategory === "Todos" ||
      product.category === activeCategory;

    const matchesSearch = product.name
      .toLowerCase()
      .includes(search.toLowerCase());

    const isActive = product.status === "active";

    return matchesCategory && matchesSearch && isActive;
  });

  const cartSubtotal = cart.reduce((sum, item) => sum + getProduct(item.productId).price * item.quantity, 0);
  const discount = 0;
  const cartTotal = cartSubtotal - discount;

  const addToCart = (productId: number) => {
    const product = getProduct(productId);
    if (product.stock === 0) return;
    const existing = getCartItem(productId);
    if (existing) {
      if (existing.quantity >= product.stock) {
        addToast('No hay existencias suficientes', 'error');
        return;
      }
      setCart(prev => prev.map(i => i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setCart(prev => [...prev, { productId, quantity: 1 }]);
    }
    addToast(`${product.name} agregado`, 'success');
  };

  const updateQuantity = (productId: number, delta: number) => {
    const item = getCartItem(productId);
    if (!item) return;
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }
    const product = getProduct(productId);
    if (newQty > product.stock) {
      addToast('No hay existencias suficientes', 'error');
      return;
    }
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, quantity: newQty } : i));
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(i => i.productId !== productId));
    addToast('Producto eliminado', 'info');
  };

  /*
   * Cobro la venta en la base de datos.
   *
   * No mando precios ni totales: el backend los calcula con el precio
   * registrado del producto, genera el folio y descuenta las existencias
   * dentro de una misma transaccion. Si todo sale bien, muestro la
   * pantalla de exito con la venta que devuelve el servidor.
   */
  const handleConfirmPayment = async (paymentData: {
    method: 'efectivo' | 'tarjeta' | 'transferencia';
    cashReceived?: number;
    transferRef?: string;
  }): Promise<void> => {
    try {
      const sale = await createSale({
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        discount,
        paymentMethod: paymentData.method,
        cashReceived: paymentData.cashReceived,
        transferRef: paymentData.transferRef,
      });

      /*
       * Agrego la venta al historial que usan el Corte de caja
       * y el modulo de Reportes.
       */
      setSales((currentSales) => [
        ...currentSales,
        sale,
      ]);

      setLastSale(sale);
      setModal('success');
      addToast('Venta realizada correctamente', 'success');

      /*
       * Recargo los productos para que las tarjetas del punto de venta
       * y el inventario muestren la existencia que desconto la venta.
       */
      setProducts(await getProducts());
    } catch (error) {
      /*
       * Si el backend rechazó la venta (producto inexistente o sin
       * existencias), muestro el error y dejo el carrito como estaba
       * para que el usuario pueda corregir y volver a cobrar.
       */
      addToast(mensajeDeError(error), 'error');
    }
  };

  const handleNewSale = () => {
    setCart([]);
    setLastSale(null);
    setModal(null);
  };

  const confirmCancelVenta = () => {
    setCart([]);
    setModal(null);
    addToast('Venta cancelada', 'warning');
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        activeModule={activeModule}
        onModuleChange={setActiveModule}
      />

      <main className="relative min-w-0 flex-1 overflow-hidden">
        {/*
         * Mientras la aplicación carga la información desde la base de
         * datos muestro este aviso para que no se vean listas vacías.
         */}
        {isLoading && (
          <div
            className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4"
            style={{ backgroundColor: "#F0F2F7" }}
          >
            <div
              className="h-10 w-10 animate-spin rounded-full border-4 border-[#E5E7EB]"
              style={{ borderTopColor: "#FF5C00" }}
            />
            <p className="text-sm font-medium text-[#6B7280]">
              Cargando información de la base de datos...
            </p>
          </div>
        )}
        {activeModule === "sale" && (
          <div
            className="flex h-full overflow-hidden"
            style={{ backgroundColor: "#F0F2F7" }}
          >
            {/* Left panel — Products */}
            <div className="flex flex-col min-w-0" style={{ width: '65%' }}>
              {/* Top bar */}
              <div className="flex-shrink-0 px-6 pt-5 pb-4" style={{ backgroundColor: '#F0F2F7' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-md"
                      style={{ backgroundColor: "#FF5C00" }}
                    >
                      <MaterialIcon name="point_of_sale" className="text-2xl" filled />
                    </div>
                  </div>
                  <span className="text-xs bg-white text-[#6B7280] border border-[#E5E7EB] px-3 py-1.5 rounded-full font-medium">
                    {filteredProducts.length} producto{filteredProducts.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Search */}
                <div className="relative mb-3">
                  <MaterialIcon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-[#9CA3AF]" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar producto..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-sm text-[#0D0F14] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 transition-all"
                    style={{ '--tw-ring-color': '#FF5C00' } as CSSProperties}
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      aria-label="Limpiar búsqueda"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151] transition-colors"
                    >
                      <MaterialIcon name="close" className="text-lg" />
                    </button>
                  )}
                </div>

                {/* Category filter */}
                <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-150 flex-shrink-0 ${
                        activeCategory === cat
                          ? 'text-white shadow-md'
                          : 'bg-white text-[#6B7280] border border-[#E5E7EB] hover:border-[#FF5C00] hover:text-[#FF5C00]'
                      }`}
                      style={activeCategory === cat ? { backgroundColor: '#FF5C00' } : {}}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Product grid */}
              <div className="flex-1 overflow-y-auto px-6 pb-6">
                {filteredProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                    <MaterialIcon name="search_off" className="text-5xl text-[#CBD5E1]" />
                    <p className="text-sm text-[#9CA3AF] font-medium">No se encontraron productos</p>
                    {search && (
                      <button onClick={() => setSearch('')} className="text-sm font-semibold hover:underline" style={{ color: '#FF5C00' }}>
                        Limpiar búsqueda
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                    {filteredProducts.map(product => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        cartQty={getCartItem(product.id)?.quantity ?? 0}
                        onAdd={() => addToCart(product.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right panel — Cart */}
            <CartPanel
              cart={cart}
              products={products}
              subtotal={cartSubtotal}
              discount={discount}
              total={cartTotal}
              onUpdateQuantity={updateQuantity}
              onRemove={removeFromCart}
              onCobrar={() => setModal('payment')}
              onCancelVenta={() => setModal('cancel')}
            />

            {/* Modals */}
            {modal === 'payment' && (
              <PaymentModal
                total={cartTotal}
                onConfirm={handleConfirmPayment}
                onClose={() => setModal(null)}
              />
            )}

            {modal === 'success' && lastSale && (
              <SaleSuccessModal
                sale={lastSale}
                onNewSale={handleNewSale}
                onShowTicket={() => setModal('ticket')}
              />
            )}

            {modal === 'ticket' && lastSale && (
              <TicketModal
                sale={lastSale}
                onClose={() => setModal('success')}
              />
            )}

            {modal === 'cancel' && (
              <ConfirmCancelModal
                onConfirm={confirmCancelVenta}
                onCancel={() => setModal(null)}
              />
            )}

            <ToastContainer toasts={toasts} />
          </div>
        )}

        {activeModule === "inventory" && (
          <InventoryPage
            products={products}
            onUpdateProduct={updateProduct}
            onAddProduct={addProduct}
            onAdjustStock={adjustStock}
            onToggleStatus={toggleStatus}
            addToast={addToast}
          />
        )}

        {activeModule === "waste" && (
          <WastePage
            products={products}
            wasteRecords={wasteRecords}
            onAddWaste={addWasteRecord}
          />
        )}

        {activeModule === "cash-closing" && (
          <CashClosingPage
            sales={shiftSales}
            closings={cashClosings}
            initialFund={initialFund}
            countedCash={countedCash}
            onInitialFundChange={setInitialFund}
            onCountedCashChange={setCountedCash}
            onConfirmClosing={confirmCashClosing}
          />
        )}

        {activeModule === "reports" && (
          <ReportsPage
            sales={sales}
            wasteRecords={wasteRecords}
            products={products}
          />
        )}
      </main>
    </div>
  );
}
