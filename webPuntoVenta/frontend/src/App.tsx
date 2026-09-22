import { useCallback, useEffect, useState, } from "react";
import type { Product, CartItem, ToastMessage, SaleRecord, AppModule, } from './types';
import { INITIAL_PRODUCTS, CATEGORIES } from './data';
import ProductCard from './components/ProductCard';
import CartPanel from './components/CartPanel';
import PaymentModal from './components/PaymentModal';
import SaleSuccessModal from './components/SaleSuccessModal';
import TicketModal from './components/TicketModal';
import ConfirmCancelModal from './components/ConfirmCancelModal';
import ToastContainer from './components/Toast';
// funcion centralizada que consulta el estado del backend.
import { getHealth } from "./services/api";
import Sidebar from "./components/Sidebar";
import ModulePlaceholder from "./components/ModulePlaceholder";
import MaterialIcon from "./components/MaterialIcon";
import InventoryPage from "./components/InventoryPage";

let _toastId = 0;

export default function App() {
  const [activeModule, setActiveModule] = useState<AppModule>("sale");
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [modal, setModal] = useState<'payment' | 'success' | 'cancel' | 'ticket' | null>(null);
  const [lastSale, setLastSale] = useState<SaleRecord | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [folioCounter, setFolioCounter] = useState(125);

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

  // Actualiza un producto y refleja el cambio en Venta e Inventario.
  const updateProduct = (updatedProduct: Product) => {
    setProducts((currentProducts) =>
      currentProducts.map((product) =>
        product.id === updatedProduct.id
          ? updatedProduct
          : product,
      ),
    );
  };

  // Agrega un producto local con un identificador nuevo.
  const addProduct = (productData: Omit<Product, "id">) => {
    const newId = Math.max(0, ...products.map((product) => product.id)) + 1;

    setProducts((currentProducts) => [
      ...currentProducts,
      { ...productData, id: newId },
    ]);
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

  const handleConfirmPayment = (paymentData: {
    method: 'efectivo' | 'tarjeta' | 'transferencia';
    cashReceived?: number;
    transferRef?: string;
  }) => {
    const now = new Date();
    const folio = `V-${String(folioCounter).padStart(6, '0')}`;
    const sale: SaleRecord = {
      folio,
      date: now.toLocaleDateString('es-MX'),
      time: now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      items: cart.map(item => {
        const p = getProduct(item.productId);
        return { name: p.name, qty: item.quantity, unitPrice: p.price, subtotal: p.price * item.quantity };
      }),
      subtotal: cartSubtotal,
      discount,
      total: cartTotal,
      paymentMethod: paymentData.method,
      cashReceived: paymentData.cashReceived,
      change: paymentData.cashReceived !== undefined ? paymentData.cashReceived - cartTotal : undefined,
      transferRef: paymentData.transferRef,
    };

    // Deduct stock
    setProducts(prev => prev.map(p => {
      const ci = cart.find(i => i.productId === p.id);
      return ci ? { ...p, stock: p.stock - ci.quantity } : p;
    }));

    setFolioCounter(prev => prev + 1);
    setLastSale(sale);
    setModal('success');
    addToast('Venta realizada correctamente', 'success');
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

      <main className="min-w-0 flex-1 overflow-hidden">
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
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-md"
              style={{ backgroundColor: "#FF5C00" }}
            >
              <MaterialIcon name="point_of_sale" className="text-2xl" filled />
            </div>
              <h1 className="text-2xl font-bold text-[#0D0F14]">Punto de Venta</h1>
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
              style={{ '--tw-ring-color': '#FF5C00' } as React.CSSProperties}
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
      addToast={addToast}
    />
  )}


  {activeModule === "waste" && (
    <ModulePlaceholder
      icon="delete_sweep"
      title="Registro de mermas"
      description="Aquí podrás registrar productos dañados, caducados, perdidos o utilizados internamente."
    />
  )}

  {activeModule === "cash-closing" && (
    <ModulePlaceholder
      icon="payments"
      title="Corte de caja"
      description="Aquí podrás consultar el resumen del turno y comparar el efectivo esperado con el efectivo contado."
    />
  
  )}

  {activeModule === "reports" && (
    <ModulePlaceholder
      icon="bar_chart"
      title="Reportes"
      description="Aquí podrás consultar reportes simulados de ventas y mermas."
    />
  )}
</main>
</div>
);
}
