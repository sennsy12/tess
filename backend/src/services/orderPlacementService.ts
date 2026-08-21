/**
 * Order Placement Service
 *
 * Creates customer-placed orders atomically:
 *   1. Idempotency check (safe retries on network failure)
 *   2. Product validation against `vare`
 *   3. Server-authoritative repricing via the pricing engine
 *      (client-supplied prices are never trusted)
 *   4. Single transaction: ordrenr from sequence → ordre insert → line inserts
 *
 * @module services/orderPlacementService
 */
import { transaction, query } from '../db/index.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import { pricingService } from './pricingService.js';

export interface CreateCustomerOrderInput {
  kundenr: string;
  items: Array<{ varekode: string; antall: number }>;
  kundeordreref?: string;
  kunderef?: string;
  lagernavn?: string;
  valutaid: string;
  idempotencyKey: string;
}

export interface CreatedOrder {
  ordrenr: number;
  kundenr: string;
  workflow_status: string;
  sum: number;
  duplicate: boolean;
}

interface ProductRow {
  varekode: string;
  varenavn: string | null;
  varegruppe: string | null;
  base_price: number;
}

/** Fetch an existing order by idempotency key (idempotent replay support). */
async function findByIdempotencyKey(key: string): Promise<number | null> {
  const result = await query(
    'SELECT ordrenr FROM ordre WHERE idempotency_key = $1 LIMIT 1',
    [key],
  );
  return result.rows[0]?.ordrenr ?? null;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === '23505'
  );
}

/** Load an existing order with its lines for the API response. */
async function hydrate(ordrenr: number): Promise<CreatedOrder> {
  const orderResult = await query(
    'SELECT ordrenr, kundenr, workflow_status, sum FROM ordre WHERE ordrenr = $1',
    [ordrenr],
  );
  const order = orderResult.rows[0];
  if (!order) {
    throw new NotFoundError('Order not found');
  }
  return {
    ordrenr: order.ordrenr,
    kundenr: order.kundenr,
    workflow_status: order.workflow_status,
    sum: Number(order.sum),
    duplicate: true,
  };
}

export const orderPlacementService = {
  /**
   * Create a pending-approval order from customer cart items.
   * Idempotent on `idempotencyKey`: replays return the original order.
   */
  createOrder: async (input: CreateCustomerOrderInput): Promise<CreatedOrder> => {
    // Idempotent replay: same key → return the already-created order
    const existingOrdrenr = await findByIdempotencyKey(input.idempotencyKey);
    if (existingOrdrenr != null) {
      return hydrate(existingOrdrenr);
    }

    // Resolve products and validate existence in one round-trip
    const varekoder = input.items.map((i) => i.varekode);
    const productResult = await query(
      'SELECT varekode, varenavn, varegruppe, base_price FROM vare WHERE varekode = ANY($1)',
      [varekoder],
    );
    const products = new Map<string, ProductRow>(
      productResult.rows.map((p: ProductRow) => [p.varekode, p]),
    );
    const unknown = varekoder.filter((v) => !products.has(v));
    if (unknown.length > 0) {
      throw new NotFoundError(`Ukjent produkt: ${unknown.join(', ')}`);
    }

    // Server-side repricing — the source of truth for all amounts
    const calculations = await pricingService.calculatePricesForOrder(
      input.items.map((item) => {
        const product = products.get(item.varekode)!;
        return {
          varekode: item.varekode,
          varegruppe: product.varegruppe ?? undefined,
          quantity: item.antall,
          base_price: Number(product.base_price ?? 0),
        };
      }),
      input.kundenr,
    );

    const totalSum =
      Math.round(calculations.reduce((acc, c) => acc + c.final_price, 0) * 100) / 100;

    try {
      const ordrenr = await transaction(async (client) => {
        const ordreResult = await client.query(
          `INSERT INTO ordre
             (ordrenr, dato, kundenr, kundeordreref, kunderef, lagernavn,
              valutaid, sum, workflow_status, status_updated_at, idempotency_key)
           VALUES
             (nextval('ordre_customer_seq'), CURRENT_DATE, $1, $2, $3, $4,
              $5, $6, 'pending_approval', NOW(), $7)
           RETURNING ordrenr`,
          [
            input.kundenr,
            input.kundeordreref ?? null,
            input.kunderef ?? null,
            input.lagernavn ?? null,
            input.valutaid,
            totalSum,
            input.idempotencyKey,
          ],
        );
        const newOrdrenr: number = ordreResult.rows[0].ordrenr;

        // Multi-value line insert (linjenr is sequential per new order)
        const values: unknown[] = [];
        const placeholders = input.items.map((item, i) => {
          const calc = calculations[i];
          const linjesum = Math.round(calc.unit_price * item.antall * 100) / 100;
          const base = i * 7;
          values.push(
            i + 1,
            newOrdrenr,
            item.varekode,
            item.antall,
            'STK',
            calc.unit_price,
            linjesum,
          );
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, 1)`;
        });

        await client.query(
          `INSERT INTO ordrelinje (linjenr, ordrenr, varekode, antall, enhet, nettpris, linjesum, linjestatus)
           VALUES ${placeholders.join(', ')}`,
          values,
        );

        return newOrdrenr;
      });

      return {
        ordrenr,
        kundenr: input.kundenr,
        workflow_status: 'pending_approval',
        sum: totalSum,
        duplicate: false,
      };
    } catch (err) {
      // Lost a race on the idempotency key — treat as replay
      if (isUniqueViolation(err)) {
        const racedOrdrenr = await findByIdempotencyKey(input.idempotencyKey);
        if (racedOrdrenr != null) {
          return hydrate(racedOrdrenr);
        }
      }
      throw err;
    }
  },
};
