'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { Product, Order } from '@/types';

import Auth from '@/components/Auth';
import InventoryTab from '@/components/InventoryTab';
import OrdersTab from '@/components/OrdersTab';
import OrderModal from '@/components/OrderModal';

export default function StockSnap() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const [activeTab, setActiveTab] = useState<'inventory' | 'orders'>('orders');
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      const { data: prodData } = await supabase.from('products').select(`id, name, color, price, inventory (id, size, stock_count)`);
      if (prodData) {
        setProducts(prodData.map(p => ({ ...p, inventory: p.inventory.sort((a, b) => a.size.localeCompare(b.size)) })) as Product[]);
      }

      const { data: orderData } = await supabase
        .from('orders')
        .select(`*, order_items(*, products(name, color))`)
        .order('created_at', { ascending: false });

      if (orderData) setOrders(orderData as Order[]);

      setLoading(false);
    };

    fetchData();

    const inventoryChannel = supabase.channel('inventory-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'inventory' }, (payload) => {
        setProducts(current => current.map(p => ({
          ...p, inventory: p.inventory.map(inv => inv.id === payload.new.id ? { ...inv, stock_count: payload.new.stock_count } : inv)
        })));
      }).subscribe();

    const ordersChannel = supabase.channel('orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        supabase.from('orders').select(`*, products(name, color)`).order('created_at', { ascending: false })
          .then(({ data }) => { if (data) setOrders(data as Order[]); });
      }).subscribe();

    return () => {
      supabase.removeChannel(inventoryChannel);
      supabase.removeChannel(ordersChannel);
    };
  }, [session]);

  const handleUpdateStock = async (invId: string, current: number, delta: number) => {
    if (current + delta < 0) return;
    await supabase.rpc('update_stock', { inv_id: invId, delta: delta });
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!window.confirm('¿Seguro que quieres cancelar este pedido? Todo el carrito volverá al inventario.')) return;
    await supabase.rpc('cancel_order_and_restock', { p_order_id: orderId });
  };

  const copyToWhatsApp = (order: Order) => {
    const itemsList = order.order_items?.map(item =>
      `👕 ${item.quantity}x ${item.products?.name} - ${item.products?.color} (Talla ${item.size})`
    ).join('\n');

    const text = `Qué pasa ${order.customer_info}! 🤝\n\nTu pedido está reservado:\n${itemsList}\n\nTotal a pagar: ${order.total_amount}€\n\nCuando puedas pásame el Bizum y lo dejamos cerrado 💸`;

    navigator.clipboard.writeText(text);
    alert('Mensaje copiado al portapapeles');
  };

  if (loading) return <div className="min-h-screen bg-[#f4f4f0] flex items-center justify-center font-mono font-bold">CARGANDO...</div>;
  if (!session) return <Auth />;

  return (
    <main className="min-h-screen bg-[#f4f4f0] text-black font-sans pb-24 selection:bg-black selection:text-white relative">
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
        <div className="flex border-2 border-black font-black uppercase">
          <button onClick={() => setActiveTab('orders')} className={`flex-1 py-2 text-center transition-colors ${activeTab === 'orders' ? 'bg-black text-white' : 'bg-white text-black'}`}>Pedidos</button>
          <button onClick={() => setActiveTab('inventory')} className={`flex-1 py-2 text-center border-l-2 border-black transition-colors ${activeTab === 'inventory' ? 'bg-black text-white' : 'bg-white text-black'}`}>Inventario</button>
        </div>
      </header>

      <div className="max-w-md mx-auto p-4 mt-2 space-y-6">
        {activeTab === 'orders' && (
          <OrdersTab
            orders={orders} products={products} onOpenModal={() => setIsModalOpen(true)}
            onUpdateStatus={handleUpdateOrderStatus} onCancelOrder={handleCancelOrder} onCopyWhatsApp={copyToWhatsApp}
          />
        )}
        {activeTab === 'inventory' && (
          <InventoryTab products={products} onUpdateStock={handleUpdateStock} />
        )}
      </div>

      {isModalOpen && <OrderModal products={products} onClose={() => setIsModalOpen(false)} />}
    </main>
  );
}