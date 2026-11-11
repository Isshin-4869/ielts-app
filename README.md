# ielts-app

手持ちの英単語帳だけを覚えるための、個人用の英単語暗記 PWA（iPhone のホーム画面から使う）。

- 仕様：[docs/DESIGN.md](docs/DESIGN.md)
- アプリ：`app/`（Vite + React + TypeScript、Dexie、vite-plugin-pwa）
- データ変換：`scripts/convert/`（Python）

単語帳のデータ（元の Excel と変換結果）はこのリポジトリにもデプロイ先にも含めていない。アプリの設定画面から、手元で変換した `items.json` を取り込んで使う。
