async (page) => {
  const inputs = [];
  await page.unrouteAll();
  await page.route('**/graphql', async (route) => {
    const { query, variables } = route.request().postDataJSON();
    if (query.includes('query Product')) {
      return route.fulfill({ json: { data: { product: {
        sku: variables.sku, name: 'Producto', stock: 10, threshold: 7,
      } } } });
    }
    if (query.includes('mutation CreateSale')) {
      inputs.push(variables.input);
      const status = inputs.length === 1 ? 'PENDING' : 'REJECTED';
      const rejectionReason = status === 'REJECTED' ? 'INSUFFICIENT_STOCK' : null;
      return route.fulfill({ json: { data: { createSale: {
        outcome: 'ACCEPTED', sale: { ...variables.input, status, rejectionReason },
      } } } });
    }
    return route.fulfill({ json: { data: { sale: null } } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:5173/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => document.activeElement?.id);
  if (focus !== 'sku') throw new Error(`Unexpected keyboard focus: ${focus}`);
  await page.keyboard.type('TEST');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.getByRole('heading', { name: 'Producto', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Registrar venta' }).click();
  await page.getByText('La venta está pendiente.', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Consultar estado' }).click();
  await page.getByText('La venta aún no aparece.', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Reintentar misma venta' }).click();
  await page.getByText('Venta rechazada. No hay stock suficiente.').waitFor();
  await page.screenshot({ path: 'evidence/venta-rechazada-390.png', fullPage: true });
  if (JSON.stringify(inputs[0]) !== JSON.stringify(inputs[1])) throw new Error('Retry changed sale input');
  return {
    keyboardFocus: focus,
    sameInput: true,
    scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth),
  };
}
