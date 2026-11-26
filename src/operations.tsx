import { useEffect, useState, type FormEvent } from 'react';
import { getDashboard, getProduct, type DashboardSnapshot, type Product, type Sale } from './api';
import { addSale, coverage, decimalText, incoming, needStatus, numberText, stockStatus, timeText,
  type Activity, type DemoState, type StockItem, type StockStatus } from './demo';
import { Empty, href, needLabels, PageHeading, StockBadge, stockLabels, TableFrame } from './panel-ui';

export type ObservedSale = { sale: Sale; at: number };

function productName(products: Product[], sku: string) {
  return products.find((product) => product.sku === sku)?.name ?? sku;
}

function coverageText(product: Product) {
  if (!('demand' in product)) return '—';
  const days = coverage(product as StockItem);
  return days === null ? '—' : decimalText(days) + ' días';
}

const activityTime = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  hourCycle: 'h23', timeZone: 'America/Santiago',
});

function RecentActivity({ activity, showDate }: { activity: Activity[]; showDate: boolean }) {
  if (!activity.length) return <Empty>No hay actividad reciente.</Empty>;

  return (
    <ol className="timeline">
      {activity.slice(0, 5).map((event, index) => (
        <li key={event.at + '-' + index}>
          <span className={'timeline-dot event-' + event.kind} aria-hidden="true" />
          <time dateTime={new Date(event.at).toISOString()}>{showDate ? activityTime.format(event.at) : timeText(event.at)}</time>
          <div><strong>{event.title}</strong><p>{event.detail}</p></div>
        </li>
      ))}
    </ol>
  );
}

const liveNeedLabels = { PENDING: 'Pendiente de análisis', DRAFT: 'Borrador', APPROVED: 'Aprobada' };
const liveNeedStyles = { PENDING: 'pending', DRAFT: 'draft', APPROVED: 'ordered' };

