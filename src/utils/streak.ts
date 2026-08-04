import { formatLocalDateKey, dateKeyInTimezone } from './localDate';

function previousDateKey(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 1);
  return formatLocalDateKey(date);
}

export function computeStreak(loggedDates: Set<string>, todayKey: string): number {
  let cursorKey = todayKey;
  if (!loggedDates.has(cursorKey)) {
    cursorKey = previousDateKey(cursorKey);
  }

  let streak = 0;
  while (loggedDates.has(cursorKey)) {
    streak += 1;
    cursorKey = previousDateKey(cursorKey);
  }
  return streak;
}

export function datesFromTimestamps(timestamps: string[], timeZone?: string): Set<string> {
  if (!timeZone) {
    return new Set(timestamps.map((ts) => formatLocalDateKey(new Date(ts))));
  }
  return new Set(timestamps.map((ts) => dateKeyInTimezone(timeZone, new Date(ts))));
}

export function todayDateKey(timeZone?: string): string {
  return timeZone ? dateKeyInTimezone(timeZone) : formatLocalDateKey(new Date());
}
