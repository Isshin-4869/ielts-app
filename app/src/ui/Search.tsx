import { useEffect, useMemo, useState } from 'react';
import { buildSearchIndex, searchItems } from '../data/search';
import type { Item } from '../data/types';
import { primaryMeaning } from '../data/validateItems';
import { repo, type AppData } from './App';
import { ItemDetail } from './ItemDetail';
import { sortStatus } from './status';

type Props = {
  data: AppData;
  query: string;
  onQuery: (q: string) => void;
};

export function Search({ data, query, onQuery }: Props) {
  const index = useMemo(() => buildSearchIndex(data.items), [data.items]);
  const { hits, total } = useMemo(
    () => searchItems(index, query, repo.params.searchResultLimit),
    [index, query],
  );
  const [selected, setSelected] = useState<Item | null>(null);

  // 詳細から戻ったら一覧の先頭に
  useEffect(() => {
    if (!selected) window.scrollTo(0, 0);
  }, [selected]);

  if (selected) {
    const st = sortStatus(data.progress.get(selected.id));
    return (
      <div className="screen">
        <div>
          <button className="back-btn" onClick={() => setSelected(null)}>
            ← 検索結果に戻る
          </button>
        </div>
        <div className="card stack" style={{ marginTop: 8 }}>
          <ItemDetail item={selected} />
        </div>
        <dl className="meta-list">
          <div>
            <dt>仕分け</dt>
            <dd>
              <span className={`badge-swatch s-${st.key}`} aria-hidden />
              {st.label}
            </dd>
          </div>
          <div>
            <dt>番号</dt>
            <dd>{selected.sourceNos.join('・')}</dd>
          </div>
          <div>
            <dt>ブロック</dt>
            <dd>{selected.block + 1}</dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <div className="screen">
      <h1>検索</h1>
      {data.items.length === 0 ? (
        <p className="muted">単語データがまだ入っていません。設定から取り込んでください。</p>
      ) : (
        <>
          <input
            className="search-input"
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="英語または日本語で検索"
            aria-label="単語を検索"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
          />
          {query.trim() === '' ? (
            <p className="muted small">見出し語・類義語・フレーズは英語で、意味や訳は日本語で探せます。</p>
          ) : (
            <>
              <p className="muted small" aria-live="polite">
                {total === 0
                  ? '見つかりませんでした'
                  : total > hits.length
                    ? `${total.toLocaleString()} 件（上位 ${hits.length} 件を表示）`
                    : `${total.toLocaleString()} 件`}
              </p>
              <ul className="result-list">
                {hits.map(({ item }) => {
                  const st = sortStatus(data.progress.get(item.id));
                  return (
                    <li key={item.id}>
                      <button onClick={() => setSelected(item)}>
                        <span className="result-main">
                          <span className="result-title" lang="en">
                            {item.kind === 'phrase' ? item.example?.en : item.headword}
                          </span>
                          <span className="result-sub">
                            {item.kind === 'phrase' ? item.example?.ja : primaryMeaning(item)}
                          </span>
                        </span>
                        <span className="result-status">
                          <span className={`badge-swatch s-${st.key}`} aria-hidden />
                          {st.label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
