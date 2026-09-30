"""E2E Scenario 1–3: full passenger journey and reject paths."""

from tests.conftest import sample_image


def _post_image(client, endpoint, person, data, index=0):
    img = sample_image(person, index)
    with img.open("rb") as f:
        return client.post(
            endpoint,
            data=data,
            files={"image": (img.name, f, "image/jpeg")},
        )


def test_complete_passenger_flow(client, mock_person):
    """Enroll → Entry → Security → Boarding → Boarded successfully."""
    person = "Margot Robbie"
    flight = "QF12"
    mock_person["set"](person)

    enroll = _post_image(
        client,
        "/enroll",
        person,
        {"name": person, "passport": "P-MR-E2E", "flight_id": flight},
        0,
    )
    assert enroll.status_code == 200

    entry = _post_image(client, "/verify", person, {"camera_id": "CAM-ENTRY"}, 1)
    assert entry.json()["result"] == "MATCH"

    security = _post_image(client, "/security", person, {"camera_id": "CAM-SEC"}, 2)
    assert security.json()["result"] == "GATE_OPEN"

    boarding = _post_image(
        client,
        "/boarding",
        person,
        {"camera_id": "CAM-BOARD", "expected_flight_id": flight},
        3,
    )
    assert boarding.json()["result"] == "GATE_OPEN"
    assert boarding.json()["passenger"]["boarding_status"] == "BOARDED"

    logs = client.get("/logs").json()
    checkpoints = {row["checkpoint"] for row in logs}
    assert {"ENTRY", "SECURITY", "BOARDING"}.issubset(checkpoints)


def test_unknown_passenger_security_reject(client, mock_person):
    """Unknown face → recognition failed → security reject."""
    mock_person["set"]("Billie Eilish")
    res = _post_image(client, "/security", "Billie Eilish", {"camera_id": "CAM-SEC"}, 0)
    assert res.json()["result"] == "NO_MATCH"


def test_wrong_flight_boarding_reject(client, mock_person):
    """Enrolled passenger on wrong gate flight → boarding reject."""
    person = "Zac Efron"
    mock_person["set"](person)
    assert _post_image(
        client,
        "/enroll",
        person,
        {"name": person, "passport": "P-ZE-1", "flight_id": "UA100"},
        0,
    ).status_code == 200
    assert _post_image(client, "/security", person, {"camera_id": "CAM-SEC"}, 1).json()[
        "result"
    ] == "GATE_OPEN"

    boarding = _post_image(
        client,
        "/boarding",
        person,
        {"camera_id": "CAM-BOARD", "expected_flight_id": "UA999"},
        2,
    )
    assert boarding.json()["result"] == "FLIGHT_MISMATCH"
