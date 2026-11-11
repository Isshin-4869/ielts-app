"""items.json の型と、元データに関する定数。

TypeScript 側の `app/src/data/types.ts` と対応させる（DESIGN.md 3.2）。
"""
from __future__ import annotations

from typing import List, Literal, TypedDict

# ---- 元データ ----

EXPECTED_COLUMNS: List[str] = [
    "行番号",
    "範囲",
    "番号",
    "単語",
    "意味",
    "例文",
    "例文の日本語訳",
    "類義語",
    "対義語",
    "語の出典",
    "例文の出典",
    "類義語・対義語の出典",
]

# フレーズ行の「範囲」。波ダッシュの字形ゆれ（〜 U+301C / ～ U+FF5E / ~）を許す
PHRASE_RANGE_PATTERN = r"3501[〜～~]3600"

WORD_SOURCE_QUIZLET = "Quizlet"
WORD_SOURCE_AUDIO_ONLY = "音声のみ"

KNOWN_POS = {"名", "動", "形", "副", "前", "接", "代", "助", "接頭", "前・副", "代・形"}

RELATION_SOURCES = {
    "Quizlet": "quizlet",
    "追加（WordNetで選定）": "wordnet",
}

INCOMPLETE_MARK = "一部欠落"

ID_PREFIX = "ielts-"
BLOCK_SIZE = 100

# 実データの期待件数（DESIGN.md 2章・3.4）
EXPECTED_COUNTS = {
    "quizlet": 3500,
    "audio-only": 429,
    "phrase": 100,
    "total": 4028,  # 重複統合後（単語 3,928 ＋ フレーズ 100）
}

# ---- items.json ----

Kind = Literal["word", "phrase"]
Origin = Literal["quizlet", "audio-only", "phrase"]


class Meaning(TypedDict):
    pos: str
    text: str


class Cloze(TypedDict):
    start: int
    length: int
    form: str


class _ExampleRequired(TypedDict):
    en: str
    source: str
    incomplete: bool


class Example(_ExampleRequired, total=False):
    ja: str
    cloze: Cloze


class _ItemRequired(TypedDict):
    id: str
    kind: Kind
    origin: Origin
    sourceNos: List[str]
    order: int
    block: int
    synonyms: List[str]
    antonyms: List[str]


class Item(_ItemRequired, total=False):
    headword: str
    meanings: List[Meaning]
    meaningRaw: str
    relationSource: Literal["quizlet", "wordnet"]
    example: Example


# JSON に書き出すときのキーの順
ITEM_KEY_ORDER = [
    "id",
    "kind",
    "origin",
    "sourceNos",
    "order",
    "block",
    "headword",
    "meanings",
    "meaningRaw",
    "synonyms",
    "antonyms",
    "relationSource",
    "example",
]
EXAMPLE_KEY_ORDER = ["en", "ja", "source", "incomplete", "cloze"]
