import { describe, expect, it } from 'vitest';
import { defaultParams as P } from '../../src/engine/params';
import { reduceLogs } from '../../src/engine/reduce';
import { seededShuffle } from '../../src/engine/rng';
import { classifySort, currentSortBlock, summarizeSort } from '../../src/engine/sorting';
import { makeItems, sortLog } from './helpers';

describe('classifySort', () => {
  it('知ってる＋即答＋訂正なし → A', () => {
    expect(classifySort('known', 1200, false, P)).toBe('A');
    expect(classifySort('known', P.sortInstantMs, false, P)).toBe('A');
  });
  it('知ってる＋即答基準超 → B', () => {
    expect(classifySort('known', P.sortInstantMs + 1, false, P)).toBe('B');
  });
  it('知ってる＋訂正あり → B', () => {
    expect(classifySort('known', 500, true, P)).toBe('B');
  });
  it('知らない → C（時間は関係ない）', () => {
    expect(classifySort('unknown', 500, false, P)).toBe('C');
    expect(classifySort('unknown', 9000, false, P)).toBe('C');
  });
});

describe('seededShuffle', () => {
  it('同じシードなら同じ並び、違うシードなら違う並び', () => {
    const a = Array.from({ length: 50 }, (_, i) => i);
    expect(seededShuffle(a, 's1')).toEqual(seededShuffle(a, 's1'));
    expect(seededShuffle(a, 's1')).not.toEqual(seededShuffle(a, 's2'));
    expect(seededShuffle(a, 's1').slice().sort((x, y) => x - y)).toEqual(a);
  });
});

describe('currentSortBlock', () => {
  const items = makeItems(250);
  const ids = items.map((i) => i.id);

  it('最初は block 0 の100件をシャッフルして出す', () => {
    const b = currentSortBlock(items, new Map(), 'seed')!;
    expect(b.block).toBe(0);
    expect(b.total).toBe(100);
    expect(b.remaining).toHaveLength(100);
    expect(new Set(b.remaining)).toEqual(new Set(ids.slice(0, 100)));
    expect(b.remaining).not.toEqual(ids.slice(0, 100)); // シャッフルされている
  });

  it('途中まで仕分けて再開しても、残りの順番は変わらない', () => {
    const first = currentSortBlock(items, new Map(), 'seed')!;
    const answered = first.remaining.slice(0, 30);
    const progress = reduceLogs(
      answered.map((id) => sortLog(id, 'known')),
      ids,
      P,
    );
    const resumed = currentSortBlock(items, progress, 'seed')!;
    expect(resumed.block).toBe(0);
    expect(resumed.remaining).toEqual(first.remaining.slice(30));
  });

  it('ブロックを仕分け終えたら次のブロック', () => {
    const progress = reduceLogs(
      ids.slice(0, 100).map((id) => sortLog(id, 'unknown')),
      ids,
      P,
    );
    const b = currentSortBlock(items, progress, 'seed')!;
    expect(b.block).toBe(1);
    expect(b.remaining).toHaveLength(100);
  });

  it('最後のブロックは端数', () => {
    const progress = reduceLogs(
      ids.slice(0, 200).map((id) => sortLog(id, 'unknown')),
      ids,
      P,
    );
    const b = currentSortBlock(items, progress, 'seed')!;
    expect(b.block).toBe(2);
    expect(b.total).toBe(50);
  });

  it('全部仕分け済みなら null', () => {
    const progress = reduceLogs(
      ids.map((id) => sortLog(id, 'known')),
      ids,
      P,
    );
    expect(currentSortBlock(items, progress, 'seed')).toBeNull();
  });
});

describe('summarizeSort', () => {
  it('分類ごとの件数とブロックの完了数', () => {
    const items = makeItems(150);
    const ids = items.map((i) => i.id);
    const logs = [
      ...ids.slice(0, 100).map((id) => sortLog(id, 'known')),
      sortLog(ids[100]!, 'known', { ms: 5000 }),
      sortLog(ids[101]!, 'unknown'),
    ];
    const s = summarizeSort(items, reduceLogs(logs, ids, P));
    expect(s).toEqual({
      total: 150,
      sorted: 102,
      byClass: { A: 100, B: 1, C: 1 },
      blocksTotal: 2,
      blocksDone: 1,
    });
  });
});
