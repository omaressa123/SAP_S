from tests.conftest import sample_image


def test_enroll_api_persists_passenger_and_faiss(client, mock_person, tmp_faiss):
    mock_person["set"]("Brad Pitt")
    img = sample_image("Brad Pitt", 0)

    with img.open("rb") as f:
        res = client.post(
            "/enroll",
            data={
                "name": "Brad Pitt",
                "passport": "P-BRAD-ENROLL",
                "flight_id": "SV123",
            },
            files={"image": (img.name, f, "image/jpeg")},
        )

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["name"] == "Brad Pitt"
    assert body["embedding_id"] is not None
    assert tmp_faiss.index.ntotal >= 1

    listed = client.get("/passengers")
    assert listed.status_code == 200
    assert any(p["passport"] == "P-BRAD-ENROLL" for p in listed.json())
