import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createSale, getProduct, getSale, type Intent, type Product, type Sale } from './api';
import { numberText, timeText } from './demo';
import type { ObservedSale } from './operations';
import { Empty, PageHeading, TableFrame } from './panel-ui';
import { clearIntent, readIntent, saveIntent } from './storage';

type Result = { kind: 'uncertain' | 'pending' | 'confirmed' | 'rejected' | 'invalid' | 'conflict'; message: string };

const resultLabels: Partial<Record<Result['kind'], string>> = {
  uncertain: 'Resultado incierto',
  conflict: 'Conflicto',
};

function saleResult(sale: Sale): Result {
  if (sale.status === 'CONFIRMED') return { kind: 'confirmed', message: 'Venta confirmada.' };
  if (sale.status === 'REJECTED') {
    const reason = sale.rejectionReason === 'INSUFFICIENT_STOCK'
      ? 'No hay stock suficiente.'
      : sale.rejectionReason === 'PRODUCT_NOT_FOUND' ? 'El producto no existe.' : 'Consulta el motivo con el servicio.';
    return { kind: 'rejected', message: `Venta rechazada. ${reason}` };
  }
  return { kind: 'pending', message: 'La venta está pendiente. Consulta su estado de nuevo.' };
}

function SaleNotice({ result }: { result: Result }) {
  const heading = resultLabels[result.kind];
  return (
    <div className={`status ${result.kind}`} role="status">
      {heading && <strong>{heading}</strong>}
      <p>{result.message}</p>
    </div>
  );
}

function SaleReference({ saleId }: { saleId: string }) {
  const [feedback, setFeedback] = useState('');

  async function copyId() {
    try {
      await navigator.clipboard.writeText(saleId);
      setFeedback('ID copiado.');
    } catch {
      setFeedback('Selecciona el ID del campo para copiarlo.');
    }
  }

  return (
    <div className="receipt-reference">
      <div className="receipt-heading">
        <label htmlFor="receipt-id">ID de venta</label>
        <button className="copy-id" type="button" onClick={() => void copyId()}>Copiar ID</button>
      </div>
      <input className="receipt-id" id="receipt-id" value={saleId} readOnly
        onFocus={(event) => event.currentTarget.select()} />
      {feedback && <p className="field-note" role="status">{feedback}</p>}
    </div>
  );
}

