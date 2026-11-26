export type Product = { sku: string; name: string; stock: number; threshold: number };
export type Intent = { saleId: string; sku: string; quantity: number };
export type Sale = Intent & {
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  rejectionReason: 'PRODUCT_NOT_FOUND' | 'INSUFFICIENT_STOCK' | null;
};
export type CreateResult = {
  outcome: 'ACCEPTED' | 'INVALID_ARGUMENT' | 'SALE_ID_CONFLICT' | 'UNKNOWN';
  sale: Sale | null;
};

export type DashboardSnapshot = {
  inventoryOverview: { criticalCount: number; attention: Product[] } | null;
  salesOverview: { unitsToday: number; recent: { sku: string; quantity: number; createdAt: string }[] } | null;
  purchasesOverview: {
    pendingCount: number;
    openOrderCount: number;
    needs: { eventId: string; sku: string; occurredAt: string; status: 'PENDING' | 'DRAFT' | 'APPROVED' }[];
  } | null;
};

const url = import.meta.env.VITE_GRAPHQL_URL || '/graphql';
const saleFields = 'saleId sku quantity status rejectionReason';

async function request<T>(query: string, variables: Record<string, unknown>,
  options: { signal?: AbortSignal; allowPartial?: boolean } = {},
): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal: options.signal,
  });
  if (!response.ok) throw new Error('HTTP error');
  const body = await response.json();
  if (!body.data || (body.errors?.length && !options.allowPartial)) throw new Error('GraphQL error');
  return body.data as T;
}

export function getDashboard(signal: AbortSignal): Promise<DashboardSnapshot> {
  return request<DashboardSnapshot>('query Dashboard {\n' +
    '  inventoryOverview { criticalCount attention { sku name stock threshold } }\n' +
    '  salesOverview { unitsToday recent { sku quantity createdAt } }\n' +
    '  purchasesOverview { pendingCount openOrderCount needs { eventId sku occurredAt status } }\n' +
    '}', {}, { signal, allowPartial: true });
}

export async function getProduct(sku: string, signal?: AbortSignal): Promise<Product | null> {
  const data = await request<{ product: Product | null }>(
    'query Product($sku: String!) { product(sku: $sku) { sku name stock threshold } }',
    { sku }, { signal },
  );
  return data.product;
}

export async function getSale(id: string): Promise<Sale | null> {
  const data = await request<{ sale: Sale | null }>(
    `query Sale($id: ID!) { sale(id: $id) { ${saleFields} } }`,
    { id },
  );
  return data.sale;
}

export async function createSale(input: Intent): Promise<CreateResult> {
  const data = await request<{ createSale: CreateResult }>(
    `mutation CreateSale($input: CreateSaleInput!) {
      createSale(input: $input) { outcome sale { ${saleFields} } }
    }`,
    { input },
  );
  return data.createSale;
}
