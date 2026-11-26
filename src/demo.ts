import type { Product } from './api';

export type Movement = { quantity: number; label: string };
export type StockItem = Product & { weeklySales: number; demand: number; movements: Movement[] };
export type Need = { id: string; sku: string; stock: number; threshold: number; at: number };
export type Offer = { id: string; supplier: string; price: number; days: number; minimum: number };
export type OrderStatus = 'draft' | 'ordered' | 'rejected' | 'received';
export type Order = {
  id: string;
  needId: string;
  sku: string;
  offer: Offer;
  units: number;
  received: number;
  status: OrderStatus;
  receipt?: { before: number; units: number; after: number };
};
export type DemoSale = { id: string; sku: string; units: number; before: number; after: number; at: number };
export type Activity = { kind: 'sale' | 'stock' | 'need' | 'analysis' | 'order' | 'receipt'; title: string; detail: string; at: number };
export type Analysis = { needId: string; stock: number; demand: number; offer: Offer; units: number };
export type DemoState = {
  products: StockItem[];
  needs: Need[];
  sales: DemoSale[];
  orders: Order[];
  activity: Activity[];
  analyses: Analysis[];
};
export type StockStatus = 'normal' | 'low' | 'critical';
export type NeedStatus = 'pending' | 'draft' | 'ordered' | 'resolved';

export const offers: Offer[] = [
  { id: 'tecno', supplier: 'TecnoSupply', price: 18500, days: 5, minimum: 10 },
  { id: 'fast', supplier: 'FastParts', price: 20200, days: 2, minimum: 20 },
  { id: 'global', supplier: 'GlobalTech', price: 17900, days: 8, minimum: 15 },
];

const monitorOffer: Offer = { id: 'display', supplier: 'Display Central', price: 62900, days: 4, minimum: 12 };
const storageKey = 'smartstock.supply-demo.v1';
const integer = new Intl.NumberFormat('es-CL');
const decimal = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 });
const clp = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' });
const time = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });

export const numberText = (value: number) => integer.format(value);
export const decimalText = (value: number) => decimal.format(value);
export const money = (value: number) => clp.format(value);
export const timeText = (value: number) => time.format(value);

function today(hour: number, minute: number) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
}

export function seedDemo(afterSale = true): DemoState {
  const saleTime = today(9, 41);
  const keyboardName = 'Teclado Mecánico';
  return {
    products: [
      { sku: 'KB-001', name: keyboardName, stock: afterSale ? 7 : 10, threshold: 7, weeklySales: afterSale ? 14 : 11, demand: 2.1,
        movements: [...(afterSale ? [{ quantity: -3, label: 'Venta V-1032' }] : []), { quantity: -2, label: 'Venta V-1029' }, { quantity: 20, label: 'Recepción OC-0021' }] },
      { sku: 'MN-003', name: 'Monitor 24″', stock: 6, threshold: 5, weeklySales: 7, demand: 1.03,
        movements: [{ quantity: -2, label: 'Venta V-1028' }] },
      { sku: 'MS-002', name: 'Mouse Pro', stock: 34, threshold: 10, weeklySales: 13, demand: 1.9,
        movements: [{ quantity: -2, label: 'Venta V-1031' }, { quantity: 24, label: 'Recepción OC-0022' }] },
      { sku: 'HB-004', name: 'Hub USB-C', stock: 18, threshold: 8, weeklySales: 9, demand: 1.29,
        movements: [{ quantity: -7, label: 'Venta V-1030' }] },
      { sku: 'CB-005', name: 'Cable HDMI 2 m', stock: 42, threshold: 15, weeklySales: 20, demand: 2.86,
        movements: [{ quantity: -12, label: 'Venta V-1027' }] },
    ],
    sales: [
      ...(afterSale ? [{ id: 'V-1032', sku: 'KB-001', units: 3, before: 10, after: 7, at: saleTime }] : []),
      { id: 'V-1031', sku: 'MS-002', units: 2, before: 36, after: 34, at: today(9, 18) },
      { id: 'V-1030', sku: 'HB-004', units: 7, before: 25, after: 18, at: today(8, 54) },
      { id: 'V-1027', sku: 'CB-005', units: 12, before: 54, after: 42, at: today(8, 29) },
    ],
    needs: [
      ...(afterSale ? [{ id: 'N-0108', sku: 'KB-001', stock: 7, threshold: 7, at: saleTime }] : []),
      { id: 'N-0107', sku: 'MN-003', stock: 5, threshold: 5, at: today(8, 12) },
    ],
    orders: [
      { id: 'OC-0023', needId: 'N-0107', sku: 'MN-003', offer: monitorOffer, units: 12, received: 0, status: 'ordered' },
    ],
    activity: [
      ...(afterSale ? [
        { kind: 'need', title: 'Necesidad de reposición creada', detail: keyboardName + ' espera análisis', at: saleTime },
        { kind: 'stock', title: 'Stock crítico detectado', detail: 'KB-001 llegó al umbral de 7 unidades', at: saleTime },
        { kind: 'sale', title: 'Venta registrada', detail: '3 × ' + keyboardName, at: saleTime },
      ] as Activity[] : []),
      { kind: 'sale', title: 'Venta registrada', detail: '2 × Mouse Pro', at: today(9, 18) },
      { kind: 'order', title: 'Orden aprobada', detail: 'OC-0023 · 12 monitores en camino', at: today(8, 40) },
    ],
    analyses: [],
  };
}

