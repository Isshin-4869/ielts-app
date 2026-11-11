"""変換の本体：Excel → items（DESIGN.md 3.3）と検証（3.4）。"""
from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd

from .cloze import find_cloze
from .issues import (
    CAT_CLOZE_INVALID,
    CAT_CLOZE_MISSING,
    CAT_COUNT,
    CAT_HEADWORD_CHARS,
    CAT_INCOMPLETE,
    CAT_MEANING,
    CAT_MULTI_SENTENCE,
    CAT_NO,
    CAT_RELATION,
    CAT_REQUIRED,
    CAT_ROW_TYPE,
    ERROR,
    WARNING,
    Issue,
)
from .merge import merge_duplicates
from .overrides import apply_overrides
from .parse import (
    classify_row,
    has_multiple_sentences,
    headword_has_japanese,
    headword_has_non_ascii,
    is_incomplete,
    make_id,
    parse_meanings,
    parse_relation_source,
    split_relations,
)
from .schema import BLOCK_SIZE, EXAMPLE_KEY_ORDER, EXPECTED_COLUMNS, ITEM_KEY_ORDER


class ColumnError(Exception):
    """列名が想定と違う。即エラーで止める。"""


@dataclass
class Result:
    items: List[Dict[str, Any]]
    issues: List[Issue]
    row_counts: Dict[str, int]  # 行の種類ごとの件数（統合前）
    expected_counts: Optional[Dict[str, int]]
    overrides_applied: List[str] = field(default_factory=list)

    @property
    def errors(self) -> List[Issue]:
        return [i for i in self.issues if i.level == ERROR]

    @property
    def warnings(self) -> List[Issue]:
        return [i for i in self.issues if i.level == WARNING]


def load_excel(path: Path) -> pd.DataFrame:
    df = pd.read_excel(path, dtype=str)
    check_columns(df)
    return df


def check_columns(df: pd.DataFrame) -> None:
    cols = [str(c) for c in df.columns]
    if cols != EXPECTED_COLUMNS:
        raise ColumnError(f"列名が想定と違います。\n  想定: {EXPECTED_COLUMNS}\n  実際: {cols}")


def convert(
    df: pd.DataFrame,
    overrides: Optional[Dict[str, Any]] = None,
    expected_counts: Optional[Dict[str, int]] = None,
) -> Result:
    check_columns(df)
    df = df.fillna("").astype(str).apply(lambda col: col.str.strip())
    issues: List[Issue] = []

    # 番号
    nos = df["番号"]
    for i in df.index[nos == ""]:
        issues.append(Issue(ERROR, CAT_NO, "", f"行番号 {df.at[i, '行番号']} の番号が空"))
    for no, n in Counter(nos[nos != ""]).items():
        if n > 1:
            issues.append(Issue(ERROR, CAT_NO, no, f"番号が {n} 回出てくる"))

    # 行ごとに Item を作る
    items: List[Dict[str, Any]] = []
    row_counts: Counter = Counter()
    for _, row in df.iterrows():
        no = row["番号"]
        if no == "":
            continue
        origin = classify_row(no, row["範囲"], row["単語"], row["意味"], row["語の出典"])
        if origin is None:
            issues.append(
                Issue(
                    ERROR,
                    CAT_ROW_TYPE,
                    no,
                    f"範囲={row['範囲']!r} 単語={row['単語']!r} 語の出典={row['語の出典']!r}",
                )
            )
            continue
        row_counts[origin] += 1
        item = _build_item(row, origin, issues)
        items.append(item)

    # 重複統合 → 並び順 → overrides
    items, merge_issues = merge_duplicates(items)
    issues += merge_issues
    for order, item in enumerate(items):
        item["order"] = order
        item["block"] = order // BLOCK_SIZE

    applied: List[str] = []
    if overrides:
        items, ov_issues, applied = apply_overrides(items, overrides)
        issues += ov_issues

    issues += validate_items(items)

    if expected_counts:
        issues += _check_counts(dict(row_counts), len(items), expected_counts)

    items = [_ordered(item) for item in items]
    return Result(items, issues, dict(row_counts), expected_counts, applied)


def _build_item(row: pd.Series, origin: str, issues: List[Issue]) -> Dict[str, Any]:
    no = row["番号"]
    kind = "phrase" if origin == "phrase" else "word"
    item: Dict[str, Any] = {
        "id": make_id(no),
        "kind": kind,
        "origin": origin,
        "sourceNos": [no],
    }
    if kind == "word":
        item["headword"] = row["単語"]
        item["meanings"], _ = parse_meanings(row["意味"])  # 書式の問題は validate_items で出す
        item["meaningRaw"] = row["意味"]
    item["synonyms"] = split_relations(row["類義語"])
    item["antonyms"] = split_relations(row["対義語"])
    rel_source, problem = parse_relation_source(row["類義語・対義語の出典"])
    if problem:
        issues.append(Issue(ERROR, CAT_RELATION, no, problem))
    if rel_source:
        item["relationSource"] = rel_source

    if row["例文"] != "" or row["例文の日本語訳"] != "":
        ex: Dict[str, Any] = {
            "en": row["例文"],
            "source": row["例文の出典"],
            "incomplete": is_incomplete(row["例文の出典"]),
        }
        if row["例文の日本語訳"] != "":
            ex["ja"] = row["例文の日本語訳"]
        if kind == "word" and not ex["incomplete"] and ex["en"] != "":
            cloze = find_cloze(ex["en"], item["headword"])
            if cloze:
                ex["cloze"] = cloze
        item["example"] = ex
    return item


