from tests.conftest import sample_image


def _enroll(client, mock_person, person, passport, flight="SV123"):
    mock_person["set"](person)
    img = sample_image(person, 0)
    with img.open("rb") as f:
        return client.post(
            "/enroll",
            data={"name": person, "passport": passport, "flight_id": flight},
            files={"image": (img.name, f, "image/jpeg")},
        )


def test_security_right_person_opens(client, mock_person):
    assert _enroll(client, mock_person, "Tom Cruise", "P-TC-SEC").status_code == 200
    mock_person["set"]("Tom Cruise")
    img = sample_image("Tom Cruise", 2)
    with img.open("rb") as f:
        res = client.post(
            "/security",
            data={"camera_id": "CAM-SEC"},
            files={"image": (img.name, f, "image/jpeg")},
        )
    assert res.status_code == 200
    assert res.json()["result"] == "GATE_OPEN"


def test_security_unknown_person_denied(client, mock_person):
    assert _enroll(client, mock_person, "Tom Cruise", "P-TC-SEC2").status_code == 200
    mock_person["set"]("Natalie Portman")  # not enrolled
    img = sample_image("Natalie Portman", 0)
    with img.open("rb") as f:
        res = client.post(
            "/security",
            data={"camera_id": "CAM-SEC"},
            files={"image": (img.name, f, "image/jpeg")},
        )
    assert res.status_code == 200
    assert res.json()["result"] == "NO_MATCH"
