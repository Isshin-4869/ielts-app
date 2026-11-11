import { describe, expect, it } from 'vitest';
import { dayKey, fixedClock, today } from '../../src/engine/clock';

// 2026-11-11 00:00 JST = 2026-11-10 15:00 UTC
const JST_MIDNIGHT_1111 = Date.UTC(2026, 10, 10, 15, 0, 0);
const H = 3_600_000;

describe('dayKey（午前4時区切り）', () => {
  it('JST 3:59 は前日', () => {
    expect(dayKey(JST_MIDNIGHT_1111 + 3 * H + 59 * 60_000, 4, 540)).toBe('2026-11-10');
  });
  it('JST 4:00 から当日', () => {
    expect(dayKey(JST_MIDNIGHT_1111 + 4 * H, 4, 540)).toBe('2026-11-11');
  });
  it('JST 23:59 は当日', () => {
    expect(dayKey(JST_MIDNIGHT_1111 + 23 * H + 59 * 60_000, 4, 540)).toBe('2026-11-11');
  });
  it('JST 翌日 2:00 はまだ当日', () => {
    expect(dayKey(JST_MIDNIGHT_1111 + 26 * H, 4, 540)).toBe('2026-11-11');
  });
  it('月・年をまたぐ', () => {
    const jstNewYear = Date.UTC(2026, 11, 31, 15, 0, 0); // 2027-01-01 00:00 JST
    expect(dayKey(jstNewYear + 3 * H, 4, 540)).toBe('2026-12-31');
    expect(dayKey(jstNewYear + 4 * H, 4, 540)).toBe('2027-01-01');
  });
  it('タイムゾーンのずれを使う（UTC）', () => {
    expect(dayKey(Date.UTC(2026, 10, 11, 3, 0), 4, 0)).toBe('2026-11-10');
    expect(dayKey(Date.UTC(2026, 10, 11, 4, 0), 4, 0)).toBe('2026-11-11');
  });
});

describe('today', () => {
  it('注入した時計から日付を出す', () => {
    const clock = fixedClock(JST_MIDNIGHT_1111 + 10 * H);
    expect(today(clock, 4)).toBe('2026-11-11');
    clock.set(JST_MIDNIGHT_1111 + 2 * H);
    expect(today(clock, 4)).toBe('2026-11-10');
  });
});
