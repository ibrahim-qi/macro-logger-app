/** Web search for nutrition research during meal parsing (Serper / Google, UK-biased). */

export interface SearchSnippet {
  title: string;
  link: string;
  snippet: string;
}

export interface SearchResult {
  query: string;
  snippets: SearchSnippet[];
}

const SERPER_URL = 'https://google.serper.dev/search';

const US_SOURCE_PATTERN =
  /\b(usda\.gov|fdc\.nal\.usda|nutritionix\.com|calorieking\.com\/us|myfitnesspal\.com)\b/i;

export function getSearchApiKey(): string | undefined {
  try {
    if (typeof Deno !== 'undefined' && Deno.env) {
      return Deno.env.get('SERPER_API_KEY')?.trim() || undefined;
    }
  } catch {
    // not in Deno
  }
  if (typeof process !== 'undefined' && process.env?.SERPER_API_KEY) {
    return process.env.SERPER_API_KEY.trim();
  }
  return undefined;
}

/** Ensure queries target UK sources. */
export function ukBiasQuery(query: string): string {
  const q = query.trim();
  if (!q) return q;

  const lower = q.toLowerCase();
  if (
    lower.includes(' uk') ||
    lower.includes('site:.co.uk') ||
    lower.includes('cofid') ||
    lower.includes('nhs.uk') ||
    lower.includes('mcdonalds.co.uk')
  ) {
    return q;
  }

  return `${q} UK`;
}

export async function searchWeb(query: string, apiKey: string): Promise<SearchResult> {
  const response = await fetch(SERPER_URL, {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: ukBiasQuery(query),
      gl: 'uk',
      hl: 'en-gb',
      num: 3,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Web search failed (${response.status}): ${detail.slice(0, 200)}`);
  }

  const payload = await response.json();
  const organic = Array.isArray(payload?.organic) ? payload.organic : [];

  const snippets = organic
    .slice(0, 8)
    .map((row: { title?: string; link?: string; snippet?: string }) => ({
      title: String(row.title ?? ''),
      link: String(row.link ?? ''),
      snippet: String(row.snippet ?? ''),
    }))
    .filter((hit) => !US_SOURCE_PATTERN.test(hit.link) && !US_SOURCE_PATTERN.test(hit.snippet))
    .slice(0, 5);

  return { query: ukBiasQuery(query), snippets };
}

/** Run unique queries in parallel, capped per meal. */
export async function runMealResearch(
  queries: string[],
  apiKey: string,
  maxQueries = 4,
): Promise<SearchResult[]> {
  const unique = [...new Set(queries.map((q) => ukBiasQuery(q)).filter(Boolean))].slice(0, maxQueries);
  if (!unique.length) return [];

  const settled = await Promise.allSettled(unique.map((q) => searchWeb(q, apiKey)));
  const results: SearchResult[] = [];

  for (const outcome of settled) {
    if (outcome.status === 'fulfilled') {
      results.push(outcome.value);
    }
  }

  return results;
}

export function formatResearchForPrompt(results: SearchResult[]): string {
  if (!results.length) return '';

  const blocks = results.map((result) => {
    const lines = [`Query: "${result.query}"`];
    if (!result.snippets.length) {
      lines.push('- No UK-suitable results returned.');
      return lines.join('\n');
    }
    for (const hit of result.snippets) {
      lines.push(`- ${hit.title} (${hit.link})`);
      lines.push(`  ${hit.snippet}`);
    }
    return lines.join('\n');
  });

  return [
    'Web research results (UK-biased; US/USDA sources filtered out):',
    '',
    blocks.join('\n\n'),
  ].join('\n');
}

/** Collect pass-1 queries + UK fallbacks for uncertain items. */
export function collectSearchQueries(
  items: Array<{
    food_name: string;
    portion_description?: string;
    confidence: string;
    search_queries?: string[];
  }>,
  maxTotal = 4,
): string[] {
  const queries: string[] = [];

  const add = (raw: string) => {
    const q = ukBiasQuery(raw);
    if (!q || queries.includes(q) || queries.length >= maxTotal) return;
    queries.push(q);
  };

  for (const item of items) {
    for (const q of item.search_queries ?? []) add(q);
  }

  for (const item of items) {
    if (queries.length >= maxTotal) break;
    if (item.confidence === 'high') continue;

    const portion = item.portion_description?.trim();
    const fallback = portion
      ? `${item.food_name} ${portion} nutrition calories CoFID NHS`
      : `${item.food_name} nutrition calories UK CoFID NHS`;
    add(fallback);
  }

  return queries.slice(0, maxTotal);
}
