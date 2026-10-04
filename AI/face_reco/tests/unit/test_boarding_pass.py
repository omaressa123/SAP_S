from app.services.boarding_pass import (
    issue_boarding_pass,
    render_barcode_png,
    save_boarding_pass_files,
)


def test_issue_boarding_pass_code128(tmp_path):
    bp = issue_boarding_pass(
        passenger_name="Anna Maria Eriksson",
        passport_number="L898902C3",
        flight_id="GV101",
    )
    assert bp.pass_id.startswith("BP-GV101-")
    assert bp.seat
    assert bp.status == "READY_FOR_BAGGAGE_DROP"
    png = render_barcode_png(bp.barcode_value)
    assert png[:8] == b"\x89PNG\r\n\x1a\n"

    files = save_boarding_pass_files(bp, tmp_path)
    html = (tmp_path / f"{bp.pass_id}.html").read_text(encoding="utf-8")
    assert "BOARDING PASS" in html
    assert "Code128" not in html  # visual pass, not marketing the lib
    assert bp.flight_id in html
    assert files["barcode_png"].endswith(".png")
