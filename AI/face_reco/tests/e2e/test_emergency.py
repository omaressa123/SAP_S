"""E2E Scenario 5: Emergency smoke → alert → dashboard updated."""


def test_emergency_smoke_updates_dashboard(client):
    res = client.post(
        "/emergency/smoke",
        json={"zone": "Terminal 1 - Gate A", "message": "Smoke detected near Gate A"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["alert_type"] == "SMOKE"
    assert body["active"] is True

    alerts = client.get("/emergency/alerts")
    assert alerts.status_code == 200
    rows = alerts.json()
    assert len(rows) >= 1
    assert any(a["zone"] == "Terminal 1 - Gate A" for a in rows)
