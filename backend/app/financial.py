from decimal import Decimal, ROUND_HALF_UP

from .models import Exposure, SourceField

PAISE = Decimal("0.01")


def advance_amount(total: Decimal, percentage: Decimal) -> Decimal:
    if (not total.is_finite() or not percentage.is_finite()
            or total < 0 or not 0 <= percentage <= 100):
        raise ValueError("Total and percentage must be finite and within range")
    return (total * percentage / Decimal(100)).quantize(PAISE, rounding=ROUND_HALF_UP)


def exposure_from_fields(baseline: list[SourceField], final: list[SourceField]) -> Exposure:
    def values(fields, key):
        selected = [f for f in fields if f.field_key == key]
        if any(f.unit == "UNSUPPORTED" for f in selected):
            raise ValueError
        if key in {"total_amount", "advance_percentage", "advance_amount"}:
            return {(Decimal(f.value), f.unit) for f in selected}
        return {(f.value.upper(), f.unit) for f in selected}

    def extract(fields):
        totals, percentages, explicit, currencies = [values(fields, key) for key in (
            "total_amount", "advance_percentage", "advance_amount", "currency")]
        if any(len(v) > 1 for v in (totals, percentages, explicit, currencies)):
            return "AMBIGUOUS", None, None
        total = next(iter(totals), None)
        percent = next(iter(percentages), None)
        amount = next(iter(explicit), None)
        currency_codes = {unit for _, unit in totals | explicit if unit}
        currency_codes |= {value for value, _ in currencies}
        if len(currency_codes) > 1:
            return "AMBIGUOUS", None, None
        if not currency_codes:
            return "INSUFFICIENT_EVIDENCE", None, None
        currency = next(iter(currency_codes))
        if total and percent:
            computed = advance_amount(total[0], percent[0])
            if amount and amount[0].quantize(PAISE, rounding=ROUND_HALF_UP) != computed:
                return "AMBIGUOUS", None, None
            return "CALCULATED", computed, currency
        if amount and amount[0].is_finite() and amount[0] >= 0:
            return "CALCULATED", amount[0].quantize(PAISE, rounding=ROUND_HALF_UP), currency
        return "INSUFFICIENT_EVIDENCE", None, None

    try:
        left_status, left, currency = extract(baseline)
        right_status, right, final_currency = extract(final)
    except (ValueError, ArithmeticError):
        return Exposure(status="INSUFFICIENT_EVIDENCE")
    if "AMBIGUOUS" in {left_status, right_status}:
        return Exposure(status="AMBIGUOUS")
    if left is None or right is None:
        return Exposure(status="INSUFFICIENT_EVIDENCE")
    if currency != final_currency:
        return Exposure(status="CURRENCY_MISMATCH")
    return Exposure(status="CALCULATED", currency=currency, baseline_amount=left,
        final_amount=right, difference=right - left)
