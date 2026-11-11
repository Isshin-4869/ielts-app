import type { EngineItem, ReviewLog } from '../../src/engine/types';

export function makeItems(n: number, blockSize = 100): EngineItem[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `t-${String(i).padStart(4, '0')}`,
    kind: 'word' as const,
    order: i,
    block: Math.floor(i / blockSize),
  }));
}

let seq = 0;
export function sortLog(
  itemId: string,
  outcome: 'known' | 'unknown',
  opts: Partial<ReviewLog> & { corrected?: boolean } = {},
): ReviewLog {
  seq++;
  const { corrected, ...rest } = opts;
  return {
    id: `L${String(seq).padStart(6, '0')}`,
    itemId,
    at: 1_700_000_000_000 + seq,
    day: '2026-11-11',
    phase: 'sort',
    format: 'swipe',
    outcome,
    ms: 1000,
    fsrsEligible: true,
    undone: false,
    ...(corrected ? { meta: { corrected: true } } : {}),
    ...rest,
  };
}
