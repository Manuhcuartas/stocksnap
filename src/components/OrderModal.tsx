import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Product } from '@/types';

interface Props {
    products: Product[];
    onClose: () => void;
}

export default function OrderModal({ products, onClose }: Props) {
    const [customer, setCustomer] = useState('');
    const [productName, setProductName] = useState('');
    const [productColor, setProductColor] = useState('');
    const [size, setSize] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        setIsSubmitting(true);

        const selectedProduct = products.find(p => p.name === productName && p.color === productColor);
        if (!customer || !selectedProduct || !size) {
            setErrorMsg('Faltan datos');
            setIsSubmitting(false);
            return;
        }

        const cartItems = [{
            product_id: selectedProduct.id,
            size: size,
            quantity: 1
        }];

        const { error } = await supabase.rpc('process_cart_order', {
            p_customer_info: customer,
            p_items: cartItems
        });

        if (error) {
            setErrorMsg(error.message || 'Error al procesar el pedido (¿Stock agotado?)');
            setIsSubmitting(false);
        } else {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border-4 border-black w-full max-w-sm p-6 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex justify-between items-center border-b-4 border-black pb-2 mb-4">
                    <h2 className="text-2xl font-black uppercase">Registrar Venta</h2>
                    <button onClick={onClose} className="font-black text-xl">X</button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block font-mono font-bold text-sm uppercase mb-1">Cliente (IG / Nombre)</label>
                        <input type="text" value={customer} onChange={e => setCustomer(e.target.value)} className="w-full border-2 border-black p-3 font-mono" placeholder="@usuario_ig" required />
                    </div>

                    <div>
                        <label className="block font-mono font-bold text-sm uppercase mb-1">Modelo</label>
                        <select value={productName} onChange={e => { setProductName(e.target.value); setProductColor(''); setSize(''); }} className="w-full border-2 border-black p-3 font-bold uppercase" required>
                            <option value="" disabled>Seleccionar modelo...</option>
                            {Array.from(new Set(products.map(p => p.name))).map(name => <option key={name} value={name}>{name}</option>)}
                        </select>
                    </div>

                    {productName && (
                        <div>
                            <label className="block font-mono font-bold text-sm uppercase mb-1">Color / Variante</label>
                            <select value={productColor} onChange={e => { setProductColor(e.target.value); setSize(''); }} className="w-full border-2 border-black p-3 font-bold uppercase" required>
                                <option value="" disabled>Seleccionar color...</option>
                                {products.filter(p => p.name === productName).map(p => <option key={p.id} value={p.color}>{p.color}</option>)}
                            </select>
                        </div>
                    )}

                    {productColor && (
                        <div>
                            <label className="block font-mono font-bold text-sm uppercase mb-1">Talla</label>
                            <select value={size} onChange={e => setSize(e.target.value)} className="w-full border-2 border-black p-3 font-bold uppercase" required>
                                <option value="" disabled>Seleccionar talla...</option>
                                {products.find(p => p.name === productName && p.color === productColor)?.inventory.map(inv => (
                                    <option key={inv.size} value={inv.size} disabled={inv.stock_count === 0}>{inv.size} (Stock: {inv.stock_count})</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {errorMsg && <p className="font-mono text-red-600 font-bold bg-red-100 p-2 border-2 border-red-600 text-sm">{errorMsg}</p>}
                    <button type="submit" disabled={isSubmitting} className="w-full bg-black text-white font-black uppercase p-4 border-2 border-black mt-4 hover:bg-gray-800 disabled:opacity-50">
                        {isSubmitting ? 'Guardando...' : 'Crear Pedido'}
                    </button>
                </form>
            </div>
        </div>
    );
}