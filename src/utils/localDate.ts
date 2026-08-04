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

export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function getZonedDateTimeFormat(timeZone: string): Intl.DateTimeFormat {
  let dtf = dtfCache.get(timeZone);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    dtfCache.set(timeZone, dtf);
  }
  return dtf;
}

function getZonedParts(date: Date, timeZone: string) {
  const parts = getZonedDateTimeFormat(timeZone).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour: pick('hour') % 24,
    minute: pick('minute'),
    second: pick('second'),
  };
}

/** Convert a wall-clock time in `timeZone` to a UTC Date */
export function zonedLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  timeZone: string,
): Date {
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = getZonedParts(new Date(utcMs), timeZone);
    const desiredMs = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
    const actualMs = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      millisecond,
    );
    const diff = desiredMs - actualMs;
    utcMs += diff;
    if (Math.abs(diff) < 1000) break;
  }

  return new Date(utcMs);
}

/** ISO UTC bounds for a calendar day (YYYY-MM-DD) in the given IANA timezone */
export function localDayBoundsForDateKey(
  dateKey: string,
  timeZone: string,
): { dayStart: string; dayEnd: string; dateKey: string } {
  const [year, month, day] = dateKey.split('-').map(Number);
  const start = zonedLocalToUtc(year, month, day, 0, 0, 0, 0, timeZone);
  const end = zonedLocalToUtc(year, month, day, 23, 59, 59, 999, timeZone);

  return {
    dateKey,
    dayStart: start.toISOString(),
    dayEnd: end.toISOString(),
  };
}

/** Today in the given IANA timezone */
export function todayDayBounds(timeZone: string = getBrowserTimezone()) {
  return localDayBoundsForDateKey(dateKeyInTimezone(timeZone), timeZone);
}

/** ISO UTC bounds for querying a calendar day in the given IANA timezone */
export function localDayBounds(
  date: Date,
  timeZone: string = getBrowserTimezone(),
): { dayStart: string; dayEnd: string; dateKey: string } {
  return localDayBoundsForDateKey(formatLocalDateKey(date), timeZone);
}

/** Current calendar date in an IANA timezone as YYYY-MM-DD */
export function dateKeyInTimezone(timeZone: string, instant = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(instant);
}

/** Store the selected calendar day with the current local clock time */
export function createTimestampForDate(date: Date): string {
  const now = new Date();
  const selected = new Date(date);
  selected.setHours(
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds(),
  );
  return selected.toISOString();
}
