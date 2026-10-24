from uuid import uuid4

import pytest

from app.comparison import compare_fields, validate_baseline
from app.errors import AppError
from app.extraction import fields_from_pages
from app.models import Document


def docs():
    case_id = uuid4()
    return (Document(id=uuid4(), case_id=case_id, document_type="ACCEPTED_QUOTE", approved=True, size_bytes=1),
        Document(id=uuid4(), case_id=case_id, document_type="FINAL_PI", size_bytes=1))


def compare(left, right):
    a, b = docs()
    return {f.field_key: f for f in compare_fields(fields_from_pages(a, [left]), fields_from_pages(b, [right]))}


def test_thickness_normalized_and_changed():
    assert compare("Thickness: 8 mm", "Thickness: 0.8 cm")["material_thickness"].status == "MATCH"
    finding = compare("Thickness: 8 mm", "Thickness: 6 mm")["material_thickness"]
    assert finding.status == "CONFLICT" and finding.severity == "HIGH"
    assert finding.baseline[0].page_number == 1


def test_missing_and_ambiguous():
    assert compare("Delivery: 7 days", "")["delivery_days"].status == "MISSING"
    assert compare("Advance: 30%", "Advance: 30%\nAdvance: 80%")["advance_percentage"].status == "AMBIGUOUS"


def test_distinct_items_not_compared():
    result = compare("Part number: A\nThickness: 8 mm", "Part number: B\nThickness: 6 mm")
    assert result["material_thickness"].status == "MISSING"
    assert result["part_number"].status == "CONFLICT"


def test_different_unscoped_products_not_compared():
    assert compare("Product: panel\nThickness: 8 mm", "Product: tube\nThickness: 6 mm")["material_thickness"].status == "INSUFFICIENT_EVIDENCE"


def test_rfq_or_unapproved_baseline_rejected():
    a, b = docs()
    for invalid in (a.model_copy(update={"approved": False}), a.model_copy(update={"document_type": "RFQ"})):
        with pytest.raises(AppError):
            validate_baseline(invalid, b)


def test_currency_difference_not_plain_price_conflict():
    assert compare("Order value: INR 100", "Order value: USD 100")["total_amount"].status == "INSUFFICIENT_EVIDENCE"
