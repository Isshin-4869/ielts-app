import { useCallback, useEffect, useRef, useState } from 'react';
import { currentSortBlock, type SortBlock } from '../engine/sorting';
import type { Progress, SortClass } from '../engine/types';
import { primaryMeaning } from '../data/validateItems';
import type { Item } from '../data/types';
import { repo, type AppData } from './App';
import { ItemDetail } from './ItemDetail';
import { SwipeCard } from './SwipeCard';

type Phase =
  | { kind: 'question'; shownAt: number }
  | { kind: 'reveal'; ms: number }
  | { kind: 'detail' }
  | { kind: 'blockDone'; block: number }
  | { kind: 'allDone' };

type Answered = { logId: string; itemId: string };
type Counts = Record<SortClass, number>;
const ZERO: Counts = { A: 0, B: 0, C: 0 };

export function SortSession({ data, onExit }: { data: AppData; onExit: () => void }) {
  const params = repo.params;
  const progress = useRef(new Map<string, Progress>(data.progress));
  const [block, setBlock] = useState<SortBlock | null>(() =>
    currentSortBlock(data.items, progress.current, data.seed),
  );
  const [queue, setQueue] = useState<string[]>(() => block?.remaining ?? []);
  const [phase, setPhase] = useState<Phase>(() =>
    block ? { kind: 'question', shownAt: performance.now() } : { kind: 'allDone' },
  );
  const [history, setHistory] = useState<Answered[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentId = queue[0];
  const current: Item | undefined = currentId ? data.itemById.get(currentId) : undefined;

  // 「知ってる」の後の表示中にアプリを閉じたら、そのまま「知ってる」で保存する
  const pendingKnown = useRef<{ itemId: string; ms: number } | null>(null);
  useEffect(
    () => () => {
      const p = pendingKnown.current;
      if (p) void repo.recordSort(p.itemId, 'known', p.ms, false);
    },
    [],
  );

  const record = useCallback(
    async (itemId: string, outcome: 'known' | 'unknown', ms: number, corrected: boolean) => {
      const res = await repo.recordSort(itemId, outcome, ms, corrected);
      progress.current.set(itemId, res.progress);
      setHistory((h) => [...h, { logId: res.log.id, itemId }]);
    },
    [],
  );

  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      setError(null);
    } catch (e) {
      setError(`保存できませんでした：${String(e)}`);
    } finally {
      setBusy(false);
    }
  }, []);

  const advance = useCallback(() => {
    setQueue((q) => {
      const rest = q.slice(1);
      if (rest.length === 0) setPhase({ kind: 'blockDone', block: block?.block ?? 0 });
      else setPhase({ kind: 'question', shownAt: performance.now() });
      return rest;
    });
  }, [block]);

  const decide = useCallback(
    (dir: 'left' | 'right', decidedAt = performance.now()) => {
      if (phase.kind !== 'question' || !current || busy) return;
      const ms = decidedAt - phase.shownAt;
      if (dir === 'right') {
        pendingKnown.current = { itemId: current.id, ms };
        setPhase({ kind: 'reveal', ms });
      } else {
        void run(async () => {
          await record(current.id, 'unknown', ms, false);
          setPhase({ kind: 'detail' });
        });
      }
    },
    [phase, current, busy, run, record],
  );

  const finishKnown = useCallback(
    (corrected: boolean) => {
      const p = pendingKnown.current;
      if (!p) return;
      pendingKnown.current = null;
      void run(async () => {
        await record(p.itemId, 'known', p.ms, corrected);
        if (corrected) setPhase({ kind: 'detail' });
        else advance();
      });
    },
    [run, record, advance],
  );

  // 「知ってる」の後、代表の意味を少し見せて自動で次へ
  useEffect(() => {
    if (phase.kind !== 'reveal') return;
    const t = setTimeout(() => finishKnown(false), params.sortRevealMs);
    return () => clearTimeout(t);
  }, [phase, finishKnown, params.sortRevealMs]);

  const nextBlock = useCallback(() => {
    const b = currentSortBlock(data.items, progress.current, data.seed);
    setBlock(b);
    setHistory([]);
    if (!b) {
      setQueue([]);
      setPhase({ kind: 'allDone' });
      return;
    }
    setQueue(b.remaining);
    setPhase({ kind: 'question', shownAt: performance.now() });
  }, [data]);

  const canUndo =
    history.length > 0 && !busy && (phase.kind === 'question' || phase.kind === 'detail' || phase.kind === 'blockDone');

  const undo = useCallback(() => {
    const last = history[history.length - 1];
    if (!last || !canUndo) return;
    void run(async () => {
      const p = await repo.undo(last.logId);
      if (p) progress.current.set(last.itemId, p);
      setHistory((h) => h.slice(0, -1));
      // 詳細表示中なら同じ項目、それ以外は直前の項目をもう一度出す
      if (phase.kind !== 'detail') setQueue((q) => [last.itemId, ...q]);
      setPhase({ kind: 'question', shownAt: performance.now() });
    });
  }, [history, canUndo, run, phase.kind]);

  // キーボード（Mac で試すとき用）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase.kind === 'question') {
        if (e.key === 'ArrowRight') decide('right');
        if (e.key === 'ArrowLeft') decide('left');
      } else if (phase.kind === 'reveal') {
        if (e.key === 'ArrowDown') finishKnown(true);
        if (e.key === 'Enter' || e.key === ' ') finishKnown(false);
      } else if (phase.kind === 'detail' && (e.key === 'Enter' || e.key === ' ')) {
        advance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, decide, finishKnown, advance]);

  // ブロック全体の分類ごとの件数（前回までの分も含む）
  const blockCounts = (b: number): Counts => {
    const c: Counts = { ...ZERO };
    for (const it of data.items) {
      if (it.block !== b) continue;
      const cls = progress.current.get(it.id)?.sortClass;
      if (cls) c[cls]++;
    }
    return c;
  };

  const total = block?.total ?? 0;
  const doneInBlock = block ? block.total - queue.length + (phase.kind === 'detail' ? 1 : 0) : 0;
  const isPhrase = current?.kind === 'phrase';

  return (
    <div className="study">
      <div className="study-top">
        <button className="icon-btn" onClick={onExit} aria-label="中断してホームに戻る">
          ✕
        </button>
        <div className="progress" aria-hidden>
          <span style={{ width: total ? `${(Math.min(doneInBlock, total) / total) * 100}%` : '0%' }} />
        </div>
        <button className="icon-btn" onClick={undo} disabled={!canUndo} aria-label="ひとつ戻る">
          ↶ 戻る
        </button>
      </div>
      {block && (phase.kind === 'question' || phase.kind === 'reveal' || phase.kind === 'detail') && (
        <div className="muted small" style={{ textAlign: 'center' }}>
          ブロック {block.block + 1} ・ {Math.min(doneInBlock + (phase.kind === 'detail' ? 0 : 1), total)} / {total}
        </div>
      )}

      <div className="study-body">
        {phase.kind === 'question' && current && (
          <>
            <SwipeCard
              key={current.id}
              onDecide={decide}
              leftHint={isPhrase ? '言えない' : '知らない'}
              rightHint={isPhrase ? '言える' : '知ってる'}
            >
              <Prompt item={current} />
            </SwipeCard>
            <div className="answer-row">
              <button className="btn btn-unknown" disabled={busy} onClick={() => decide('left')}>
                ← {isPhrase ? '言えない' : '知らない'}
              </button>
              <button className="btn btn-known" disabled={busy} onClick={() => decide('right')}>
                {isPhrase ? '言える' : '知ってる'} →
              </button>
            </div>
          </>
        )}

        {phase.kind === 'reveal' && current && (
          <>
            <div className="card swipe-card" onClick={() => finishKnown(false)}>
              <Prompt item={current} />
              <div className="reveal-meaning" lang={isPhrase ? 'en' : undefined}>
                {primaryMeaning(current)}
              </div>
              <div className="countdown">
                <span style={{ animationDuration: `${params.sortRevealMs}ms` }} />
              </div>
            </div>
            <div className="answer-row" style={{ gridTemplateColumns: '1fr' }}>
              <button className="btn btn-unknown" onClick={() => finishKnown(true)}>
                違った
              </button>
            </div>
          </>
        )}

        {phase.kind === 'detail' && current && (
          <>
            <div className="card" style={{ maxHeight: '62vh', overflowY: 'auto' }} onClick={advance}>
              <ItemDetail item={current} />
            </div>
            <div className="answer-row" style={{ gridTemplateColumns: '1fr' }}>
              <button className="btn btn-primary" disabled={busy} onClick={advance}>
                次へ
              </button>
            </div>
          </>
        )}

        {phase.kind === 'blockDone' && (
          <BlockDone block={phase.block} counts={blockCounts(phase.block)} onNext={nextBlock} onExit={onExit} />
        )}

        {phase.kind === 'allDone' && (
          <div className="done-box stack">
            <div className="done-title">仕分けが終わりました</div>
            <button className="btn btn-primary" onClick={onExit}>
              ホームに戻る
            </button>
          </div>
        )}

        {error && <p className="error small">{error}</p>}
      </div>
    </div>
  );
}

function BlockDone(props: { block: number; counts: Counts; onNext: () => void; onExit: () => void }) {
  const { block, counts, onNext, onExit } = props;
  return (
    <div className="done-box stack">
      <div>
        <div className="done-title">ブロック {block + 1} 完了</div>
        <div className="muted small">このブロックの仕分け結果（{counts.A + counts.B + counts.C} 件）</div>
      </div>
      <div className="kpi-row">
        <div className="card kpi">
          <div className="kpi-label">知ってる</div>
          <div className="kpi-value">{counts.A}</div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">あやふや</div>
          <div className="kpi-value">{counts.B}</div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">知らない</div>
          <div className="kpi-value">{counts.C}</div>
        </div>
      </div>
      <button className="btn btn-primary" onClick={onNext}>
        次のブロックへ
      </button>
      <button className="btn" onClick={onExit}>
        ホームに戻る
      </button>
    </div>
  );
}

function Prompt({ item }: { item: Item }) {
  if (item.kind === 'phrase') {
    return (
      <>
        <div className="label">英語で言える？</div>
        <div className="phrase-ja">{item.example?.ja}</div>
      </>
    );
  }
  return (
    <div className="headword" lang="en">
      {item.headword}
    </div>
  );
}
