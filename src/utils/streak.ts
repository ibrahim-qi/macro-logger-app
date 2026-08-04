import { formatLocalDateKey } from './localDate';

const formatDay = (date: Date): string => formatLocalDateKey(date);

export function computeStreak(loggedDates: Set<string>): number {
  const cursor = new Date();
  if (!loggedDates.has(formatDay(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (loggedDates.has(formatDay(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function datesFromTimestamps(timestamps: string[]): Set<string> {
  return new Set(timestamps.map((ts) => formatLocalDateKey(new Date(ts))));
}