export function readDemo(): DemoState {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (raw) {
      const state = JSON.parse(raw) as DemoState;
      if ([state.products, state.needs, state.sales, state.orders, state.activity, state.analyses].every(Array.isArray)) {
        return state;
      }
    }
  } catch {
    // A fresh scenario is still usable when storage is unavailable.
  }
  return seedDemo();
}

export function saveDemo(state: DemoState) {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // State remains available for the current page.
  }
}

export function stockStatus(product: Product): StockStatus {
  if (product.stock <= product.threshold) return 'critical';
  return product.stock <= product.threshold * 1.5 ? 'low' : 'normal';
}

export function coverage(product: Pick<StockItem, 'stock' | 'demand'>) {
  return product.demand > 0 ? product.stock / product.demand : null;
}

export function incoming(orders: Order[], sku: string) {
  return orders.reduce((total, order) => total + (order.sku === sku && order.status === 'ordered' ? order.units - order.received : 0), 0);
}

export function needStatus(orders: Order[], needId: string): NeedStatus {
  const status = orders.find((item) => item.needId === needId && item.status !== 'rejected')?.status;
  if (status === 'received') return 'resolved';
  return status === 'draft' || status === 'ordered' ? status : 'pending';
}

export function quotesFor(sku: string): Offer[] {
  return sku === 'MN-003' ? [monitorOffer] : offers;
}

export function recommendedOffer(product: StockItem, quotes: Offer[]) {
  const days = coverage(product);
  const byPrice = [...quotes].sort((first, second) => first.price - second.price);
  return (days !== null ? byPrice.find((offer) => offer.days <= days) : byPrice[0])
    ?? [...quotes].sort((first, second) => first.days - second.days)[0];
}