export function Dashboard({ demo, onAnalyze }: {
  demo: DemoState | null; onAnalyze: (needId: string) => void;
}) {
  const [state, setState] = useState<{ snapshot?: DashboardSnapshot; loading: boolean }>({ loading: true });
  const [attempt, setAttempt] = useState(0);
  const live = demo === null;
  useEffect(() => {
    if (!live) return;
    const controller = new AbortController();
    getDashboard(controller.signal).then(
      (snapshot) => { if (!controller.signal.aborted) setState({ snapshot, loading: false }); },
      () => { if (!controller.signal.aborted) setState({ loading: false }); },
    );
    return () => controller.abort();
  }, [live, attempt]);

  const inventory = state.snapshot?.inventoryOverview;
  const sales = state.snapshot?.salesOverview;
  const purchases = state.snapshot?.purchasesOverview;
  const loading = live && state.loading;
  const unavailable = live && !loading && !(inventory && sales && purchases);
  const products = demo?.products ?? inventory?.attention ?? [];
  const byPriority = { critical: 0, low: 1, normal: 2 };
  const attention = demo
    ? [...products].sort((a, b) => byPriority[stockStatus(a)] - byPriority[stockStatus(b)]).slice(0, 4)
    : products;
  const pending = demo?.needs.filter((need) => needStatus(demo.orders, need.id) !== 'resolved') ?? [];
  const criticalCount = demo ? products.filter((product) => stockStatus(product) === 'critical').length : inventory?.criticalCount;
  const pendingCount = demo ? pending.length : purchases?.pendingCount;
  const openCount = demo ? demo.orders.filter((order) => ['draft', 'ordered'].includes(order.status)).length : purchases?.openOrderCount;
  const today = new Date().toDateString();
  const soldToday = demo ? demo.sales.reduce((total, sale) =>
    total + (new Date(sale.at).toDateString() === today ? sale.units : 0), 0) : sales?.unitsToday;
  const activity = demo?.activity ?? sales?.recent.map((sale) => ({
    kind: 'sale' as const, title: 'Venta confirmada',
    detail: sale.quantity + ' × ' + productName(products, sale.sku), at: Date.parse(sale.createdAt),
  })) ?? [];
  const metrics = [
    { label: 'Stock crítico', value: criticalCount,
      unit: criticalCount === 1 ? 'producto' : 'productos', tone: 'critical' },
    { label: 'Ventas hoy', value: soldToday,
      unit: soldToday === 1 ? 'unidad' : 'unidades', tone: 'sales' },
    { label: 'Reposición pendiente', value: pendingCount, unit: pendingCount === 1 ? 'necesidad' : 'necesidades', tone: 'pending' },
    { label: 'Órdenes abiertas', value: openCount, unit: openCount === 1 ? 'orden' : 'órdenes', tone: 'orders' },
  ];

  return <>
    <PageHeading title="Buenos días" summary="Esto es lo que está ocurriendo con tu inventario.">
      <a className="workspace-button primary-action" href={href('ventas')}>Registrar venta</a>
    </PageHeading>
    {loading && <p role="status">Consultando datos de los servicios…</p>}
    {unavailable && <div className="surface-actions">
      <p role="status">Algunos datos del Dashboard no están disponibles.</p>
      <button className="workspace-button subtle-action" onClick={() => {
        setState((current) => ({ ...current, loading: true }));
        setAttempt((current) => current + 1);
      }}>Volver a consultar</button>
    </div>}
    <dl className="metric-grid">
      {metrics.map((metric) => <div className={'metric metric-' + metric.tone} key={metric.label}>
        <dt>{metric.label}</dt>
        <dd><strong>{metric.value === undefined ? '—' : numberText(metric.value)}</strong><span>{metric.value === undefined ? 'Sin datos disponibles' : metric.unit}</span></dd>
      </div>)}
    </dl>
    <div className="dashboard-grid">
      <section className="surface attention-panel" aria-labelledby="attention-title">
        <div className="surface-heading">
          <h2 id="attention-title">Productos que requieren atención</h2>
          <a className="text-link" href={href('inventario')}>Ver inventario</a>
        </div>
        {attention.length ? (
          <TableFrame label="Productos que requieren atención">
            <table className="data-table"><thead><tr><th>Producto</th><th className="numeric">Stock</th><th className="numeric">Umbral</th>{demo && <th>Cobertura</th>}<th>Estado</th></tr></thead>
              <tbody>{attention.map((product) => <tr key={product.sku}>
                <td><a className="entity-link" href={href('inventario', product.sku)}>{product.name}</a><span className="table-detail">{product.sku}</span></td>
                <td className="numeric emphasized">{numberText(product.stock)}</td>
                <td className="numeric">{numberText(product.threshold)}</td>
                {demo && <td>{coverageText(product)}</td>}
                <td><StockBadge product={product} /></td>
              </tr>)}</tbody>
            </table>
          </TableFrame>
        ) : <Empty>{demo || inventory ? 'No hay productos con stock crítico o bajo.'
          : loading ? 'Consultando Inventario…' : 'Inventario no disponible.'}</Empty>}
      </section>
      <section className="surface activity-panel" aria-labelledby="activity-title">
        <div className="surface-heading"><h2 id="activity-title">Actividad reciente</h2></div>
        {demo || sales ? <RecentActivity activity={activity} showDate={live} />
          : <Empty>{loading ? 'Consultando Ventas…' : 'Ventas no disponible.'}</Empty>}
      </section>
    </div>
    <section className="surface dashboard-needs" aria-labelledby="needs-summary">
      <div className="surface-heading"><h2 id="needs-summary">Necesidades de reposición</h2>{demo && <a className="text-link" href={href('compras')}>Ir a Compras</a>}</div>
      {demo ? pending.length ? (
        <TableFrame label="Necesidades pendientes">
          <table className="data-table"><thead><tr><th>Producto</th><th>SKU</th><th>Detectada</th><th>Estado</th><th>Acción</th></tr></thead>
            <tbody>{pending.map((need) => {
              const status = needStatus(demo.orders, need.id);
              const unitsOnWay = incoming(demo.orders, need.sku);
              return <tr key={need.id}>
                <td><a className="entity-link" href={href('compras', need.id)}>{productName(products, need.sku)}</a></td>
                <td>{need.sku}</td><td>{timeText(need.at)}</td>
                <td><span className={'badge ' + status}>{needLabels[status]}</span>
                  {status === 'ordered' && <span className="table-detail">{unitsOnWay} en camino</span>}</td>
                <td>{status === 'pending' ? <button className="workspace-button subtle-action" onClick={() => onAnalyze(need.id)}>Analizar reposición</button>
                  : <a className="text-link" href={href('compras', need.id)}>Ver detalle</a>}</td>
              </tr>;
            })}</tbody>
          </table>
        </TableFrame>
      ) : <Empty>No quedan necesidades abiertas.</Empty>
        : purchases?.needs.length ? (
          <TableFrame label="Necesidades recientes">
            <table className="data-table live-needs"><thead><tr><th>SKU</th><th>Detectada</th><th>Estado</th></tr></thead>
              <tbody>{purchases.needs.map((need) => <tr key={need.eventId}>
                <td><a className="entity-link" href={href('inventario', need.sku)}>{need.sku}</a></td>
                <td><time dateTime={need.occurredAt}>{activityTime.format(Date.parse(need.occurredAt))}</time></td>
                <td><span className={'badge ' + liveNeedStyles[need.status]}>{liveNeedLabels[need.status]}</span></td>
              </tr>)}</tbody>
            </table>
          </TableFrame>
        ) : <Empty>{purchases ? 'No quedan necesidades abiertas.'
          : loading ? 'Consultando Compras…' : 'Compras no disponible.'}</Empty>}
    </section>
  </>;
}

