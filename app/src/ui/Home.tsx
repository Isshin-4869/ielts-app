import { currentSortBlock, summarizeSort } from '../engine/sorting';
import type { AppData } from './App';
import { ImportButton } from './ImportButton';

type Props = {
  data: AppData;
  onStart: () => void;
  onImported: () => void | Promise<void>;
  notify: (msg: string) => void;
};

const fmt = (n: number) => n.toLocaleString('ja-JP');
const pct = (n: number, total: number) => (total === 0 ? 0 : (n / total) * 100);
const pctText = (n: number, total: number) => `${pct(n, total).toFixed(1)}%`;

function asOf(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')} 時点`;
}

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

  // 内訳：グラフの左からの順と凡例の上からの順をそろえる
  const series = [
    { key: 'known', label: '知ってる', n: s.byClass.A },
    { key: 'unsure', label: 'あやふや', n: s.byClass.B },
    { key: 'unknown', label: '知らない', n: s.byClass.C },
    { key: 'new', label: '未着手', n: remaining },
  ];
  const summary = series.map((x) => `${x.label} ${fmt(x.n)}語（${pctText(x.n, s.total)}）`).join('、');

  return (
    <div className="screen">
      <h1>IELTS 単語</h1>
      <div className="home-main">
        <div className="stack">
          {/* 全体の指標（最も目を引く位置と背景色） */}
          <section className="card kpi kpi-highlight">
            {block ? (
              <>
                <div className="kpi-label">仕分けの残り</div>
                <div className="kpi-value">
                  {fmt(remaining)}
                  <span className="kpi-unit">語</span>
                </div>
                <div className="kpi-compare">
                  全 {fmt(s.total)} 語のうち {pctText(s.sorted, s.total)} を仕分け済み
                </div>
              </>
            ) : (
              <>
                <div className="kpi-label">仕分け</div>
                <div className="kpi-value">完了</div>
                <div className="kpi-compare">次は「知らない」項目の周回です（次のステップで追加します）</div>
              </>
            )}
          </section>

          {/* 部分：いま進めているブロック */}
          {block && (
            <section className="card kpi">
              <div className="kpi-label">いまのブロック</div>
              <div className="kpi-value">
                {block.block + 1}
                <span className="kpi-unit">/ {s.blocksTotal}</span>
              </div>
              <div className="kpi-compare">
                このブロックの残り {fmt(block.remaining.length)} 件（{fmt(block.total)} 件中）
              </div>
            </section>
          )}

          {/* 詳細：仕分けの内訳 */}
          <section className="card">
            <h2 className="chart-title">仕分けの内訳（累計）</h2>
            <p className="chart-subtitle">全 {fmt(s.total)} 語に占める割合</p>
            <div className="stacked-bar" role="img" aria-label={`仕分けの内訳。${summary}`}>
              {series
                .filter((x) => x.n > 0)
                .map((x) => (
                  <span key={x.key} className={`s-${x.key}`} style={{ width: `${pct(x.n, s.total)}%` }} />
                ))}
            </div>
            <ul className="legend">
              {series.map((x) => (
                <li key={x.key}>
                  <span className={`swatch s-${x.key}`} aria-hidden />
                  <span>{x.label}</span>
                  <span className="num">{fmt(x.n)}</span>
                  <span className="pct">{pctText(x.n, s.total)}</span>
                </li>
              ))}
            </ul>
          </section>

          <p className="footnote">{asOf(new Date())}・この端末に保存された回答から集計</p>
        </div>

        <button className="btn btn-primary btn-big" disabled={!block} onClick={onStart}>
          {s.sorted === 0 ? '始める' : '続ける'}
        </button>
      </div>
    </div>
  );
}
