"""
Tests for Advance Exposure Calculation Engine
Verifies exact deterministic financial math and benchmark test case.
"""

from decimal import Decimal
import pytest
from trustchain.database.exposure import calculate_advance_exposure


def test_sharma_auto_benchmark_exposure():
    """
    Benchmark test case from TrustChain AI Master Prompt:
    Accepted Quote: INR 480,000 @ 30% advance = INR 144,000
    Final PI:       INR 480,000 @ 80% advance = INR 384,000
    Discrepancy:    +INR 240,000 additional exposure
    """
    res = calculate_advance_exposure(
        baseline_total=480000,
        baseline_advance_percentage=30,
        final_total=480000,
        final_advance_percentage=80,
        currency="INR",
    )

    assert res.baseline_advance_amount == Decimal("144000.00")
    assert res.final_advance_amount == Decimal("384000.00")
    assert res.exposure_delta_amount == Decimal("240000.00")
    assert res.is_exposure_increased is True
    assert res.currency == "INR"


def test_exposure_with_price_increase_and_advance_shift():
    """
    Price changes from 500,000 to 600,000, and advance changes from 20% to 50%:
    Baseline advance: 500,000 * 20% = 100,000
    Final advance:    600,000 * 50% = 300,000
    Delta:            +200,000
    """
    res = calculate_advance_exposure(
        baseline_total="500000.00",
        baseline_advance_percentage="20.00",
        final_total="600000.00",
        final_advance_percentage="50.00",
    )

    assert res.baseline_advance_amount == Decimal("100000.00")
    assert res.final_advance_amount == Decimal("300000.00")
    assert res.exposure_delta_amount == Decimal("200000.00")
    assert res.is_exposure_increased is True


def test_exposure_decrease():
    """Supplier agrees to lower advance from 50% to 25%."""
    res = calculate_advance_exposure(
        baseline_total=200000,
        baseline_advance_percentage=50,
        final_total=200000,
        final_advance_percentage=25,
    )

    assert res.baseline_advance_amount == Decimal("100000.00")
    assert res.final_advance_amount == Decimal("50000.00")
    assert res.exposure_delta_amount == Decimal("-50000.00")
    assert res.is_exposure_increased is False


def test_zero_advance_baseline():
    """0% advance accepted vs 20% requested in PI."""
    res = calculate_advance_exposure(
        baseline_total=100000,
        baseline_advance_percentage=0,
        final_total=100000,
        final_advance_percentage=20,
    )

    assert res.baseline_advance_amount == Decimal("0.00")
    assert res.final_advance_amount == Decimal("20000.00")
    assert res.exposure_delta_amount == Decimal("20000.00")
    assert res.is_exposure_increased is True


def test_invalid_advance_percentages():
    """Percentages out of [0, 100] must be rejected."""
    with pytest.raises(ValueError, match="between 0 and 100"):
        calculate_advance_exposure(100000, -5, 100000, 20)

    with pytest.raises(ValueError, match="between 0 and 100"):
        calculate_advance_exposure(100000, 30, 100000, 120)


def test_negative_total_amounts():
    """Negative totals must be rejected."""
    with pytest.raises(ValueError, match="cannot be negative"):
        calculate_advance_exposure(-100000, 30, 100000, 30)
