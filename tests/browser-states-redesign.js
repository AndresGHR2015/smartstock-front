async (page) => {
  await page.unrouteAll();
  let productFails = true;
  let attempts = 0;
  await page.route('**/graphql', async (route) => {
    const { query, variables } = route.request().postDataJSON();
    if (query.includes('query Product')) {
      if (productFails) return route.abort();
      return route.fulfill({ json: { data: { product: { sku: variables.sku, name: 'Producto', stock: 2, threshold: 3 } } } });
    }
    if (query.includes('mutation CreateSale')) {
      attempts += 1;
      const status = attempts === 1 ? 'PENDING' : 'REJECTED';
      return route.fulfill({ json: { data: { createSale: { outcome: 'ACCEPTED', sale: {
        ...variables.input, status, rejectionReason: status === 'REJECTED' ? 'INSUFFICIENT_STOCK' : null,
      } } } } });
    }
    return route.fulfill({ json: { data: { sale: null } } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:5173/#/ventas');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByLabel('SKU del producto').fill('TEST');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByText('No se pudo consultar el producto.', { exact: false }).waitFor();
  await page.locator('#inventario').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'evidence/redesign/error-producto-390.png' });
  productFails = false;
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('heading', { name: 'Producto', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Registrar venta' }).click();
  await page.getByText('La venta está pendiente.', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Consultar estado' }).click();
  await page.getByText('La venta aún no aparece.', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Reintentar misma venta' }).click();
  await page.getByText('Venta rechazada. No hay stock suficiente.').waitFor();
  await page.locator('#ventas').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'evidence/redesign/venta-rechazada-390.png' });
  return { productError: true, pending: true, nullSaleUncertain: true, rejected: true };
}
