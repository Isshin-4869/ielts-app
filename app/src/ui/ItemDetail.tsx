import type { Item, Meaning } from '../data/types';

function groupByPos(meanings: Meaning[]): { pos: string; texts: string[] }[] {
  const out: { pos: string; texts: string[] }[] = [];
  for (const m of meanings) {
    const last = out[out.length - 1];
    if (last && last.pos === m.pos) last.texts.push(m.text);
    else out.push({ pos: m.pos, texts: [m.text] });
  }
  return out;
}

/** 項目の全データ（意味・例文・類義語・対義語） */
export function ItemDetail({ item }: { item: Item }) {
  const ex = item.example;
  if (item.kind === 'phrase') {
    return (
      <div className="detail">
        <div className="phrase-ja">{ex?.ja}</div>
        <section>
          <h3>英文</h3>
          <div className="example-en" lang="en">
            {ex?.en}
          </div>
        </section>
      </div>
    );
  }
  return (
    <div className="detail">
      <div className="headword" lang="en">
        {item.headword}
      </div>
      <section>
        {groupByPos(item.meanings ?? []).map((g, i) => (
          <div key={i}>
            <span className="pos">{g.pos}</span>
            {g.texts.join('；')}
          </div>
        ))}
      </section>
      {ex?.en && (
        <section>
          <h3>例文{ex.incomplete ? '（一部欠落）' : ''}</h3>
          <div className="example-en" lang="en">
            {ex.en}
          </div>
        </section>
      )}
      {item.synonyms.length > 0 && (
        <section>
          <h3>類義語</h3>
          <div className="chips" lang="en">
            {item.synonyms.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
        </section>
      )}
      {item.antonyms.length > 0 && (
        <section>
          <h3>対義語</h3>
          <div className="chips" lang="en">
            {item.antonyms.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
