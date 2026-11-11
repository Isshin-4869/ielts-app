"""data/overrides.json（手修正）を変換結果に適用する（DESIGN.md 3.3 の7）。

書式：
    {
      "_comment": "先頭が _ のキーは無視する（メモ用）",
      "1965": { "example": { "cloze": "oxen" } },
      "1234": { "meaningRaw": "【名】直した意味" },
      "2000": { "synonyms": ["foo", "bar"], "relationSource": null }
    }

- キーは元データの番号。統合した語はどちらの番号でもよい。
- 値は上書きする Item のフィールド。`null` はそのフィールドを消す。
- `example` は中身のキーごとに上書きする（`{"cloze": ...}` だけ書けばよい）。
- `example.cloze` は文字列で書くと、例文中でその文字列を探して位置を入れる。
- `meaningRaw` だけ書いた場合は `meanings` を作り直す。
- word の例文を変えて `cloze` を書かなかった場合は穴埋め位置を探し直す。
- `id` `kind` `origin` `sourceNos` `order` `block` は上書きできない。
"""
from __future__ import annotations

import copy
from typing import Any, Dict, List, Tuple

from .cloze import find_cloze, locate_form
from .issues import CAT_OVERRIDES, ERROR, Issue
from .parse import parse_meanings
from .schema import EXAMPLE_KEY_ORDER, ITEM_KEY_ORDER

PROTECTED_FIELDS = {"id", "kind", "origin", "sourceNos", "order", "block"}
EDITABLE_FIELDS = set(ITEM_KEY_ORDER) - PROTECTED_FIELDS
EXAMPLE_FIELDS = set(EXAMPLE_KEY_ORDER)


def apply_overrides(
    items: List[Dict[str, Any]], overrides: Dict[str, Any]
) -> Tuple[List[Dict[str, Any]], List[Issue], List[str]]:
    """戻り値は (items, issues, 適用した内容の説明の一覧)。items はその場で書き換える。"""
    issues: List[Issue] = []
    applied: List[str] = []
    by_no: Dict[str, Dict[str, Any]] = {}
    for item in items:
        for no in item["sourceNos"]:
            by_no[no] = item

    for no, patch in overrides.items():
        if no.startswith("_"):
            continue
        item = by_no.get(no)
        if item is None:
            issues.append(Issue(ERROR, CAT_OVERRIDES, no, "この番号の項目がない"))
            continue
        if not isinstance(patch, dict):
            issues.append(Issue(ERROR, CAT_OVERRIDES, no, "値がオブジェクトでない"))
            continue

        bad = [k for k in patch if k not in EDITABLE_FIELDS]
        if bad:
            issues.append(Issue(ERROR, CAT_OVERRIDES, no, f"上書きできないフィールド: {', '.join(bad)}"))
            continue

        cloze_given = False
        example_changed = False
        for field, value in patch.items():
            if field == "example":
                if value is None:
                    item.pop("example", None)
                    continue
                if not isinstance(value, dict):
                    issues.append(Issue(ERROR, CAT_OVERRIDES, no, "example がオブジェクトでない"))
                    continue
                bad_ex = [k for k in value if k not in EXAMPLE_FIELDS]
                if bad_ex:
                    issues.append(Issue(ERROR, CAT_OVERRIDES, no, f"example に未知のキー: {', '.join(bad_ex)}"))
                    continue
                ex = item.setdefault("example", {})
                for k, v in value.items():
                    if k == "cloze":
                        cloze_given = True
                        continue  # 例文の書き換えを先に済ませてから処理する
                    example_changed = True
                    if v is None:
                        ex.pop(k, None)
                    else:
                        ex[k] = copy.deepcopy(v)
                if cloze_given:
                    _apply_cloze(item, value["cloze"], no, issues)
            elif value is None:
                item.pop(field, None)
            else:
                item[field] = copy.deepcopy(value)

        if "meaningRaw" in patch and "meanings" not in patch and item.get("meaningRaw"):
            item["meanings"], _ = parse_meanings(item["meaningRaw"])

        if example_changed and not cloze_given and item["kind"] == "word" and "example" in item:
            ex = item["example"]
            ex.pop("cloze", None)
            if not ex.get("incomplete") and ex.get("en"):
                found = find_cloze(ex["en"], item.get("headword", ""))
                if found:
                    ex["cloze"] = found

        applied.append(f"{no}（{item['id']}）: {', '.join(patch.keys())}")
    return items, issues, applied


def _apply_cloze(item: Dict[str, Any], value: Any, no: str, issues: List[Issue]) -> None:
    ex = item["example"]
    if value is None:
        ex.pop("cloze", None)
    elif isinstance(value, str):
        found = locate_form(ex.get("en", ""), value)
        if found is None:
            issues.append(Issue(ERROR, CAT_OVERRIDES, no, f"cloze に指定した「{value}」が例文中にない"))
        else:
            ex["cloze"] = found
    elif isinstance(value, dict):
        ex["cloze"] = copy.deepcopy(value)
    else:
        issues.append(Issue(ERROR, CAT_OVERRIDES, no, "cloze は文字列・オブジェクト・null のどれか"))
