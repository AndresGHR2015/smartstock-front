async (page) => {
  const inputs = [];
  let stock = 10;
  await page.route('**/graphql', async (route) => {
    const { query, variables } = route.request().postDataJSON();
    if (query.includes('query Product')) {
      return route.fulfill({ json: { data: { product: {
        sku: variables.sku, name: 'Café de prueba con nombre suficientemente largo para comprobar el ajuste', stock, threshold: 7,
      } } } });
    }
    if (query.includes('mutation CreateSale')) {
      inputs.push(variables.input);
      if (inputs.length === 1) return route.abort();
      stock = 7;
      return route.fulfill({ json: { data: { createSale: {
        outcome: 'ACCEPTED', sale: { ...variables.input, status: 'CONFIRMED', rejectionReason: null },
      } } } });
    }
    return route.fulfill({ json: { data: { sale: null } } });
  });
  await page.goto('http://localhost:5173/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const widths = [];
  for (const width of [390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: width === 768 ? 1024 : 900 });
    await page.screenshot({ path: `evidence/redesign/inicio-${width}.png` });
    const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    if (dimensions.scroll > dimensions.client) throw new Error(`Overflow at ${width}: ${JSON.stringify(dimensions)}`);
    widths.push({ width, ...dimensions });
  }
  await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
  if (focus !== 'SmartStock, inicio') throw new Error(`Unexpected focus: ${focus}`);
  await page.getByLabel('SKU del producto').fill('CAFE-1');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByText('Café de prueba', { exact: false }).waitFor();
  await page.getByLabel('Cantidad').fill('3');
  await page.getByRole('button', { name: 'Registrar venta' }).click();
  await page.getByText('Resultado incierto').waitFor();
  await page.screenshot({ path: 'evidence/redesign/venta-incierta-1440.png' });
  await page.reload();
  await page.getByText('Hay una venta guardada sin resolver.', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Reintentar misma venta' }).click();
  await page.getByText('Venta confirmada.').waitFor();
  await page.getByText('7', { exact: true }).waitFor();
  if (JSON.stringify(inputs[0]) !== JSON.stringify(inputs[1])) throw new Error('Retry changed the input');
  await page.screenshot({ path: 'evidence/redesign/venta-confirmada-1440.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#ventas').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'evidence/redesign/venta-confirmada-390.png' });
  const mobile = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  if (mobile.scroll > mobile.client) throw new Error(`Mobile result overflow: ${JSON.stringify(mobile)}`);
  await page.getByRole('link', { name: 'Reposición y compras' }).click();
  if (await page.evaluate(() => location.hash) !== '#reposicion') throw new Error('Navigation failed');
  return { widths, mobile, keyboardFocus: focus, sameSaleInputAfterReload: true, stock, navigation: 'reposicion' };
}
