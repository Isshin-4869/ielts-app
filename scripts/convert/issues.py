"""検証で見つかった問題（エラー・警告）。"""
from __future__ import annotations

from dataclasses import dataclass

ERROR = "error"
WARNING = "warning"

# レポートでの見出し（表示順）
CAT_ROW_TYPE = "行の種類を判定できない"
CAT_NO = "番号の重複・欠け"
CAT_COUNT = "件数が期待値と違う"
CAT_REQUIRED = "必須項目の欠け"
CAT_HEADWORD_CHARS = "見出し語の文字"
CAT_MEANING = "意味の書式"
CAT_RELATION = "類義語・対義語の出典"
CAT_CLOZE_INVALID = "穴埋め位置が例文と合わない"
CAT_OVERRIDES = "overrides.json"
CAT_CLOZE_MISSING = "穴埋め位置が見つからない例文"
CAT_INCOMPLETE = "「一部欠落」の例文"
CAT_MERGED = "統合した重複語"
CAT_MULTI_SENTENCE = "2文以上に見える例文"

CATEGORY_ORDER = [
    CAT_ROW_TYPE,
    CAT_NO,
    CAT_COUNT,
    CAT_REQUIRED,
    CAT_HEADWORD_CHARS,
    CAT_MEANING,
    CAT_RELATION,
    CAT_CLOZE_INVALID,
    CAT_OVERRIDES,
    CAT_CLOZE_MISSING,
    CAT_INCOMPLETE,
    CAT_MERGED,
    CAT_MULTI_SENTENCE,
]


@dataclass(frozen=True)
class Issue:
    level: str  # ERROR / WARNING
    category: str
    no: str  # 元データの番号（該当なしは ""）
    message: str
