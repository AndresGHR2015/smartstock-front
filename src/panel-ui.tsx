import type { ReactNode } from 'react';
import type { Product } from './api';
import { stockStatus, type NeedStatus, type OrderStatus, type StockStatus } from './demo';

export type View = 'dashboard' | 'inventario' | 'ventas' | 'compras' | 'reposicion';

export const views: { id: View; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '⌂' },
  { id: 'inventario', label: 'Inventario', icon: '▦' },
  { id: 'ventas', label: 'Ventas', icon: '↗' },
  { id: 'compras', label: 'Compras', icon: '▤' },
  { id: 'reposicion', label: 'Reposición IA', icon: '✦' },
];

export function href(view: View, detail?: string) {
  return '#/' + view + (detail ? '/' + encodeURIComponent(detail) : '');
}

export const stockLabels: Record<StockStatus, string> = { normal: 'Normal', low: 'Stock bajo', critical: 'Crítico' };
export const needLabels: Record<NeedStatus, string> = {
  pending: 'Pendiente de análisis', draft: 'Borrador', ordered: 'En camino', resolved: 'Resuelta',
};
export const orderLabels: Record<OrderStatus, string> = {
  draft: 'Borrador', ordered: 'Aprobada', rejected: 'Rechazada', received: 'Recibida',
};

export function StockBadge({ product }: { product: Product }) {
  const status = stockStatus(product);
  return <span className={'badge ' + status}>{stockLabels[status]}</span>;
}

export function PageHeading({ title, summary, children }: { title: string; summary: string; children?: ReactNode }) {
  return (
    <div className="section-intro">
      <div><h1>{title}</h1><p>{summary}</p></div>
      {children}
    </div>
  );
}

export function TableFrame({ label, children }: { label: string; children: ReactNode }) {
  return <div className="table-region" role="region" aria-label={label} tabIndex={0}>{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="surface-empty">{children}</p>;
}
