import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createSale, getProduct, getSale, type Intent, type Product, type Sale } from './api';
import { clearIntent, readIntent, saveIntent } from './storage';

type Result = { kind: 'uncertain' | 'pending' | 'confirmed' | 'rejected' | 'invalid' | 'conflict'; message: string };

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

export default function App() {
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
      if (!found) setProductMessage('No se encontró este SKU.');
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
    if (next.kind === 'confirmed' || next.kind === 'rejected') {
      if (next.kind === 'confirmed') await loadProduct(current.sku);
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
    } catch {
      setStorageError('No se pudo actualizar el almacenamiento local. Revisa las ventas guardadas antes de continuar.');
    }
  }

  const canFinish = result && ['confirmed', 'rejected', 'invalid'].includes(result.kind);

  return (
    <div className="page">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="SmartStock, inicio"><span className="brand-mark">S</span><span>SmartStock<small>Operaciones</small></span></a>
        <nav className="navigation" aria-label="Navegación principal">
          <span className="nav-label">Espacio de trabajo</span>
          <a href="#inventario"><span aria-hidden="true">▦</span> Inventario</a>
          <a href="#ventas"><span aria-hidden="true">▤</span> Ventas</a>
          <a href="#reposicion"><span aria-hidden="true">◇</span> Reposición y compras</a>
        </nav>
        <p className="sidebar-note">SmartStock <span>Inventario conectado a tus operaciones</span></p>
      </aside>
      <main className="main">
        <header className="topbar"><span>Espacio de trabajo</span><span>Inventario / Operaciones</span></header>
        <div className="content">
        <div className="intro">
          <div><p className="section-label">Gestión de inventario</p>
          <h1>Inventario y ventas</h1>
          <p>Consulta existencias y registra una venta desde el mismo lugar.</p></div>
        </div>
        <div className="workspace">
          <section id="inventario" className="inventory" aria-labelledby="inventory-title">
            <div className="section-heading"><div><h2 id="inventory-title">Consulta de producto</h2><p>Busca por SKU para ver la disponibilidad actual.</p></div><span className="heading-icon" aria-hidden="true">⌕</span></div>
            <form onSubmit={search} className="search-form">
              <label htmlFor="sku">SKU del producto</label>
              <div className="search-row">
                <input id="sku" value={sku} onChange={(event) => setSku(event.target.value)} placeholder="Escribe un SKU" required />
                <button type="submit" disabled={loadingProduct}>{loadingProduct ? 'Buscando…' : 'Buscar'}</button>
              </div>
            </form>
            <div aria-live="polite">
              {productMessage && <p className="notice">{productMessage}</p>}
              {product ? <div className="product">
                <div className="product-heading"><div><span className="detail-label">Producto</span><h3>{product.name}</h3><p className="sku">{product.sku}</p></div><span className={`stock-status ${product.stock <= product.threshold ? 'low' : ''}`}>{product.stock <= product.threshold ? 'En umbral o por debajo' : 'Sobre el umbral'}</span></div>
                <div className="stock-row"><div><span className="detail-label">Stock disponible</span><strong>{product.stock}</strong><span className="unit">unidades</span></div><div className="threshold"><span className="detail-label">Umbral de reposición</span><b>{product.threshold} unidades</b></div></div>
              </div> : !loadingProduct && !productMessage && <div className="empty"><span aria-hidden="true">▦</span><div><strong>Consulta el stock de un producto</strong><p>Introduce su SKU para ver existencias y umbral de reposición.</p></div></div>}
            </div>
          </section>
          <section id="ventas" className="sale-panel" aria-labelledby="sale-title">
            <p className="section-label">Ventas</p>
            <h2 id="sale-title">Registrar venta</h2>
            <p className="panel-description">La disponibilidad se confirma al procesar la venta.</p>
            {intent ? <div className="sale-details"><span className="detail-label">Venta guardada</span><p><b>{intent.quantity}</b> unidades de <b>{intent.sku}</b></p><span className="sale-id">ID: {intent.saleId}</span></div> : <form onSubmit={submitSale}>
              <label htmlFor="quantity">Cantidad</label>
              <input id="quantity" type="number" min="1" max="2147483647" step="1" required value={quantity} onChange={(event) => setQuantity(event.target.value)} />
              <button className="primary" type="submit" disabled={!product || !!storageError || busy}>Registrar venta</button>
              {!product && <p className="helper">Primero busca un producto.</p>}
            </form>}
            {storageError && <p className="status error" role="alert">{storageError}</p>}
            {result && <div className={`status ${result.kind}`} role="status"><b>{result.kind === 'confirmed' ? 'Confirmada' : result.kind === 'rejected' || result.kind === 'invalid' ? 'Rechazada' : result.kind === 'conflict' ? 'Conflicto' : result.kind === 'pending' ? 'Pendiente' : 'Resultado incierto'}</b><p>{result.message}</p></div>}
            {intent && <div className="actions">
              {!canFinish && <><button type="button" onClick={() => void checkSale()} disabled={busy}>Consultar estado</button><button type="button" className="secondary" onClick={() => void send(intent)} disabled={busy}>Reintentar misma venta</button></>}
              {canFinish && <button type="button" onClick={finishSale} disabled={busy}>Nueva venta</button>}
            </div>}
          </section>
        </div>
        <section id="reposicion" className="replenishment" aria-labelledby="replenishment-title">
          <div><p className="section-label">Siguiente etapa</p><h2 id="replenishment-title">Reposición y compras</h2><p>De la necesidad de stock a la recepción de mercancía.</p></div>
          <div className="future-content"><span className="future-icon" aria-hidden="true">◇</span><div><strong>Capacidad pendiente de integración</strong><p>Esta pantalla aún no permite consultar ofertas, gestionar borradores ni registrar decisiones o recepciones.</p></div></div>
        </section>
        <p className="footer-note">Las consultas y ventas utilizan el Gateway de SmartStock.</p>
        </div>
      </main>
    </div>
  );
}
