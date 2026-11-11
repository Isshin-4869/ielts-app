import json

import pandas as pd
import pytest

from scripts.convert.__main__ import main
from scripts.convert.core import ColumnError, convert
from scripts.convert.issues import (
    CAT_CLOZE_INVALID,
    CAT_CLOZE_MISSING,
    CAT_COUNT,
    CAT_HEADWORD_CHARS,
    CAT_INCOMPLETE,
    CAT_MEANING,
    CAT_MERGED,
    CAT_NO,
    CAT_OVERRIDES,
    CAT_REQUIRED,
    CAT_ROW_TYPE,
)
from scripts.convert.schema import ITEM_KEY_ORDER

from .conftest import make_row, phrase_row, to_df


def _by_id(result):
    return {i["id"]: i for i in result.items}


def _cats(result, level="error"):
    issues = result.errors if level == "error" else result.warnings
    return [i.category for i in issues]


class TestConvert:
    def test_basic(self, sample_rows):
        r = convert(to_df(sample_rows))
        assert r.errors == []
        assert r.row_counts == {"quizlet": 4, "audio-only": 1, "phrase": 1}
        assert len(r.items) == 5  # zorble の重複を統合

        items = _by_id(r)
        assert list(items) == ["ielts-0001", "ielts-0002", "ielts-0002a", "ielts-0003", "ielts-3501"]

        z = items["ielts-0001"]
        assert z["kind"] == "word" and z["origin"] == "quizlet"
        assert z["meanings"][0] == {"pos": "名", "text": "ぞるぶる"}
        assert z["meaningRaw"] == "【名】ぞるぶる；架空の生き物"
        assert z["synonyms"] == ["blorp", "snarf"]
        assert z["antonyms"] == []
        assert z["relationSource"] == "quizlet"
        assert z["example"]["cloze"] == {"start": 4, "length": 6, "form": "zorble"}

        s = items["ielts-0002"]
        assert [m["pos"] for m in s["meanings"]] == ["動", "形", "形"]
        assert s["relationSource"] == "wordnet"
        assert s["example"]["cloze"]["form"] == "secured"

        assert items["ielts-0003"]["example"]["cloze"]["form"] == "ushered in"

    def test_audio_only_and_incomplete(self, sample_rows):
        f = _by_id(convert(to_df(sample_rows)))["ielts-0002a"]
        assert f["origin"] == "audio-only"
        assert f["example"]["incomplete"] is True
        assert "cloze" not in f["example"]  # 一部欠落は穴埋めに使わない

    def test_phrase(self, sample_rows):
        p = _by_id(convert(to_df(sample_rows)))["ielts-3501"]
        assert p["kind"] == "phrase" and p["origin"] == "phrase"
        assert "headword" not in p and "meanings" not in p
        assert p["example"] == {
            "en": "It goes without saying that tests matter.",
            "ja": "テストが大事なのは言うまでもない。",
            "source": "音声",
            "incomplete": False,
        }
        assert p["synonyms"] == [] and p["antonyms"] == []

    def test_order_and_block(self, sample_rows):
        r = convert(to_df(sample_rows))
        assert [i["order"] for i in r.items] == [0, 1, 2, 3, 4]
        assert all(i["block"] == 0 for i in r.items)

    def test_block_every_100(self):
        rows = [make_row(str(n), f"word{n}x", "【名】なにか") for n in range(1, 206)]
        r = convert(to_df(rows))
        assert [r.items[k]["block"] for k in (0, 99, 100, 199, 200, 204)] == [0, 0, 1, 1, 2, 2]

    def test_key_order(self, sample_rows):
        for item in convert(to_df(sample_rows)).items:
            keys = list(item)
            assert keys == [k for k in ITEM_KEY_ORDER if k in item]

    def test_json_has_no_nulls(self, sample_rows):
        text = json.dumps(convert(to_df(sample_rows)).items, ensure_ascii=False)
        assert "null" not in text


