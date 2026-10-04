from tests.conftest import sample_image


def _enroll(client, mock_person, person, passport, flight="SV123"):
    mock_person["set"](person)
    img = sample_image(person, 0)
    with img.open("rb") as f:
        res = client.post(
            "/enroll",
            data={"name": person, "passport": passport, "flight_id": flight},
            files={"image": (img.name, f, "image/jpeg")},
        )
    assert res.status_code == 200
    return res.json()


def _security(client, mock_person, person):
    mock_person["set"](person)
    img = sample_image(person, 1)
    with img.open("rb") as f:
        return client.post(
            "/security",
            data={"camera_id": "CAM-SEC"},
            files={"image": (img.name, f, "image/jpeg")},
        )


def _boarding(client, mock_person, person, flight, image_index=2):
    mock_person["set"](person)
    img = sample_image(person, image_index)
    with img.open("rb") as f:
        return client.post(
            "/boarding",
            data={"camera_id": "CAM-BOARD", "expected_flight_id": flight},
            files={"image": (img.name, f, "image/jpeg")},
        )


def test_boarding_opens_when_flight_ok_and_not_boarded(client, mock_person):
    _enroll(client, mock_person, "Robert Downey Jr", "P-RDJ-1", flight="SV500")
    assert _security(client, mock_person, "Robert Downey Jr").json()["result"] == "GATE_OPEN"
    res = _boarding(client, mock_person, "Robert Downey Jr", "SV500")
    assert res.status_code == 200
    assert res.json()["result"] == "GATE_OPEN"
    assert res.json()["passenger"]["boarding_status"] == "BOARDED"


def test_boarding_rejects_already_boarded(client, mock_person):
    _enroll(client, mock_person, "Robert Downey Jr", "P-RDJ-2", flight="SV500")
    assert _security(client, mock_person, "Robert Downey Jr").json()["result"] == "GATE_OPEN"
    assert _boarding(client, mock_person, "Robert Downey Jr", "SV500", 2).json()["result"] == "GATE_OPEN"
    second = _boarding(client, mock_person, "Robert Downey Jr", "SV500", 3)
    assert second.json()["result"] == "GATE_DENIED"
    assert "already boarded" in second.json()["message"].lower()
