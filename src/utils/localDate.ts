/** Calendar date in the user's local timezone as YYYY-MM-DD */
export function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parse YYYY-MM-DD as local midnight (not UTC) */
export function parseLocalDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Local start/end timestamps for querying a calendar day */
export function localDayBounds(date: Date): { dayStart: string; dayEnd: string; dateKey: string } {
  const dateKey = formatLocalDateKey(date);
  return {
    dateKey,
    dayStart: `${dateKey}T00:00:00`,
    dayEnd: `${dateKey}T23:59:59`,
  };
}
