"""例文の中で見出し語（またはその変化形）の位置を探す（DESIGN.md 3.3 の6）。

探し方：
1. 見出し語そのまま（大文字小文字を無視、単語の区切りで一致）
2. 変化形：lemminflect の全変化形 ＋ 自前の規則変化（-s/-es/-ed/-ing/-er/-est、
   子音を重ねる形・重ねない形の両方）。lemminflect は `leaped` `enrolled`
   `regimens` のような形を作らないため、自前の規則で補う。
   複数語の見出し語は、先頭の語を変化させた形と最後の語を変化させた形の両方を探す
   （`usher in` → `ushered in`、`humpback whale` → `humpback whales`）。
どちらもハイフンの有無は区別しない（`cleanup` ↔ `clean-up`）。
接頭辞の見出し語（`pseudo-`）は探さない。
"""
from __future__ import annotations

import re
from functools import lru_cache
from typing import Iterable, List, Optional, Set

from lemminflect import getAllInflections

from .schema import Cloze

_VOWELS = "aeiou"


def regular_inflections(word: str) -> Set[str]:
    """規則変化の候補を広めに作る。実在しない形が混ざってもよい（例文中で一致したものだけ使う）。"""
    w = word.lower()
    out = {w + "s", w + "es", w + "ed", w + "ing", w + "er", w + "est"}
    if w.endswith("e"):
        out |= {w + "d", w[:-1] + "ing", w + "r", w + "st"}
    if w.endswith("ie"):
        out.add(w[:-2] + "ying")
    if len(w) >= 2 and w.endswith("y") and w[-2] not in _VOWELS:
        stem = w[:-1]
        out |= {stem + "ies", stem + "ied", stem + "ier", stem + "iest"}
    if len(w) >= 2 and w[-1] not in _VOWELS + "wxy" and w[-2] in _VOWELS:
        doubled = w + w[-1]
        out |= {doubled + "ed", doubled + "ing", doubled + "er", doubled + "est"}
    if w.endswith("c"):
        out |= {w + "ked", w + "king"}
    return out


@lru_cache(maxsize=None)
def inflections(word: str) -> frozenset:
    """1語の変化形（元の形は除く）。"""
    forms: Set[str] = set()
    for w in {word, word.lower()}:
        for tup in getAllInflections(w).values():
            forms.update(tup)
    forms |= regular_inflections(word)
    forms.discard(word)
    forms.discard(word.lower())
    return frozenset(forms)


def candidate_forms(headword: str) -> List[str]:
    """見出し語の変化形の候補（見出し語そのものは含まない）。"""
    words = headword.split()
    if not words:
        return []
    if len(words) == 1:
        return sorted(inflections(words[0]))
    first, rest = words[0], words[1:]
    init, last = words[:-1], words[-1]
    cands = {" ".join([f] + rest) for f in inflections(first)}
    cands |= {" ".join(init + [f]) for f in inflections(last)}
    return sorted(cands)


@lru_cache(maxsize=None)
def _pattern(form: str) -> "re.Pattern[str]":
    word_pats = []
    for w in form.split():
        letters = [re.escape(c) for c in w if c != "-"]
        word_pats.append("-?".join(letters))
    body = r"[\s-]+".join(word_pats)
    return re.compile(r"(?<![A-Za-z])" + body + r"(?![A-Za-z])", re.IGNORECASE)


def _search(sentence: str, forms: Iterable[str]) -> Optional[Cloze]:
    best = None  # (start, -length)
    for f in forms:
        m = _pattern(f).search(sentence)
        if m and m.end() > m.start():
            key = (m.start(), -(m.end() - m.start()))
            if best is None or key < best:
                best = key
    if best is None:
        return None
    start, neg_len = best
    length = -neg_len
    return {"start": start, "length": length, "form": sentence[start:start + length]}


def find_cloze(sentence: str, headword: str) -> Optional[Cloze]:
    headword = headword.strip()
    if headword == "" or headword.startswith("-") or headword.endswith("-"):
        return None
    found = _search(sentence, [headword])
    if found:
        return found
    return _search(sentence, candidate_forms(headword))


def locate_form(sentence: str, form: str) -> Optional[Cloze]:
    """overrides で `cloze` を文字列で指定したとき用：例文中でその文字列の位置を探す。"""
    if form == "":
        return None
    return _search(sentence, [form])
