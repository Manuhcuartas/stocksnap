'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

// --- TIPOS ---
interface Inventory {
  id: string;
  size: string;
  stock_count: number;
}

interface Product {
  id: string;
  name: string;
  color: string;
  inventory: Inventory[];
}

interface Order {
  id: string;
  customer_info: string;
  product_id: string;
  size: string;
  status: 'pendiente_pago' | 'pagado' | 'entregado' | 'cancelado';
  created_at: string;
  products?: { name: string; color: string };
}

export default function StockSnap() {
  // --- ESTADOS ---
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(true);

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  // UI States
  const [activeTab, setActiveTab] = useState<'inventory' | 'orders'>('orders');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form States para Nuevo Pedido
  const [newOrderCustomer, setNewOrderCustomer] = useState('');
  const [newOrderProductName, setNewOrderProductName] = useState('');
  const [newOrderProductColor, setNewOrderProductColor] = useState('');
  const [newOrderSize, setNewOrderSize] = useState('');
  const [orderError, setOrderError] = useState('');

  // --- EFECTOS ---
  // 1. Gestión de Sesión
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  // 2. Carga de Datos y Tiempo Real
  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      // Cargar Productos
      const { data: prodData } = await supabase
        .from('products')
        .select(`id, name, color, inventory (id, size, stock_count)`);

      if (prodData) {
        setProducts(prodData.map(p => ({
          ...p,
          inventory: p.inventory.sort((a, b) => a.size.localeCompare(b.size))
        })) as Product[]);
      }

      // Cargar Pedidos
      const { data: orderData } = await supabase
        .from('orders')
        .select(`*, products(name, color)`)
        .order('created_at', { ascending: false });

      if (orderData) setOrders(orderData as Order[]);

      setLoading(false);
    };

    fetchData();

    // Suscripciones Tiempo Real
    const inventoryChannel = supabase.channel('inventory-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'inventory' }, (payload) => {
        setProducts(current => current.map(p => ({
          ...p,
          inventory: p.inventory.map(inv => inv.id === payload.new.id ? { ...inv, stock_count: payload.new.stock_count } : inv)
        })));
      }).subscribe();

    const ordersChannel = supabase.channel('orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        // Al haber cualquier cambio en pedidos (insert/update), recargamos la lista
        supabase.from('orders').select(`*, products(name, color)`).order('created_at', { ascending: false })
          .then(({ data }) => { if (data) setOrders(data as Order[]); });
      }).subscribe();

    return () => {
      supabase.removeChannel(inventoryChannel);
      supabase.removeChannel(ordersChannel);
    };
  }, [session]);

  // --- HANDLERS (Auth & Acciones) ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoginError('Credenciales incorrectas');
    setLoading(false);
  };

  const handleUpdateStock = async (invId: string, current: number, delta: number) => {
    if (current + delta < 0) return;
    await supabase.rpc('update_stock', { inv_id: invId, delta: delta });
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderError('');

    // Buscar el producto exacto seleccionado para obtener su ID
    const selectedProduct = products.find(
      p => p.name === newOrderProductName && p.color === newOrderProductColor
    );

    if (!newOrderCustomer || !selectedProduct || !newOrderSize) {
      setOrderError('Faltan datos');
      return;
    }

    const { error } = await supabase.rpc('process_new_order', {
      p_customer_info: newOrderCustomer,
      p_product_id: selectedProduct.id,
      p_size: newOrderSize
    });

    if (error) {
      setOrderError(error.message || 'Error al procesar el pedido (¿Stock agotado?)');
    } else {
      setIsModalOpen(false);
      setNewOrderCustomer('');
      setNewOrderProductName('');
      setNewOrderProductColor('');
      setNewOrderSize('');
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
  };

  // --- RENDERIZADO ---
  if (loading) return <div className="min-h-screen bg-[#f4f4f0] flex items-center justify-center font-mono font-bold">CARGANDO...</div>;

  // Pantalla de Login
  if (!session) {
    return (
      <main className="min-h-screen bg-[#f4f4f0] flex items-center justify-center p-4">
        <div className="bg-white border-4 border-black p-6 w-full max-w-sm shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <h1 className="text-3xl font-black uppercase tracking-tighter mb-6 text-center border-b-4 border-black pb-4">Acceso</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border-2 border-black p-3" required />
            <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} className="w-full border-2 border-black p-3" required />
            {loginError && <p className="font-mono text-red-600 font-bold bg-red-100 p-2 border-2 border-red-600">{loginError}</p>}
            <button type="submit" className="w-full bg-black text-white font-black uppercase p-4 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] active:translate-y-[4px] active:translate-x-[4px] active:shadow-none">Entrar</button>
          </form>
        </div>
      </main>
    );
  }

  // App Principal
  return (
    <main className="min-h-screen bg-[#f4f4f0] text-black font-sans pb-24 selection:bg-black selection:text-white relative">
      {/* Header Fijo */}
      <header className="bg-white border-b-4 border-black p-4 sticky top-0 z-10 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-black tracking-tighter uppercase">StockSnap</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-green-500 border border-black"></span></span>
            </div>
            <button onClick={() => supabase.auth.signOut()} className="text-xs font-mono font-bold uppercase bg-gray-200 px-2 py-1 border-2 border-black">Salir</button>
          </div>
        </div>

        {/* Pestañas de Navegación */}
        <div className="flex border-2 border-black font-black uppercase">
          <button onClick={() => setActiveTab('orders')} className={`flex-1 py-2 text-center transition-colors ${activeTab === 'orders' ? 'bg-black text-white' : 'bg-white text-black'}`}>Pedidos</button>
          <button onClick={() => setActiveTab('inventory')} className={`flex-1 py-2 text-center border-l-2 border-black transition-colors ${activeTab === 'inventory' ? 'bg-black text-white' : 'bg-white text-black'}`}>Inventario</button>
        </div>
      </header>

      <div className="max-w-md mx-auto p-4 mt-2 space-y-6">

        {/* PESTAÑA: PEDIDOS */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full bg-[#ccff00] text-black border-4 border-black p-4 font-black uppercase text-xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-[4px] active:translate-x-[4px] active:shadow-none transition-all mb-4"
            >
              + Nuevo Pedido
            </button>

            {orders.length === 0 ? (
              <p className="text-center font-mono font-bold text-gray-500 py-10">No hay pedidos registrados.</p>
            ) : (
              orders.map(order => (
                <div key={order.id} className="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <div className="flex justify-between items-start mb-2 border-b-2 border-black pb-2">
                    <div>
                      <h3 className="font-black text-lg">{order.customer_info}</h3>
                      <p className="font-mono text-sm">{order.products?.name} - Talla {order.size}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3">
                    {order.status === 'pendiente_pago' && (
                      <button onClick={() => handleUpdateOrderStatus(order.id, 'pagado')} className="flex-1 bg-yellow-400 border-2 border-black py-2 font-black uppercase text-xs active:bg-yellow-500">Marcar Pagado</button>
                    )}
                    {order.status === 'pagado' && (
                      <button onClick={() => handleUpdateOrderStatus(order.id, 'entregado')} className="flex-1 bg-green-400 border-2 border-black py-2 font-black uppercase text-xs active:bg-green-500">Marcar Entregado</button>
                    )}
                    {order.status === 'entregado' && (
                      <span className="flex-1 bg-gray-200 border-2 border-black py-2 font-black uppercase text-xs text-center">Entregado ✓</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* PESTAÑA: INVENTARIO */}
        {activeTab === 'inventory' && (
          <div className="space-y-6">
            <div className="bg-yellow-200 border-2 border-black p-3 text-xs font-mono font-bold uppercase">
              ⚠️ Ajuste manual. Usar solo para mermas o devoluciones. Las ventas se restan solas en Pedidos.
            </div>
            {products.map((product) => (
              <div key={product.id} className="bg-white border-4 border-black p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <div className="mb-4 border-b-2 border-dashed border-gray-300 pb-2">
                  <h2 className="text-xl font-black uppercase">{product.name}</h2>
                  <p className="text-sm font-mono font-bold bg-gray-100 inline-block px-2 border border-black">{product.color}</p>
                </div>
                <div className="space-y-3">
                  {product.inventory.map((inv) => (
                    <div key={inv.id} className="flex justify-between items-center">
                      <div className="flex items-center gap-3 w-1/3">
                        <span className="font-mono text-2xl font-black">{inv.size}</span>
                        <span className={`h-4 w-4 border-2 border-black ${inv.stock_count === 0 ? 'bg-red-500' : inv.stock_count <= 5 ? 'bg-yellow-400' : 'bg-green-400'}`}></span>
                      </div>
                      <div className="flex items-center gap-4">
                        <button onClick={() => handleUpdateStock(inv.id, inv.stock_count, -1)} disabled={inv.stock_count === 0} className="w-10 h-10 bg-white border-2 border-black font-black text-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] disabled:opacity-30">-</button>
                        <span className="font-mono text-xl font-black w-8 text-center">{inv.stock_count}</span>
                        <button onClick={() => handleUpdateStock(inv.id, inv.stock_count, 1)} className="w-10 h-10 bg-black text-white border-2 border-black font-black text-xl active:translate-y-[2px]">+</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL: NUEVO PEDIDO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black w-full max-w-sm p-6 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex justify-between items-center border-b-4 border-black pb-2 mb-4">
              <h2 className="text-2xl font-black uppercase">Registrar Venta</h2>
              <button onClick={() => setIsModalOpen(false)} className="font-black text-xl">X</button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div>
                <label className="block font-mono font-bold text-sm uppercase mb-1">Cliente (IG / Nombre)</label>
                <input type="text" value={newOrderCustomer} onChange={e => setNewOrderCustomer(e.target.value)} className="w-full border-2 border-black p-3 font-mono" placeholder="@usuario_ig" required />
              </div>

              {/* Selector 1: Modelo (Agrupado) */}
              <div>
                <label className="block font-mono font-bold text-sm uppercase mb-1">Modelo</label>
                <select
                  value={newOrderProductName}
                  onChange={e => {
                    setNewOrderProductName(e.target.value);
                    setNewOrderProductColor(''); // Resetea color al cambiar modelo
                    setNewOrderSize('');         // Resetea talla
                  }}
                  className="w-full border-2 border-black p-3 font-bold uppercase"
                  required
                >
                  <option value="" disabled>Seleccionar modelo...</option>
                  {/* Extraer nombres únicos para no duplicar en el select */}
                  {Array.from(new Set(products.map(p => p.name))).map(uniqueName => (
                    <option key={uniqueName} value={uniqueName}>{uniqueName}</option>
                  ))}
                </select>
              </div>

              {/* Selector 2: Color (Aparece al elegir modelo) */}
              {newOrderProductName && (
                <div>
                  <label className="block font-mono font-bold text-sm uppercase mb-1">Color / Variante</label>
                  <select
                    value={newOrderProductColor}
                    onChange={e => {
                      setNewOrderProductColor(e.target.value);
                      setNewOrderSize(''); // Resetea talla al cambiar color
                    }}
                    className="w-full border-2 border-black p-3 font-bold uppercase"
                    required
                  >
                    <option value="" disabled>Seleccionar color...</option>
                    {products
                      .filter(p => p.name === newOrderProductName)
                      .map(p => (
                        <option key={p.id} value={p.color}>{p.color}</option>
                      ))}
                  </select>
                </div>
              )}

              {/* Selector 3: Talla (Aparece al elegir color) */}
              {newOrderProductColor && (
                <div>
                  <label className="block font-mono font-bold text-sm uppercase mb-1">Talla</label>
                  <select
                    value={newOrderSize}
                    onChange={e => setNewOrderSize(e.target.value)}
                    className="w-full border-2 border-black p-3 font-bold uppercase"
                    required
                  >
                    <option value="" disabled>Seleccionar talla...</option>
                    {products
                      .find(p => p.name === newOrderProductName && p.color === newOrderProductColor)
                      ?.inventory.map(inv => (
                        <option key={inv.size} value={inv.size} disabled={inv.stock_count === 0}>
                          {inv.size} (Stock: {inv.stock_count})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {orderError && <p className="font-mono text-red-600 font-bold bg-red-100 p-2 border-2 border-red-600 text-sm">{orderError}</p>}

              <button type="submit" className="w-full bg-black text-white font-black uppercase p-4 border-2 border-black mt-4 hover:bg-gray-800">Crear Pedido</button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}