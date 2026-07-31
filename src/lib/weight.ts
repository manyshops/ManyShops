import Anthropic from '@anthropic-ai/sdk';
import type { ScrapedProduct } from './scraper';

/**
 * Weight estimation.
 *
 * Turkish storefronts almost never publish shipping weight, and logistics is
 * billed per kilo — so the estimate is load-bearing for the quote. Three tiers,
 * most trustworthy first:
 *
 *   1. A weight the store actually declared (schema.org `weight`).
 *   2. A weight written into the product title ("500 gr", "1,5 kg").
 *   3. Category classification from the title/category text.
 *
 * When ANTHROPIC_API_KEY is configured, tier 3 is refined by Claude; otherwise
 * the keyword table stands on its own. The app is fully functional either way.
 */

export type WeightEstimate = {
  weightKg: number;
  method: 'declared' | 'parsed' | 'ai' | 'heuristic' | 'default';
  /** Category key when one matched — surfaced in the UI for transparency. */
  category: string | null;
  confidence: 'high' | 'medium' | 'low';
};

/** Fallback when nothing at all matches: one billable unit. */
const DEFAULT_WEIGHT_KG = 0.8;

type CategoryRule = {
  key: string;
  weightKg: number;
  /** Matched case-insensitively against title + category + brand text. */
  keywords: string[];
};

/**
 * Weights are packed shipping weights in kg, not net product weight.
 * Turkish and English terms sit side by side because listings mix both.
 */
