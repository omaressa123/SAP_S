"""ICAO 9303 TD3 (passport) MRZ parsing — no external PassportEye dependency."""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass
class PassportData:
    document_type: str
    issuing_country: str
    surname: str
    given_names: str
    full_name: str
    passport_number: str
    nationality: str
    date_of_birth: str  # YYYY-MM-DD
    sex: str
    expiry_date: str  # YYYY-MM-DD
    personal_number: str
    mrz_raw: str
    valid_check_digits: bool


def _char_value(ch: str) -> int:
    if ch == "<":
        return 0
    if ch.isdigit():
        return int(ch)
    if "A" <= ch <= "Z":
        return ord(ch) - 55
    raise ValueError(f"Invalid MRZ character: {ch!r}")


def mrz_check_digit(data: str) -> str:
    weights = (7, 3, 1)
    total = sum(_char_value(ch) * weights[i % 3] for i, ch in enumerate(data))
    return str(total % 10)


def _yy_mm_dd(raw: str) -> str:
    if len(raw) != 6 or not raw.isdigit():
        return raw
    yy, mm, dd = int(raw[:2]), int(raw[2:4]), int(raw[4:6])
    # Passports: DOB usually 19xx/20xx; expiry usually 20xx/21xx
    century = 1900 if yy >= 50 else 2000
    # For expiry dates, years like 30 mean 2030 — handled by caller context if needed
    return f"{century + yy:04d}-{mm:02d}-{dd:02d}"


def _expiry_date(raw: str) -> str:
    if len(raw) != 6 or not raw.isdigit():
        return raw
    yy, mm, dd = int(raw[:2]), int(raw[2:4]), int(raw[4:6])
    century = 2000 if yy < 80 else 1900
    return f"{century + yy:04d}-{mm:02d}-{dd:02d}"


def _names(field: str) -> tuple[str, str, str]:
    parts = field.split("<<", 1)
    surname = parts[0].replace("<", " ").strip()
    given = parts[1].replace("<", " ").strip() if len(parts) > 1 else ""
    given = re.sub(r"\s+", " ", given)
    surname = re.sub(r"\s+", " ", surname)
    full = f"{given} {surname}".strip() if given else surname
    return surname, given, full


def parse_td3(lines: list[str] | str) -> PassportData:
    """Parse a 2-line TD3 passport MRZ (44 chars each)."""
    if isinstance(lines, str):
        text = lines.upper().replace(" ", "").replace("\r", "\n")
        found = re.findall(r"[A-Z0-9<]{30,44}", text)
        if len(found) >= 2:
            lines = found[:2]
        else:
            raw_lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
            lines = raw_lines

    cleaned = [re.sub(r"[^A-Z0-9<]", "", ln.upper()) for ln in lines]
    cleaned = [ln for ln in cleaned if len(ln) >= 30]
    if len(cleaned) < 2:
        raise ValueError("MRZ must contain two TD3 lines")

    line1 = cleaned[0].ljust(44, "<")[:44]
    line2 = cleaned[1].ljust(44, "<")[:44]

    if not line1.startswith("P"):
        line1 = "P" + line1[1:]

    surname, given, full_name = _names(line1[5:44])
    passport_number = line2[0:9].replace("<", "")
    nationality = line2[10:13].replace("<", "")
    dob = _yy_mm_dd(line2[13:19])
    sex = line2[20].replace("<", "X")
    expiry = _expiry_date(line2[21:27])
    personal = line2[28:42].replace("<", "")

    checks = [
        mrz_check_digit(line2[0:9]) == line2[9],
        mrz_check_digit(line2[13:19]) == line2[19],
        mrz_check_digit(line2[21:27]) == line2[27],
    ]

    return PassportData(
        document_type=line1[0:2].replace("<", ""),
        issuing_country=line1[2:5],
        surname=surname,
        given_names=given,
        full_name=full_name,
        passport_number=passport_number,
        nationality=nationality,
        date_of_birth=dob,
        sex=sex,
        expiry_date=expiry,
        personal_number=personal,
        mrz_raw=f"{line1}\n{line2}",
        valid_check_digits=all(checks),
    )


def find_mrz_in_text(text: str) -> PassportData | None:
    try:
        return parse_td3(text)
    except ValueError:
        return None
