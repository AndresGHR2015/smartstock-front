import { useEffect, useState } from 'react';
import App from './App';
import type { Product, Sale } from './api';
import { analyzeNeed, readDemo, saveDemo, seedDemo } from './demo';
import { Dashboard, DemoSales, Inventory, type ObservedSale } from './operations';
import { Empty, href, PageHeading, views, type View } from './panel-ui';
import { Purchases, Replenishment } from './procurement';

type Route = { view: View; detail?: string; lookup?: boolean };

function readRoute(): Route {
  if (window.location.hash === '#consulta-venta') return { view: 'ventas', lookup: true };
  const [name, encoded] = window.location.hash.replace(/^#\/?/, '').split('/');
  const view = views.find((item) => item.id === name)?.id ?? 'dashboard';
  try {
    return { view, detail: encoded ? decodeURIComponent(encoded) : undefined };
  } catch {
    return { view };
  }
}

const dateLabel = new Intl.DateTimeFormat('es-CL', {
  weekday: 'long', day: 'numeric', month: 'long',
});

export default function Workspace() {
  const [route, setRoute] = useState(readRoute);
  const [demoMode] = useState(() => new URLSearchParams(window.location.search).get('modo') === 'demo');
  const [demo, setDemo] = useState(() => demoMode ? readDemo() : seedDemo());
  const [observed, setObserved] = useState<Product[]>([]);
  const [observedSales, setObservedSales] = useState<ObservedSale[]>([]);

  useEffect(() => {
    const changeRoute = () => setRoute(readRoute());
    window.addEventListener('hashchange', changeRoute);
    return () => window.removeEventListener('hashchange', changeRoute);
  }, []);

  useEffect(() => {
    if (route.lookup) {
      document.getElementById('consulta-venta')?.scrollIntoView();
    } else {
      window.scrollTo(0, 0);
    }
  }, [route.view, route.detail, route.lookup]);

  useEffect(() => {
    if (demoMode) saveDemo(demo);
  }, [demo, demoMode]);

  function rememberProduct(product: Product) {
    setObserved((items) => [product, ...items.filter((item) => item.sku !== product.sku)]);
  }

  function rememberSale(sale: Sale) {
    const at = Date.now();
    setObservedSales((items) => items.some((item) => item.sale.saleId === sale.saleId) ? items : [{ sale, at }, ...items]);
  }

  function analyze(needId: string) {
    setDemo((state) => analyzeNeed(state, needId));
    window.location.hash = href('reposicion', needId);
  }

  function reset() {
    setDemo(seedDemo(false));
    window.location.hash = href('dashboard');
  }

  const active = views.find((item) => item.id === route.view)!;
  const modeLink = window.location.pathname + (demoMode ? '' : '?modo=demo') + href(route.view);
  let content;
  switch (route.view) {
    case 'dashboard':
      content = <Dashboard demo={demoMode ? demo : null} observed={observed} observedSales={observedSales} onAnalyze={analyze} />;
      break;
    case 'inventario':
      content = <Inventory demo={demoMode ? demo : null} observed={observed} detail={route.detail} onProduct={rememberProduct} />;
      break;
    case 'ventas':
      content = demoMode ? <DemoSales state={demo} onChange={setDemo} />
        : <App onProduct={rememberProduct} onSale={rememberSale} observedSales={observedSales} />;
      break;
    case 'compras':
      content = demoMode ? <Purchases state={demo} detail={route.detail} onChange={setDemo} onAnalyze={analyze} /> : <>
        <PageHeading title="Compras" summary="Gestiona las necesidades, borradores y órdenes de reposición." />
        <section className="surface">
          <div className="surface-heading"><h2>Flujo de abastecimiento</h2></div>
          <Empty>Las operaciones de Compras del Gateway aún son internas. Puedes recorrer necesidades, órdenes y recepción en el escenario demo.</Empty>
          <div className="surface-actions"><a className="workspace-button primary-action" href={modeLink}>Abrir Compras en demo</a></div>
        </section>
      </>;
      break;
    case 'reposicion':
      content = demoMode ? <Replenishment state={demo} detail={route.detail} onChange={setDemo} onAnalyze={analyze} /> : <>
        <PageHeading title="Reposición IA" summary="Revisa la evidencia y decide qué comprar." />
        <section className="surface">
          <div className="surface-heading"><h2>Recomendación de reposición</h2></div>
          <Empty>La conexión con el agente de reposición está pendiente. El escenario demo muestra cómo revisar y convertir una sugerencia en borrador.</Empty>
          <div className="surface-actions"><a className="workspace-button primary-action" href={modeLink}>Abrir Reposición IA en demo</a></div>
        </section>
      </>;
      break;
  }

  return (
    <div className="supply-workspace">
      <aside className="workspace-sidebar">
        <a className="workspace-brand" href={href('dashboard')} aria-label="SmartStock, inicio">
          <span className="workspace-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>SmartStock<small>Abastecimiento</small></span>
        </a>
        <nav className="workspace-nav" aria-label="Navegación principal">
          {views.map((item) => <a href={href(item.id)} key={item.id} aria-current={route.view === item.id ? 'page' : undefined}>
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>{item.label}
          </a>)}
        </nav>
      </aside>
      <div className="workspace-main">
        <header className="workspace-topbar">
          <span className="breadcrumb">{active.label}</span>
          <div className="workspace-controls">
            <span className="workspace-date">{dateLabel.format(new Date())}</span>
            {demoMode && <span className="mode-indicator">Modo demo</span>}
            {demoMode && <button className="mode-link" onClick={reset}>Reiniciar demo</button>}
            <a className="mode-link" href={modeLink}>{demoMode ? 'Ver datos reales' : 'Abrir demo'}</a>
          </div>
        </header>
        <main className="workspace-content">{content}</main>
      </div>
    </div>
  );
}