const CATEGORY_RULES: CategoryRule[] = [
  // Very light
  { key: 'jewelry', weightKg: 0.1, keywords: ['kolye', 'yüzük', 'bileklik', 'küpe', 'takı', 'necklace', 'ring', 'bracelet', 'earring', 'jewel'] },
  { key: 'phone-case', weightKg: 0.12, keywords: ['kılıf', 'telefon kılıfı', 'phone case', 'cover case', 'ekran koruyucu', 'screen protector'] },
  { key: 'socks', weightKg: 0.12, keywords: ['çorap', 'sock', 'patik'] },
  { key: 'underwear', weightKg: 0.15, keywords: ['iç çamaşır', 'külot', 'boxer', 'sütyen', 'underwear', 'lingerie', 'bra'] },
  { key: 'cosmetics', weightKg: 0.2, keywords: ['ruj', 'makyaj', 'kozmetik', 'maskara', 'fondöten', 'oje', 'lipstick', 'makeup', 'cosmetic', 'mascara', 'foundation', 'serum', 'krem', 'cream'] },
  { key: 'accessory', weightKg: 0.2, keywords: ['kemer', 'şapka', 'atkı', 'eldiven', 'gözlük', 'belt', 'hat', 'cap', 'scarf', 'glove', 'sunglass', 'wallet', 'cüzdan'] },
  { key: 'tshirt', weightKg: 0.25, keywords: ['tişört', 'tshirt', 't-shirt', 'atlet', 'body', 'crop'] },

  // Light
  { key: 'shirt', weightKg: 0.35, keywords: ['gömlek', 'shirt', 'bluz', 'blouse', 'tunik', 'tunic'] },
  { key: 'watch', weightKg: 0.4, keywords: ['kol saati', 'saat', 'watch', 'smartwatch', 'akıllı saat'] },
  { key: 'headphones', weightKg: 0.4, keywords: ['kulaklık', 'headphone', 'earbud', 'airpod', 'earphone'] },
  { key: 'skirt', weightKg: 0.4, keywords: ['etek', 'skirt', 'şort', 'short'] },
  { key: 'dress', weightKg: 0.5, keywords: ['elbise', 'dress', 'tulum', 'jumpsuit', 'abiye'] },
  { key: 'perfume', weightKg: 0.6, keywords: ['parfüm', 'perfume', 'edt', 'edp', 'eau de'] },
  { key: 'book', weightKg: 0.6, keywords: ['kitap', 'book', 'roman', 'defter', 'notebook paper'] },
  { key: 'sweater', weightKg: 0.6, keywords: ['kazak', 'sweatshirt', 'hoodie', 'sweater', 'triko', 'hırka', 'cardigan'] },
  { key: 'towel', weightKg: 0.6, keywords: ['havlu', 'towel', 'bornoz', 'bathrobe'] },

  // Medium
  { key: 'trousers', weightKg: 0.7, keywords: ['pantolon', 'jean', 'kot', 'trouser', 'pants', 'eşofman', 'jogger'] },
  { key: 'toy', weightKg: 0.8, keywords: ['oyuncak', 'toy', 'puzzle', 'lego', 'peluş', 'plush'] },
  { key: 'bag', weightKg: 0.9, keywords: ['çanta', 'bag', 'handbag', 'clutch', 'omuz çantası'] },
  { key: 'sneakers', weightKg: 1.0, keywords: ['spor ayakkabı', 'sneaker', 'koşu ayakkabı', 'running shoe'] },
  { key: 'backpack', weightKg: 1.0, keywords: ['sırt çantası', 'backpack', 'okul çantası', 'rucksack'] },
  { key: 'shoes', weightKg: 1.1, keywords: ['ayakkabı', 'shoe', 'sandalet', 'sandal', 'terlik', 'slipper', 'loafer', 'topuklu', 'heel'] },
  { key: 'jacket', weightKg: 1.2, keywords: ['ceket', 'jacket', 'mont', 'blazer', 'yelek', 'vest'] },
  { key: 'bedding', weightKg: 1.4, keywords: ['nevresim', 'çarşaf', 'yastık', 'bedding', 'duvet', 'pillow', 'battaniye', 'blanket'] },
  { key: 'boots', weightKg: 1.6, keywords: ['bot', 'çizme', 'boot', 'postal'] },
  { key: 'coat', weightKg: 1.8, keywords: ['kaban', 'palto', 'coat', 'trençkot', 'trench', 'parka'] },

  // Heavy
  { key: 'small-appliance', weightKg: 1.8, keywords: ['su ısıtıcı', 'kettle', 'tost makinesi', 'toaster', 'blender', 'mikser', 'saç kurutma', 'hair dryer', 'ütü', 'iron'] },
  { key: 'tablet', weightKg: 1.0, keywords: ['tablet', 'ipad', 'e-reader', 'kindle'] },
  { key: 'phone', weightKg: 0.6, keywords: ['cep telefonu', 'smartphone', 'iphone', 'galaxy s', 'telefon'] },
  { key: 'laptop', weightKg: 2.6, keywords: ['laptop', 'notebook bilgisayar', 'macbook', 'dizüstü'] },
  { key: 'coffee-machine', weightKg: 4.5, keywords: ['kahve makinesi', 'coffee machine', 'espresso', 'airfryer', 'fritöz'] },
  { key: 'vacuum', weightKg: 6.0, keywords: ['süpürge', 'vacuum', 'robot süpürge'] },
  { key: 'monitor', weightKg: 7.0, keywords: ['monitör', 'monitor', 'ekran '] },
  { key: 'television', weightKg: 12.0, keywords: ['televizyon', 'television', ' tv ', 'smart tv'] },
  { key: 'furniture', weightKg: 15.0, keywords: ['koltuk', 'masa', 'sandalye', 'dolap', 'furniture', 'sofa', 'desk', 'chair', 'wardrobe'] }
];

/** Reads "500 gr", "1,5 kg", "2.5kg" out of a product title. */
export function parseWeightFromText(text: string): number | null {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(kg|kilogram|kilo|gr|gram|g)\b/i);
  if (!match) return null;

  const value = Number.parseFloat(match[1].replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return null;

  const unit = match[2].toLowerCase();
  const kg = unit.startsWith('k') ? value : value / 1000;

  // Guard against matching a model number or a volume that isn't a weight.
  if (kg <= 0 || kg > 80) return null;
  return kg;
}

