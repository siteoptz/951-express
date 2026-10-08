import { describe, expect, it } from 'vitest';
import { bookableWeeks, findBookableWeek, isMondayIso, weekNumber } from '@/lib/weeks';

// Times are given as UTC instants. Los Angeles is UTC-7 in summer (PDT) and UTC-8 in winter (PST).
const at = (iso: string) => new Date(iso);
const starts = (now: string) => bookableWeeks(at(now)).map((w) => w.start);

describe('bookableWeeks', () => {
  it('returns weeksShown Monday-start weeks with Sunday ends and labels', () => {
    const weeks = bookableWeeks(at('2026-10-08T19:00:00Z')); // Thu Oct 8, noon PDT
    expect(weeks).toHaveLength(8);
    expect(weeks[0]).toEqual({ start: '2026-10-12', end: '2026-10-18', label: 'Oct 12 – 18' });
    expect(weeks[1].label).toBe('Oct 19 – 25');
    expect(weeks[2].label).toBe('Oct 26 – Nov 1'); // month boundary
    expect(weeks[7].start).toBe('2026-11-30');
  });

  it('skips a week that starts within the 3-day lead, allows exactly 3 days away', () => {
    // Sat Oct 10, 6pm PDT: Monday Oct 12 is 2.25 days away: skipped.
    expect(starts('2026-10-11T01:00:00Z')[0]).toBe('2026-10-19');
    // Fri Oct 9 00:00 PDT: Monday is exactly 3 days away: allowed.
    expect(starts('2026-10-09T07:00:00Z')[0]).toBe('2026-10-12');
    // One minute later it is inside the lead window.
    expect(starts('2026-10-09T07:01:00Z')[0]).toBe('2026-10-19');
  });

  it('uses the Los Angeles calendar, not UTC', () => {
    // 03:00Z Mon Oct 12 is still Sun Oct 11, 8pm in Los Angeles: Monday is 4 hours away, so skip it.
    expect(starts('2026-10-12T03:00:00Z')[0]).toBe('2026-10-19');
    // 08:00Z Mon Oct 12 is Mon 1am PDT: the current week has started, so the next is Oct 19.
    expect(starts('2026-10-12T08:00:00Z')[0]).toBe('2026-10-19');
  });

  it('on a Monday, the current week is gone and the next one is bookable', () => {
    expect(starts('2026-10-12T17:00:00Z')[0]).toBe('2026-10-19');
  });

  it('crosses a year boundary', () => {
    const weeks = bookableWeeks(at('2026-12-21T20:00:00Z')); // Mon Dec 21
    expect(weeks.slice(0, 3).map((w) => [w.start, w.label])).toEqual([
      ['2026-12-28', 'Dec 28 – Jan 3'],
      ['2027-01-04', 'Jan 4 – 10'],
      ['2027-01-11', 'Jan 11 – 17'],
    ]);
    expect(weeks[0].end).toBe('2027-01-03');
  });

  describe('daylight saving time', () => {
    it('spring forward (Sun Mar 8, 2026): week keys stay on Mondays and the week is still 7 days', () => {
      const weeks = bookableWeeks(at('2026-03-04T20:00:00Z')); // Wed Mar 4
      expect(weeks.slice(0, 3).map((w) => w.start)).toEqual([
        '2026-03-09',
        '2026-03-16',
        '2026-03-23',
      ]);
      expect(weeks[0]).toMatchObject({ end: '2026-03-15', label: 'Mar 9 – 15' });
    });
    it('a Saturday before spring forward still sees the right lead window', () => {
      // Sat Mar 7, 8pm PST = Sun 04:00Z. Monday Mar 9 00:00 PDT is only 1.1 days away: skipped.
      expect(starts('2026-03-08T04:00:00Z')[0]).toBe('2026-03-16');
      // Thu Mar 5, 11pm PST: Monday is 3 days 1 hour away (the lost hour does not shorten it): allowed.
      expect(starts('2026-03-06T07:00:00Z')[0]).toBe('2026-03-09');
      // Fri Mar 6 00:00 PST is exactly 3 calendar days before Mon Mar 9 00:00 PDT, even though only 71 hours pass.
      expect(starts('2026-03-06T08:00:00Z')[0]).toBe('2026-03-09');
    });
    it('fall back (Sun Nov 1, 2026): Nov 2 is a Monday key and the label crosses the month', () => {
      const weeks = bookableWeeks(at('2026-10-28T19:00:00Z'));
      expect(weeks[0]).toMatchObject({ start: '2026-11-02', end: '2026-11-08' });
      const prior = bookableWeeks(at('2026-10-21T19:00:00Z'));
      expect(prior[0].label).toBe('Oct 26 – Nov 1');
      expect(prior[0].end).toBe('2026-11-01');
    });
    it('a Saturday before fall back sees the extra hour', () => {
      // Sat Oct 31, 9pm PDT = Sun 04:00Z. Monday Nov 2 00:00 PST is 1 day + 3 hours away: skipped.
      expect(starts('2026-11-01T04:00:00Z')[0]).toBe('2026-11-09');
    });
  });

  it('honors a custom config', () => {
    const weeks = bookableWeeks(at('2026-10-08T19:00:00Z'), {
      timezone: 'America/New_York',
      weekStartsOn: 0,
      leadDays: 0,
      weeksShown: 2,
    });
    expect(weeks.map((w) => w.start)).toEqual(['2026-10-11', '2026-10-18']);
  });

  it('defaults to now', () => {
    expect(bookableWeeks()).toHaveLength(8);
  });
});

describe('findBookableWeek', () => {
  const now = at('2026-10-08T19:00:00Z');
  it('finds a listed week and rejects past, too-soon, and far-future weeks', () => {
    expect(findBookableWeek('2026-10-19', now)?.label).toBe('Oct 19 – 25');
    expect(findBookableWeek('2026-10-05', now)).toBeNull();
    expect(findBookableWeek('2026-12-28', now)).toBeNull();
    expect(findBookableWeek('2026-10-20', now)).toBeNull();
  });
  it('is tighter than the browser: a week inside the lead window is not bookable', () => {
    expect(findBookableWeek('2026-10-12', at('2026-10-10T20:00:00Z'))).toBeNull();
  });
  it('defaults to now', () => {
    expect(findBookableWeek('1999-01-04')).toBeNull();
  });
});

describe('isMondayIso / weekNumber', () => {
  it('accepts only real Mondays', () => {
    expect(isMondayIso('2026-10-12')).toBe(true);
    expect(isMondayIso('2026-10-13')).toBe(false);
    expect(isMondayIso('2026-02-30')).toBe(false);
    expect(isMondayIso('2026-13-01')).toBe(false);
    expect(isMondayIso('10/12/2026')).toBe(false);
    expect(isMondayIso('')).toBe(false);
  });
  it('numbers weeks consecutively, across DST and year boundaries', () => {
    expect(weekNumber('1970-01-05')).toBe(0);
    expect(weekNumber('2026-03-09') - weekNumber('2026-03-02')).toBe(1);
    expect(weekNumber('2027-01-04') - weekNumber('2026-12-28')).toBe(1);
    expect(weekNumber('2026-11-02') - weekNumber('2026-10-26')).toBe(1);
  });
  it('throws for a non-Monday', () => {
    expect(() => weekNumber('2026-10-13')).toThrow(/Not a Monday/);
  });
});
