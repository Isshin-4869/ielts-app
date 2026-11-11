"""1行ぶんのセルを解釈する関数（行の種類、意味、類義語・対義語、ID）。"""
from __future__ import annotations

import re
from typing import List, Optional, Tuple

from .schema import (
    INCOMPLETE_MARK,
    KNOWN_POS,
    PHRASE_RANGE_PATTERN,
    RELATION_SOURCES,
    WORD_SOURCE_AUDIO_ONLY,
    WORD_SOURCE_QUIZLET,
    ID_PREFIX,
    Meaning,
)

_NO_NUMERIC = re.compile(r"\d+")
_NO_AUDIO = re.compile(r"\d+[a-z]+")
_NO_PARTS = re.compile(r"(\d+)([a-z]*)")
_POS_TAG = re.compile(r"【([^】]*)】")
_MEANING_SEP = "；"
_JAPANESE_OR_FULLWIDTH = re.compile(r"[　-ヿ㐀-鿿＀-￯]")
_NON_ASCII = re.compile(r"[^\x00-\x7f]")
_MULTI_SENTENCE = re.compile(r"[.!?][\"”’']?\s+[A-Z]")


def classify_row(no: str, range_: str, word: str, meaning: str, word_source: str) -> Optional[str]:
    """行の種類を返す（'quizlet' / 'audio-only' / 'phrase'）。どれにも当たらなければ None。"""
    if re.fullmatch(PHRASE_RANGE_PATTERN, range_):
        if word == "" and meaning == "":
            return "phrase"
        return None
    if _NO_NUMERIC.fullmatch(no) and word_source == WORD_SOURCE_QUIZLET:
        return "quizlet"
    if _NO_AUDIO.fullmatch(no) and word_source == WORD_SOURCE_AUDIO_ONLY:
        return "audio-only"
    return None


def make_id(no: str) -> str:
    """番号から安定IDを作る。'1' → 'ielts-0001'、'10a' → 'ielts-0010a'。"""
    m = _NO_PARTS.fullmatch(no)
    if not m:
        raise ValueError(f"番号の形式が想定外です: {no!r}")
    return f"{ID_PREFIX}{int(m.group(1)):04d}{m.group(2)}"


def parse_meanings(raw: str) -> Tuple[List[Meaning], List[str]]:
    """`【動】を固定する；【形】しっかりした；揺るがない` のような意味を品詞ごとに分割する。

    戻り値は (meanings, 問題の一覧)。問題が1つでもあれば検証エラーにする。
    """
    problems: List[str] = []
    raw = raw.strip()
    if raw == "":
        return [], ["意味が空"]
    if not raw.startswith("【"):
        problems.append("品詞タグで始まっていない")

    meanings: List[Meaning] = []
    tags = list(_POS_TAG.finditer(raw))
    if not tags:
        problems.append("品詞タグがない")
        return meanings, problems

    for i, tag in enumerate(tags):
        pos = tag.group(1).strip()
        if pos not in KNOWN_POS:
            problems.append(f"未知の品詞タグ【{pos}】")
        end = tags[i + 1].start() if i + 1 < len(tags) else len(raw)
        body = raw[tag.end():end]
        texts = [t.strip() for t in body.split(_MEANING_SEP)]
        texts = [t for t in texts if t != ""]
        if not texts:
            problems.append(f"【{pos}】の後に意味がない")
        for t in texts:
            meanings.append({"pos": pos, "text": t})
    return meanings, problems


def split_relations(raw: str) -> List[str]:
    """類義語・対義語を `,` で分割する。空なら空配列。"""
    return [w.strip() for w in raw.split(",") if w.strip() != ""]


def parse_relation_source(raw: str) -> Tuple[Optional[str], Optional[str]]:
    """(relationSource, 問題) を返す。空なら (None, None)。"""
    raw = raw.strip()
    if raw == "":
        return None, None
    if raw in RELATION_SOURCES:
        return RELATION_SOURCES[raw], None
    return None, f"未知の類義語・対義語の出典: {raw}"


def is_incomplete(example_source: str) -> bool:
    return INCOMPLETE_MARK in example_source


def headword_has_japanese(headword: str) -> bool:
    """見出し語に日本語・全角記号が入っているか。"""
    return bool(_JAPANESE_OR_FULLWIDTH.search(headword))


def headword_has_non_ascii(headword: str) -> bool:
    return bool(_NON_ASCII.search(headword))


def has_multiple_sentences(sentence: str) -> bool:
    """例文が2文以上に見えるか（文末記号＋空白＋大文字で判定する目安）。"""
    return bool(_MULTI_SENTENCE.search(sentence))