export function addSale(state: DemoState, sku: string, quantity: number): DemoState {
  const product = state.products.find((item) => item.sku === sku);
  if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > product.stock) return state;

  const at = Date.now();
  const after = product.stock - quantity;
  const id = 'V-' + (1033 + state.sales.length);
  const sale = { id, sku, units: quantity, before: product.stock, after, at };
  const crossesThreshold = product.stock > product.threshold && after <= product.threshold;
  const hasNeed = state.needs.some((need) => need.sku === sku && needStatus(state.orders, need.id) !== 'resolved');
  const need = crossesThreshold && !hasNeed ? { id: 'N-' + (109 + state.needs.length).toString().padStart(4, '0'), sku, stock: after, threshold: product.threshold, at } : null;
  const activity: Activity[] = [{ kind: 'sale', title: 'Venta registrada', detail: quantity + ' × ' + product.name, at }];
  if (crossesThreshold) activity.unshift({ kind: 'stock', title: 'Stock crítico detectado', detail: sku + ' bajó a ' + after + ' unidades', at });
  if (need) activity.unshift({ kind: 'need', title: 'Necesidad de reposición creada', detail: product.name + ' espera análisis', at });

  return {
    ...state,
    products: state.products.map((item) => item.sku !== sku ? item : {
      ...item, stock: after, weeklySales: item.weeklySales + quantity,
      movements: [{ quantity: -quantity, label: 'Venta ' + id }, ...item.movements],
    }),
    sales: [sale, ...state.sales],
    needs: need ? [need, ...state.needs] : state.needs,
    activity: [...activity, ...state.activity],
  };
}

export function analyzeNeed(state: DemoState, needId: string) {
  const need = state.needs.find((item) => item.id === needId);
  const product = state.products.find((item) => item.sku === need?.sku);
  if (!need || !product || needStatus(state.orders, needId) !== 'pending' || state.analyses.some((item) => item.needId === needId)) return state;
  const offer = recommendedOffer(product, quotesFor(product.sku));
  const units = Math.max(offer.minimum, product.threshold + 1 - product.stock);
  return {
    ...state,
    analyses: [{ needId, stock: product.stock, demand: product.demand, offer, units }, ...state.analyses],
    activity: [{ kind: 'analysis', title: 'Recomendación disponible', detail: product.name, at: Date.now() } as Activity, ...state.activity],
  };
}

export function createDraft(state: DemoState, needId: string) {
  const need = state.needs.find((item) => item.id === needId);
  const analysis = state.analyses.find((item) => item.needId === needId);
  if (!need || !analysis || needStatus(state.orders, needId) !== 'pending') return state;

  const id = 'OC-' + (23 + state.orders.length).toString().padStart(4, '0');
  const { offer, units } = analysis;
  const order: Order = { id, needId, sku: need.sku, offer, units, received: 0, status: 'draft' };
  return {
    ...state,
    orders: [order, ...state.orders],
    activity: [{ kind: 'order', title: 'Borrador creado', detail: id + ' · ' + offer.supplier, at: Date.now() } as Activity, ...state.activity],
  };
}

export function decideOrder(state: DemoState, id: string, status: 'ordered' | 'rejected') {
  const order = state.orders.find((item) => item.id === id);
  if (!order || order.status !== 'draft') return state;
  return {
    ...state,
    orders: state.orders.map((item) => item.id === id ? { ...item, status } : item),
    activity: [{
      kind: 'order', title: status === 'ordered' ? 'Orden aprobada' : 'Orden rechazada',
      detail: id + ' · ' + order.offer.supplier, at: Date.now(),
    } as Activity, ...state.activity],
  };
}

export function receiveOrder(state: DemoState, id: string, quantity: number): DemoState {
  const order = state.orders.find((item) => item.id === id);
  const product = state.products.find((item) => item.sku === order?.sku);
  if (!order || !product || order.status !== 'ordered' || !Number.isInteger(quantity) || quantity < 1 || quantity > order.units - order.received) {
    return state;
  }

  const receipt = { before: product.stock, units: quantity, after: product.stock + quantity };
  const received = order.received + quantity;
  return {
    ...state,
    orders: state.orders.map((item) => item.id === id ? { ...item, received, receipt, status: received === item.units ? 'received' : 'ordered' } : item),
    products: state.products.map((item) => item.sku !== order.sku ? item : {
      ...item, stock: receipt.after, movements: [{ quantity, label: 'Recepción ' + id }, ...item.movements],
    }),
    activity: [{ kind: 'receipt', title: 'Recepción registrada', detail: '+' + quantity + ' × ' + product.name, at: Date.now() }, ...state.activity],
  };
}
