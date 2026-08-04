import type { MealPeriod, TimeOfDay } from '../types/experience';
import { getMealPeriod as getMealPeriodFromTotals } from './mealTotals';
import { formatLocalDateKey } from './localDate';

export function getMealPeriod(date = new Date()): MealPeriod {
  return getMealPeriodFromTotals(date) as MealPeriod;
}

export function deriveNameFromEmail(email: string | undefined | null): string | null {
  if (!email) return null;
  const local = email.split('@')[0]?.trim();
  if (!local) return null;
  const segment = local.split(/[._-]/)[0];
  if (!segment) return null;
  return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
}

export function getFirstName(displayName: string | null | undefined): string | null {
  if (!displayName?.trim()) return null;
  return displayName.trim().split(/\s+/)[0] ?? null;
}

export function getTimeOfDay(date = new Date()): TimeOfDay {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

export function formatDateKey(date = new Date()): string {
  return formatLocalDateKey(date);
}

export function timeOfDayLabel(timeOfDay: TimeOfDay): string {
  switch (timeOfDay) {
    case 'morning': return 'Good morning';
    case 'afternoon': return 'Good afternoon';
    case 'evening': return 'Good evening';
    case 'night': return 'Good evening';
  }
}

export function mealPeriodPrompt(mealPeriod: MealPeriod): string {
  switch (mealPeriod) {
    case 'Breakfast': return 'What did you have for breakfast?';
    case 'Lunch': return "What's for lunch?";
    case 'Snack': return 'What are you snacking on?';
    case 'Dinner': return "What's for dinner?";
  }
}
