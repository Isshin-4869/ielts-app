import { currentSortBlock, summarizeSort } from '../engine/sorting';
import type { AppData } from './App';
import { ImportButton } from './ImportButton';

type Props = {
  data: AppData;
  onStart: () => void;
  onImported: () => void | Promise<void>;
  notify: (msg: string) => void;
};

export function Home({ data, onStart, onImported, notify }: Props) {
  if (data.items.length === 0) {
    return (
      <div className="screen">
        <h1>IELTS 単語</h1>
        <div className="home-main">
          <div className="card stack">
            <p style={{ margin: 0 }}>単語データがまだ入っていません。</p>
            <p className="muted small" style={{ margin: 0 }}>
              Mac で作った items.json を AirDrop で iPhone に送り、下のボタンから選んでください。
            </p>
          </div>
          <ImportButton label="単語データを取り込む" primary onImported={onImported} notify={notify} />
        </div>
      </div>
    );
  }

  const s = summarizeSort(data.items, data.progress);
  const block = currentSortBlock(data.items, data.progress, data.seed);
  const remaining = s.total - s.sorted;
  const pct = (n: number) => `${(n / s.total) * 100}%`;

  return (
    <div className="screen">
      <h1>IELTS 単語</h1>
      <div className="home-main">
        <div className="stack">
          {block ? (
            <div className="card">
              <div className="muted small">仕分けの残り</div>
              <div className="hero-number">{remaining.toLocaleString()}</div>
              <div className="muted small">
                / {s.total.toLocaleString()} 語 ・ ブロック {block.block + 1} / {s.blocksTotal}（あと
                {block.remaining.length}件）
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="big" style={{ fontWeight: 700, fontSize: 20 }}>
                仕分けが終わりました
              </div>
              <p className="muted small" style={{ marginBottom: 0 }}>
                次は「知らない」項目の周回です（次のステップで追加します）。
              </p>
            </div>
          )}

          <div className="bar" aria-hidden>
            <span style={{ width: pct(s.byClass.A), background: 'var(--known)' }} />
            <span style={{ width: pct(s.byClass.B), background: 'var(--unsure)' }} />
            <span style={{ width: pct(s.byClass.C), background: 'var(--unknown)' }} />
          </div>

          <div className="stat-row">
            <div className="stat">
              <span className="muted small">
                <i className="dot" style={{ background: 'var(--known)' }} />
                知ってる
              </span>
              <b>{s.byClass.A.toLocaleString()}</b>
            </div>
            <div className="stat">
              <span className="muted small">
                <i className="dot" style={{ background: 'var(--unsure)' }} />
                あやふや
              </span>
              <b>{s.byClass.B.toLocaleString()}</b>
            </div>
            <div className="stat">
              <span className="muted small">
                <i className="dot" style={{ background: 'var(--unknown)' }} />
                知らない
              </span>
              <b>{s.byClass.C.toLocaleString()}</b>
            </div>
          </div>
        </div>

        <button className="btn btn-primary btn-big" disabled={!block} onClick={onStart}>
          {s.sorted === 0 ? '始める' : '続ける'}
        </button>
      </div>
    </div>
  );
}
