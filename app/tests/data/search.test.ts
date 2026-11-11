import { describe, expect, it } from 'vitest';
import { RANK, buildSearchIndex, searchItems } from '../../src/data/search';
import type { Item } from '../../src/data/types';

let order = 0;
function word(headword: string, meaning: string, synonyms: string[] = []): Item {
  const o = order++;
  return {
    id: `w-${o}`,
    kind: 'word',
    origin: 'quizlet',
    sourceNos: [String(o + 1)],
    order: o,
    block: 0,
    headword,
    meanings: [{ pos: '名', text: meaning }],
    meaningRaw: `【名】${meaning}`,
    synonyms,
    antonyms: [],
  };
}

const items: Item[] = [
  word('zorblisation', 'ぞるぶる化'),
  word('zorble', 'ぞるぶる'),
  word('blorp', 'ふにゃふにゃ', ['zorble']),
  word('antizorble', '反ぞるぶる'),
  {
    id: 'p-1',
    kind: 'phrase',
    origin: 'phrase',
    sourceNos: ['3501'],
    order: 99,
    block: 0,
    synonyms: [],
    antonyms: [],
    example: { en: 'The zorble is here to stay.', ja: 'ぞるぶるは定着した。', source: '音声', incomplete: false },
  },
];
const index = buildSearchIndex(items);
const ids = (q: string) => searchItems(index, q, 50).hits.map((h) => h.item.id);

describe('searchItems', () => {
  it('完全一致 → 前方一致 → 部分一致 → 類義語 → フレーズの順', () => {
    expect(ids('zorble')).toEqual(['w-1', 'w-3', 'w-2', 'p-1']);
    const ranks = searchItems(index, 'zorble', 50).hits.map((h) => h.rank);
    expect(ranks).toEqual([RANK.exact, RANK.contains, RANK.relation, RANK.phrase]);
  });

  it('前方一致は並び順（order）で', () => {
    expect(ids('zorbl')).toEqual(['w-0', 'w-1', 'w-3', 'w-2', 'p-1']);
  });

  it('大文字と英米のつづりの違いを気にしない', () => {
    expect(ids('ZORBLIZATION')).toEqual(['w-0']);
  });

  it('つづりの揺れの途中まで打っても当たる', () => {
    expect(ids('zorblisat')).toEqual(['w-0']);
    expect(ids('zorblizat')).toEqual(['w-0']); // アメリカ式の途中まで（そろえた見出し語の前方一致）
    expect(ids('zorblization')).toEqual(['w-0']);
  });

  it('日本語は意味とフレーズの訳から探す', () => {
    expect(ids('ぞるぶる')).toEqual(['w-0', 'w-1', 'w-3', 'p-1']);
    expect(ids('ふにゃ')).toEqual(['w-2']);
  });

  it('空なら何も返さない', () => {
    expect(searchItems(index, '   ', 50)).toEqual({ hits: [], total: 0 });
  });

  it('件数の上限と総数', () => {
    const r = searchItems(index, 'zorbl', 2);
    expect(r.hits).toHaveLength(2);
    expect(r.total).toBe(5);
  });
});
