"""見出し語の重複を1件に統合する（DESIGN.md 3.3 の5）。"""
from __future__ import annotations

from typing import Any, Dict, List, Tuple

from .issues import CAT_MERGED, WARNING, Issue


def merge_duplicates(items: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Issue]]:
    """小文字化した見出し語をキーに word を統合する。

    - 先に出た方を残し、`sourceNos` に後の番号を足す（並び順も先に出た方）。
    - 先に出た方に例文がなく後にあれば、後の例文を使う。類義語・対義語は和集合。
    - 統合した語はすべて警告として一覧に出す（意味が違えばその旨も書く）。
    """
    kept: List[Dict[str, Any]] = []
    by_key: Dict[str, Dict[str, Any]] = {}
    issues: List[Issue] = []

    for item in items:
        if item["kind"] != "word":
            kept.append(item)
            continue
        key = item["headword"].strip().lower()
        first = by_key.get(key)
        if first is None:
            by_key[key] = item
            kept.append(item)
            continue

        first["sourceNos"].append(item["sourceNos"][0])
        if "example" not in first and "example" in item:
            first["example"] = item["example"]
        for rel in ("synonyms", "antonyms"):
            for w in item[rel]:
                if w not in first[rel]:
                    first[rel].append(w)
        if "relationSource" not in first and "relationSource" in item:
            first["relationSource"] = item["relationSource"]

        same = first.get("meaningRaw") == item.get("meaningRaw")
        note = "意味は同じ" if same else f"意味が違う：{first.get('meaningRaw')} ／ {item.get('meaningRaw')}"
        issues.append(
            Issue(
                WARNING,
                CAT_MERGED,
                item["sourceNos"][0],
                f"{first['headword']}：番号 {', '.join(first['sourceNos'])} を {first['id']} に統合（{note}）",
            )
        )
    return kept, issues
