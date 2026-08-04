export type ParseConfidence = 'high' | 'medium' | 'low';

export interface ParsedFoodItem {
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  quantity: number;
  confidence?: ParseConfidence;
  /** True when macros were filled from the user's saved foods list */
  from_saved_food?: boolean;
}

export interface ParseMealResponse {
  items: ParsedFoodItem[];
  notes?: string;
  transcript?: string;
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
