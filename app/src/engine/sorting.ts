// 1周目の仕分け（DESIGN.md 5.1）。

import type { Params } from './params';
import { seededShuffle } from './rng';
import type { EngineItem, Progress, ReviewLog, SortClass } from './types';

/** 仕分けの回答から分類を決める。 */
export function classifySort(
  outcome: 'known' | 'unknown',
  ms: number,
  corrected: boolean,
  params: Params,
): SortClass {
  if (outcome === 'unknown') return 'C';
  if (corrected || ms > params.sortInstantMs) return 'B';
  return 'A';
}

/** 仕分けログ1件から分類を決める（reduce 用）。仕分けログでなければ undefined。 */
export function classifySortLog(log: ReviewLog, params: Params): SortClass | undefined {
  if (log.phase !== 'sort') return undefined;
  if (log.outcome !== 'known' && log.outcome !== 'unknown') return undefined;
  return classifySort(log.outcome, log.ms, log.meta?.corrected === true, params);
}

export type SortBlock = {
  block: number;
  /** このブロックの全項目数 */
  total: number;
  /** このブロックでまだ仕分けていない項目の ID（出題順） */
  remaining: string[];
};

/**
 * 今仕分けるブロックと、その残りを出題順に返す。全部仕分け済みなら null。
 * ブロック内の順番はブロック全体をシードでシャッフルしてから未着手だけを残すので、
 * 途中でやめて再開しても順番は変わらない。
 */
export function currentSortBlock(
  items: readonly EngineItem[],
  progress: ReadonlyMap<string, Progress>,
  seed: string,
): SortBlock | null {
  const isNew = (id: string) => (progress.get(id)?.state ?? 'new') === 'new';
  let block: number | undefined;
  for (const it of items) {
    if (isNew(it.id) && (block === undefined || it.block < block)) block = it.block;
  }
  if (block === undefined) return null;
  const inBlock = items.filter((it) => it.block === block).sort((a, b) => a.order - b.order);
  const shuffled = seededShuffle(
    inBlock.map((it) => it.id),
    `${seed}:sort:${block}`,
  );
  return { block, total: inBlock.length, remaining: shuffled.filter(isNew) };
}

export type SortSummary = {
  total: number;
  sorted: number;
  byClass: Record<SortClass, number>;
  blocksTotal: number;
  blocksDone: number;
};

export function summarizeSort(
  items: readonly EngineItem[],
  progress: ReadonlyMap<string, Progress>,
): SortSummary {
  const byClass: Record<SortClass, number> = { A: 0, B: 0, C: 0 };
  const blocks = new Map<number, boolean>(); // block → 全部仕分け済みか
  let sorted = 0;
  for (const it of items) {
    const p = progress.get(it.id);
    const done = p !== undefined && p.state !== 'new';
    if (done) {
      sorted++;
      if (p.sortClass) byClass[p.sortClass]++;
    }
    blocks.set(it.block, (blocks.get(it.block) ?? true) && done);
  }
  return {
    total: items.length,
    sorted,
    byClass,
    blocksTotal: blocks.size,
    blocksDone: [...blocks.values()].filter(Boolean).length,
  };
}
