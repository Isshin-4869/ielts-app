import { describe, expect, it } from 'vitest';
import { defaultParams as P, type Params } from '../../src/engine/params';
import { applyLog, initialProgress, reduceItem, reduceLogs } from '../../src/engine/reduce';
import { sortLog } from './helpers';

describe('applyLog（仕分け）', () => {
  it('A → known', () => {
    const p = applyLog(initialProgress('x'), sortLog('x', 'known', { ms: 800 }), P);
    expect(p.state).toBe('known');
    expect(p.sortClass).toBe('A');
    expect(p.cycle).toBeUndefined();
  });

  it('B → cycle_waiting、連続正解1から', () => {
    const log = sortLog('x', 'known', { ms: 800, corrected: true });
    const p = applyLog(initialProgress('x'), log, P);
    expect(p.state).toBe('cycle_waiting');
    expect(p.sortClass).toBe('B');
    expect(p.cycle).toEqual({
      rounds: 0,
      streak: 1,
      inputShown: false,
      lastSeenDay: log.day,
      lastCorrectDay: log.day,
    });
  });

  it('C → cycle_waiting、連続正解0から', () => {
    const p = applyLog(initialProgress('x'), sortLog('x', 'unknown'), P);
    expect(p.state).toBe('cycle_waiting');
    expect(p.sortClass).toBe('C');
    expect(p.cycle?.streak).toBe(0);
    expect(p.cycle?.lastCorrectDay).toBeUndefined();
  });

  it('updatedAt はログの時刻', () => {
    const log = sortLog('x', 'unknown');
    expect(applyLog(initialProgress('x'), log, P).updatedAt).toBe(log.at);
  });

  it('仕分けは最初の1回だけ有効', () => {
    let p = applyLog(initialProgress('x'), sortLog('x', 'unknown'), P);
    p = applyLog(p, sortLog('x', 'known'), P);
    expect(p.sortClass).toBe('C');
  });

  it('取り消し済みのログは無視', () => {
    const p0 = initialProgress('x');
    expect(applyLog(p0, sortLog('x', 'known', { undone: true }), P)).toBe(p0);
  });

  it('別の項目のログは無視', () => {
    const p0 = initialProgress('x');
    expect(applyLog(p0, sortLog('y', 'known'), P)).toBe(p0);
  });

  it('元の進捗を書き換えない', () => {
    const p0 = initialProgress('x');
    applyLog(p0, sortLog('x', 'unknown'), P);
    expect(p0).toEqual(initialProgress('x'));
  });
});

describe('reduceLogs', () => {
  const ids = ['a', 'b', 'c', 'd'];

  it('ログのない項目は new', () => {
    const m = reduceLogs([sortLog('a', 'known')], ids, P);
    expect(m.get('b')).toEqual(initialProgress('b'));
    expect(m.size).toBe(4);
  });

  it('ログの順番がばらばらでも時刻順に流し込む', () => {
    const first = sortLog('a', 'unknown', { at: 100 });
    const second = sortLog('a', 'known', { at: 200 });
    expect(reduceLogs([second, first], ids, P).get('a')?.sortClass).toBe('C');
  });

  it('取り消し → やり直しで、やり直しの方が効く', () => {
    const logs = [sortLog('a', 'unknown', { undone: true }), sortLog('a', 'known')];
    expect(reduceLogs(logs, ids, P).get('a')?.sortClass).toBe('A');
  });

  it('項目にないログ（データの入れ替え後など）は無視', () => {
    const m = reduceLogs([sortLog('zzz', 'known')], ids, P);
    expect(m.has('zzz')).toBe(false);
  });

  it('同じログなら何度作り直しても同じ結果（増分適用とも一致）', () => {
    const logs = [
      sortLog('a', 'known', { ms: 500 }),
      sortLog('b', 'known', { ms: 9000 }),
      sortLog('c', 'unknown'),
      sortLog('d', 'known', { corrected: true }),
    ];
    const full = reduceLogs(logs, ids, P);
    expect(reduceLogs(logs, ids, P)).toEqual(full);
    for (const id of ids) {
      expect(reduceItem(id, logs.filter((l) => l.itemId === id), P)).toEqual(full.get(id));
    }
    expect([...full.values()].map((p) => p.sortClass)).toEqual(['A', 'B', 'C', 'B']);
  });

  it('パラメータを変えて作り直せる（即答基準）', () => {
    const logs = [sortLog('a', 'known', { ms: 2500 })];
    const strict: Params = { ...P, sortInstantMs: 2000 };
    expect(reduceLogs(logs, ids, P).get('a')?.sortClass).toBe('A');
    expect(reduceLogs(logs, ids, strict).get('a')?.sortClass).toBe('B');
  });
});
