"""検証レポート（report.md）を作る（DESIGN.md 3.4）。"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Dict, List

from .core import Result, no_sort_key
from .issues import CATEGORY_ORDER, Issue
from .schema import BLOCK_SIZE

_ORIGIN_LABELS = [
    ("quizlet", "本編の単語"),
    ("audio-only", "音声のみの単語"),
    ("phrase", "フレーズ"),
]


def build_report(result: Result, source_name: str, wrote_items: bool) -> str:
    lines: List[str] = []
    add = lines.append
    errors, warnings = result.errors, result.warnings

    add("# 変換レポート")
    add("")
    add(f"- 入力：`{source_name}`")
    add(f"- 実行：{datetime.now().strftime('%Y-%m-%d %H:%M')}")
    add(f"- 結果：エラー {len(errors)} 件、警告 {len(warnings)} 件")
    add(f"- items.json：{'出力した' if wrote_items else 'エラーがあるため出力していない'}")
    add("")

    # 件数
    add("## 件数")
    add("")
    exp = result.expected_counts or {}
    add("| 種類 | 件数 | 期待値 |")
    add("| --- | ---: | ---: |")
    for key, label in _ORIGIN_LABELS:
        add(f"| {label} | {result.row_counts.get(key, 0):,} | {_fmt(exp.get(key))} |")
    rows_total = sum(result.row_counts.values())
    add(f"| 行の合計 | {rows_total:,} | |")
    add(f"| 重複統合で減った数 | {rows_total - len(result.items):,} | |")
    add(f"| **総件数（統合後）** | **{len(result.items):,}** | {_fmt(exp.get('total'))} |")
    add("")

    words = [i for i in result.items if i["kind"] == "word"]
    with_ex = [i for i in words if "example" in i]
    with_cloze = [i for i in with_ex if "cloze" in i["example"]]
    exact = [i for i in with_cloze if i["example"]["cloze"]["form"].lower() == i["headword"].lower()]
    add("| 内訳 | 件数 |")
    add("| --- | ---: |")
    add(f"| word | {len(words):,} |")
    add(f"| phrase | {len(result.items) - len(words):,} |")
    add(f"| word で例文あり | {len(with_ex):,} |")
    add(f"| 穴埋め位置あり | {len(with_cloze):,} |")
    add(f"| 　うち見出し語そのまま | {len(exact):,} |")
    add(f"| 　うち変化形 | {len(with_cloze) - len(exact):,} |")
    add(f"| 品詞が複数ある語 | {sum(1 for i in words if len({m['pos'] for m in i['meanings']}) > 1):,} |")
    add(f"| 類義語あり | {sum(1 for i in result.items if i['synonyms']):,} |")
    add(f"| 対義語あり | {sum(1 for i in result.items if i['antonyms']):,} |")
    add(f"| ブロック数（{BLOCK_SIZE}件ごと） | {_block_count(result):,} |")
    add("")

    # エラー・警告
    add("## エラー")
    add("")
    if errors:
        _issue_sections(lines, errors)
    else:
        add("なし")
        add("")

    add("## 警告")
    add("")
    if warnings:
        _issue_sections(lines, warnings)
    else:
        add("なし")
        add("")

    add("## overrides.json の適用")
    add("")
    if result.overrides_applied:
        for a in result.overrides_applied:
            add(f"- {a}")
    else:
        add("なし")
    add("")

    # 変化形の一覧（目で確認する用）
    inflected = [i for i in with_cloze if i not in exact]
    suffixed = [
        i for i in inflected if i["example"]["cloze"]["form"].lower().startswith(i["headword"].lower())
    ]
    changed = [i for i in inflected if i not in suffixed]
    add("## 参考：変化形で穴埋め位置を決めた例文")
    add("")
    add(f"見出し語と違う形で一致したもの {len(inflected):,} 件。")
    add("")
    suffix_counts: Dict[str, int] = defaultdict(int)
    for i in suffixed:
        suffix_counts[i["example"]["cloze"]["form"][len(i["headword"]):].lower()] += 1
    add(
        f"- 見出し語に語尾が付いただけの形：{len(suffixed):,} 件（"
        + "、".join(f"-{s} {n}" for s, n in sorted(suffix_counts.items(), key=lambda x: -x[1]))
        + "）"
    )
    add(f"- 語形が変わる形（不規則変化、y→ies、e の脱落、ハイフンなど）：{len(changed):,} 件。下の表で、位置が正しいか目で確認する。")
    add("")
    add("| 番号 | 見出し語 | 例文中の形 | 例文 |")
    add("| --- | --- | --- | --- |")
    for i in changed:
        ex = i["example"]
        c = ex["cloze"]
        marked = ex["en"][: c["start"]] + "**" + c["form"] + "**" + ex["en"][c["start"] + c["length"]:]
        add(f"| {i['sourceNos'][0]} | {_esc(i['headword'])} | {_esc(c['form'])} | {_esc(marked)} |")
    add("")
    return "\n".join(lines)


def _issue_sections(lines: List[str], issues: List[Issue]) -> None:
    grouped: Dict[str, List[Issue]] = defaultdict(list)
    for i in issues:
        grouped[i.category].append(i)
    cats = [c for c in CATEGORY_ORDER if c in grouped] + [c for c in grouped if c not in CATEGORY_ORDER]
    for cat in cats:
        group = sorted(grouped[cat], key=lambda i: no_sort_key(i.no))
        lines.append(f"### {cat}（{len(group)} 件）")
        lines.append("")
        lines.append("| 番号 | 内容 |")
        lines.append("| --- | --- |")
        for i in group:
            lines.append(f"| {i.no} | {_esc(i.message)} |")
        lines.append("")


def _esc(s: str) -> str:
    return s.replace("|", "\\|").replace("\n", " ")


def _fmt(v) -> str:
    return f"{v:,}" if isinstance(v, int) else ""



def _block_count(result: Result) -> int:
    return len({i["block"] for i in result.items})

