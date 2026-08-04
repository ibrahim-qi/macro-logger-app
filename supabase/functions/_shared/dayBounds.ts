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

function zonedLocalToUtc(
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

export function dateKeyInTimezone(timeZone: string, instant = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(instant);
}

export function dayBoundsInTimezone(
  dateKey: string,
  timeZone: string,
): { dayStart: string; dayEnd: string } {
  const [year, month, day] = dateKey.split('-').map(Number);
  const start = zonedLocalToUtc(year, month, day, 0, 0, 0, 0, timeZone);
  const end = zonedLocalToUtc(year, month, day, 23, 59, 59, 999, timeZone);

  return {
    dayStart: start.toISOString(),
    dayEnd: end.toISOString(),
  };
}

export function todayBoundsForTimezone(timeZone: string): { dayStart: string; dayEnd: string; dateKey: string } {
  const dateKey = dateKeyInTimezone(timeZone);
  const bounds = dayBoundsInTimezone(dateKey, timeZone);
  return { ...bounds, dateKey };
}
