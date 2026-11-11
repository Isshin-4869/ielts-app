import { useCallback, useEffect, useState } from 'react';
import type { Progress } from '../engine/types';
import { db } from '../data/db';
import { Repo } from '../data/repo';
import type { Item } from '../data/types';
import { Home } from './Home';
import { Settings } from './Settings';
import { SortSession } from './SortSession';

export const repo = new Repo(db);

export type AppData = {
  items: Item[];
  itemById: Map<string, Item>;
  progress: Map<string, Progress>;
  seed: string;
};

type View = 'home' | 'settings' | 'sort';

export function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [view, setView] = useState<View>('home');
  const [toast, setToast] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [{ items, progress }, seed] = await Promise.all([repo.loadAll(), repo.installSeed()]);
      setData({ items, itemById: new Map(items.map((i) => [i.id, i])), progress, seed });
    } catch (e) {
      setLoadError(String(e));
    }
  }, []);

  useEffect(() => {
    void reload();
    // ブラウザに勝手にデータを消されないよう頼む（DESIGN.md 13章）
    void navigator.storage?.persist?.().catch(() => undefined);
  }, [reload]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  if (loadError) {
    return (
      <div className="screen">
        <p className="error">データを読み込めませんでした。{'\n'}{loadError}</p>
      </div>
    );
  }
  if (!data) return <div className="screen" />;

  if (view === 'sort') {
    return (
      <SortSession
        data={data}
        onExit={() => {
          setView('home');
          void reload();
        }}
      />
    );
  }

  return (
    <>
      {view === 'home' ? (
        <Home data={data} onStart={() => setView('sort')} onImported={reload} notify={setToast} />
      ) : (
        <Settings data={data} onChanged={reload} notify={setToast} />
      )}
      <nav className="tabbar">
        <button aria-current={view === 'home' ? 'page' : undefined} onClick={() => setView('home')}>
          ホーム
        </button>
        <button aria-current={view === 'settings' ? 'page' : undefined} onClick={() => setView('settings')}>
          設定
        </button>
      </nav>
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
