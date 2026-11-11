// ファイルの読み込み・書き出し（iPhone の PWA でも使える方法を選ぶ）。

/** JSON を端末に保存する。iPhone では共有シート（「"ファイル"に保存」や AirDrop）を出す。 */
export async function saveJson(filename: string, data: unknown): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const file = new File([blob], filename, { type: 'application/json' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      // 共有に失敗したらダウンロードにする
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

export async function readJsonFile(file: File): Promise<unknown> {
  const text = await file.text();
  return JSON.parse(text) as unknown;
}