class TestMerge:
    def test_duplicate_merged(self, sample_rows):
        r = convert(to_df(sample_rows))
        z = _by_id(r)["ielts-0001"]
        assert z["sourceNos"] == ["1", "4"]
        assert z["order"] == 0
        assert "ielts-0004" not in _by_id(r)
        assert _cats(r, "warning").count(CAT_MERGED) == 1

    def test_case_insensitive_and_fills_example(self):
        rows = [
            make_row("1", "Zorble", "【名】ぞるぶる"),
            make_row("2", "zorble", "【名】ぞるぶる", example="A zorble ran.", synonyms="blorp", relation_source="Quizlet"),
        ]
        r = convert(to_df(rows))
        assert len(r.items) == 1
        z = r.items[0]
        assert z["sourceNos"] == ["1", "2"]
        assert z["example"]["en"] == "A zorble ran."
        assert z["synonyms"] == ["blorp"] and z["relationSource"] == "quizlet"

    def test_different_meanings_noted(self):
        rows = [make_row("1", "zorble", "【名】ぞるぶる"), make_row("2", "zorble", "【動】ぞるぶる")]
        msg = [i.message for i in convert(to_df(rows)).warnings if i.category == CAT_MERGED][0]
        assert "意味が違う" in msg


class TestValidation:
    def test_wrong_columns(self, sample_rows):
        df = to_df(sample_rows).rename(columns={"例文": "例"})
        with pytest.raises(ColumnError):
            convert(df)

    def test_unclassified_row(self):
        r = convert(to_df([make_row("5", "zorble", "【名】x", word_source="不明")]))
        assert CAT_ROW_TYPE in _cats(r)

    def test_duplicate_number(self):
        r = convert(to_df([make_row("5", "aa", "【名】x"), make_row("5", "bb", "【名】y")]))
        assert CAT_NO in _cats(r)

    def test_empty_meaning(self):
        r = convert(to_df([make_row("5", "zorble", "")]))
        assert CAT_REQUIRED in _cats(r)

    def test_phrase_missing_ja(self):
        r = convert(to_df([phrase_row("3501", "Hello there.", "")]))
        assert CAT_REQUIRED in _cats(r)

    def test_bad_meaning(self):
        r = convert(to_df([make_row("5", "zorble", "【感】おお")]))
        assert CAT_MEANING in _cats(r)

    def test_japanese_in_headword(self):
        r = convert(to_df([make_row("5", "zorble（名）", "【名】x")]))
        assert CAT_HEADWORD_CHARS in _cats(r)

    def test_cloze_missing_is_warning(self):
        r = convert(to_df([make_row("5", "ox", "【名】うし", example="Two oxen pulled the cart.")]))
        assert r.errors == []
        assert CAT_CLOZE_MISSING in _cats(r, "warning")

    def test_incomplete_listed(self, sample_rows):
        assert CAT_INCOMPLETE in _cats(convert(to_df(sample_rows)), "warning")

    def test_expected_counts(self, sample_rows):
        ok = {"quizlet": 4, "audio-only": 1, "phrase": 1, "total": 5}
        assert convert(to_df(sample_rows), expected_counts=ok).errors == []
        bad = dict(ok, phrase=100)
        assert CAT_COUNT in _cats(convert(to_df(sample_rows), expected_counts=bad))


