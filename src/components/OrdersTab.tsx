import { useState } from 'react';
import { Order, Product } from '@/types';

interface Props {
    orders: Order[];
    products: Product[];
    onOpenModal: () => void;
    onUpdateStatus: (orderId: string, newStatus: string) => void;
    onCancelOrder: (orderId: string) => void;
    onCopyWhatsApp: (order: Order) => void;
}

export default function OrdersTab({ orders, products, onOpenModal, onUpdateStatus, onCancelOrder, onCopyWhatsApp }: Props) {
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterProduct, setFilterProduct] = useState<string>('all');

    // Filtrado
    const filteredOrders = orders.filter(order => {
        const matchStatus = filterStatus === 'all' || order.status === filterStatus;
        const matchProduct = filterProduct === 'all' || order.order_items?.some(item => item.products?.name === filterProduct);
        return matchStatus && matchProduct;
    });

    // Generador de CSV Logístico (Optimizado para Excel en celdas)
    const exportToCSV = () => {
        const exportableOrders = orders.filter(o => o.status === 'pagado');

        if (exportableOrders.length === 0) {
            alert("No hay pedidos pagados para exportar.");
            return;
        }

        // \uFEFF es el BOM (Byte Order Mark) para que Excel lea los acentos.
        // Usamos punto y coma (;) como separador de columnas.
        let csvContent = "\uFEFFTicket;Cliente IG;Prenda;Color;Talla;Cantidad\n";

        exportableOrders.forEach(order => {
            const ticketId = order.id.split('-')[0].toUpperCase();

            order.order_items?.forEach(item => {
                const row = [
                    `"${ticketId}"`,
                    `"${order.customer_info}"`,
                    `"${item.products?.name}"`,
                    `"${item.products?.color}"`,
                    `"${item.size}"`,
                    `"${item.quantity}"`
                ].join(";"); // <-- Separador cambiado a punto y coma

                csvContent += row + "\n";
            });
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `logistica_pagados_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-4">
            {/* HUD de Métricas Rápidas */}
            <div className="grid grid-cols-2 gap-2 mb-4 font-mono font-bold text-xs text-center">
                <div className="bg-yellow-100 border-2 border-black p-2">
                    <span className="block text-xl font-black">{orders.filter(o => o.status === 'pendiente_pago').length}</span> Pendiente de pago
                </div>
                <div className="bg-green-100 border-2 border-black p-2">
                    <span className="block text-xl font-black">{orders.filter(o => o.status === 'pagado').length}</span> Pagado
                </div>
                <div className="bg-blue-100 border-2 border-black p-2">
                    <span className="block text-xl font-black">{orders.filter(o => o.status === 'entregado').length}</span> Entregado
                </div>
                <div className="bg-red-100 border-2 border-black p-2">
                    <span className="block text-xl font-black">{orders.filter(o => o.status === 'cancelado').length}</span> Cancelado
                </div>
            </div>

            <div className="flex gap-2 mb-4">
                <button onClick={onOpenModal} className="flex-1 bg-[#ccff00] text-black border-4 border-black p-3 font-black uppercase text-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all">
                    + Pedido
                </button>
                <button onClick={exportToCSV} className="bg-white text-black border-4 border-black p-3 font-black uppercase text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all flex flex-col items-center justify-center">
                    <span>CSV</span>
                    <span className="text-[10px] font-mono">Preparar</span>
                </button>
            </div>

            {/* CONTROLES DE FILTRO */}
            <div className="flex gap-2 mb-4">
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="flex-1 border-2 border-black p-2 font-bold text-xs uppercase bg-white outline-none">
                    <option value="all">Todos los estados</option>
                    <option value="pendiente_pago">Pendiente de pago</option>
                    <option value="pagado">Pagado</option>
                    <option value="entregado">Entregado</option>
                    <option value="cancelado">Cancelado</option>
                </select>
                <select value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)} className="flex-1 border-2 border-black p-2 font-bold text-xs uppercase bg-white outline-none">
                    <option value="all">Todas las prendas</option>
                    {Array.from(new Set(products.map(p => p.name))).map(name => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                </select>
            </div>

            {/* LISTA DE PEDIDOS */}
            {filteredOrders.length === 0 ? (
                <p className="text-center font-mono font-bold text-gray-500 py-10">No hay pedidos que coincidan.</p>
            ) : (
                filteredOrders.map(order => (
                    <div key={order.id} className={`border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${order.status === 'cancelado' ? 'bg-red-50 opacity-60' : 'bg-white'}`}>
                        <div className="flex justify-between items-start mb-2 border-b-2 border-black pb-2">
                            <div>
                                <h3 className={`font-black text-lg ${order.status === 'cancelado' ? 'line-through' : ''}`}>{order.customer_info}</h3>

                                {/* Mapeo del carrito */}
                                <div className="mt-2 space-y-1">
                                    {order.order_items?.map(item => (
                                        <p key={item.id} className="font-mono text-sm font-bold bg-gray-100 inline-block px-1 border border-black w-full">
                                            {item.quantity}x {item.products?.name} - {item.products?.color} (Talla {item.size})
                                        </p>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col items-end gap-2">
                                <span className="font-black text-xl">{order.total_amount}€</span>
                                {order.status === 'pendiente_pago' && (
                                    <button onClick={() => onCopyWhatsApp(order)} className="text-2xl hover:scale-110 transition-transform" title="Copiar mensaje">💬</button>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-2 mt-3">
                            {order.status === 'pendiente_pago' && (
                                <button onClick={() => onUpdateStatus(order.id, 'pagado')} className="flex-1 bg-yellow-400 border-2 border-black py-2 font-black uppercase text-xs active:translate-y-[2px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">Marcar Pagado</button>
                            )}
                            {order.status === 'pagado' && (
                                <button onClick={() => onUpdateStatus(order.id, 'entregado')} className="flex-1 bg-green-400 border-2 border-black py-2 font-black uppercase text-xs active:translate-y-[2px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">Marcar Entregado</button>
                            )}
                            {order.status === 'entregado' && (
                                <span className="flex-1 bg-gray-200 border-2 border-black py-2 font-black uppercase text-xs text-center">Entregado ✓</span>
                            )}
                            {order.status === 'cancelado' && (
                                <span className="flex-1 bg-red-200 border-2 border-red-800 text-red-800 py-2 font-black uppercase text-xs text-center">Cancelado 🚫</span>
                            )}
                            {order.status !== 'cancelado' && (
                                <button onClick={() => onCancelOrder(order.id)} className="px-3 bg-red-400 border-2 border-black py-2 font-black uppercase text-xs text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px]" title="Cancelar">✖</button>
                            )}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}