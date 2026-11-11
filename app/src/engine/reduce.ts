// 回答ログ → 進捗の畳み込み（DESIGN.md 12.1）。進捗はこの結果のキャッシュにすぎない。

import type { Params } from './params';
import { classifySortLog } from './sorting';
import type { Progress, ReviewLog } from './types';

export function initialProgress(itemId: string): Progress {
  return { itemId, state: 'new', flags: {}, confusions: [], updatedAt: 0 };
}

/** ログを古い順に並べる（同時刻は ID 順。ULID なので作成順になる）。 */
export function sortLogs(logs: readonly ReviewLog[]): ReviewLog[] {
  return logs.slice().sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** 1件のログを進捗に反映する。取り消し済みのログは無視する。元の進捗は変えない。 */
export function applyLog(p: Progress, log: ReviewLog, params: Params): Progress {
  if (log.undone || log.itemId !== p.itemId) return p;

  if (log.phase === 'sort') {
    if (p.state !== 'new') return p; // 仕分けは最初の1回だけ
    const cls = classifySortLog(log, params);
    if (!cls) return p;
    const next: Progress = { ...p, flags: { ...p.flags }, sortClass: cls, updatedAt: log.at };
    if (cls === 'A') {
      // DESIGN.md 4章では「すぐ srs へ」。SRS の実装（ステップ4）までは known で止める。
      next.state = 'known';
    } else {
      next.state = 'cycle_waiting';
      next.cycle = {
        rounds: 0,
        streak: cls === 'B' ? 1 : 0,
        inputShown: false,
        lastSeenDay: log.day,
        ...(cls === 'B' ? { lastCorrectDay: log.day } : {}),
      };
    }
    return next;
  }

  // 周回・SRS などはステップ3以降で追加する
  return p;
}

/** 全ログから全項目の進捗を作り直す。 */
export function reduceLogs(
  logs: readonly ReviewLog[],
  itemIds: readonly string[],
  params: Params,
): Map<string, Progress> {
  const out = new Map<string, Progress>();
  for (const id of itemIds) out.set(id, initialProgress(id));
  for (const log of sortLogs(logs)) {
    const p = out.get(log.itemId);
    if (p) out.set(log.itemId, applyLog(p, log, params));
  }
  return out;
}

/** 1項目の進捗をその項目のログから作り直す（取り消しの後など）。 */
export function reduceItem(itemId: string, logs: readonly ReviewLog[], params: Params): Progress {
  let p = initialProgress(itemId);
  for (const log of sortLogs(logs)) p = applyLog(p, log, params);
  return p;
}
