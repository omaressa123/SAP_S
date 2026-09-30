from app.services.similarity import is_match, is_verified


def test_is_verified_above_threshold():
    assert is_verified(0.83, threshold=0.75) is True


def test_is_verified_below_threshold():
    assert is_verified(0.30, threshold=0.40) is False


def test_is_match_uses_default_threshold():
    assert is_match(0.99) is True
    assert is_match(0.10) is False
