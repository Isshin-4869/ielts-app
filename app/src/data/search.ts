// 単語検索（項目一覧の検索部分）。英語の比較には lang/en のつづり正規化を使う。

import { normalizeSpelling } from '../lang/en/spelling';
import type { Item } from './types';

type Entry = {
  item: Item;
  headRaw: string; // 小文字にしただけの見出し語（入力途中でも当たるように）
  head: string; // 正規化した見出し語
  relations: string[]; // 正規化した類義語・対義語
  phraseEn: string; // 正規化したフレーズの英文
  ja: string; // 意味・訳（そのまま）
};

export type SearchIndex = Entry[];

export type SearchHit = { item: Item; rank: number };

/** 順位（小さいほど上） */
export const RANK = {
  exact: 0,
  prefix: 1,
  contains: 2,
  relation: 3,
  phrase: 4,
  meaning: 5,
} as const;

const JAPANESE = /[぀-ヿ㐀-鿿ｦ-ﾟ]/;

export function buildSearchIndex(items: readonly Item[]): SearchIndex {
  return items.map((item) => ({
    item,
    headRaw: (item.headword ?? '').trim().toLowerCase(),
    head: item.headword ? normalizeSpelling(item.headword) : '',
    relations: [...item.synonyms, ...item.antonyms].map(normalizeSpelling),
    phraseEn: item.kind === 'phrase' ? normalizeSpelling(item.example?.en ?? '') : '',
    ja:
      item.kind === 'phrase'
        ? (item.example?.ja ?? '')
        : (item.meanings ?? []).map((m) => m.text).join('；'),
  }));
}

function headRank(head: string, q: string): number | null {
  if (!head) return null;
  if (head === q) return RANK.exact;
  if (head.startsWith(q)) return RANK.prefix;
  if (head.includes(q)) return RANK.contains;
  return null;
}

function rankOf(e: Entry, q: string, qRaw: string, isJapanese: boolean): number | null {
  if (isJapanese) return e.ja.includes(q) ? RANK.meaning : null;
  // 正規化した形と、小文字にしただけの形の良い方
  const a = headRank(e.head, q);
  const b = headRank(e.headRaw, qRaw);
  if (a !== null || b !== null) return Math.min(a ?? Infinity, b ?? Infinity);
  if (e.relations.some((r) => r === q || r.startsWith(q))) return RANK.relation;
  if (e.phraseEn && e.phraseEn.includes(q)) return RANK.phrase;
  return null;
}

export function searchItems(
  index: SearchIndex,
  query: string,
  limit: number,
): { hits: SearchHit[]; total: number } {
  const raw = query.trim();
  if (raw === '') return { hits: [], total: 0 };
  const isJapanese = JAPANESE.test(raw);
  const q = isJapanese ? raw : normalizeSpelling(raw);
  const qRaw = raw.toLowerCase().replace(/\s+/g, ' ');
  const hits: SearchHit[] = [];
  for (const e of index) {
    const rank = rankOf(e, q, qRaw, isJapanese);
    if (rank !== null) hits.push({ item: e.item, rank });
  }
  hits.sort((a, b) => a.rank - b.rank || a.item.order - b.item.order);
  return { hits: hits.slice(0, limit), total: hits.length };
}
