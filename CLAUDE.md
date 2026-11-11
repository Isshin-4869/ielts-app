# CLAUDE.md

## このプロジェクト

手持ちの単語帳データ（`実践IELTS英単語3500`、Excel 1ファイル）だけを覚えるための、個人用の英単語暗記PWA。使用者は自分1人で、iPhoneのホーム画面から使う。TOEFL・IELTS対策が目的。

学習方式は二段構え。前半は高速周回（1周目で全項目を「知ってる／知らない」に仕分け、知らない項目をアクティブ枠で周回）、条件を満たした項目から順にSRS（FSRS）へ卒業させる。

**仕様の正は `docs/DESIGN.md`。** 実装前に該当する章を読むこと。DESIGN.md にない判断が必要なとき、または DESIGN.md と違うやり方の方が明らかに良いと思ったときは、実装前に理由を添えて確認すること。仕様を変えたら DESIGN.md も更新する。

## 技術スタック

- アプリ：TypeScript（strict）、Vite、React、vite-plugin-pwa、Dexie、ts-fsrs
- 同期・認証：Firebase（Auth、Firestore）。無料枠内で運用する
- 通知：Cloudflare Workers（Cron、KV、Web Push）
- 配信：GitHub Pages
- データ変換：Python 3、pandas、openpyxl、lemminflect、pytest
- 開発機：Apple Silicon の Mac

## 守ること

- **元データと変換結果をコミットしない。** `data/raw/` と `data/out/` は gitignore。市販の単語帳由来のデータなので、リポジトリやデプロイ先に単語帳の内容を含めない。テスト用のフィクスチャは数件の架空データで作る。
- **学習エンジン（`app/src/engine/`）は純粋関数だけで書く。** UI・Dexie・現在時刻に直接依存しない。時刻は `clock` を引数で受け取る。英語固有の処理は `app/src/lang/en/` に分ける（将来、韓国語データにも同じエンジンを使うため）。
- **回答ログが正、進捗はキャッシュ。** 進捗はログの畳み込み（`reduce`）で必ず再現できること。ログは削除せず、取り消しは `undone: true`。
- **パラメータは `app/src/engine/params.ts` に集約。** 数値をコードに直書きしない。
- **1日の区切りは午前4時。**
- **Firestore の読み書き回数を意識する。** 1項目1ドキュメントにしない（DESIGN.md 12.3）。
- エンジンの変更にはテストを書く（Vitest）。変換スクリプトには pytest。
- iPhone Safari（ホーム画面に追加したPWA）で動くことを前提にする。iOSで使えないWeb APIに頼らない。
- UIの文言は日本語。

## 進め方

- 開発は DESIGN.md 15章のステップ順。各ステップの最初に計画（作るファイル、方針、確認したいこと）を短く出し、承認を得てから実装する。
- ステップの終わりに「完了の目安」を満たしたか確認し、使用者が実機で試す手順を書く。
- コミットは意味のある単位で、メッセージは日本語でよい。

## コマンド（決まったら追記する）

- Python の環境（初回だけ。システムの Python 3.9 で動く）：`python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`
- 変換：`.venv/bin/python -m scripts.convert`（入力の既定は `data/raw/実践IELTS英単語3500_一覧.xlsx`、出力は `data/out/`。エラーがあれば終了コード1で items.json は出さない）
- テスト：`.venv/bin/pytest` / `npm test`
- 開発サーバー：`npm run dev`
