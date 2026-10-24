from decimal import Decimal

import pytest

from app.extraction import fields_from_pages
from app.financial import advance_amount, exposure_from_fields
from test_comparison import docs


def exposure(left, right):
    a, b = docs()
    return exposure_from_fields(fields_from_pages(a, [left]), fields_from_pages(b, [right]))


def test_synthetic_advance_and_changed_totals():
    result = exposure("Order value: INR 4,80,000\nAdvance: 30%", "Order value: INR 480000\nAdvance: 80%")
    assert (result.baseline_amount, result.final_amount, result.difference) == (
        Decimal("144000.00"), Decimal("384000.00"), Decimal("240000.00"))
    changed = exposure("Order value: INR 100\nAdvance: 30%", "Order value: INR 200\nAdvance: 80%")
    assert changed.difference == Decimal("130.00")


def test_rounding_and_zero():
    assert advance_amount(Decimal("1.01"), Decimal("50")) == Decimal("0.51")
    assert advance_amount(Decimal("100"), Decimal("0")) == Decimal("0.00")


@pytest.mark.parametrize("total,percentage", [("-1", "30"), ("100", "101"), ("NaN", "20"), ("100", "-1")])
def test_invalid_inputs(total, percentage):
    with pytest.raises(ValueError):
        advance_amount(Decimal(total), Decimal(percentage))


def test_unresolved_currency_missing_and_conflicting_values():
    assert exposure("Order value: INR 100\nAdvance: 30%", "Order value: USD 100\nAdvance: 30%").status == "CURRENCY_MISMATCH"
    assert exposure("Order value: INR 100", "Order value: INR 100\nAdvance: 30%").status == "INSUFFICIENT_EVIDENCE"
    assert exposure("Order value: INR 100\nAdvance: 30%", "Order value: INR 100\nAdvance: 30%\nAdvance: 80%").status == "AMBIGUOUS"
    assert exposure("Advance amount: INR 30", "Advance amount: INR 80").difference == 50
