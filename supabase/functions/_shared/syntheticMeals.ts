/** Synthetic meal-description generator for building a self-owned training set.
 *  Produces realistic UK meal phrasings (brands, portions, sides, swaps,
 *  negations) that the real parse pipeline then verifies against Open Food
 *  Facts / Serper to produce source-backed labels. Labels are never AI
 *  estimates — every generated meal is run through the evidence pipeline. */

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rand = () => number;

function pick<T>(rand: Rand, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

// --- UK-first taxonomy -------------------------------------------------------

const CEREALS = ['porridge', 'cornflakes', 'weetabix', 'bran flakes', 'muesli', 'shredded wheat'] as const;
const MILK = ['semi-skimmed milk', 'whole milk', 'oat milk', 'almond milk', 'skimmed milk'] as const;
const BREADS = ['wholemeal', 'white', 'sourdough', 'seeded', 'granary'] as const;
const SPREADS = ['butter', 'marmite', 'peanut butter', 'jam', 'marmalade', 'chocolate spread'] as const;
const EGG_PREPS = ['scrambled', 'fried', 'poached', 'boiled'] as const;
const FRUITS = ['a banana', 'an apple', 'an orange', 'a pear', 'a handful of grapes'] as const;
const YOGURTS = ['greek yogurt', 'natural yogurt', 'fruit yogurt', 'skyr yogurt'] as const;
const SMOOTHIES = ['strawberry', 'mango', 'berry', 'banana'] as const;
const BARS = ['protein', 'granola', 'nut', 'cereal'] as const;

const SANDWICHES = ['chicken', 'ham and cheese', 'egg mayo', 'tuna mayo', 'bacon and egg', 'cheese and pickle'] as const;
const SANDWICH_BREAD = ['white bread', 'brown bread', 'a baguette', 'a wrap'] as const;
const SALADS = ['a caesar salad', 'a greek salad', 'a chicken salad', 'a cobb salad'] as const;
const SALAD_TOPPINGS = ['grilled chicken', 'tuna', 'feta', 'avocado'] as const;
const DRESSINGS = ['caesar', 'vinaigrette', 'ranch', 'olive oil'] as const;
const SOUPS = ['tomato', 'chicken', 'lentil', 'leek and potato', 'carrot and coriander'] as const;
const JACKET_FILLINGS = ['baked beans', 'cheese', 'tuna mayo', 'chilli'] as const;
const WRAP_FILLINGS = ['chicken and bacon', 'falafel and hummus', 'tuna mayo', 'duck and hoisin'] as const;

const PROTEINS = ['grilled chicken breast', 'a salmon fillet', 'a rump steak', 'a pork chop', 'lamb chops', 'a cod fillet'] as const;
const CARBS = ['white rice', 'brown rice', 'sweet potato mash', 'new potatoes', 'couscous', 'quinoa'] as const;
const VEG = ['broccoli', 'green beans', 'peas', 'roasted carrots', 'spinach', 'asparagus'] as const;
const CURRIES = ['chicken tikka masala', 'lamb rogan josh', 'vegetable korma', 'beef madras', 'chana masala'] as const;
const RICE = ['basmati rice', 'pilau rice', 'plain rice', 'boiled rice'] as const;
const PASTAS = ['spaghetti bolognese', 'penne arrabiata', 'a carbonara', 'mac and cheese', 'lasagne'] as const;
const STIR_FRY_VEG = ['peppers', 'broccoli', 'mushrooms', 'pak choi'] as const;
const FISH_TYPES = ['battered cod', 'sea bass', 'haddock', 'a tuna steak'] as const;
const POTATO_TYPES = ['chips', 'mashed potato', 'boiled potatoes', 'roast potatoes'] as const;

const CRISPS = ['walkers cheese and onion crisps', 'ready salted crisps', 'salt and vinegar crisps', 'prawn cocktail crisps', 'smoky bacon crisps'] as const;
const CHOCOLATES = ['dairy milk', 'kitkat', 'twix', 'snickers', 'maltesers'] as const;
const NUTS = ['almonds', 'cashews', 'peanuts', 'walnuts'] as const;
const BISCUITS = ['a digestive', 'a rich tea', 'a chocolate hobnob', 'a custard cream'] as const;

const BURGERS = ['a big mac', 'a quarter pounder', 'a whopper', 'a double cheeseburger', 'a chicken burger'] as const;
const BURGER_SIDES = ['fries', 'a side salad', 'onion rings', 'mozzarella sticks'] as const;
const SOFT_DRINKS = ['diet coke', 'coke zero', 'orange juice', 'sparkling water', 'apple juice'] as const;
const PIZZAS = ['margherita', 'pepperoni', 'hawaiian', 'vegetarian', 'bbq chicken'] as const;
const PIZZA_TOPPINGS = ['extra cheese', 'pepperoni', 'mushrooms', 'olives'] as const;
const CHINESE = ['sweet and sour chicken', 'chow mein', 'egg fried rice', 'beef in black bean sauce'] as const;
const KEBAB_SIDES = ['chips', 'salad', 'pitta bread', 'garlic sauce'] as const;
const SWAP_PHRASES = ['swapped the fries for a salad', 'no pickles', 'without mayo', 'swapped the coke for a diet coke', 'no cheese', 'extra sauce'] as const;
const NEGATED_VEG = ['onions', 'mushrooms', 'peas', 'tomatoes'] as const;

type Template = (rand: Rand) => string;

const TEMPLATES: Template[] = [
  // Breakfast
  (r) => `a bowl of ${pick(r, CEREALS)} with ${pick(r, MILK)}`,
  (r) => `two slices of ${pick(r, BREADS)} toast with ${pick(r, SPREADS)}`,
  (r) => `two ${pick(r, EGG_PREPS)} eggs on ${pick(r, BREADS)} toast`,
  (r) => `${pick(r, FRUITS)} and a pot of ${pick(r, YOGURTS)}`,
  (r) => `a ${pick(r, SMOOTHIES)} smoothie and a ${pick(r, BARS)} bar`,
  // Lunch
  (r) => `a ${pick(r, SANDWICHES)} sandwich on ${pick(r, SANDWICH_BREAD)}`,
  (r) => `${pick(r, SALADS)} with ${pick(r, SALAD_TOPPINGS)} and ${pick(r, DRESSINGS)} dressing`,
  (r) => `a bowl of ${pick(r, SOUPS)} soup with ${pick(r, BREADS)} bread`,
  (r) => `a jacket potato with ${pick(r, JACKET_FILLINGS)}`,
  (r) => `a wrap with ${pick(r, WRAP_FILLINGS)}`,
  // Dinner
  (r) => `${pick(r, PROTEINS)} with ${pick(r, CARBS)} and ${pick(r, VEG)}`,
  (r) => `a ${pick(r, CURRIES)} with ${pick(r, RICE)}`,
  (r) => `${pick(r, PASTAS)}`,
  (r) => `a chicken stir fry with ${pick(r, STIR_FRY_VEG)} and noodles`,
  (r) => `${pick(r, FISH_TYPES)} with ${pick(r, VEG)} and ${pick(r, POTATO_TYPES)}`,
  // Snacks
  (r) => `a packet of ${pick(r, CRISPS)}`,
  (r) => `a ${pick(r, CHOCOLATES)} bar`,
  (r) => `an apple and a handful of ${pick(r, NUTS)}`,
  (r) => `${pick(r, BISCUITS)} biscuit with a cup of tea`,
  // Takeaway + messy real-speech
  (r) => `${pick(r, BURGERS)} meal with ${pick(r, BURGER_SIDES)} and ${pick(r, SOFT_DRINKS)}`,
  (r) => `a ${pick(r, PIZZAS)} pizza with ${pick(r, PIZZA_TOPPINGS)}`,
  (r) => `${pick(r, CHINESE)} with ${pick(r, RICE)}`,
  (r) => `a chicken kebab with ${pick(r, KEBAB_SIDES)}`,
  (r) => `i had ${pick(r, PROTEINS)} and ${pick(r, CARBS)}, oh and some ${pick(r, VEG)}`,
  (r) => `${pick(r, BURGERS)} but ${pick(r, SWAP_PHRASES)}`,
  (r) => `${pick(r, PROTEINS)} with ${pick(r, CARBS)}, no ${pick(r, NEGATED_VEG)}`,
];

export function generateSyntheticMeals(count: number, seed = 1): string[] {
  const rand = mulberry32(seed);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(pick(rand, TEMPLATES)(rand));
  }
  return out;
}
