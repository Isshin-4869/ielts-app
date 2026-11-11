// 取り込む items.json の中身を確かめる（純粋関数）。

import type { Item } from './types';

export type ValidateResult = { ok: true; items: Item[] } | { ok: false; errors: string[] };

const MAX_ERRORS = 10;

export function validateItems(data: unknown): ValidateResult {
  if (!Array.isArray(data)) return { ok: false, errors: ['配列ではありません（items.json を選んでください）'] };
  if (data.length === 0) return { ok: false, errors: ['項目が0件です'] };

  const errors: string[] = [];
  const ids = new Set<string>();
  const add = (i: number, msg: string) => {
    if (errors.length < MAX_ERRORS) errors.push(`${i + 1}件目: ${msg}`);
  };

  data.forEach((raw, i) => {
    if (typeof raw !== 'object' || raw === null) return add(i, 'オブジェクトではない');
    const it = raw as Record<string, unknown>;
    if (typeof it.id !== 'string' || it.id === '') return add(i, 'id がない');
    if (ids.has(it.id)) add(i, `id が重複: ${it.id}`);
    ids.add(it.id);
    if (it.kind !== 'word' && it.kind !== 'phrase') add(i, `kind が不正: ${String(it.kind)}`);
    if (typeof it.order !== 'number' || typeof it.block !== 'number') add(i, 'order / block がない');
    if (!Array.isArray(it.synonyms) || !Array.isArray(it.antonyms)) add(i, 'synonyms / antonyms がない');
    if (it.kind === 'word') {
      if (typeof it.headword !== 'string' || it.headword === '') add(i, 'word の headword がない');
      if (!Array.isArray(it.meanings) || it.meanings.length === 0) add(i, 'word の meanings がない');
    }
    if (it.kind === 'phrase') {
      const ex = it.example as Record<string, unknown> | undefined;
      if (!ex || typeof ex.en !== 'string' || typeof ex.ja !== 'string') add(i, 'phrase の例文・訳がない');
    }
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, items: data as Item[] };
}

/** 代表の意味（仕分けで「知ってる」の後に見せる） */
export function primaryMeaning(item: Item): string {
  if (item.kind === 'phrase') return item.example?.en ?? '';
  const m = item.meanings?.[0];
  return m ? `【${m.pos}】${m.text}` : '';
}
