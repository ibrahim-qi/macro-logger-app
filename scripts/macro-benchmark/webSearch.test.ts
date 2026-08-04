import {
  fallbackQuery,
  filterAndRankSnippets,
  searchMealItems,
  ukBiasQuery,
} from '../../supabase/functions/_shared/webSearch.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const ranked = filterAndRankSnippets([
  {
    title: 'Blocked',
    link: 'https://www.myfitnesspal.com/food',
    snippet: '100 calories',
  },
  {
    title: 'General result',
    link: 'https://example.com/food',
    snippet: 'Per 100g: 10 kcal, protein 1g, carbs 1g, fat 0g.',
  },
  {
    title: 'UK result',
    link: 'https://example.org.uk/food',
    snippet: 'Per 100g: 20 kcal, protein 2g, carbs 2g, fat 0g.',
  },
]);
assert(ranked.length === 1, 'Blocked and non-UK sources must be removed');
assert(ranked[0].title === 'UK result', 'UK evidence must be retained');

assert(ukBiasQuery('banana nutrition') === 'banana nutrition UK', 'Queries must be UK biased');
assert(ukBiasQuery('banana nutrition UK') === 'banana nutrition UK', 'UK must not be duplicated');

const generic = fallbackQuery({
  food_name: 'cooked white rice',
  preparation: 'boiled',
});
assert(generic.includes('protein carbohydrate fat per 100g'), 'Generic fallback must request complete evidence');
assert(
  !/\b\d+\s*(?:kcal|cal|ml)\b/i.test(generic.replace(/\bper 100g\b/i, '')),
  'Queries must not embed guessed food values',
);

const originalFetch = globalThis.fetch;
let attempts = 0;
globalThis.fetch = (async () => {
  attempts += 1;
  if (attempts === 1) {
    return new Response('rate limited', { status: 429 });
  }
  return new Response(JSON.stringify({
    organic: [{
      title: 'UK nutrition',
      link: 'https://example.org.uk/nutrition',
      snippet: 'Per 100g: 100 kcal, protein 5g, carbohydrate 10g, fat 4g.',
    }],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}) as typeof fetch;

try {
  const results = await searchMealItems([
    {
      item_id: 'item_1',
      food_name: 'test food unique retry',
      search_query: 'test food unique retry nutrition',
    },
    {
      item_id: 'item_2',
      food_name: 'overflow food',
      search_query: 'overflow food nutrition',
    },
  ], 'test-key', { maxItems: 1, concurrency: 1 });

  assert(attempts === 2, `Expected one retry after 429, got ${attempts} attempts`);
  assert(results.length === 2, 'Every item must receive an explicit search result');
  assert(results[0].item_id === 'item_1' && results[0].status === 'ok', 'Identity must survive search');
  assert(
    results[1].item_id === 'item_2' &&
    results[1].status === 'error' &&
    results[1].error?.includes('safety limit'),
    'Overflow items must not be silently dropped',
  );

  attempts = 0;
  globalThis.fetch = (async () => {
    attempts += 1;
    if (attempts === 1) throw new DOMException('timed out', 'TimeoutError');
    return new Response(JSON.stringify({
      organic: [{
        title: 'UK timeout recovery',
        link: 'https://example.org.uk/recovered',
        snippet: 'Per 100g: 90 kcal, protein 3g, carbohydrate 12g, fat 2g.',
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  const timeoutRecovery = await searchMealItems([{
    item_id: 'item_timeout',
    food_name: 'unique timeout food',
    search_query: 'unique timeout food nutrition',
  }], 'test-key');
  assert(attempts === 2, 'A timeout/network failure must receive one retry');
  assert(timeoutRecovery[0].status === 'ok', 'A successful timeout retry must be returned');
} finally {
  globalThis.fetch = originalFetch;
}

console.log('All web search checks passed.');