def validate_items(items: List[Dict[str, Any]]) -> List[Issue]:
    """最終的な items を検証する（overrides の適用後）。"""
    issues: List[Issue] = []
    for item in items:
        no = item["sourceNos"][0]
        ex = item.get("example")

        if item["kind"] == "word":
            hw = item.get("headword", "")
            if hw == "":
                issues.append(Issue(ERROR, CAT_REQUIRED, no, "word の見出し語が空"))
            elif headword_has_japanese(hw):
                issues.append(Issue(ERROR, CAT_HEADWORD_CHARS, no, f"日本語・全角記号を含む：{hw}"))
            elif headword_has_non_ascii(hw):
                issues.append(Issue(WARNING, CAT_HEADWORD_CHARS, no, f"ASCII 以外の文字を含む：{hw}"))

            raw = item.get("meaningRaw", "")
            if raw == "" and not item.get("meanings"):
                issues.append(Issue(ERROR, CAT_REQUIRED, no, f"word の意味が空（{hw}）"))
            elif raw != "":
                _, problems = parse_meanings(raw)
                for p in problems:
                    issues.append(Issue(ERROR, CAT_MEANING, no, f"{hw}：{p}（{raw}）"))

            if ex and ex.get("en") and not ex.get("incomplete") and "cloze" not in ex:
                issues.append(Issue(WARNING, CAT_CLOZE_MISSING, no, f"{hw}：{ex['en']}"))
        else:
            if not ex or not ex.get("en"):
                issues.append(Issue(ERROR, CAT_REQUIRED, no, "phrase の例文が空"))
            if not ex or not ex.get("ja"):
                issues.append(Issue(ERROR, CAT_REQUIRED, no, "phrase の日本語訳が空"))

        has_rel = bool(item["synonyms"] or item["antonyms"])
        if has_rel and "relationSource" not in item:
            issues.append(Issue(WARNING, CAT_RELATION, no, "類義語・対義語があるのに出典が空"))
        if not has_rel and "relationSource" in item:
            issues.append(Issue(WARNING, CAT_RELATION, no, "出典があるのに類義語・対義語が空"))

        if ex:
            label = item.get("headword", "フレーズ")
            if ex.get("en") and not ex.get("source"):
                issues.append(Issue(WARNING, CAT_REQUIRED, no, f"{label}：例文の出典が空"))
            if ex.get("incomplete"):
                issues.append(Issue(WARNING, CAT_INCOMPLETE, no, f"{label}：{ex.get('en', '')}"))
            if ex.get("en") and has_multiple_sentences(ex["en"]):
                issues.append(Issue(WARNING, CAT_MULTI_SENTENCE, no, f"{label}：{ex['en']}"))
            cloze = ex.get("cloze")
            if cloze is not None:
                en = ex.get("en", "")
                try:
                    ok = en[cloze["start"]:cloze["start"] + cloze["length"]] == cloze["form"] and cloze["length"] > 0
                except (KeyError, TypeError):
                    ok = False
                if not ok:
                    issues.append(Issue(ERROR, CAT_CLOZE_INVALID, no, f"{label}：{cloze}"))
    return issues


def _check_counts(row_counts: Dict[str, int], total: int, expected: Dict[str, int]) -> List[Issue]:
    issues = []
    for key in ("quizlet", "audio-only", "phrase"):
        if key in expected and row_counts.get(key, 0) != expected[key]:
            issues.append(Issue(ERROR, CAT_COUNT, "", f"{key}: {row_counts.get(key, 0)} 件（期待値 {expected[key]}）"))
    if "total" in expected and total != expected["total"]:
        issues.append(Issue(ERROR, CAT_COUNT, "", f"統合後の総件数: {total} 件（期待値 {expected['total']}）"))
    return issues


def _ordered(item: Dict[str, Any]) -> Dict[str, Any]:
    out = {k: item[k] for k in ITEM_KEY_ORDER if k in item}
    if "example" in out:
        ex = out["example"]
        out["example"] = {k: ex[k] for k in EXAMPLE_KEY_ORDER if k in ex}
    return out


_NO_SORT = re.compile(r"(\d+)([a-z]*)")


def no_sort_key(no: str):
    m = _NO_SORT.fullmatch(no)
    return (int(m.group(1)), m.group(2)) if m else (10**9, no)