export function Inventory({ demo, observed, detail, onProduct }: {
  demo: DemoState | null; observed: Product[]; detail?: string; onProduct: (product: Product) => void;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StockStatus | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [detailError, setDetailError] = useState<{ sku: string; message: string }>();
  const products = demo?.products ?? observed;
  const selected = products.find((product) => product.sku === detail);
  useEffect(() => {
    if (!detail || demo || selected) return;
    const controller = new AbortController();
    setDetailError(undefined);
    getProduct(detail, controller.signal).then(
      (product) => {
        if (controller.signal.aborted) return;
        if (product) onProduct(product);
        else setDetailError({ sku: detail, message: 'No se encontró ese SKU.' });
      },
      () => {
        if (!controller.signal.aborted) setDetailError({ sku: detail, message: 'No se pudo consultar el inventario.' });
      },
    );
    return () => controller.abort();
  }, [demo, detail, selected, onProduct]);
  const matching = products.filter((product) => {
    const statusMatches = filter === 'all' || stockStatus(product) === filter;
    const query = demo ? search.trim().toLocaleLowerCase('es-CL') : '';
    return statusMatches && (product.sku + ' ' + product.name).toLocaleLowerCase('es-CL').includes(query);
  });

  async function lookup(event: FormEvent) {
    event.preventDefault();
    if (loading || !search.trim()) return;

    setLoading(true);
    setMessage('');
    try {
      const product = await getProduct(search);
      if (product) {
        onProduct(product);
        setFilter('all');
      } else {
        setMessage('No se encontró ese SKU.');
      }
    } catch {
      setMessage('No se pudo consultar el inventario. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  if (selected) {
    const sample = demo ? demo.products.find((product) => product.sku === selected.sku) : undefined;
    return <>
      <a className="back-link" href={href('inventario')}>Volver a Inventario</a>
      <PageHeading title={selected.name} summary={selected.sku}><StockBadge product={selected} /></PageHeading>
      <section className="surface">
        <div className="surface-heading"><h2>Disponibilidad y demanda</h2></div>
        <dl className="detail-grid">
          <div><dt>Stock disponible</dt><dd>{numberText(selected.stock)} unidades</dd></div>
          <div><dt>Umbral</dt><dd>{numberText(selected.threshold)} unidades</dd></div>
          <div><dt>Pendiente de recibir</dt><dd>{demo ? numberText(incoming(demo.orders, selected.sku)) : '—'}</dd></div>
          <div><dt>Ventas últimos 7 días</dt><dd>{sample ? numberText(sample.weeklySales) : '—'}</dd></div>
          <div><dt>Cobertura estimada</dt><dd>{coverageText(selected)}</dd></div>
        </dl>
      </section>
      <section className="surface">
        <div className="surface-heading"><h2>Movimientos recientes</h2></div>
        {sample ? <ul className="movement-list">{sample.movements.map((movement, index) => <li key={movement.label + index}>
          <strong className={movement.quantity < 0 ? '' : 'positive'}>{movement.quantity > 0 ? '+' : ''}{movement.quantity}</strong>
          <span>{movement.label}</span>
        </li>)}</ul> : <Empty>El historial de movimientos está disponible en el modo demo.</Empty>}
      </section>
    </>;
  }
  if (!demo && detail) return <>
    <a className="back-link" href={href('inventario')}>Volver a Inventario</a>
    <PageHeading title="Inventario" summary={detail} />
    <p role="status">{detailError?.sku === detail ? detailError.message : 'Consultando disponibilidad…'}</p>
  </>;
  const searchField = <input id="inventory-search" value={search} onChange={(event) => setSearch(event.target.value)}
    placeholder={demo ? 'Buscar producto o SKU' : 'Introduce un SKU'} autoComplete="off" />;
  return <>
    <PageHeading title="Inventario" summary="Consulta existencias y detecta productos que requieren atención." />
    <section className="surface">
      <div className="inventory-controls">
        {demo ? <div className="filter-search"><label className="sr-only" htmlFor="inventory-search">Buscar producto o SKU</label>{searchField}</div>
          : <form className="filter-search live-inventory-search" onSubmit={lookup}>
            <label className="sr-only" htmlFor="inventory-search">Buscar por SKU</label>{searchField}
            <button className="workspace-button primary-action" disabled={loading}>{loading ? 'Consultando…' : 'Consultar SKU'}</button>
          </form>}
        <div className="filter-group" aria-label="Filtrar inventario por estado">
          {(['all', 'normal', 'low', 'critical'] as const).map((status) => (
            <button type="button" className="filter-button" key={status} aria-pressed={filter === status}
              onClick={() => setFilter(status)}>{status === 'all' ? 'Todos' : stockLabels[status]}</button>
          ))}
        </div>
      </div>
      {message && <p className="surface-message" role="status">{message}</p>}
      {matching.length ? <TableFrame label="Tabla de inventario">
        <table className="data-table inventory-table">
          <thead><tr><th>Producto</th><th>SKU</th><th className="numeric">Stock</th><th className="numeric">Umbral</th><th className="numeric">En camino</th><th>Estado</th></tr></thead>
          <tbody>{matching.map((product) => <tr key={product.sku}>
            <td><a className="entity-link" href={href('inventario', product.sku)}>{product.name}</a></td>
            <td>{product.sku}</td><td className="numeric emphasized">{numberText(product.stock)}</td>
            <td className="numeric">{numberText(product.threshold)}</td>
            <td className="numeric">{demo ? numberText(incoming(demo.orders, product.sku)) : '—'}</td>
            <td><StockBadge product={product} /></td>
          </tr>)}</tbody>
        </table>
      </TableFrame> : <Empty>{products.length ? 'Ningún producto coincide con estos filtros.' : 'Consulta un SKU para incorporarlo a la vista de esta sesión.'}</Empty>}
      {matching.length > 0 && <p className="table-footer">{matching.length} de {products.length} {demo ? 'productos' : 'SKU consultados'}</p>}
    </section>
  </>;
}

export function DemoSales({ state, onChange }: { state: DemoState; onChange: (state: DemoState) => void }) {
  const [sku, setSku] = useState('KB-001');
  const [quantity, setQuantity] = useState('3');
  const [message, setMessage] = useState('');
  const [lastId, setLastId] = useState<string>();
  const product = state.products.find((item) => item.sku === sku);
  const lastSale = state.sales.find((sale) => sale.id === lastId);
  const need = lastSale && state.needs.find((item) => item.sku === lastSale.sku && needStatus(state.orders, item.id) === 'pending');

  function register(event: FormEvent) {
    event.preventDefault();
    const next = addSale(state, sku, Number(quantity));
    if (next === state) {
      setMessage('Ingresa una cantidad entera dentro del stock disponible.');
      return;
    }
    setLastId(next.sales[0].id);
    setMessage('');
    onChange(next);
  }

  return <>
    <PageHeading title="Ventas" summary="Registra unidades vendidas y revisa el efecto en las existencias." />
    <div className="sales-grid">
      <section className="surface">
        <div className="surface-heading"><h2>Registrar venta</h2></div>
        <form onSubmit={register} className="panel-form">
          <label htmlFor="sale-product">Producto</label>
          <select id="sale-product" value={sku} onChange={(event) => { setSku(event.target.value); setMessage(''); }}>
            {state.products.map((item) => <option value={item.sku} key={item.sku}>{item.name} · {item.sku}</option>)}
          </select>
          {product && <p className="form-hint">Stock disponible <strong>{numberText(product.stock)} unidades</strong></p>}
          <label htmlFor="demo-quantity">Cantidad</label>
          <input id="demo-quantity" className="quantity-field" type="number" min="1" step="1" value={quantity}
            onChange={(event) => setQuantity(event.target.value)} required />
          <button className="workspace-button primary-action">Registrar venta</button>
          {message && <p className="form-feedback error" role="alert">{message}</p>}
        </form>
        {lastSale && <div className="form-feedback success sales-feedback" role="status">
          <strong>Venta registrada</strong><span>Stock actualizado: <b>{lastSale.before} → {lastSale.after}</b></span>
          {need && <a className="text-link" href={href('compras', need.id)}>Ver necesidad de reposición</a>}
        </div>}
      </section>
      <section className="surface">
        <div className="surface-heading"><h2>Ventas recientes</h2></div>
        <TableFrame label="Ventas recientes">
          <table className="data-table"><thead><tr><th>ID</th><th>Producto</th><th className="numeric">Cantidad</th><th>Estado</th></tr></thead>
            <tbody>{state.sales.slice(0, 8).map((sale) => <tr key={sale.id}>
              <td><strong>{sale.id}</strong><span className="table-detail">{timeText(sale.at)}</span></td>
              <td>{productName(state.products, sale.sku)}</td><td className="numeric">{sale.units}</td>
              <td><span className="badge normal">Confirmada</span></td>
            </tr>)}</tbody>
          </table>
        </TableFrame>
      </section>
    </div>
  </>;
}
