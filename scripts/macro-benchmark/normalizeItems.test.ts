import { normalizeItems } from '../../supabase/functions/_shared/normalizeItems.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const [count, volume, invalid] = normalizeItems([
  {
    item_id: ' item_1 ',
    food_name: '  cherry tomato ',
    calories: 3,
    protein: 0.1,
    carbs: 0.5,
    fats: 0,
    quantity: 30,
    unit: 'count',
    evidence_status: 'uk_evidence',
  },
  {
    item_id: 'item_2',
    food_name: ' drink ',
    calories: 100,
    protein: 5,
    carbs: 10,
    fats: 3,
    quantity: 1,
    unit: 'serving',
    reference_volume_ml: 250,
    source_url: ' https://example.org.uk/drink ',
  },
  {
    food_name: 'invalid numbers',
    calories: Number.NaN,
    protein: -1,
    carbs: Number.POSITIVE_INFINITY,
    fats: 2,
    quantity: 0,
  },
]);

assert(count.item_id === 'item_1', 'Item IDs should be trimmed');
assert(count.food_name === 'cherry tomato', 'Food names should be trimmed');
assert(count.quantity === 30, 'Normalizer must not reinterpret a valid count');
assert(count.unit === 'count', 'Count unit must be preserved');
assert(count.evidence_status === 'uk_evidence', 'Evidence metadata must be preserved');

assert(volume.reference_volume_ml === 250, 'Millilitres must remain volume metadata');
assert(volume.reference_weight_g === undefined, 'Millilitres must not become grams');
assert(volume.source_url === 'https://example.org.uk/drink', 'Source URLs should be trimmed');

assert(invalid.calories === 0 && invalid.protein === 0 && invalid.carbs === 0, 'Invalid macros must be bounded');
assert(invalid.quantity === 1, 'Invalid quantity receives only a structural fallback');
assert(invalid.unit === 'serving', 'Missing unit should normalize to serving');

console.log('All boundary normalization checks passed.');
