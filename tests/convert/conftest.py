"""テスト用の架空データ。元データの内容は使わない。"""
from __future__ import annotations

from typing import Dict, List

import pandas as pd
import pytest

from scripts.convert.schema import EXPECTED_COLUMNS


def make_row(
    no: str,
    word: str = "",
    meaning: str = "",
    example: str = "",
    ja: str = "",
    synonyms: str = "",
    antonyms: str = "",
    word_source: str = "Quizlet",
    example_source: str = "",
    relation_source: str = "",
    range_: str = "1〜1000",
) -> Dict[str, str]:
    if example and not example_source:
        example_source = "作成"
    return {
        "行番号": "",
        "範囲": range_,
        "番号": no,
        "単語": word,
        "意味": meaning,
        "例文": example,
        "例文の日本語訳": ja,
        "類義語": synonyms,
        "対義語": antonyms,
        "語の出典": word_source,
        "例文の出典": example_source,
        "類義語・対義語の出典": relation_source,
    }


def phrase_row(no: str, en: str, ja: str) -> Dict[str, str]:
    return make_row(no, example=en, ja=ja, word_source="", example_source="音声", range_="3501〜3600")


def to_df(rows: List[Dict[str, str]]) -> pd.DataFrame:
    for i, r in enumerate(rows, start=1):
        r["行番号"] = str(i)
    return pd.DataFrame(rows, columns=EXPECTED_COLUMNS)


@pytest.fixture
def sample_rows() -> List[Dict[str, str]]:
    return [
        make_row(
            "1",
            "zorble",
            "【名】ぞるぶる；架空の生き物",
            example="The zorble slept all day.",
            synonyms="blorp, snarf",
            relation_source="Quizlet",
        ),
        make_row(
            "2",
            "secure",
            "【動】を固定する；【形】しっかりした；揺るがない",
            example="They secured the funding.",
            antonyms="insecure",
            relation_source="追加（WordNetで選定）",
        ),
        make_row(
            "2a",
            "flimp",
            "【形】ふにゃふにゃの",
            word_source="音声のみ",
            example="… flimp …",
            example_source="音声（一部欠落）",
        ),
        make_row("3", "usher in", "【動】の到来を告げる", example="The treaty ushered in an era of peace."),
        make_row("4", "zorble", "【名】ぞるぶる；架空の生き物"),
        phrase_row("3501", "It goes without saying that tests matter.", "テストが大事なのは言うまでもない。"),
    ]
