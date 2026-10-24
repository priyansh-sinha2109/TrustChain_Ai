"""Small deterministic unit and commercial-value normalizers."""
import re
from decimal import Decimal, InvalidOperation


def decimal_number(text: str) -> Decimal:
    text = text.strip()
    if not re.fullmatch(r"-?(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.\d+)?", text):
        raise ValueError("Unsupported number")
    try:
        number = Decimal(text.replace(",", ""))
    except InvalidOperation:
        raise ValueError("Unsupported number") from None
    if not number.is_finite():
        raise ValueError("Unsupported number")
    return number


def normalize(key: str, text: str) -> tuple[str, str | None]:
    value = text.strip()
    if key == "material_thickness":
        match = re.fullmatch(r"([\d,.]+)\s*(mm|millimetres?|millimeters?|cm|m)", value, re.I)
        if not match:
            raise ValueError("Unsupported thickness")
        unit = match[2].lower()
        multiplier = Decimal("10") if unit == "cm" else Decimal("1000") if unit == "m" else Decimal("1")
        return str(decimal_number(match[1]) * multiplier), "mm"
    if key == "delivery_days":
        match = re.fullmatch(r"(\d+)\s*(days?|weeks?)", value, re.I)
        if not match:
            raise ValueError("Unsupported delivery term")
        return str(int(match[1]) * (7 if match[2].lower().startswith("week") else 1)), "days"
    if key == "advance_percentage":
        match = re.fullmatch(r"([\d.]+)\s*%", value)
        if not match or not 0 <= decimal_number(match[1]) <= 100:
            raise ValueError("Unsupported percentage")
        return str(decimal_number(match[1])), "%"
    if key in {"total_amount", "unit_price", "advance_amount"}:
        match = re.fullmatch(r"(?:(INR|USD|EUR|GBP|Rs\.?|₹)\s*)?([\d,.]+)(?:\s*(INR|USD|EUR|GBP))?", value, re.I)
        if not match:
            raise ValueError("Unsupported amount")
        left, right = match[1], match[3]
        currency = (left or right or "").upper()
        if left and right and left.upper() != right.upper():
            raise ValueError("Conflicting currencies")
        if currency in {"RS", "RS.", "₹"}:
            currency = "INR"
        return str(decimal_number(match[2])), currency or None
    if key == "quantity":
        match = re.fullmatch(r"([\d,.]+)\s*(pcs?|pieces?|units?|kg)?", value, re.I)
        if not match:
            raise ValueError("Unsupported quantity")
        unit = (match[2] or "").lower()
        if unit and unit != "kg":
            unit = "pieces"
        return str(decimal_number(match[1])), unit or None
    if key == "freight":
        terms = {"included": "included", "inclusive": "included", "excluded": "excluded", "extra": "excluded"}
        if value.casefold() not in terms:
            raise ValueError("Unsupported freight term")
        return terms[value.casefold()], None
    return " ".join(value.casefold().split()), None
