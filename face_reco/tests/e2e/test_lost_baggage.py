"""E2E Scenario 4: Lost bag RFID → database → dashboard location."""


def test_lost_baggage_last_location(client):
    reg = client.post(
        "/baggage/register",
        json={"rfid_tag": "RFID-1001", "passenger_id": None, "location": "CHECKIN"},
    )
    assert reg.status_code == 200
    assert reg.json()["last_location"] == "CHECKIN"

    scan = client.post(
        "/baggage/scan",
        json={"rfid_tag": "RFID-1001", "location": "CAROUSEL-B3"},
    )
    assert scan.status_code == 200
    assert scan.json()["last_location"] == "CAROUSEL-B3"

    found = client.get("/baggage/RFID-1001")
    assert found.status_code == 200
    assert found.json()["last_location"] == "CAROUSEL-B3"
    assert found.json()["status"] == "in_transit"
