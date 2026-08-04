export interface UserProfile {
  id: string;
  display_name: string | null;
  timezone: string;
  locale: string;
  onboarding_completed: boolean;
}

export interface UserGoals {
  daily_calories_goal: number;
  daily_protein_goal: number;
  daily_carbs_goal: number;
  daily_fats_goal: number;
}

export interface DailyTotals {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';
export type MealPeriod = 'Breakfast' | 'Lunch' | 'Snack' | 'Dinner';

export interface ExperienceContext {
  displayName: string | null;
  firstName: string | null;
  timeOfDay: TimeOfDay;
  mealPeriod: MealPeriod;
  goals: UserGoals | null;
  todayTotals: DailyTotals;
  entryCount: number;
  streak: number;
  caloriesRemaining: number | null;
  proteinRemaining: number | null;
  hasLoggedToday: boolean;
  weeklyDaysLogged: number | null;
}
