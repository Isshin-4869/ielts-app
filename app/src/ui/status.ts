import type { Progress } from '../engine/types';

export type StatusKey = 'new' | 'known' | 'unsure' | 'unknown';

/** 仕分けの結果を画面に出すときの名前（ホームの内訳と同じ分け方） */
export function sortStatus(p: Progress | undefined): { key: StatusKey; label: string } {
  switch (p?.sortClass) {
    case 'A':
      return { key: 'known', label: '知ってる' };
    case 'B':
      return { key: 'unsure', label: 'あやふや' };
    case 'C':
      return { key: 'unknown', label: '知らない' };
    default:
      return { key: 'new', label: '未着手' };
  }
}
