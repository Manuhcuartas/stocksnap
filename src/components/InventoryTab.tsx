import { Product } from '@/types';

interface Props {
    products: Product[];
    onUpdateStock: (invId: string, current: number, delta: number) => void;
}

export default function InventoryTab({ products, onUpdateStock }: Props) {
    return (
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
                                    <button onClick={() => onUpdateStock(inv.id, inv.stock_count, -1)} disabled={inv.stock_count === 0} className="w-10 h-10 bg-white border-2 border-black font-black text-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] disabled:opacity-30">-</button>
                                    <span className="font-mono text-xl font-black w-8 text-center">{inv.stock_count}</span>
                                    <button onClick={() => onUpdateStock(inv.id, inv.stock_count, 1)} className="w-10 h-10 bg-black text-white border-2 border-black font-black text-xl active:translate-y-[2px]">+</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}