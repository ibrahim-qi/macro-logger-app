export type ParseConfidence = 'high' | 'medium' | 'low';

export interface ParsedFoodItem {
  item_id?: string;
  food_name: string;
  preparation?: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  quantity: number;
  unit?: 'count' | 'serving';
  confidence?: ParseConfidence;
  /** What the parser inferred beyond the user's words (e.g. slice weight, raw vs cooked) */
  portion_assumption?: string;
  /** Gram weight the per-unit macros represent — used to scale when the user adjusts serving size */
  reference_weight_g?: number;
  /** Millilitre volume the per-unit macros represent; never treated as grams implicitly */
  reference_volume_ml?: number;
  /** UK source used for the estimate (e.g. CoFID, Tesco UK) */
  source_note?: string;
  source_title?: string;
  source_url?: string;
  evidence_quote?: string;
  evidence_status?: 'uk_evidence' | 'ai_estimate' | 'user_saved' | 'unavailable';
  /** True when macros were filled from the user's saved foods list */
  from_saved_food?: boolean;
  macro_validation?: {
    status: 'ok' | 'review';
    atwater_error_pct: number | null;
  };
}

export interface ParseMealResponse {
  items: ParsedFoodItem[];
  notes?: string;
  transcript?: string;
  research_used?: boolean;
  searches_run?: number;
  parse_path?: 'fast' | 'research';
  research_available?: boolean;
}

/** User-visible parse pipeline stages streamed from the edge function. */
export type ParseProgressStage =
  | 'transcribing'
  | 'identifying'
  | 'looking_up'
  | 'estimating';

export interface ParseProgressState {
  current: ParseProgressStage;
}
