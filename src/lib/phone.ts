/**
 * Lebanese mobile number handling.
 *
 * Accepts what people actually type — 03 123 456, +961 3 123 456, 0096171123456 —
 * and normalises to E.164 so the WhatsApp handoff and the order record agree.
 */

const LEBANON_CC = '961';

/**
 * Valid Lebanese mobile prefixes (national format, leading zero stripped).
 * 7x/8x numbers are 8 digits after the prefix-carrying first digit; 3 is 7.
 */
const MOBILE_PATTERNS = [
  /^3\d{6}$/, // 03 XXX XXX  (legacy Alfa/Touch)
  /^7[0-9]\d{6}$/, // 70/71/76/78/79 XXX XXX
  /^8[13]\d{6}$/ // 81/83 XXX XXX
];

export type PhoneResult =
  | { valid: true; e164: string; national: string }
  | { valid: false; reason: 'empty' | 'format' };

export function normalizeLebanesePhone(input: string): PhoneResult {
  const digits = input.replace(/[^\d+]/g, '');
  if (!digits) return { valid: false, reason: 'empty' };

  let national = digits.replace(/^\+/, '');

  if (national.startsWith('00')) national = national.slice(2);
  if (national.startsWith(LEBANON_CC)) national = national.slice(LEBANON_CC.length);
  national = national.replace(/^0+/, '');

  if (!MOBILE_PATTERNS.some((pattern) => pattern.test(national))) {
    return { valid: false, reason: 'format' };
  }

  return {
    valid: true,
    e164: `+${LEBANON_CC}${national}`,
    national: `0${national}`
  };
}

export function isValidLebanesePhone(input: string): boolean {
  return normalizeLebanesePhone(input).valid;
}

/** Lebanese governorates, used for the delivery-area selector. */
export const LEBANON_REGIONS = [
  'beirut',
  'mount-lebanon',
  'north',
  'akkar',
  'bekaa',
  'baalbek-hermel',
  'south',
  'nabatieh'
] as const;

export type LebanonRegion = (typeof LEBANON_REGIONS)[number];
