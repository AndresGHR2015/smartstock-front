import { describe, expect, it } from 'vitest';
import { addSale, analyzeNeed, createDraft, decideOrder, incoming, needStatus, receiveOrder,
  seedDemo, stockStatus } from '../src/demo';

describe('escenario de abastecimiento', () => {
  it('propaga la venta hasta la recepción completa', () => {
    const sku = 'KB-001';
    const stock = (state: ReturnType<typeof seedDemo>) => state.products.find((item) => item.sku === sku)!;
    const sold = addSale(seedDemo(false), sku, 3);
    const need = sold.needs.find((item) => item.sku === sku)!;
    expect(sold.sales[0]).toMatchObject({ before: 10, after: 7, units: 3 });
    expect(stockStatus(stock(sold))).toBe('critical');
    expect(needStatus(sold.orders, need.id)).toBe('pending');
    expect(createDraft(sold, need.id)).toBe(sold);

    const draft = createDraft(analyzeNeed(sold, need.id), need.id);
    const order = draft.orders[0];
    expect(order).toMatchObject({ units: 20, offer: { supplier: 'FastParts' } });
    expect(receiveOrder(draft, order.id, 20)).toBe(draft);

    const approved = decideOrder(draft, order.id, 'ordered');
    expect(incoming(approved.orders, sku)).toBe(20);
    const partial = receiveOrder(approved, order.id, 8);
    expect(stock(partial).stock).toBe(15);
    expect(incoming(partial.orders, sku)).toBe(12);
    expect(needStatus(partial.orders, need.id)).toBe('ordered');
    expect(receiveOrder(partial, order.id, 13)).toBe(partial);

    const final = receiveOrder(partial, order.id, 12);
    expect(stock(final).stock).toBe(27);
    expect(stockStatus(stock(final))).toBe('normal');
    expect(incoming(final.orders, sku)).toBe(0);
    expect(needStatus(final.orders, need.id)).toBe('resolved');
    expect(final.analyses[0]).toMatchObject({ stock: 7, units: 20, offer: { supplier: 'FastParts' } });
    expect(receiveOrder(final, order.id, 12)).toBe(final);
  });

  it('no duplica necesidades y deja abierta una necesidad cuyo borrador se rechaza', () => {
    const state = seedDemo();
    const need = state.needs[0];
    const first = addSale(state, need.sku, 1);
    expect(first.needs).toBe(state.needs);
    const draft = createDraft(analyzeNeed(first, need.id), need.id);
    const rejected = decideOrder(draft, draft.orders[0].id, 'rejected');
    expect(needStatus(rejected.orders, need.id)).toBe('pending');
    expect(incoming(rejected.orders, need.sku)).toBe(0);
    expect(addSale(rejected, need.sku, 999)).toBe(rejected);
  });
});
