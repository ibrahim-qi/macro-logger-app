import { shouldUseFastParse } from '../../supabase/functions/_shared/parseFastPath.ts';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(shouldUseFastParse('2 boiled eggs'), 'simple count uses fast path');
assert(shouldUseFastParse('150g grilled chicken breast'), 'explicit grams uses fast path');
assert(shouldUseFastParse('one medium banana'), 'medium banana uses fast path');

assert(!shouldUseFastParse("McDonald's Big Mac"), 'branded uses research path');
assert(!shouldUseFastParse('Greggs sausage roll'), 'Greggs uses research path');
assert(!shouldUseFastParse('large latte with semi-skimmed milk'), 'vague drink without brand uses research');
assert(!shouldUseFastParse('150g Greek yogurt with a handful of blueberries'), 'handful uses research path');
assert(!shouldUseFastParse('meal deal: chicken sandwich and crisps'), 'meal deal uses research path');
assert(!shouldUseFastParse('2 boiled eggs and 2 slices sourdough toast'), 'compound meal uses research path');
assert(!shouldUseFastParse('porridge with a tablespoon of peanut butter'), 'with side uses research path');
assert(!shouldUseFastParse('200ml plain kefir'), 'unspecified kefir uses research path');
assert(!shouldUseFastParse('180g boneless skinless chicken thighs'), 'grams meat without cooking state uses research path');
assert(shouldUseFastParse('150g grilled chicken breast'), 'grilled meat uses fast path');

console.log('All fast-path routing checks passed.');
