import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { fixedClock } from '../../src/engine/clock';
import { reduceLogs } from '../../src/engine/reduce';
import { currentSortBlock } from '../../src/engine/sorting';
import { AppDB } from '../../src/data/db';
import { Repo } from '../../src/data/repo';
import type { Item } from '../../src/data/types';
import { validateItems } from '../../src/data/validateItems';

function fakeItems(n: number): Item[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `t-${String(i).padStart(4, '0')}`,
    kind: 'word' as const,
    origin: 'quizlet' as const,
    sourceNos: [String(i + 1)],
    order: i,
    block: Math.floor(i / 100),
    headword: `zorb${i}`,
    meanings: [{ pos: '名', text: `ぞるぶ${i}` }],
    meaningRaw: `【名】ぞるぶ${i}`,
    synonyms: [],
    antonyms: [],
  }));
}

let n = 0;
let repo: Repo;
let db: AppDB;
const T0 = Date.UTC(2026, 10, 11, 1, 0); // 10:00 JST

beforeEach(async () => {
  db = new AppDB(`test-${++n}`);
  repo = new Repo(db, fixedClock(T0));
  await repo.importItems(fakeItems(150));
});

describe('Repo', () => {
  it('取り込むと全項目が new', async () => {
    const { items, progress } = await repo.loadAll();
    expect(items).toHaveLength(150);
    expect([...progress.values()].every((p) => p.state === 'new')).toBe(true);
  });

  it('回答でログと進捗を保存し、日付は4時区切り', async () => {
    const { log, progress } = await repo.recordSort('t-0000', 'known', 1200, false);
    expect(log.day).toBe('2026-11-11');
    expect(progress.state).toBe('known');
    expect(await db.logs.count()).toBe(1);
    expect((await db.progress.get('t-0000'))?.sortClass).toBe('A');
  });

  it('100件仕分けて作り直しても同じ（閉じて再開できる）', async () => {
    const seed = await repo.installSeed();
    const { items, progress } = await repo.loadAll();
    const block = currentSortBlock(items, progress, seed)!;
    for (const [k, id] of block.remaining.slice(0, 40).entries()) {
      await repo.recordSort(id, k % 3 === 0 ? 'unknown' : 'known', 1000 + k * 100, false);
    }
    // 「アプリを開き直す」：新しい Repo で読み直す
    const repo2 = new Repo(db, fixedClock(T0));
    expect(await repo2.installSeed()).toBe(seed);
    const again = await repo2.loadAll();
    const resumed = currentSortBlock(again.items, again.progress, seed)!;
    expect(resumed.remaining).toEqual(block.remaining.slice(40));

    // キャッシュの進捗とログからの作り直しが一致する
    const rebuilt = reduceLogs(await db.logs.toArray(), again.items.map((i) => i.id), repo.params);
    for (const [id, p] of rebuilt) expect(again.progress.get(id)).toEqual(p);
  });

  it('取り消すと new に戻り、ログは残る', async () => {
    const { log } = await repo.recordSort('t-0001', 'unknown', 900, false);
    const p = await repo.undo(log.id);
    expect(p?.state).toBe('new');
    expect((await db.logs.get(log.id))?.undone).toBe(true);
  });

  it('単語データを入れ直してもログと進捗は残る', async () => {
    await repo.recordSort('t-0002', 'unknown', 900, false);
    await repo.importItems(fakeItems(150));
    expect((await db.progress.get('t-0002'))?.state).toBe('cycle_waiting');
  });

  it('バックアップに単語データを含めない', async () => {
    await repo.recordSort('t-0003', 'known', 900, true);
    const b = await repo.exportBackup();
    expect(b.logs).toHaveLength(1);
    expect(b.progress).toHaveLength(150);
    expect(JSON.stringify(b)).not.toContain('zorb3');
  });
});

describe('validateItems', () => {
  it('正しいデータ', () => {
    expect(validateItems(fakeItems(3)).ok).toBe(true);
  });
  it('配列でない', () => {
    expect(validateItems({ a: 1 }).ok).toBe(false);
  });
  it('word に意味がない・id の重複', () => {
    const items = fakeItems(2) as unknown as Record<string, unknown>[];
    items[1] = { ...items[1], id: items[0]!.id, meanings: [] };
    const r = validateItems(items);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toMatch(/重複/);
  });
});
