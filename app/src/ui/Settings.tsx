import { useEffect, useState } from 'react';
import { saveJson } from '../data/files';
import { repo, type AppData } from './App';
import { ImportButton } from './ImportButton';

type Props = {
  data: AppData;
  onChanged: () => void | Promise<void>;
  notify: (msg: string) => void;
};

export function Settings({ data, onChanged, notify }: Props) {
  const [logCount, setLogCount] = useState<number | null>(null);
  const [importedAt, setImportedAt] = useState<number | undefined>();
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    void repo.counts().then((c) => setLogCount(c.logs));
    void repo.itemsImportedAt().then(setImportedAt);
    void navigator.storage?.persisted?.().then(setPersisted);
  }, [data]);

  async function backup() {
    setBusy(true);
    try {
      const file = await repo.exportBackup();
      const d = new Date(file.exportedAt);
      const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
      const r = await saveJson(`ielts-backup-${stamp}.json`, file);
      if (r !== 'cancelled') notify('バックアップを書き出しました');
    } catch (e) {
      notify(`書き出せませんでした：${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function rebuild() {
    setBusy(true);
    try {
      await repo.rebuildProgress();
      await onChanged();
      notify('進捗をログから作り直しました');
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    try {
      await repo.resetProgress();
      setConfirmReset(false);
      await onChanged();
      notify('進捗をリセットしました。最初から仕分けできます');
    } catch (e) {
      notify(`リセットできませんでした：${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const sortedCount = [...data.progress.values()].filter((p) => p.state !== 'new').length;

  return (
    <div className="screen">
      <h1>設定</h1>
      <div className="stack">
        <div className="card stack">
          <div>
            <b>単語データ</b>
            <div className="muted small">
              {data.items.length.toLocaleString()} 件
              {importedAt ? `（${new Date(importedAt).toLocaleString('ja-JP')} に取り込み）` : ''}
            </div>
          </div>
          <ImportButton label="単語データを取り込む" onImported={onChanged} notify={notify} />
          <p className="muted small" style={{ margin: 0 }}>
            入れ直しても、これまでの回答と進捗は消えません。
          </p>
        </div>

        <div className="card stack">
          <div>
            <b>バックアップ</b>
            <div className="muted small">回答ログ {logCount?.toLocaleString() ?? '…'} 件</div>
          </div>
          <button className="btn" disabled={busy} onClick={() => void backup()}>
            バックアップを書き出す
          </button>
          <p className="muted small" style={{ margin: 0 }}>
            回答ログ・進捗・設定を1つのファイルにします（単語データは含みません）。「"ファイル"に保存」を選んでください。
          </p>
        </div>

        <div className="card stack">
          <b>メンテナンス</b>
          <button className="btn" disabled={busy} onClick={() => void rebuild()}>
            進捗をログから作り直す
          </button>
          <p className="muted small" style={{ margin: 0 }}>
            データの保護：{persisted === null ? '確認中' : persisted ? '有効' : '未許可（ホーム画面に追加すると有効になりやすい）'}
          </p>
        </div>

        <div className="card stack">
          <div>
            <b>最初からやり直す</b>
            <div className="muted small">仕分け済み {sortedCount.toLocaleString()} 語</div>
          </div>
          {!confirmReset ? (
            <button className="btn btn-danger" disabled={busy || sortedCount === 0} onClick={() => setConfirmReset(true)}>
              進捗をリセットする
            </button>
          ) : (
            <div className="stack confirm-box" role="alertdialog" aria-label="進捗のリセットの確認">
              <p style={{ margin: 0 }}>
                全 {data.items.length.toLocaleString()} 語を「未着手」に戻し、仕分けを最初からやり直します。出題の順番も変わります。
              </p>
              <p className="muted small" style={{ margin: 0 }}>
                これまでの回答は「取り消し」として記録に残りますが、アプリの画面からは元に戻せません。心配なら先にバックアップを書き出してください。
              </p>
              <button className="btn btn-danger-solid" disabled={busy} onClick={() => void reset()}>
                リセットする
              </button>
              <button className="btn" disabled={busy} onClick={() => setConfirmReset(false)}>
                やめる
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
