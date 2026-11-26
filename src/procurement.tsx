import type { FormEvent } from 'react';
import { coverage, createDraft, decimalText, decideOrder, incoming, money, needStatus, numberText,
  quotesFor, receiveOrder, timeText, type DemoState, type Need, type Offer, type Order, type StockItem } from './demo';
import { Empty, href, needLabels, orderLabels, PageHeading, StockBadge, TableFrame } from './panel-ui';

type DemoActions = { state: DemoState; onChange: (state: DemoState) => void; onAnalyze: (needId: string) => void };

function OffersTable({ rows }: { rows: Offer[] }) {
  return <TableFrame label="Cotizaciones disponibles">
    <table className="data-table">
      <thead><tr><th>Proveedor</th><th className="numeric">Precio/u</th><th className="numeric">Entrega</th><th className="numeric">Pedido mínimo</th></tr></thead>
      <tbody>{rows.map((offer) => <tr key={offer.id}>
        <td><strong>{offer.supplier}</strong></td><td className="numeric">{money(offer.price)}</td>
        <td className="numeric">{offer.days} días</td><td className="numeric">{offer.minimum} unidades</td>
      </tr>)}</tbody>
    </table>
  </TableFrame>;
}

function NeedDetail({ state, need, product, onAnalyze }: {
  state: DemoState; need: Need; product: StockItem; onAnalyze: (needId: string) => void;
}) {
  const status = needStatus(state.orders, need.id);
  const order = state.orders.find((item) => item.needId === need.id && item.status !== 'rejected');
  const days = coverage(product);

  return <>
    <a className="back-link" href={href('compras')}>Volver a Compras</a>
    <PageHeading title="Necesidad de reposición" summary={product.name + ' · ' + product.sku}>
      <span className={'badge ' + status}>{needLabels[status]}</span>
    </PageHeading>
    <section className="surface">
      <div className="surface-heading"><h2>Disponibilidad</h2><StockBadge product={product} /></div>
      <dl className="detail-grid">
        <div><dt>Detectada</dt><dd>{timeText(need.at)}</dd></div>
        <div><dt>Stock actual</dt><dd>{numberText(product.stock)}</dd></div>
        <div><dt>Umbral</dt><dd>{numberText(product.threshold)}</dd></div>
        <div><dt>Demanda diaria</dt><dd>{decimalText(product.demand)} unidades</dd></div>
        <div><dt>Cobertura</dt><dd>{days === null ? '—' : decimalText(days) + ' días'}</dd></div>
        <div><dt>Unidades en camino</dt><dd>{numberText(incoming(state.orders, product.sku))}</dd></div>
      </dl>
    </section>
    <section className="surface">
      <div className="surface-heading">
        <h2>Cotizaciones disponibles</h2>
        {status === 'pending' ? <button className="workspace-button primary-action" onClick={() => onAnalyze(need.id)}>
          <span aria-hidden="true">✦</span> {state.analyses.some((item) => item.needId === need.id) ? 'Ver análisis de reposición' : 'Analizar con SmartStock AI'}
        </button> : order && <a className="workspace-button subtle-action" href={href('compras', order.id)}>Ver {order.id}</a>}
      </div>
      <OffersTable rows={quotesFor(product.sku)} />
    </section>
  </>;
}

function OrdersTable({ state, orders }: { state: DemoState; orders: Order[] }) {
  if (!orders.length) return <Empty>Los documentos aparecerán aquí cuando se creen desde una necesidad de reposición.</Empty>;
  return <TableFrame label="Órdenes de compra">
    <table className="data-table">
      <thead><tr><th>Orden</th><th>Proveedor</th><th>Producto</th><th className="numeric">Unidades</th><th className="numeric">Total</th><th>Estado</th></tr></thead>
      <tbody>{orders.map((order) => <tr key={order.id}>
        <td><a className="entity-link" href={href('compras', order.id)}>{order.id}</a></td>
        <td>{order.offer.supplier}</td><td>{state.products.find((item) => item.sku === order.sku)?.name ?? order.sku}</td>
        <td className="numeric">{order.units}</td><td className="numeric">{money(order.units * order.offer.price)}</td>
        <td><span className={'badge ' + order.status}>{orderLabels[order.status]}</span></td>
      </tr>)}</tbody>
    </table>
  </TableFrame>;
}

