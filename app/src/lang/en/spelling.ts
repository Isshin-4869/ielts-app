// イギリス式／アメリカ式のつづりの揺れをそろえる（英語アダプタ、DESIGN.md 6.6）。
// 比較用のキーを作るだけで、表示には使わない。両方を同じ関数に通してから比べる。

const RULES: [RegExp, string][] = [
  [/isation/g, 'ization'], // organisation → organization
  [/is(e|es|ed|ing|er|ers)\b/g, 'iz$1'], // recognise → recognize
  [/ys(e|es|ed|ing)\b/g, 'yz$1'], // analyse → analyze
  [/our(s|ed|ing|ful|ite|ites|able)?\b/g, 'or$1'], // colour → color, favourite → favorite
  [/tre(s)?\b/g, 'ter$1'], // centre → center
  [/ogue(s)?\b/g, 'og$1'], // catalogue → catalog
  [/ence\b/g, 'ense'], // defence → defense
  [/ll(ed|ing|er|ers)\b/g, 'l$1'], // travelled → traveled
];

/** 小文字にし、前後の空白を除き、英米のつづりの揺れをそろえる */
export function normalizeSpelling(s: string): string {
  let out = s.trim().toLowerCase().replace(/\s+/g, ' ');
  for (const [re, to] of RULES) out = out.replace(re, to);
  return out;
}
