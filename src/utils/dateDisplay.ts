export function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

export function isSelectedToday(date: Date): boolean {
  return isSameCalendarDay(date, new Date());
}

/** Pill label: "Today · Mon, 4 Aug" or "Yesterday · …" or "Mon, 4 Aug" */
export function formatDatePillLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const detail = date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  if (isSameCalendarDay(date, today)) return `Today · ${detail}`;
  if (isSameCalendarDay(date, yesterday)) return `Yesterday · ${detail}`;
  return detail;
}

/** Short chip label without secondary detail */
export function formatDateChipLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameCalendarDay(date, today)) return 'Today';
  if (isSameCalendarDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
