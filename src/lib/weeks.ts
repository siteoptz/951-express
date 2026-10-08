// Bookable pickup weeks. A week runs Monday to Sunday in the business time zone, which handles DST,
// month, and year boundaries by using calendar arithmetic in that zone (never fixed 24-hour steps).
import { TZDate } from '@date-fns/tz';
import { addDays, addWeeks, format, startOfWeek } from 'date-fns';
import { booking } from '@/config/booking';

export type Week = {
  /** Monday, YYYY-MM-DD (the stored key). */
  start: string;
  /** Sunday, YYYY-MM-DD. */
  end: string;
  /** "Oct 19 – 25" or "Oct 26 – Nov 1". */
  label: string;
};

type WeekConfig = {
  timezone: string;
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  leadDays: number;
  weeksShown: number;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function labelFor(start: Date, end: Date): string {
  const sameMonth = start.getMonth() === end.getMonth();
  return `${format(start, 'MMM d')} – ${format(end, sameMonth ? 'd' : 'MMM d')}`;
}

/**
 * The next `weeksShown` weeks whose Monday starts at least `leadDays` calendar days from now
 * (a week starting exactly `leadDays` away is allowed).
 */
export function bookableWeeks(now: Date = new Date(), cfg: WeekConfig = booking): Week[] {
  const nowTz = new TZDate(now, cfg.timezone);
  const threshold = addDays(nowTz, cfg.leadDays).getTime();
  let start = startOfWeek(nowTz, { weekStartsOn: cfg.weekStartsOn });
  while (start.getTime() < threshold) start = addWeeks(start, 1);

  const weeks: Week[] = [];
  for (let i = 0; i < cfg.weeksShown; i++) {
    const end = addDays(start, 6);
    weeks.push({
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd'),
      label: labelFor(start, end),
    });
    start = addWeeks(start, 1);
  }
  return weeks;
}

/** The server's check that a week the browser sent is actually bookable right now. */
export function findBookableWeek(
  weekStart: string,
  now: Date = new Date(),
  cfg: WeekConfig = booking,
): Week | null {
  return bookableWeeks(now, cfg).find((w) => w.start === weekStart) ?? null;
}

/** True for a real calendar date that falls on a Monday. */
export function isMondayIso(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value && d.getUTCDay() === 1
  );
}

/**
 * Whole weeks since Monday 1970-01-05, from the date string alone (no time zone involved), so it is a
 * stable integer key for the capacity lock: pg_advisory_xact_lock(route, weekNumber).
 */
export function weekNumber(weekStart: string): number {
  if (!isMondayIso(weekStart)) throw new Error(`Not a Monday date: ${weekStart}`);
  return Math.round(
    (Date.parse(`${weekStart}T00:00:00Z`) - Date.parse('1970-01-05T00:00:00Z')) / (7 * 86_400_000),
  );
}