class TestOverrides:
    def test_cloze_by_string(self):
        rows = [make_row("5", "ox", "【名】うし", example="Two oxen pulled the cart.")]
        r = convert(to_df(rows), overrides={"5": {"example": {"cloze": "oxen"}}})
        assert r.errors == []
        assert r.items[0]["example"]["cloze"] == {"start": 4, "length": 4, "form": "oxen"}
        assert CAT_CLOZE_MISSING not in _cats(r, "warning")
        assert r.overrides_applied

    def test_cloze_string_not_in_sentence(self):
        rows = [make_row("5", "ox", "【名】うし", example="Two oxen pulled the cart.")]
        r = convert(to_df(rows), overrides={"5": {"example": {"cloze": "cows"}}})
        assert CAT_OVERRIDES in _cats(r)

    def test_bad_cloze_object_is_error(self):
        rows = [make_row("5", "ox", "【名】うし", example="Two oxen pulled the cart.")]
        bad = {"start": 0, "length": 4, "form": "oxen"}
        r = convert(to_df(rows), overrides={"5": {"example": {"cloze": bad}}})
        assert CAT_CLOZE_INVALID in _cats(r)

    def test_meaning_raw_reparsed(self):
        r = convert(to_df([make_row("5", "zorble", "【感】おお")]), overrides={"5": {"meaningRaw": "【名】ぞるぶる；生き物"}})
        assert r.errors == []
        assert r.items[0]["meanings"] == [{"pos": "名", "text": "ぞるぶる"}, {"pos": "名", "text": "生き物"}]

    def test_example_rewrite_recomputes_cloze(self, sample_rows):
        r = convert(to_df(sample_rows), overrides={"2": {"example": {"en": "Secure your bag."}}})
        ex = _by_id(r)["ielts-0002"]["example"]
        assert ex["en"] == "Secure your bag."
        assert ex["source"] == "作成"  # 書いていないキーは残る
        assert ex["cloze"]["form"] == "Secure"

    def test_null_removes_field(self, sample_rows):
        r = convert(to_df(sample_rows), overrides={"1": {"relationSource": None, "synonyms": []}})
        z = _by_id(r)["ielts-0001"]
        assert "relationSource" not in z and z["synonyms"] == []

    def test_merged_item_by_second_number(self, sample_rows):
        r = convert(to_df(sample_rows), overrides={"4": {"synonyms": ["glorp"]}})
        assert _by_id(r)["ielts-0001"]["synonyms"] == ["glorp"]

    def test_unknown_number(self, sample_rows):
        assert CAT_OVERRIDES in _cats(convert(to_df(sample_rows), overrides={"9999": {"synonyms": []}}))

    def test_protected_field(self, sample_rows):
        assert CAT_OVERRIDES in _cats(convert(to_df(sample_rows), overrides={"1": {"id": "x"}}))

    def test_comment_keys_ignored(self, sample_rows):
        r = convert(to_df(sample_rows), overrides={"_comment": "メモ"})
        assert r.errors == [] and r.overrides_applied == []


class TestCli:
    def _write_xlsx(self, path, rows):
        to_df(rows).to_excel(path, index=False, sheet_name="全項目")

    def test_writes_outputs(self, tmp_path, sample_rows):
        xlsx = tmp_path / "in.xlsx"
        self._write_xlsx(xlsx, sample_rows)
        ov = tmp_path / "overrides.json"
        ov.write_text('{"_comment": "x"}', encoding="utf-8")
        out = tmp_path / "out"
        code = main([str(xlsx), "--out", str(out), "--overrides", str(ov), "--no-count-check"])
        assert code == 0
        items = json.loads((out / "items.json").read_text(encoding="utf-8"))
        assert len(items) == 5
        report = (out / "report.md").read_text(encoding="utf-8")
        assert "エラー 0 件" in report
        assert "統合した重複語" in report

    def test_count_check_fails_on_fixture(self, tmp_path, sample_rows):
        xlsx = tmp_path / "in.xlsx"
        self._write_xlsx(xlsx, sample_rows)
        out = tmp_path / "out"
        out.mkdir()
        (out / "items.json").write_text("[]", encoding="utf-8")
        code = main([str(xlsx), "--out", str(out), "--overrides", str(tmp_path / "none.json")])
        assert code == 1
        assert not (out / "items.json").exists()  # エラー時は古い結果も残さない
        assert "件数が期待値と違う" in (out / "report.md").read_text(encoding="utf-8")

    def test_wrong_columns_exit_1(self, tmp_path, sample_rows):
        xlsx = tmp_path / "in.xlsx"
        pd.DataFrame(sample_rows).drop(columns=["例文"]).to_excel(xlsx, index=False)
        assert main([str(xlsx), "--out", str(tmp_path / "out")]) == 1
