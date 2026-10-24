from app.database_mapping import SEVERITY_TO_DATABASE, REVIEW_TO_DATABASE, finding_details, research_status
from app.models import Finding


def test_severity_is_explicit_and_does_not_invent_critical():
    assert {k:v.value for k,v in SEVERITY_TO_DATABASE.items()} == {"INFO":"LOW","WARNING":"MEDIUM","HIGH":"HIGH"}


def test_comparison_status_not_overwritten_by_review_workflow():
    finding = Finding(field_key="quantity",category="TECHNICAL",status="MATCH",severity="INFO",explanation="Same quantity")
    details = finding_details(finding)
    assert details["comparison_status"] == "MATCH" and details["backend_severity"] == "INFO"


def test_review_mapping_preserves_purchasing_meaning():
    assert REVIEW_TO_DATABASE["APPROVE"].value == "APPROVE_ADVANCE"
    assert REVIEW_TO_DATABASE["REJECT"].value == "REJECT_PAYMENT"
    assert REVIEW_TO_DATABASE["REQUEST_CLARIFICATION"].value == "REQUEST_SUPPLIER_CLARIFICATION"
    assert research_status("CANCELLED").value == "FAILED"
