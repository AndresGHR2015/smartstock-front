import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearIntent, readIntent, saveIntent } from '../src/storage';

describe('saved sale intents', () => {
  let data: Record<string, string>;
  beforeEach(() => {
    data = {};
    vi.stubGlobal('localStorage', new Proxy({
      getItem: (key: string) => data[key] ?? null,
      setItem: (key: string, value: string) => { data[key] = value; },
      removeItem: (key: string) => { delete data[key]; },
    }, {
      ownKeys: (target) => [...Reflect.ownKeys(target), ...Object.keys(data)],
      getOwnPropertyDescriptor: (target, key) => Reflect.getOwnPropertyDescriptor(target, key) ?? { configurable: true, enumerable: true },
    }));
  });
  it('preserves exact arguments and keeps other intents when one is cleared', () => {
    const first = { saleId: 'first', sku: ' SKU ', quantity: 3 };
    const second = { saleId: 'second', sku: 'other', quantity: 1 };
    saveIntent(first);
    saveIntent(second);
    expect(readIntent()).toEqual(first);
    clearIntent(first.saleId);
    expect(readIntent()).toEqual(second);
  });
  it('does not silently ignore damaged saved data', () => {
    localStorage.setItem('smartstock.sale-intent.v1.bad', '{}');
    expect(() => readIntent()).toThrow();
  });
});