function OrderDetail({ state, order, onChange }: { state: DemoState; order: Order; onChange: (state: DemoState) => void }) {
  const product = state.products.find((item) => item.sku === order.sku);
  const remaining = order.units - order.received;

  function receive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const quantity = Number(new FormData(event.currentTarget).get('units'));
    onChange(receiveOrder(state, order.id, quantity));
  }

  return <>
    <a className="back-link" href={href('compras', order.status === 'draft' ? 'borradores' : 'ordenes')}>Volver a Compras</a>
    <PageHeading title={order.id} summary={order.offer.supplier}>
      <span className={'badge ' + order.status}>{orderLabels[order.status]}</span>
    </PageHeading>
    <div className="cost-grid">
      <section className="surface">
        <div className="surface-heading"><h2>Detalle de compra</h2></div>
        <TableFrame label="Detalle de compra">
          <table className="data-table">
            <thead><tr><th>Producto</th><th className="numeric">Cantidad</th><th className="numeric">Precio/u</th><th className="numeric">Subtotal</th></tr></thead>
            <tbody><tr><td><strong>{product?.name ?? order.sku}</strong><span className="table-detail">{order.sku}</span></td>
              <td className="numeric">{order.units}</td><td className="numeric">{money(order.offer.price)}</td>
              <td className="numeric emphasized">{money(order.units * order.offer.price)}</td></tr></tbody>
          </table>
        </TableFrame>
        {order.status === 'draft' && <div className="surface-actions">
          <button className="workspace-button subtle-action" onClick={() => onChange(decideOrder(state, order.id, 'rejected'))}>Rechazar</button>
          <button className="workspace-button primary-action" onClick={() => onChange(decideOrder(state, order.id, 'ordered'))}>Aprobar orden</button>
        </div>}
        {order.status === 'ordered' && <p className="surface-message" role="status">Orden aprobada. {remaining} {remaining === 1 ? 'unidad pendiente' : 'unidades pendientes'} de recibir.</p>}
        {order.status === 'received' && <p className="surface-message positive" role="status">Orden recibida. Necesidad de reposición resuelta.</p>}
        {order.status === 'rejected' && <p className="surface-message" role="status">Orden rechazada. La necesidad sigue abierta.</p>}
      </section>
      <section className="surface">
        <div className="surface-heading"><h2>Recepción</h2></div>
        {order.status === 'ordered' && <form className="panel-form" onSubmit={receive} key={remaining}>
          <label htmlFor="receive-units">Cantidad recibida</label>
          <input className="quantity-field" id="receive-units" name="units" type="number" min="1" max={remaining} step="1" defaultValue={remaining} required />
          <button className="workspace-button primary-action">Registrar recepción</button>
        </form>}
        {order.receipt && <dl className="detail-grid receipt-metrics" aria-live="polite">
          <div><dt>Antes</dt><dd>{order.receipt.before}</dd></div>
          <div><dt>Recibido</dt><dd className="positive">+{order.receipt.units}</dd></div>
          <div><dt>Stock actual</dt><dd>{order.receipt.after}</dd></div>
        </dl>}
        {order.status === 'draft' && <Empty>Aprueba la orden para habilitar la recepción.</Empty>}
        {order.status === 'rejected' && <Empty>La orden fue rechazada.</Empty>}
      </section>
    </div>
  </>;
}

const purchaseTabs = [
  { id: '', label: 'Necesidades' },
  { id: 'borradores', label: 'Borradores' },
  { id: 'ordenes', label: 'Órdenes' },
];

export function Purchases({ state, detail, onChange, onAnalyze }: DemoActions & { detail?: string }) {
  const need = state.needs.find((item) => item.id === detail);
  const product = state.products.find((item) => item.sku === need?.sku);
  if (need && product) return <NeedDetail state={state} need={need} product={product} onAnalyze={onAnalyze} />;

  const order = state.orders.find((item) => item.id === detail);
  if (order) return <OrderDetail state={state} order={order} onChange={onChange} />;

  const tab = detail === 'borradores' || detail === 'ordenes' ? detail : '';
  return <>
    <PageHeading title="Compras" summary="Revisa necesidades, prepara órdenes y registra lo que llega." />
    <section className="surface">
      <nav className="purchase-tabs" aria-label="Vistas de compras">
        {purchaseTabs.map((item) => <a key={item.label} href={href('compras', item.id)}
          aria-current={tab === item.id ? 'page' : undefined}>{item.label}</a>)}
      </nav>
      {tab ? <OrdersTable state={state} orders={state.orders.filter((item) => tab === 'borradores' ? item.status === 'draft' : item.status !== 'draft')} /> :
        <TableFrame label="Necesidades de reposición">
          <table className="data-table">
            <thead><tr><th>Producto</th><th className="numeric">Stock</th><th className="numeric">Umbral</th><th>Detectada</th><th>Estado</th></tr></thead>
            <tbody>{state.needs.map((item) => {
              const status = needStatus(state.orders, item.id);
              const current = state.products.find((entry) => entry.sku === item.sku);
              return <tr key={item.id}>
                <td><a className="entity-link" href={href('compras', item.id)}>{current?.name ?? item.sku}</a><span className="table-detail">{item.sku}</span></td>
                <td className="numeric emphasized">{numberText(current?.stock ?? item.stock)}</td>
                <td className="numeric">{item.threshold}</td><td>Hoy, {timeText(item.at)}</td>
                <td><span className={'badge ' + status}>{needLabels[status]}</span></td>
              </tr>;
            })}</tbody>
          </table>
        </TableFrame>}
    </section>
  </>;
}

