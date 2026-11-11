// ULID（時刻順に並ぶ一意ID）。

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

let lastTime = -1;
let lastRandom: number[] = [];

export function ulid(now: number = Date.now()): string {
  let random: number[];
  if (now === lastTime) {
    // 同じミリ秒内は乱数部を1増やして順序を保つ
    random = lastRandom.slice();
    for (let i = random.length - 1; i >= 0; i--) {
      if (random[i]! < 31) {
        random[i]!++;
        break;
      }
      random[i] = 0;
    }
  } else {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    random = Array.from(bytes, (b) => b % 32);
  }
  lastTime = now;
  lastRandom = random;

  let time = '';
  let t = now;
  for (let i = 0; i < 10; i++) {
    time = ENCODING[t % 32] + time;
    t = Math.floor(t / 32);
  }
  return time + random.map((r) => ENCODING[r]).join('');
}
