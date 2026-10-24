"""
TrustChain AI — Advance Exposure Calculation Engine
Role: Member 3 (Supabase Architecture, Data Persistence, Security & Audit)

Implements pure, deterministic calculation of pre-advance exposure differences
between agreed commercial quotation terms and final supplier Proforma Invoices (PI).
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Union
from trustchain.database.models import AdvanceExposureResult


def to_decimal(val: Union[int, float, str, Decimal]) -> Decimal:
    """Safely converts input to Decimal without floating-point inaccuracies."""
    if isinstance(val, Decimal):
        return val
    return Decimal(str(val))


def calculate_advance_exposure(
    baseline_total: Union[int, float, str, Decimal],
    baseline_advance_percentage: Union[int, float, str, Decimal],
    final_total: Union[int, float, str, Decimal],
    final_advance_percentage: Union[int, float, str, Decimal],
    currency: str = "INR",
) -> AdvanceExposureResult:
    """
    Calculates the exact advance exposure delta between baseline quotation and final PI.

    Formula:
        Baseline Advance = (baseline_total * baseline_advance_pct) / 100
        Final Advance = (final_total * final_advance_pct) / 100
        Exposure Delta = Final Advance - Baseline Advance

    Example (Sharma Auto benchmark case):
        Baseline: INR 480,000 @ 30% = INR 144,000
        Final PI: INR 480,000 @ 80% = INR 384,000
        Exposure Delta: +INR 240,000 (Commitment increased by INR 240,000)
    """
    b_tot = to_decimal(baseline_total)
    b_pct = to_decimal(baseline_advance_percentage)
    f_tot = to_decimal(final_total)
    f_pct = to_decimal(final_advance_percentage)

    if b_pct < Decimal("0.00") or b_pct > Decimal("100.00"):
        raise ValueError(f"Baseline advance percentage must be between 0 and 100, got: {b_pct}")
    if f_pct < Decimal("0.00") or f_pct > Decimal("100.00"):
        raise ValueError(f"Final advance percentage must be between 0 and 100, got: {f_pct}")
    if b_tot < Decimal("0.00") or f_tot < Decimal("0.00"):
        raise ValueError("Order total amounts cannot be negative.")

    b_adv = ((b_tot * b_pct) / Decimal("100.0")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    f_adv = ((f_tot * f_pct) / Decimal("100.0")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    delta = (f_adv - b_adv).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    return AdvanceExposureResult(
        baseline_total=b_tot.quantize(Decimal("0.01")),
        baseline_advance_percentage=b_pct.quantize(Decimal("0.01")),
        baseline_advance_amount=b_adv,
        final_total=f_tot.quantize(Decimal("0.01")),
        final_advance_percentage=f_pct.quantize(Decimal("0.01")),
        final_advance_amount=f_adv,
        exposure_delta_amount=delta,
        is_exposure_increased=(delta > Decimal("0.00")),
        currency=currency.upper(),
    )