function searchableText(product: ScrapedProduct): string {
  return [product.title, product.category, product.brand, product.description]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Longest keyword match wins, so "spor ayakkabı" beats a bare "ayakkabı". */
export function classifyByKeywords(
  text: string
): { rule: CategoryRule; matched: string } | null {
  let best: { rule: CategoryRule; matched: string } | null = null;

  for (const rule of CATEGORY_RULES) {
    for (const keyword of rule.keywords) {
      if (!text.includes(keyword)) continue;
      if (!best || keyword.length > best.matched.length) {
        best = { rule, matched: keyword };
      }
    }
  }
  return best;
}

const WEIGHT_SCHEMA = {
  type: 'object',
  properties: {
    weight_kg: {
      type: 'number',
      description:
        'Estimated packed shipping weight in kilograms, including retail packaging.'
    },
    category: {
      type: 'string',
      description: 'Short lowercase product category slug, e.g. "sneakers".'
    },
    confidence: {
      type: 'string',
      enum: ['high', 'medium', 'low'],
      description: 'How confident the estimate is given the available detail.'
    }
  },
  required: ['weight_kg', 'category', 'confidence'],
  additionalProperties: false
} as const;

type ClaudeWeightResult = {
  weight_kg: number;
  category: string;
  confidence: 'high' | 'medium' | 'low';
};

/**
 * Refines the estimate with Claude. Returns null on any failure — a quote must
 * never depend on this call succeeding.
 */
async function estimateWithClaude(
  product: ScrapedProduct,
  fallbackKg: number
): Promise<ClaudeWeightResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const details = [
    product.title && `Title: ${product.title}`,
    product.category && `Category: ${product.category}`,
    product.brand && `Brand: ${product.brand}`,
    product.description && `Description: ${product.description.slice(0, 400)}`
  ]
    .filter(Boolean)
    .join('\n');

  if (!details) return null;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create(
      {
        model: 'claude-opus-5',
        max_tokens: 1024,
        output_config: {
          effort: 'low',
          format: { type: 'json_schema', schema: WEIGHT_SCHEMA }
        },
        system:
          'You estimate packed shipping weights for parcels flown from Turkey to Lebanon. ' +
          'Listings are in Turkish or English. Include retail packaging in the estimate. ' +
          'Prefer a slightly conservative (heavier) figure over an optimistic one, because ' +
          'an under-estimate means the customer is quoted less than the shipment costs. ' +
          `If the listing is too vague to judge, return ${fallbackKg} with low confidence.`,
        messages: [
          {
            role: 'user',
            content: `Estimate the packed shipping weight of this product.\n\n${details}`
          }
        ]
      },
      { timeout: 15_000 }
    );

    if (response.stop_reason === 'refusal') return null;

    const block = response.content.find((item) => item.type === 'text');
    if (!block || block.type !== 'text') return null;

    const parsed = JSON.parse(block.text) as ClaudeWeightResult;
    if (!Number.isFinite(parsed.weight_kg) || parsed.weight_kg <= 0) return null;
    // Sanity bound: nothing this service ships is above 80kg.
    if (parsed.weight_kg > 80) return null;

    return parsed;
  } catch {
    // Network error, bad JSON, rate limit — the heuristic still stands.
    return null;
  }
}

export async function estimateWeight(
  product: ScrapedProduct,
  options: { useAi?: boolean } = {}
): Promise<WeightEstimate> {
  // 1. The store told us.
  if (product.weightKg != null && product.weightKg > 0) {
    return {
      weightKg: product.weightKg,
      method: 'declared',
      category: product.category,
      confidence: 'high'
    };
  }

  // 2. The title told us.
  const fromTitle = product.title ? parseWeightFromText(product.title) : null;
  if (fromTitle != null) {
    return {
      weightKg: fromTitle,
      method: 'parsed',
      category: product.category,
      confidence: 'high'
    };
  }

  // 3. Classify.
  const text = searchableText(product);
  const match = text ? classifyByKeywords(text) : null;
  const heuristicKg = match?.rule.weightKg ?? DEFAULT_WEIGHT_KG;

  if (options.useAi !== false) {
    const ai = await estimateWithClaude(product, heuristicKg);
    if (ai) {
      return {
        weightKg: ai.weight_kg,
        method: 'ai',
        category: ai.category,
        confidence: ai.confidence
      };
    }
  }

  if (match) {
    return {
      weightKg: match.rule.weightKg,
      method: 'heuristic',
      category: match.rule.key,
      confidence: 'medium'
    };
  }

  return {
    weightKg: DEFAULT_WEIGHT_KG,
    method: 'default',
    category: null,
    confidence: 'low'
  };
}