function SaleLookup() {
  const [saleId, setSaleId] = useState('');
  const [sale, setSale] = useState<Sale | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function lookup(event: FormEvent) {
    event.preventDefault();
    if (loading) return;

    if (!saleId.trim()) {
      setSale(null);
      setMessage('Introduce un ID de venta.');
      return;
    }

    setLoading(true);
    setMessage('');
    setSale(null);
    try {
      const found = await getSale(saleId);
      setSale(found);
      if (!found) setMessage('No encontramos una venta con ese ID. Revísalo o inténtalo de nuevo.');
    } catch {
      setMessage('No se pudo consultar la venta. Vuelve a intentarlo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="sale-lookup" id="consulta-venta" aria-labelledby="lookup-title">
      <div className="lookup-header">
        <h2 id="lookup-title">Consultar una venta</h2>
        <p>Usa el ID que se muestra al registrar la venta.</p>
      </div>
      <form onSubmit={lookup} className="lookup-form">
        <label htmlFor="lookup-id">ID de venta</label>
        <div className="field-row">
          <input id="lookup-id" placeholder="Pega el ID de la venta" value={saleId}
            onChange={(event) => setSaleId(event.target.value)} autoComplete="off" spellCheck={false} required />
          <button className="secondary" type="submit" disabled={loading}>{loading ? 'Consultando…' : 'Buscar venta'}</button>
        </div>
      </form>
      {message && <p className="lookup-feedback notice" role="status">{message}</p>}
      {sale && <div className="lookup-feedback">
        <dl className="lookup-result">
          <div><dt>Producto</dt><dd>{sale.sku}</dd></div>
          <div><dt>Unidades</dt><dd>{sale.quantity}</dd></div>
          <div><dt>ID de venta</dt><dd>{sale.saleId}</dd></div>
        </dl>
        <SaleNotice result={saleResult(sale)} />
      </div>}
    </section>
  );
}

export default function App({ onProduct, onSale, observedSales }: {
  onProduct: (product: Product) => void; onSale: (sale: Sale) => void; observedSales: ObservedSale[];
}) {
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [product, setProduct] = useState<Product | null>(null);
  const [productMessage, setProductMessage] = useState('');
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [busy, setBusy] = useState(false);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [storageError, setStorageError] = useState('');
  const inFlight = useRef(false);
  const productRequest = useRef(0);

  useEffect(() => {
    try {
      const saved = readIntent();
      if (saved) {
        setIntent(saved);
        setSku(saved.sku);
        setResult({ kind: 'uncertain', message: 'Hay una venta guardada sin resolver. Consulta su estado o reintenta con los mismos datos.' });
      }
    } catch {
      setStorageError('No se puede leer el almacenamiento local. No registres ventas hasta recuperarlo.');
    }
  }, []);

  async function loadProduct(value: string) {
    const requestId = ++productRequest.current;
    setLoadingProduct(true);
    setProductMessage('');
    setProduct(null);
    try {
      const found = await getProduct(value);
      if (requestId !== productRequest.current) return;
      setProduct(found);
      if (found) onProduct(found);
      else setProductMessage('No se encontró este SKU.');
    } catch {
      if (requestId === productRequest.current) setProductMessage('No se pudo consultar el producto. Comprueba la conexión e inténtalo de nuevo.');
    } finally {
      if (requestId === productRequest.current) setLoadingProduct(false);
    }
  }

  function search(event: FormEvent) {
    event.preventDefault();
    if (!sku.trim()) {
      setProductMessage('Introduce un SKU.');
      return;
    }
    void loadProduct(sku);
  }

  async function applySale(sale: Sale, current: Intent) {
    if (sale.saleId !== current.saleId || sale.sku !== current.sku || sale.quantity !== current.quantity) {
      setResult({ kind: 'uncertain', message: 'La respuesta no coincide con la venta guardada. No inicies otra venta; consulta con soporte.' });
      return;
    }
    const next = saleResult(sale);
    setResult(next);
    if (next.kind === 'confirmed') {
      onSale(sale);
      await loadProduct(current.sku);
    }
  }

  async function send(current: Intent) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setResult({ kind: 'pending', message: 'Enviando venta…' });
    try {
      const response = await createSale(current);
      if (response.outcome === 'ACCEPTED' && response.sale) {
        await applySale(response.sale, current);
      } else if (response.outcome === 'INVALID_ARGUMENT') {
        setResult({ kind: 'invalid', message: 'El servicio rechazó los datos de la solicitud.' });
      } else if (response.outcome === 'SALE_ID_CONFLICT') {
        setResult({ kind: 'conflict', message: 'El identificador ya corresponde a otra venta. Consulta con soporte antes de continuar.' });
      } else {
        setResult({ kind: 'uncertain', message: 'No se conoce el resultado. Consulta el estado o reintenta esta misma venta.' });
      }
    } catch {
      setResult({ kind: 'uncertain', message: 'Se perdió la conexión o la respuesta. La venta podría haberse registrado; consulta o reintenta con los mismos datos.' });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function submitSale(event: FormEvent) {
    event.preventDefault();
    const amount = Number(quantity);
    if (!product || intent || inFlight.current || storageError || !Number.isInteger(amount) || amount < 1 || amount > 2147483647) return;
    try {
      const existing = readIntent();
      if (existing) {
        setIntent(existing);
        setResult({ kind: 'uncertain', message: 'Hay otra venta guardada sin resolver. Consulta su estado antes de continuar.' });
        return;
      }
      const next = { saleId: crypto.randomUUID(), sku: product.sku, quantity: amount };
      saveIntent(next);
      setIntent(next);
      void send(next);
    } catch {
      setStorageError('No se pudo guardar la venta en este navegador. No se ha enviado.');
    }
  }

  async function checkSale() {
    if (!intent || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const sale = await getSale(intent.saleId);
      if (sale) await applySale(sale, intent);
      else setResult({ kind: 'uncertain', message: 'La venta aún no aparece. Podría seguir procesándose; reintenta con los mismos datos.' });
    } catch {
      setResult({ kind: 'uncertain', message: 'No se pudo consultar el estado. La venta podría haberse registrado; vuelve a consultar o reintenta.' });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function finishSale() {
    if (!intent) return;
    try {
      clearIntent(intent.saleId);
      const next = readIntent();
      setIntent(next);
      setResult(next ? { kind: 'uncertain', message: 'Hay otra venta guardada sin resolver. Consulta su estado antes de continuar.' } : null);
      setQuantity('1');
    } catch {
      setStorageError('No se pudo actualizar el almacenamiento local. Revisa las ventas guardadas antes de continuar.');
    }
  }

  const canFinish = result && ['confirmed', 'rejected', 'invalid'].includes(result.kind);
  const stockLabel = product && (product.stock === 0 ? 'Sin stock' : product.stock <= product.threshold ? 'Stock bajo' : 'Disponible');
  const exceedsStock = product && Number(quantity) > product.stock;

  return (
    <div className="live-sales">
      <PageHeading title="Ventas" summary="Consulta un SKU, registra las unidades y recupera el estado de una venta.">
        <a className="workspace-button subtle-action" href="#consulta-venta">Consultar venta</a>
      </PageHeading>
      <div className="sales-grid live-sales-grid">
        <div className="workbench live-workbench">
          <section id="inventario" className="inventory panel" aria-labelledby="inventory-title">
            <h2 id="inventory-title">Consultar inventario</h2>
            <form onSubmit={search} className="search-form">
              <label htmlFor="sku">SKU del producto</label>
              <div className="field-row">
                <input id="sku" value={sku} onChange={(event) => setSku(event.target.value)}
                  placeholder="Ej. ABC-123" autoComplete="off" spellCheck={false} required />
                <button type="submit" disabled={loadingProduct}>{loadingProduct ? 'Buscando…' : 'Buscar'}</button>
              </div>
            </form>
            <div className="inventory-result" aria-live="polite">
              {productMessage ? <p className="notice">{productMessage}</p> : product ? (
                <div className="product">
                  <div className="product-heading">
                    <div>
                      <p className="sku">{product.sku}</p>
                      <h3>{product.name}</h3>
                    </div>
                    <span className={`stock-status ${product.stock <= product.threshold ? 'low' : ''}`}>{stockLabel}</span>
                  </div>
                  <dl className="stock-row">
                    <div className="stock-available">
                      <dt>Stock disponible</dt>
                      <dd><strong>{product.stock}</strong> <span>unidades</span></dd>
                    </div>
                    <div className="stock-threshold">
                      <dt>Umbral de reposición</dt>
                      <dd>{product.threshold} unidades</dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <div className="inventory-empty">
                  <span className="package-mark" aria-hidden="true" />
                  <div>
                    <strong>{loadingProduct ? 'Consultando inventario…' : 'Aún no hay un producto seleccionado'}</strong>
                    {!loadingProduct && <p>El saldo y el umbral de reposición aparecerán aquí.</p>}
                  </div>
                </div>
              )}
            </div>
          </section>
          <section id="ventas" className="sale-panel panel" aria-labelledby="sale-title">
            <h2 id="sale-title">Registrar venta</h2>
            {intent ? (
              <div className="sale-ticket">
                <dl className="sale-details">
                  <div><dt>Producto</dt><dd>{intent.sku}</dd></div>
                  <div><dt>Cantidad</dt><dd>{intent.quantity} unidades</dd></div>
                </dl>
                <SaleReference key={intent.saleId} saleId={intent.saleId} />
              </div>
            ) : (
              <form className="sale-form" onSubmit={submitSale}>
                <div className="sale-target"><span>Producto</span><strong>{product?.sku ?? 'Sin seleccionar'}</strong></div>
                <label htmlFor="quantity">Cantidad</label>
                <input id="quantity" type="number" min="1" max="2147483647" step="1" required value={quantity}
                  onChange={(event) => setQuantity(event.target.value)} disabled={!product}
                  aria-describedby={!product || exceedsStock ? 'quantity-help' : undefined} />
                {!product && <p id="quantity-help" className="field-note">Busca un SKU para habilitar la venta.</p>}
                {exceedsStock && <p id="quantity-help" className="field-note stock-warning">La cantidad supera el último stock consultado.</p>}
                <button className="sale-submit" type="submit" disabled={!product || !!storageError || busy}>Registrar venta</button>
              </form>
            )}
            {storageError && <p className="status error" role="alert">{storageError}</p>}
            {result && <SaleNotice result={result} />}
            {intent && (
              <div className="actions">
                {canFinish ? <button type="button" onClick={finishSale} disabled={busy}>Nueva venta</button> : <>
                  <button type="button" onClick={() => void checkSale()} disabled={busy}>Consultar estado</button>
                  <button type="button" className="secondary" onClick={() => void send(intent)} disabled={busy}>Reintentar misma venta</button>
                </>}
              </div>
            )}
          </section>
        </div>
        <section className="surface">
          <div className="surface-heading"><h2>Ventas recientes</h2></div>
          {observedSales.length ? <TableFrame label="Ventas confirmadas en esta sesión">
            <table className="data-table">
              <thead><tr><th>ID</th><th>SKU</th><th className="numeric">Cantidad</th><th>Estado</th></tr></thead>
              <tbody>{observedSales.map(({ sale, at }) => <tr key={sale.saleId}>
                <td><span className="live-sale-id" title={sale.saleId}>{sale.saleId.slice(0, 8)}</span>
                  <span className="table-detail">{timeText(at)}</span></td>
                <td>{sale.sku}</td><td className="numeric">{numberText(sale.quantity)}</td>
                <td><span className="badge normal">Confirmada</span></td>
              </tr>)}</tbody>
            </table>
          </TableFrame> : <Empty>Las ventas que confirmes en esta sesión aparecerán aquí.</Empty>}
        </section>
      </div>
      <SaleLookup />
    </div>
  );
}
