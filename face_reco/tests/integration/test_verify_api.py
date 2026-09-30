from tests.conftest import sample_image


def _enroll(client, mock_person, person: str, passport: str, flight: str = "SV123"):
    mock_person["set"](person)
    img = sample_image(person, 0)
    with img.open("rb") as f:
        res = client.post(
            "/enroll",
            data={"name": person, "passport": passport, "flight_id": flight},
            files={"image": (img.name, f, "image/jpeg")},
        )
    assert res.status_code == 200, res.text
    return res.json()


def test_verify_api_pipeline(client, mock_person):
    _enroll(client, mock_person, "Hugh Jackman", "P-HJ-1")
    mock_person["set"]("Hugh Jackman")
    img = sample_image("Hugh Jackman", 1)
    with img.open("rb") as f:
        res = client.post(
            "/verify",
            data={"camera_id": "CAM-ENTRY"},
            files={"image": (img.name, f, "image/jpeg")},
        )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["result"] == "MATCH"
    assert body["passenger"]["name"] == "Hugh Jackman"
    assert body["similarity"] is not None
