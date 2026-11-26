import type { Intent } from './api';

const prefix = 'smartstock.sale-intent.v1.';

export function readIntent(): Intent | null {
  const key = Object.keys(localStorage).find((item) => item.startsWith(prefix));
  if (!key) return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (
    typeof value.saleId !== 'string' || !value.saleId.trim() ||
    typeof value.sku !== 'string' || !value.sku.trim() ||
    !Number.isInteger(value.quantity) || value.quantity < 1 || value.quantity > 2147483647
  ) throw new Error('Invalid saved intent');
  return { saleId: value.saleId, sku: value.sku, quantity: value.quantity };
}

export function saveIntent(intent: Intent): void {
  localStorage.setItem(prefix + intent.saleId, JSON.stringify(intent));
}

export function clearIntent(saleId: string): void {
  localStorage.removeItem(prefix + saleId);
}
