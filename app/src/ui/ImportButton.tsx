import { useRef, useState } from 'react';
import { readJsonFile } from '../data/files';
import { validateItems } from '../data/validateItems';
import { repo } from './App';

type Props = {
  label: string;
  primary?: boolean;
  onImported: () => void | Promise<void>;
  notify: (msg: string) => void;
};

/** 単語データ（items.json）を選んで取り込むボタン */
export function ImportButton({ label, primary, onImported, notify }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function importData(data: unknown) {
    const r = validateItems(data);
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    setErrors([]);
    await repo.importItems(r.items);
    await onImported();
    notify(`${r.items.length.toLocaleString()}件を取り込みました`);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      await importData(await readJsonFile(file));
    } catch (e) {
      setErrors([`読み込めませんでした：${String(e)}`]);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  async function loadDevItems() {
    setBusy(true);
    try {
      const res = await fetch(__DEV_ITEMS_URL__);
      await importData(await res.json());
    } catch (e) {
      setErrors([`読み込めませんでした：${String(e)}`]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <label className={`btn file-btn ${primary ? 'btn-primary' : ''}`} aria-disabled={busy}>
        {busy ? '取り込み中…' : label}
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          disabled={busy}
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </label>
      {import.meta.env.DEV && __DEV_ITEMS_URL__ && (
        <button className="btn small" disabled={busy} onClick={() => void loadDevItems()}>
          開発用：data/out/items.json を読み込む
        </button>
      )}
      {errors.length > 0 && <p className="error small">{errors.join('\n')}</p>}
    </div>
  );
}
