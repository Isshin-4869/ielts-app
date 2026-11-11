import pytest

from scripts.convert.parse import (
    classify_row,
    has_multiple_sentences,
    headword_has_japanese,
    is_incomplete,
    make_id,
    parse_meanings,
    parse_relation_source,
    split_relations,
)


class TestClassifyRow:
    def test_main_word(self):
        assert classify_row("12", "1〜1000", "zorble", "【名】x", "Quizlet") == "quizlet"

    def test_audio_only(self):
        assert classify_row("10a", "1〜1000", "flimp", "【形】x", "音声のみ") == "audio-only"
        assert classify_row("19bc", "1〜1000", "flimp", "【形】x", "音声のみ") == "audio-only"

    def test_phrase(self):
        assert classify_row("3501", "3501〜3600", "", "", "") == "phrase"

    def test_phrase_range_with_fullwidth_tilde(self):
        assert classify_row("3501", "3501～3600", "", "", "") == "phrase"

    def test_phrase_range_but_has_word(self):
        assert classify_row("3501", "3501〜3600", "zorble", "", "") is None

    def test_number_and_source_mismatch(self):
        assert classify_row("10a", "1〜1000", "flimp", "【形】x", "Quizlet") is None
        assert classify_row("10", "1〜1000", "flimp", "【形】x", "音声のみ") is None

    def test_unknown_source(self):
        assert classify_row("10", "1〜1000", "flimp", "【形】x", "") is None


class TestMakeId:
    @pytest.mark.parametrize(
        "no, expected",
        [("1", "ielts-0001"), ("10a", "ielts-0010a"), ("999", "ielts-0999"), ("3501", "ielts-3501")],
    )
    def test_ids(self, no, expected):
        assert make_id(no) == expected

    def test_bad_number(self):
        with pytest.raises(ValueError):
            make_id("A1")


class TestParseMeanings:
    def test_single_pos(self):
        meanings, problems = parse_meanings("【名】ぞるぶる；架空の生き物")
        assert meanings == [{"pos": "名", "text": "ぞるぶる"}, {"pos": "名", "text": "架空の生き物"}]
        assert problems == []

    def test_multiple_pos(self):
        meanings, problems = parse_meanings("【動】を固定する；【形】しっかりした；揺るがない")
        assert meanings == [
            {"pos": "動", "text": "を固定する"},
            {"pos": "形", "text": "しっかりした"},
            {"pos": "形", "text": "揺るがない"},
        ]
        assert problems == []

    def test_compound_pos(self):
        meanings, problems = parse_meanings("【前・副】の上に")
        assert meanings == [{"pos": "前・副", "text": "の上に"}]
        assert problems == []

    def test_keeps_japanese_comma_inside(self):
        meanings, _ = parse_meanings("【名】あれ、これ；それ")
        assert [m["text"] for m in meanings] == ["あれ、これ", "それ"]

    def test_unknown_pos(self):
        _, problems = parse_meanings("【感】おお")
        assert any("未知の品詞タグ" in p for p in problems)

    def test_not_starting_with_tag(self):
        _, problems = parse_meanings("ぞるぶる【名】生き物")
        assert any("品詞タグで始まっていない" in p for p in problems)

    def test_no_tag(self):
        meanings, problems = parse_meanings("ぞるぶる")
        assert meanings == []
        assert problems

    def test_empty_after_tag(self):
        _, problems = parse_meanings("【名】；【動】走る")
        assert any("意味がない" in p for p in problems)

    def test_empty(self):
        assert parse_meanings("") == ([], ["意味が空"])


class TestRelations:
    def test_split(self):
        assert split_relations("blorp, snarf, big deal") == ["blorp", "snarf", "big deal"]

    def test_split_tolerates_spacing(self):
        assert split_relations(" blorp ,snarf,  ") == ["blorp", "snarf"]

    def test_empty(self):
        assert split_relations("") == []

    def test_source(self):
        assert parse_relation_source("Quizlet") == ("quizlet", None)
        assert parse_relation_source("追加（WordNetで選定）") == ("wordnet", None)
        assert parse_relation_source("") == (None, None)
        src, problem = parse_relation_source("手入力")
        assert src is None and problem


def test_is_incomplete():
    assert is_incomplete("音声（一部欠落）")
    assert is_incomplete("音声（修正・一部欠落）")
    assert not is_incomplete("音声（聞き取り誤りを修正）")
    assert not is_incomplete("作成")


def test_headword_japanese():
    assert headword_has_japanese("zorble（名）")
    assert headword_has_japanese("ｚｏｒｂｌｅ")
    assert not headword_has_japanese("well-being")


def test_multiple_sentences():
    assert has_multiple_sentences("It was late. It was wrong.")
    assert not has_multiple_sentences("It was late, and wrong.")
