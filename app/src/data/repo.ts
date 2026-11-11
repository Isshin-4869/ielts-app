// 画面から使う読み書き。ログを書いたら同じトランザクションで進捗（キャッシュ）も更新する。

import { today, type Clock } from '../engine/clock';
import { defaultParams, type Params } from '../engine/params';
import { applyLog, initialProgress, reduceItem, reduceLogs } from '../engine/reduce';
import type { Progress, ReviewLog } from '../engine/types';
import type { AppDB } from './db';
import type { Item } from './types';
import { ulid } from './ulid';

export const systemClock: Clock = {
  now: () => Date.now(),
  utcOffsetMinutes: (ms) => -new Date(ms).getTimezoneOffset(),
};

const META_SEED = 'installSeed';
const META_IMPORTED = 'itemsImportedAt';

export class Repo {
  constructor(
    private readonly db: AppDB,
    private readonly clock: Clock = systemClock,
    readonly params: Params = defaultParams,
  ) {}

  async loadAll(): Promise<{ items: Item[]; progress: Map<string, Progress> }> {
    const [items, progressRows] = await Promise.all([
      this.db.items.orderBy('order').toArray(),
      this.db.progress.toArray(),
    ]);
    const progress = new Map(progressRows.map((p) => [p.itemId, p]));
    for (const it of items) if (!progress.has(it.id)) progress.set(it.id, initialProgress(it.id));
    return { items, progress };
  }

  /** シャッフル用の端末ごとのシード（初回に作って保存） */
  async installSeed(): Promise<string> {
    const row = await this.db.meta.get(META_SEED);
    if (typeof row?.value === 'string') return row.value;
    const seed = ulid(this.clock.now());
    await this.db.meta.put({ key: META_SEED, value: seed });
    return seed;
  }

  async itemsImportedAt(): Promise<number | undefined> {
    const row = await this.db.meta.get(META_IMPORTED);
    return typeof row?.value === 'number' ? row.value : undefined;
  }

  /** 単語データを入れ替える。ログは残し、進捗はログから作り直す。 */
  async importItems(items: Item[]): Promise<void> {
    await this.db.transaction('rw', [this.db.items, this.db.progress, this.db.logs, this.db.meta], async () => {
      await this.db.items.clear();
      await this.db.items.bulkAdd(items);
      await this.rebuildInTx(items.map((i) => i.id));
      await this.db.meta.put({ key: META_IMPORTED, value: this.clock.now() });
    });
  }

  /** 仕分けの回答を1件保存する。 */
  async recordSort(
    itemId: string,
    outcome: 'known' | 'unknown',
    ms: number,
    corrected: boolean,
  ): Promise<{ log: ReviewLog; progress: Progress }> {
    const at = this.clock.now();
    const log: ReviewLog = {
      id: ulid(at),
      itemId,
      at,
      day: today(this.clock, this.params.dayStartHour),
      phase: 'sort',
      format: 'swipe',
      outcome,
      ms: Math.round(ms),
      fsrsEligible: true,
      undone: false,
      ...(corrected ? { meta: { corrected: true } } : {}),
    };
    let progress!: Progress;
    await this.db.transaction('rw', [this.db.logs, this.db.progress], async () => {
      const current = (await this.db.progress.get(itemId)) ?? initialProgress(itemId);
      progress = applyLog(current, log, this.params);
      await this.db.logs.add(log);
      await this.db.progress.put(progress);
    });
    return { log, progress };
  }

  /** 回答を取り消す（ログは消さず undone を付け、その項目の進捗を作り直す）。 */
  async undo(logId: string): Promise<Progress | undefined> {
    let progress: Progress | undefined;
    await this.db.transaction('rw', [this.db.logs, this.db.progress], async () => {
      const log = await this.db.logs.get(logId);
      if (!log) return;
      await this.db.logs.update(logId, { undone: true });
      const logs = await this.db.logs.where('itemId').equals(log.itemId).toArray();
      progress = reduceItem(log.itemId, logs, this.params);
      await this.db.progress.put(progress);
    });
    return progress;
  }

  /** 全ログから進捗を作り直す。 */
  async rebuildProgress(): Promise<void> {
    await this.db.transaction('rw', [this.db.items, this.db.progress, this.db.logs], async () => {
      const ids = (await this.db.items.toCollection().primaryKeys()) as string[];
      await this.rebuildInTx(ids);
    });
  }

  private async rebuildInTx(itemIds: string[]): Promise<void> {
    const logs = await this.db.logs.toArray();
    const progress = reduceLogs(logs, itemIds, this.params);
    await this.db.progress.clear();
    await this.db.progress.bulkPut([...progress.values()]);
  }

  async counts(): Promise<{ items: number; logs: number }> {
    const [items, logs] = await Promise.all([this.db.items.count(), this.db.logs.count()]);
    return { items, logs };
  }

  /** バックアップ（進捗・ログ・設定）。単語データは含めない。 */
  async exportBackup(): Promise<BackupFile> {
    const [logs, progress, meta] = await Promise.all([
      this.db.logs.toArray(),
      this.db.progress.toArray(),
      this.db.meta.toArray(),
    ]);
    return { app: 'ielts-app', version: 1, exportedAt: this.clock.now(), logs, progress, meta };
  }
}

export type BackupFile = {
  app: 'ielts-app';
  version: 1;
  exportedAt: number;
  logs: ReviewLog[];
  progress: Progress[];
  meta: { key: string; value: unknown }[];
};
