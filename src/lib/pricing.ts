/**
 * ManyShops landed-cost engine.
 *
 * Every constant here is a business rule, not a tunable. Changing one changes
 * what customers are quoted, so they live in one place and nowhere else.
 */

/** Fixed rate. Deliberately NOT fetched from a live FX API. */
export const TRY_PER_USD = 46.5;

export const COMMISSION_RATE_STANDARD = 0.15;
export const COMMISSION_RATE_HIGH_VALUE = 0.12;
/** Order product value (USD) at or below which the standard rate applies. */
export const COMMISSION_THRESHOLD_USD = 100;

export const LOGISTICS_RATE_USD_PER_KG = 5.5;
/** Anything lighter than this still bills as this. */
export const MIN_BILLABLE_WEIGHT_KG = 1.0;

/** Flat, per item. */
export const PACKAGING_FEE_USD = 0.2;

export type PriceBreakdown = {
  /** Unit price as listed by the store, in Turkish lira. */
  unitPriceTry: number;
  quantity: number;
  /** Total lira value of the order line. */
  totalPriceTry: number;
  /** Product value converted to USD — the "P_USD" of the pricing rules. */
  productUsd: number;
  /** 0.15 or 0.12, whichever tier P_USD falls into. */
  commissionRate: number;
  commissionUsd: number;
  /** Per-unit estimate before the minimum is applied. */
  estimatedWeightKg: number;
  /** Total order weight before the minimum is applied. */
  totalWeightKg: number;
  /** What logistics actually charges for: max(totalWeight, 1.0). */
  billableWeightKg: number;
  logisticsUsd: number;
  packagingUsd: number;
  totalUsd: number;
};

/** Round to cents, avoiding the classic 1.005 -> 1.00 float artefact. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function tryToUsd(amountTry: number): number {
  return amountTry / TRY_PER_USD;
}

export function commissionRateFor(productUsd: number): number {
  return productUsd <= COMMISSION_THRESHOLD_USD
    ? COMMISSION_RATE_STANDARD
    : COMMISSION_RATE_HIGH_VALUE;
}

export function billableWeight(totalWeightKg: number): number {
  return Math.max(totalWeightKg, MIN_BILLABLE_WEIGHT_KG);
}

export type PriceInput = {
  unitPriceTry: number;
  /** Per-unit estimate from the weight module. */
  estimatedWeightKg: number;
  quantity?: number;
};

/**
 * Computes the full landed cost.
 *
 * Each line is rounded to cents before the total is summed, so the receipt the
 * customer reads always adds up exactly to the number they're asked to pay.
 *
 * With quantity 1 this reduces to the single-item rules verbatim. For larger
 * quantities the commission tier is decided on the *order* product value, the
 * weight minimum applies to the shipment as a whole, and packaging is charged
 * per item as specified.
 */
export function calculatePrice({
  unitPriceTry,
  estimatedWeightKg,
  quantity = 1
}: PriceInput): PriceBreakdown {
  if (!Number.isFinite(unitPriceTry) || unitPriceTry < 0) {
    throw new RangeError('unitPriceTry must be a non-negative finite number');
  }
  if (!Number.isFinite(estimatedWeightKg) || estimatedWeightKg < 0) {
    throw new RangeError('estimatedWeightKg must be a non-negative finite number');
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new RangeError('quantity must be a positive integer');
  }

  const totalPriceTry = unitPriceTry * quantity;
  const productUsd = round2(tryToUsd(totalPriceTry));

  const commissionRate = commissionRateFor(productUsd);
  const commissionUsd = round2(productUsd * commissionRate);

  const totalWeightKg = estimatedWeightKg * quantity;
  const billableWeightKg = billableWeight(totalWeightKg);
  const logisticsUsd = round2(billableWeightKg * LOGISTICS_RATE_USD_PER_KG);

  const packagingUsd = round2(PACKAGING_FEE_USD * quantity);

  const totalUsd = round2(
    productUsd + commissionUsd + logisticsUsd + packagingUsd
  );

  return {
    unitPriceTry,
    quantity,
    totalPriceTry,
    productUsd,
    commissionRate,
    commissionUsd,
    estimatedWeightKg,
    totalWeightKg,
    billableWeightKg,
    logisticsUsd,
    packagingUsd,
    totalUsd
  };
}

export function formatUsd(value: number, locale = 'en'): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-LB' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

export function formatTry(value: number, locale = 'en'): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-LB' : 'en-US', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}
