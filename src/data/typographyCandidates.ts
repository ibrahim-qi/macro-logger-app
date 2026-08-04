export type TypographyFilter = 'all' | 'recommended' | 'single-family' | 'serif-wordmark';

export interface TypographyPair {
  id: string;
  name: string;
  wordmarkFont: string;
  uiFont: string;
  wordmarkWeight: number;
  uiWeight?: number;
  wordmarkLetterSpacing?: string;
  wordmarkStyle?: 'normal' | 'italic';
  recommended?: boolean;
  singleFamily?: boolean;
  serifWordmark?: boolean;
  note: string;
}

export const TYPOGRAPHY_PAIRS: TypographyPair[] = [
  {
    id: 'sora-jakarta',
    name: 'Sora + Plus Jakarta',
    wordmarkFont: 'Sora',
    uiFont: 'Plus Jakarta Sans',
    wordmarkWeight: 600,
    wordmarkLetterSpacing: '0.04em',
    recommended: true,
    note: 'Soft geometry on the mark; calm UI that stays out of the way.',
  },
  {
    id: 'fraunces-jakarta',
    name: 'Fraunces + Plus Jakarta',
    wordmarkFont: 'Fraunces',
    uiFont: 'Plus Jakarta Sans',
    wordmarkWeight: 600,
    wordmarkLetterSpacing: '0.02em',
    recommended: true,
    serifWordmark: true,
    note: 'Premium wellness feel — serif brand, clean sans everywhere else.',
  },
  {
    id: 'bricolage-dm',
    name: 'Bricolage + DM Sans',
    wordmarkFont: 'Bricolage Grotesque',
    uiFont: 'DM Sans',
    wordmarkWeight: 600,
    wordmarkLetterSpacing: '0.01em',
    recommended: true,
    note: 'Distinctive display with friendly, modern UI body.',
  },
  {
    id: 'syne-jakarta',
    name: 'Syne + Plus Jakarta',
    wordmarkFont: 'Syne',
    uiFont: 'Plus Jakarta Sans',
    wordmarkWeight: 700,
    wordmarkLetterSpacing: '0.06em',
    recommended: true,
    note: 'Bold editorial wordmark; UI stays neutral and readable.',
  },
  {
    id: 'sora-sora',
    name: 'Sora (single family)',
    wordmarkFont: 'Sora',
    uiFont: 'Sora',
    wordmarkWeight: 600,
    uiWeight: 400,
    wordmarkLetterSpacing: '0.05em',
    singleFamily: true,
    note: 'One family, two weights — simple system, brand still wins at 600.',
  },
  {
    id: 'manrope-manrope',
    name: 'Manrope (single family)',
    wordmarkFont: 'Manrope',
    uiFont: 'Manrope',
    wordmarkWeight: 700,
    uiWeight: 400,
    wordmarkLetterSpacing: '0.03em',
    singleFamily: true,
    note: 'Rounded grotesk; cohesive but less distinctive wordmark.',
  },
  {
    id: 'onest-onest',
    name: 'Onest (single family)',
    wordmarkFont: 'Onest',
    uiFont: 'Onest',
    wordmarkWeight: 600,
    uiWeight: 400,
    wordmarkLetterSpacing: '0.04em',
    singleFamily: true,
    note: 'Geometric and neutral — safe, minimal character.',
  },
  {
    id: 'figtree-figtree',
    name: 'Figtree (single family)',
    wordmarkFont: 'Figtree',
    uiFont: 'Figtree',
    wordmarkWeight: 700,
    uiWeight: 400,
    wordmarkLetterSpacing: '0.02em',
    singleFamily: true,
    note: 'Warm and approachable; good for everyday logging UX.',
  },
  {
    id: 'dm-dm',
    name: 'DM Sans (single family)',
    wordmarkFont: 'DM Sans',
    uiFont: 'DM Sans',
    wordmarkWeight: 700,
    uiWeight: 400,
    wordmarkLetterSpacing: '0.03em',
    singleFamily: true,
    note: 'Low-contrast pairing — brand may not stand out enough.',
  },
  {
    id: 'albert-albert',
    name: 'Albert Sans (single family)',
    wordmarkFont: 'Albert Sans',
    uiFont: 'Albert Sans',
    wordmarkWeight: 700,
    uiWeight: 400,
    wordmarkLetterSpacing: '0.05em',
    singleFamily: true,
    note: 'Clean geometric; similar risk — wordmark needs weight + spacing.',
  },
  {
    id: 'outfit-jakarta',
    name: 'Outfit + Plus Jakarta (current)',
    wordmarkFont: 'Outfit',
    uiFont: 'Plus Jakarta Sans',
    wordmarkWeight: 600,
    wordmarkLetterSpacing: '-0.02em',
    note: 'What the app used before — functional but generic wordmark.',
  },
  {
    id: 'cormorant-jakarta',
    name: 'Cormorant + Plus Jakarta (current wordmark)',
    wordmarkFont: 'Cormorant Garamond',
    uiFont: 'Plus Jakarta Sans',
    wordmarkWeight: 600,
    wordmarkLetterSpacing: '0.06em',
    serifWordmark: true,
    note: 'Current wordmark font — elegant but can feel editorial vs product.',
  },
  {
    id: 'lexend-jakarta',
    name: 'Lexend + Plus Jakarta',
    wordmarkFont: 'Lexend',
    uiFont: 'Plus Jakarta Sans',
    wordmarkWeight: 600,
    wordmarkLetterSpacing: '0.03em',
    note: 'Highly readable; brand text may blend with UI too much.',
  },
  {
    id: 'epilogue-jakarta',
    name: 'Epilogue + Plus Jakarta',
    wordmarkFont: 'Epilogue',
    uiFont: 'Plus Jakarta Sans',
    wordmarkWeight: 600,
    wordmarkLetterSpacing: '0.04em',
    note: 'Subtle personality in the wordmark without going serif.',
  },
  {
    id: 'space-jakarta',
    name: 'Space Grotesk + Plus Jakarta',
    wordmarkFont: 'Space Grotesk',
    uiFont: 'Plus Jakarta Sans',
    wordmarkWeight: 600,
    wordmarkLetterSpacing: '0.02em',
    note: 'Tech-forward wordmark; pairs well with soft Jakarta body.',
  },
  {
    id: 'urbanist-jakarta',
    name: 'Urbanist + Plus Jakarta',
    wordmarkFont: 'Urbanist',
    uiFont: 'Plus Jakarta Sans',
    wordmarkWeight: 600,
    wordmarkLetterSpacing: '0.05em',
    note: 'Wide, airy wordmark; UI stays compact and legible.',
  },
  {
    id: 'bricolage-jakarta',
    name: 'Bricolage + Plus Jakarta',
    wordmarkFont: 'Bricolage Grotesque',
    uiFont: 'Plus Jakarta Sans',
    wordmarkWeight: 600,
    wordmarkLetterSpacing: '0.01em',
    note: 'Quirky display + trusted UI — strong contrast between brand and app.',
  },
  {
    id: 'fraunces-dm',
    name: 'Fraunces + DM Sans',
    wordmarkFont: 'Fraunces',
    uiFont: 'DM Sans',
    wordmarkWeight: 600,
    wordmarkLetterSpacing: '0.02em',
    serifWordmark: true,
    note: 'Wellness premium wordmark with slightly warmer UI than Jakarta.',
  },
];

export const TYPOGRAPHY_FONT_FAMILIES = [
  'Sora',
  'Fraunces',
  'Bricolage Grotesque',
  'Manrope',
  'Onest',
  'Outfit',
  'Cormorant Garamond',
  'DM Sans',
  'Albert Sans',
  'Lexend',
  'Figtree',
  'Syne',
  'Epilogue',
  'Space Grotesk',
  'Urbanist',
  'Plus Jakarta Sans',
] as const;

export function buildGoogleFontsUrl(families: readonly string[]): string {
  const params = families
    .map((family) => {
      const name = family.replace(/ /g, '+');
      return `family=${name}:ital,wght@0,400;0,500;0,600;0,700;1,400`;
    })
    .join('&');
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}

export function filterPairs(filter: TypographyFilter): TypographyPair[] {
  switch (filter) {
    case 'recommended':
      return TYPOGRAPHY_PAIRS.filter((p) => p.recommended);
    case 'single-family':
      return TYPOGRAPHY_PAIRS.filter((p) => p.singleFamily);
    case 'serif-wordmark':
      return TYPOGRAPHY_PAIRS.filter((p) => p.serifWordmark);
    default:
      return TYPOGRAPHY_PAIRS;
  }
}
