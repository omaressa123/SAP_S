"""Professional boarding-pass generation (IATA-style + Code128, not QR-only)."""

from __future__ import annotations

import io
import secrets
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from barcode import Code128
from barcode.writer import ImageWriter


@dataclass
class BoardingPassPayload:
    pass_id: str
    passenger_name: str
    passport_number: str
    flight_id: str
    origin: str
    destination: str
    seat: str
    gate: str
    boarding_group: str
    sequence: int
    issued_at: datetime
    barcode_value: str
    status: str = "READY_FOR_BAGGAGE_DROP"


def _seat_for(passport: str) -> str:
    n = sum(ord(c) for c in passport) % 30 + 1
    row = 10 + (n % 20)
    letter = "ABCDEF"[n % 6]
    return f"{row}{letter}"


def issue_boarding_pass(
    *,
    passenger_name: str,
    passport_number: str,
    flight_id: str,
    origin: str = "CAI",
    destination: str = "DXB",
    gate: str = "A12",
    boarding_group: str = "2",
) -> BoardingPassPayload:
    seq = secrets.randbelow(900) + 100
    pass_id = f"BP-{flight_id}-{seq}"
    issued = datetime.now(timezone.utc)
    # IATA-like Code128 payload (simplified) — scannable by gate readers
    barcode_value = f"M1{passenger_name[:20].upper().replace(' ', '')} {flight_id} {seq} {passport_number}"
    return BoardingPassPayload(
        pass_id=pass_id,
        passenger_name=passenger_name.upper(),
        passport_number=passport_number,
        flight_id=flight_id,
        origin=origin,
        destination=destination,
        seat=_seat_for(passport_number),
        gate=gate,
        boarding_group=boarding_group,
        sequence=seq,
        issued_at=issued,
        barcode_value=barcode_value[:48],
        status="READY_FOR_BAGGAGE_DROP",
    )


def render_barcode_png(barcode_value: str) -> bytes:
    buffer = io.BytesIO()
    Code128(barcode_value, writer=ImageWriter()).write(
        buffer,
        options={
            "module_width": 0.35,
            "module_height": 14,
            "quiet_zone": 2,
            "font_size": 0,
            "text_distance": 1,
            "write_text": False,
        },
    )
    return buffer.getvalue()


def render_boarding_pass_html(payload: BoardingPassPayload, barcode_data_uri: str) -> str:
    issued = payload.issued_at.strftime("%Y-%m-%d %H:%M UTC")
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Boarding Pass {payload.pass_id}</title>
<style>
  @page {{ size: 80mm 200mm; margin: 4mm; }}
  body {{
    font-family: "IBM Plex Mono", "Courier New", monospace;
    background: #f4f6f8;
    color: #111;
    margin: 0;
    padding: 12px;
  }}
  .pass {{
    width: 72mm;
    margin: 0 auto;
    background: #fff;
    border: 1px solid #222;
    padding: 10px 12px 14px;
  }}
  .airline {{ font-size: 13px; font-weight: 700; letter-spacing: 0.08em; }}
  .route {{ font-size: 22px; font-weight: 700; margin: 8px 0 2px; }}
  .muted {{ color: #555; font-size: 10px; }}
  .grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }}
  .label {{ font-size: 9px; color: #666; text-transform: uppercase; letter-spacing: 0.06em; }}
  .value {{ font-size: 14px; font-weight: 700; }}
  .name {{ font-size: 15px; font-weight: 700; margin-top: 10px; border-top: 1px dashed #999; padding-top: 8px; }}
  .barcode {{ text-align: center; margin-top: 12px; }}
  .barcode img {{ width: 100%; max-height: 54px; object-fit: contain; }}
  .status {{
    margin-top: 10px;
    font-size: 10px;
    font-weight: 700;
    background: #111;
    color: #fff;
    text-align: center;
    padding: 6px;
  }}
</style>
</head>
<body>
  <div class="pass">
    <div class="airline">GATEVISION AIR · BOARDING PASS</div>
    <div class="route">{payload.origin} → {payload.destination}</div>
    <div class="muted">Flight {payload.flight_id} · Seq {payload.sequence:03d}</div>
    <div class="name">{payload.passenger_name}</div>
    <div class="muted">Passport {payload.passport_number}</div>
    <div class="grid">
      <div><div class="label">Gate</div><div class="value">{payload.gate}</div></div>
      <div><div class="label">Seat</div><div class="value">{payload.seat}</div></div>
      <div><div class="label">Group</div><div class="value">{payload.boarding_group}</div></div>
      <div><div class="label">Issued</div><div class="value" style="font-size:11px">{issued}</div></div>
    </div>
    <div class="barcode">
      <img alt="boarding barcode" src="{barcode_data_uri}"/>
      <div class="muted">{payload.barcode_value}</div>
    </div>
    <div class="status">IDENTITY VERIFIED · PROCEED TO BAGGAGE DROP</div>
  </div>
</body>
</html>"""


def save_boarding_pass_files(
    payload: BoardingPassPayload,
    out_dir: str | Path,
) -> dict[str, str]:
    import base64

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    png = render_barcode_png(payload.barcode_value)
    png_path = out / f"{payload.pass_id}.png"
    png_path.write_bytes(png)
    data_uri = "data:image/png;base64," + base64.b64encode(png).decode("ascii")
    html = render_boarding_pass_html(payload, data_uri)
    html_path = out / f"{payload.pass_id}.html"
    html_path.write_text(html, encoding="utf-8")
    return {"html": str(html_path), "barcode_png": str(png_path), "data_uri": data_uri}
