import pytest

from scripts.convert.cloze import find_cloze, locate_form, regular_inflections


def _form(sentence, headword):
    c = find_cloze(sentence, headword)
    if c is None:
        return None
    assert sentence[c["start"]:c["start"] + c["length"]] == c["form"]
    return c["form"]


class TestExact:
    def test_same_form(self):
        assert find_cloze("We need to secure it.", "secure") == {"start": 11, "length": 6, "form": "secure"}

    def test_ignores_case_and_keeps_original_form(self):
        assert _form("Secure the area first.", "secure") == "Secure"

    def test_word_boundary(self):
        # "art" は "start" の中ではなく、単独の art に一致する
        assert find_cloze("Start with art.", "art")["start"] == 11

    def test_exact_preferred_over_earlier_inflection(self):
        assert _form("He secured it, and now we secure it.", "secure") == "secure"

    def test_multiword_exact(self):
        assert _form("A traffic jam blocked the road.", "traffic jam") == "traffic jam"


class TestRegular:
    @pytest.mark.parametrize(
        "sentence, headword, expected",
        [
            ("They organised a meeting.", "organise", "organised"),  # -d
            ("Prices are rising.", "rise", "rising"),  # e の脱落
            ("The frog leaped over the log.", "leap", "leaped"),  # lemminflect は leapt しか作らない
            ("She enrolled at the zorble academy.", "enrol", "enrolled"),  # 子音を重ねる（英式）
            ("Doctors compared three regimens.", "regimen", "regimens"),
            ("She studied hard.", "study", "studied"),  # y → ied
            ("Several tragedies occurred.", "tragedy", "tragedies"),  # y → ies
            ("Two zorbles appeared.", "zorble", "zorbles"),  # 辞書にない語
        ],
    )
    def test_regular(self, sentence, headword, expected):
        assert _form(sentence, headword) == expected


class TestIrregular:
    @pytest.mark.parametrize(
        "sentence, headword, expected",
        [
            ("She undertook the task.", "undertake", "undertook"),
            ("A bee stung him.", "sting", "stung"),
            ("The sweater shrank in the wash.", "shrink", "shrank"),
            ("Craftsmen built the hall.", "craftsman", "Craftsmen"),
            ("Such phenomena are rare.", "phenomenon", "phenomena"),
        ],
    )
    def test_irregular(self, sentence, headword, expected):
        assert _form(sentence, headword) == expected


class TestMultiword:
    def test_inflect_first_word(self):
        assert _form("The new mayor ushered in sweeping reforms.", "usher in") == "ushered in"

    def test_inflect_last_word(self):
        assert _form("We saw two humpback whales.", "humpback whale") == "humpback whales"


class TestHyphen:
    def test_headword_without_hyphen(self):
        assert _form("The clean-up took a week.", "cleanup") == "clean-up"

    def test_headword_with_hyphen(self):
        assert _form("Their wellbeing matters.", "well-being") == "wellbeing"


class TestNotFound:
    def test_prefix_headword(self):
        assert find_cloze("This pseudoscience fooled nobody.", "pseudo-") is None

    def test_missing(self):
        assert find_cloze("Two oxen pulled the cart.", "ox") is None

    def test_no_partial_word_match(self):
        assert find_cloze("The cart moved.", "art") is None


def test_regular_inflections_include_doubling_both_ways():
    forms = regular_inflections("travel")
    assert {"traveled", "travelled", "traveling", "travelling"} <= forms


def test_locate_form():
    assert locate_form("Two oxen pulled the cart.", "oxen") == {"start": 4, "length": 4, "form": "oxen"}
    assert locate_form("Two oxen pulled the cart.", "cows") is None
