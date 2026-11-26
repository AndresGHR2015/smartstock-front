async (page) => {
  let stock = 10;
  let savedSale = null;
  let loseResponse = true;
  const calls = [];
  await page.route('**/graphql', async (route) => {
    const { query, variables } = route.request().postDataJSON();
    calls.push({ query, variables });
    if (query.includes('query Product')) {
      return route.fulfill({ json: { data: { product: {
        sku: variables.sku, name: 'Café de prueba', stock, threshold: 7,
      } } } });
    }
    if (query.includes('mutation CreateSale')) {
      if (!savedSale) {
        stock -= variables.input.quantity;
        savedSale = { ...variables.input, status: 'CONFIRMED', rejectionReason: null };
      }
      if (loseResponse) {
        loseResponse = false;
        return route.abort();
      }
      return route.fulfill({ json: { data: { createSale: { outcome: 'ACCEPTED', sale: savedSale } } } });
    }
    return route.fulfill({ json: { data: { sale: savedSale } } });
  });
  await page.goto('http://localhost:5173/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const checks = [];
  for (const width of [390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: width === 768 ? 1024 : 900 });
    await page.reload();
    await page.screenshot({ path: `evidence/inicio-${width}.png`, fullPage: true });
    checks.push({ width, ...await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    })) });
  }
  await page.keyboard.press('Tab');
  checks.push({ focused: await page.evaluate(() => document.activeElement?.textContent) });
  await page.getByLabel('SKU del producto').fill('CAFE-1');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByText('Café de prueba').waitFor();
  await page.getByLabel('Cantidad').fill('3');
  await page.getByRole('button', { name: 'Registrar venta' }).click();
  await page.getByText('Resultado incierto').waitFor();
  await page.screenshot({ path: 'evidence/venta-incierta-1440.png', fullPage: true });
  await page.reload();
  await page.getByText('Hay una venta guardada sin resolver.', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Consultar estado' }).click();
  await page.getByText('Venta confirmada.').waitFor();
  await page.getByText('7', { exact: true }).waitFor();
  await page.screenshot({ path: 'evidence/venta-confirmada-1440.png', fullPage: true });
  checks.push({ stock, createCalls: calls.filter((call) => call.query.includes('mutation CreateSale')).length,
    lookupId: calls.find((call) => call.query.includes('query Sale'))?.variables.id,
    sentId: calls.find((call) => call.query.includes('mutation CreateSale'))?.variables.input.saleId });
  return checks;
}
