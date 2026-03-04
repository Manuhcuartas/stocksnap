export interface Inventory {
    id: string;
    size: string;
    stock_count: number;
}

export interface Product {
    id: string;
    name: string;
    color: string;
    price?: number;
    image_url?: string;
    inventory: Inventory[];
}

export interface OrderItem {
    id: string;
    product_id: string;
    size: string;
    quantity: number;
    price: number;
    products?: { name: string; color: string };
}

export interface Order {
    id: string;
    customer_info: string;
    status: 'pendiente_pago' | 'pagado' | 'entregado' | 'cancelado';
    created_at: string;
    total_amount: number;
    order_items: OrderItem[];
}