export function Replenishment({ state, detail, onChange, onAnalyze }: DemoActions & { detail?: string }) {
  const analysis = state.analyses.find((item) => item.needId === detail);
  const need = state.needs.find((item) => item.id === analysis?.needId);
  const product = state.products.find((item) => item.sku === need?.sku);
  const order = need && state.orders.find((item) => item.needId === need.id && item.status !== 'rejected');
  const pending = state.needs.filter((item) => needStatus(state.orders, item.id) === 'pending');

  if (!need || !analysis || !product) return <>
    <PageHeading title="Reposición IA" summary="Compara las cotizaciones y revisa la evidencia para decidir qué comprar." />
    <section className="surface">
      <div className="surface-heading"><h2>Necesidades para analizar</h2></div>
      {pending.length ? <ul className="analysis-queue">
        {pending.map((item) => <li key={item.id}>
          <div><strong>{state.products.find((entry) => entry.sku === item.sku)?.name ?? item.sku}</strong><p>{item.sku}</p></div>
          <button className="workspace-button primary-action" onClick={() => onAnalyze(item.id)}>
            {state.analyses.some((entry) => entry.needId === item.id) ? 'Ver recomendación' : 'Analizar reposición'}
          </button>
        </li>)}
      </ul> : <Empty>No hay necesidades pendientes de análisis.</Empty>}
    </section>
  </>;

  const rows = quotesFor(product.sku);
  const { offer: preferred, units } = analysis;
  const days = coverage(analysis);
  const meetsDeadline = days !== null && preferred.days <= days;
  const timelyOptions = days === null ? [] : rows.filter((offer) => offer.days <= days);
  const alternatives = rows.filter((offer) => offer.id !== preferred.id);

  function discard() {
    if (!need) return;
    onChange({ ...state, analyses: state.analyses.filter((item) => item.needId !== need.id) });
    window.location.hash = href('compras', need.id);
  }

  function draft() {
    if (!need) return;
    const next = createDraft(state, need.id);
    if (next === state) return;
    onChange(next);
    window.location.hash = href('compras', next.orders[0].id);
  }

  return <>
    <a className="back-link" href={href('compras', need.id)}>Volver a la necesidad</a>
    <PageHeading title="Recomendación de reposición" summary={product.name + ' · ' + product.sku} />
    <section className="recommendation surface">
      <div className="recommendation-header">
        <span className="recommendation-icon" aria-hidden="true">✦</span>
        <div>
          <h2>Comprar {units} unidades a {preferred.supplier}</h2>
          <p>{days === null
            ? 'La demanda reciente es insuficiente para calcular el quiebre. La propuesta prioriza el costo de compra.'
            : 'El stock cubriría ' + decimalText(days) + ' días. ' + preferred.supplier + ' entrega en ' + preferred.days + ' días'
              + (meetsDeadline ? timelyOptions.length === 1 ? ' y es la única opción que llega antes del quiebre estimado.' : ' y ofrece el menor precio entre quienes llegan a tiempo.'
                : ' y es la alternativa más rápida, aunque llegaría después del quiebre estimado.')}</p>
        </div>
      </div>
      <dl className="detail-grid recommendation-evidence">
        <div><dt>Stock al analizar</dt><dd>{analysis.stock}</dd></div>
        <div><dt>Consumo promedio</dt><dd>{decimalText(analysis.demand)} unidades/día</dd></div>
        <div><dt>Quiebre estimado</dt><dd>{days === null ? '—' : decimalText(days) + ' días'}</dd></div>
        <div><dt>Precio unitario</dt><dd>{money(preferred.price)}</dd></div>
        <div><dt>Plazo de entrega</dt><dd>{preferred.days} días</dd></div>
        <div><dt>Pedido mínimo</dt><dd>{preferred.minimum} unidades</dd></div>
      </dl>
      <div className="surface-actions">
        {order ? <a className="workspace-button primary-action" href={href('compras', order.id)}>Ver {order.id}</a> : <>
          <button className="workspace-button subtle-action" onClick={discard}>Descartar</button>
          <button className="workspace-button primary-action" onClick={draft}>Crear borrador de compra</button>
        </>}
      </div>
    </section>
    {alternatives.length > 0 && <section className="surface">
      <div className="surface-heading"><h2>Por qué no las otras opciones</h2></div>
      <ul className="alternative-list">{alternatives.map((offer) => <li key={offer.id}>
        <div><strong>{offer.supplier}</strong><span>{money(offer.price)} / unidad</span></div>
        <p>Entrega en {offer.days} días{days !== null && offer.days > days ? ', después del quiebre estimado.' : '.'}</p>
      </li>)}</ul>
    </section>}
  </>;
}
