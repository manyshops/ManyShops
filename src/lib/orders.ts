import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { PriceBreakdown } from './pricing';

/**
 * Order persistence.
 *
 * A newline-delimited JSON file on disk. Deliberately boring: it is real
 * storage with real reads and writes, it survives restarts, and swapping it for
 * Postgres later means reimplementing two functions rather than rewriting the
 * API layer. Writes are serialised through a promise chain because a Node
 * server handles concurrent requests on one thread.
 */

export type OrderStatus = 'pending' | 'confirmed' | 'purchased' | 'delivered' | 'cancelled';

export type OrderItem = {
  productUrl: string;
  storeBrand: string;
  storeHost: string;
  title: string | null;
  imageUrl: string | null;
  quantity: number;
  note: string | null;
  breakdown: PriceBreakdown;
  weightMethod: string;
};

export type OrderCustomer = {
  fullName: string;
  phoneE164: string;
  phoneNational: string;
  region: string;
  address: string;
  landmark: string | null;
};

export type Order = {
  reference: string;
  createdAt: string;
  status: OrderStatus;
  locale: string;
  customer: OrderCustomer;
  item: OrderItem;
  totalUsd: number;
};

const DATA_DIR = path.join(process.cwd(), '.data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.ndjson');

let writeQueue: Promise<unknown> = Promise.resolve();

/** Reference codes are shown to customers, so no ambiguous 0/O/1/I. */
const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateReference(): string {
  const bytes = randomBytes(6);
  let code = '';
  for (const byte of bytes) {
    code += REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length];
  }
  return `MS-${code.slice(0, 3)}-${code.slice(3)}`;
}

async function ensureStore(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
}

export async function saveOrder(order: Order): Promise<Order> {
  const write = writeQueue.then(async () => {
    await ensureStore();
    await writeFile(ORDERS_FILE, `${JSON.stringify(order)}\n`, {
      encoding: 'utf8',
      flag: 'a'
    });
    return order;
  });

  // Keep the chain alive even if this write fails, so one bad order does not
  // wedge every subsequent one.
  writeQueue = write.catch(() => undefined);
  return write;
}

export async function listOrders(): Promise<Order[]> {
  try {
    const contents = await readFile(ORDERS_FILE, 'utf8');
    return contents
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as Order);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

export async function findOrder(reference: string): Promise<Order | null> {
  const orders = await listOrders();
  const wanted = reference.trim().toUpperCase();
  return orders.find((order) => order.reference === wanted) ?? null;
}
