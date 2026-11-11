// 時刻と「1日」の区切り（午前4時）。エンジンは現在時刻を直接読まず、Clock を引数で受け取る。

export type Clock = {
  /** epoch ms */
  now(): number;
  /** その時刻における端末のタイムゾーンの UTC からのずれ（分）。JST なら 540 */
  utcOffsetMinutes(epochMs: number): number;
};

/** 'YYYY-MM-DD'。dayStartHour 時より前は前日扱い。 */
export function dayKey(epochMs: number, dayStartHour: number, utcOffsetMinutes: number): string {
  const shifted = new Date(epochMs + (utcOffsetMinutes - dayStartHour * 60) * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function today(clock: Clock, dayStartHour: number): string {
  const now = clock.now();
  return dayKey(now, dayStartHour, clock.utcOffsetMinutes(now));
}

/** テスト用の固定時計 */
export function fixedClock(epochMs: number, utcOffsetMinutes = 540): Clock & { set(ms: number): void } {
  let t = epochMs;
  return {
    now: () => t,
    utcOffsetMinutes: () => utcOffsetMinutes,
    set(ms: number) {
      t = ms;
    },
  };
}
