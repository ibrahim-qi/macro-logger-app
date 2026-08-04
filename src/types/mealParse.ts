export type ParseConfidence = 'high' | 'medium' | 'low';

export interface ParsedFoodItem {
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  quantity: number;
  confidence?: ParseConfidence;
  /** What the parser inferred beyond the user's words (e.g. slice weight, raw vs cooked) */
  portion_assumption?: string;
  /** UK source used for the estimate (e.g. CoFID, Tesco UK) */
  source_note?: string;
  /** True when macros were filled from the user's saved foods list */
  from_saved_food?: boolean;
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

export interface TranscribeMealResponse {
  transcript: string;
}

export interface ParseMealRequest {
  text?: string;
  audio?: string;
  mimeType?: string;
  action?: 'transcribe' | 'parse';
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
