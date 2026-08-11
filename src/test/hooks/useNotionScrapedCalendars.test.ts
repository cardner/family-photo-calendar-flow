import { describe, expect, it } from 'vitest';
import { buildCurrentWeekDateFilter } from '@/hooks/useNotionScrapedCalendars';

describe('buildCurrentWeekDateFilter', () => {
  it('filters from Sunday at the start of the current week', () => {
    const filter = buildCurrentWeekDateFilter(new Date(2026, 7, 11, 15, 30));

    expect(filter).toEqual({
      property: 'Date',
      date: {
        on_or_after: '2026-08-09',
      },
    });
  });

  it('keeps the current date when syncing on Sunday', () => {
    const filter = buildCurrentWeekDateFilter(new Date(2026, 7, 9, 23, 59));

    expect(filter.date.on_or_after).toBe('2026-08-09');
  });
});
