'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

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

export default function StockSnap() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Verificación de sesión al cargar la app
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Carga de productos condicionada a tener sesión
  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }

    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`id, name, color, inventory (id, size, stock_count)`);

      if (error) {
        console.error('Error cargando productos:', error);
        return;
      }

      const formattedData = data?.map(p => ({
        ...p,
        inventory: p.inventory.sort((a, b) => a.size.localeCompare(b.size))
      })) as Product[];

      setProducts(formattedData);
      setLoading(false);
    };

    fetchProducts();

    const channel = supabase
      .channel('inventory-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'inventory' },
        (payload) => {
          setProducts((currentProducts) =>
            currentProducts.map((product) => ({
              ...product,
              inventory: product.inventory.map((inv) =>
                inv.id === payload.new.id
                  ? { ...inv, stock_count: payload.new.stock_count }
                  : inv
              ),
            }))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  // 3. Funciones de Autenticación y Actualización
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) setLoginError('Credenciales incorrectas');
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setProducts([]);
  };

  const handleUpdateStock = async (inventoryId: string, currentStock: number, delta: number) => {
    if (currentStock + delta < 0) return;
    const { error } = await supabase.rpc('update_stock', { inv_id: inventoryId, delta: delta });
    if (error) console.error('Error actualizando stock:', error);
  };

  if (loading) return (
    <div className="min-h-screen bg-[#f4f4f0] flex items-center justify-center font-mono text-black font-bold">
      CARGANDO...
    </div>
  );

  // 4. Interfaz de Login (Si no hay sesión)
  if (!session) {
    return (
      <main className="min-h-screen bg-[#f4f4f0] flex items-center justify-center p-4 selection:bg-black selection:text-white font-sans">
        <div className="bg-white border-4 border-black p-6 w-full max-w-sm shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <h1 className="text-3xl font-black uppercase tracking-tighter mb-6 text-center border-b-4 border-black pb-4">Acceso<br />StockSnap</h1>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block font-mono font-bold text-sm uppercase mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border-2 border-black p-3 outline-none focus:ring-2 focus:ring-black focus:bg-gray-50 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block font-mono font-bold text-sm uppercase mb-1">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border-2 border-black p-3 outline-none focus:ring-2 focus:ring-black focus:bg-gray-50 transition-colors"
                required
              />
            </div>

            {loginError && <p className="font-mono text-red-600 font-bold text-sm bg-red-100 p-2 border-2 border-red-600">{loginError}</p>}

            <button
              type="submit"
              className="w-full bg-black text-white font-black uppercase tracking-widest p-4 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:bg-gray-800 active:translate-y-[4px] active:translate-x-[4px] active:shadow-none transition-all mt-4"
            >
              Entrar
            </button>
          </form>
        </div>
      </main>
    );
  }

  // 5. Interfaz Principal (Si hay sesión activa)
  return (
    <main className="min-h-screen bg-[#f4f4f0] text-black font-sans pb-20 selection:bg-black selection:text-white">
      <header className="bg-white border-b-4 border-black p-4 sticky top-0 z-10 flex justify-between items-center">
        <h1 className="text-2xl font-black tracking-tighter uppercase">StockSnap</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500 border border-black"></span>
            </span>
            <span className="text-xs font-mono font-bold uppercase hidden sm:block">Live</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs font-mono font-bold uppercase bg-gray-200 px-2 py-1 border-2 border-black active:bg-gray-300"
          >
            Salir
          </button>
        </div>
      </header>

      <div className="max-w-md mx-auto p-4 mt-4 space-y-6">
        {products.map((product) => (
          <div key={product.id} className="bg-white border-4 border-black rounded-xl p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <div className="mb-6 border-b-2 border-dashed border-gray-300 pb-4">
              <h2 className="text-xl font-black uppercase tracking-tight">{product.name}</h2>
              <p className="text-sm font-mono text-gray-600 font-bold bg-gray-100 inline-block px-2 py-1 mt-1 border border-black">
                {product.color}
              </p>
            </div>

            <div className="space-y-4">
              {product.inventory.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 w-1/3">
                    <span className="font-mono text-2xl font-black">{inv.size}</span>
                    <span className={`h-4 w-4 border-2 border-black rounded-none ${inv.stock_count === 0 ? 'bg-red-500' :
                        inv.stock_count <= 5 ? 'bg-yellow-400' : 'bg-green-400'
                      }`}></span>
                  </div>

                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleUpdateStock(inv.id, inv.stock_count, -1)}
                      disabled={inv.stock_count === 0}
                      className="w-12 h-12 flex items-center justify-center bg-white border-2 border-black text-black font-black text-2xl rounded-lg shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-[3px] active:translate-x-[3px] active:shadow-none transition-all disabled:opacity-30 disabled:active:translate-y-0 disabled:active:translate-x-0 disabled:active:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                    >
                      -
                    </button>

                    <span className="font-mono text-2xl font-black w-8 text-center bg-gray-100 py-1 border-2 border-black">
                      {inv.stock_count}
                    </span>

                    <button
                      onClick={() => handleUpdateStock(inv.id, inv.stock_count, 1)}
                      className="w-12 h-12 flex items-center justify-center bg-black border-2 border-black text-white font-black text-2xl rounded-lg shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)] hover:bg-gray-800 active:translate-y-[3px] active:translate-x-[3px] active:shadow-none transition-all"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}