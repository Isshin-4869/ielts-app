"""使い方：
    python -m scripts.convert [data/raw/実践IELTS英単語3500_一覧.xlsx] [--out data/out] [--overrides data/overrides.json]

エラーがあれば終了コード1。そのとき items.json は出力しない（report.md は出す）。
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .core import ColumnError, convert, load_excel
from .report import build_report
from .schema import EXPECTED_COUNTS

DEFAULT_INPUT = Path("data/raw/実践IELTS英単語3500_一覧.xlsx")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="python -m scripts.convert", description="単語帳の Excel を items.json に変換する")
    ap.add_argument("input", nargs="?", type=Path, default=DEFAULT_INPUT, help="元データの xlsx")
    ap.add_argument("--out", type=Path, default=Path("data/out"), help="出力先ディレクトリ")
    ap.add_argument("--overrides", type=Path, default=Path("data/overrides.json"), help="手修正の JSON")
    ap.add_argument("--no-count-check", action="store_true", help="件数の期待値チェックをしない")
    args = ap.parse_args(argv)

    if not args.input.exists():
        print(f"入力ファイルがありません: {args.input}", file=sys.stderr)
        return 1
    try:
        df = load_excel(args.input)
    except ColumnError as e:
        print(str(e), file=sys.stderr)
        return 1

    overrides = {}
    if args.overrides.exists():
        overrides = json.loads(args.overrides.read_text(encoding="utf-8"))

    result = convert(df, overrides, None if args.no_count_check else EXPECTED_COUNTS)
    ok = not result.errors

    args.out.mkdir(parents=True, exist_ok=True)
    items_path = args.out / "items.json"
    if ok:
        items_path.write_text(json.dumps(result.items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    elif items_path.exists():
        items_path.unlink()  # 古い結果を取り込まないように消す
    report_path = args.out / "report.md"
    report_path.write_text(build_report(result, args.input.name, ok), encoding="utf-8")

    print(f"項目 {len(result.items)} 件、エラー {len(result.errors)} 件、警告 {len(result.warnings)} 件")
    if ok:
        print(f"出力: {items_path}")
    print(f"レポート: {report_path}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
