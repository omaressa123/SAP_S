from app.services.mrz import mrz_check_digit, parse_td3
from tests.fixtures_mrz import SAMPLE_MRZ, SAMPLE_MRZ_ICAO


def test_parse_sample_passport_mrz():
    data = parse_td3(SAMPLE_MRZ_ICAO)
    assert data.passport_number == "L898902C3"
    assert data.nationality == "UTO"
    assert "ERIKSSON" in data.surname
    assert "ANNA" in data.given_names
    assert data.sex == "F"
    assert data.date_of_birth.startswith("1974-08-12")
    assert data.expiry_date.startswith("2012-04-15")
    assert data.valid_check_digits is True


def test_parse_future_expiry_mrz():
    data = parse_td3(SAMPLE_MRZ)
    assert data.expiry_date.startswith("2032-12-31")
    assert data.valid_check_digits is True


def test_mrz_check_digit():
    assert mrz_check_digit("L898902C3") == "6"


def test_invalid_mrz_raises():
    import pytest

    with pytest.raises(ValueError):
        parse_td3("NOT-A-PASSPORT")
