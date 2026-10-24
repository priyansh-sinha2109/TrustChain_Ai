from decimal import Decimal

from .errors import AppError
from .models import Document, DocumentType, Finding, SourceField

TECHNICAL = {"material_thickness", "material_grade", "part_number", "quantity"}
COMMERCIAL = {"total_amount", "advance_percentage", "delivery_days", "freight"}
NUMERIC = {"material_thickness", "quantity", "total_amount", "advance_percentage", "delivery_days"}


def validate_baseline(baseline: Document, final: Document) -> None:
    if (not baseline.approved or baseline.document_type not in {
            DocumentType.ACCEPTED_QUOTE, DocumentType.PURCHASE_ORDER}):
        raise AppError("MISSING_APPROVED_BASELINE", "Select an explicitly approved quotation or purchase order.", 422)
    if baseline.id == final.id or final.document_type != DocumentType.FINAL_PI:
        raise AppError("INVALID_FINAL_DOCUMENT", "Select a separate final proforma invoice.", 422)
    if baseline.case_id != final.case_id:
        raise AppError("DOCUMENT_CASE_MISMATCH", "Documents must belong to the same authorized case.", 422)


def identity(field: SourceField):
    value = Decimal(field.value) if field.field_key in NUMERIC and field.unit != "UNSUPPORTED" else field.value
    return value, field.unit


def compare_fields(baseline: list[SourceField], final: list[SourceField]) -> list[Finding]:
    findings = []
    # Part numbers are themselves compared as document-level identifiers; other technical
    # fields must match the same explicit item identity, never positional table rows.
    def groups(fields, key, item):
        return [f for f in fields if f.field_key == key and
                (key not in TECHNICAL or key == "part_number" or f.line_item == item)]

    for key in sorted(TECHNICAL | COMMERCIAL):
        items = ({f.line_item for f in baseline + final if f.field_key == key}
                 if key in TECHNICAL and key != "part_number" else {None})
        for item in sorted(items or {None}, key=lambda value: value or ""):
            left, right = groups(baseline, key, item), groups(final, key, item)
            status = "MATCH"
            if not left or not right:
                status = "MISSING"
            elif any(f.unit == "UNSUPPORTED" for f in left + right):
                status = "INSUFFICIENT_EVIDENCE"
            elif len({identity(f) for f in left}) > 1 or len({identity(f) for f in right}) > 1:
                status = "AMBIGUOUS"
            elif key in TECHNICAL and key != "part_number" and item is None:
                # Single-item PDFs without part numbers can only be matched when their
                # stated product identities agree (or neither states an identity).
                products_left = {f.value for f in baseline if f.field_key == "product_name"}
                products_right = {f.value for f in final if f.field_key == "product_name"}
                if products_left != products_right or len(products_left) > 1:
                    status = "INSUFFICIENT_EVIDENCE"
            if status == "MATCH" and left and right:
                if key == "total_amount" and (not left[0].unit or not right[0].unit):
                    status = "INSUFFICIENT_EVIDENCE"
                elif left[0].unit != right[0].unit:
                    status = "INSUFFICIENT_EVIDENCE"
                elif identity(left[0]) != identity(right[0]):
                    status = "CONFLICT"
            severity = "HIGH" if status == "CONFLICT" and key in {
                "material_thickness", "material_grade", "part_number", "advance_percentage"} else (
                "WARNING" if status != "MATCH" else "INFO")
            findings.append(Finding(field_key=key,
                category="TECHNICAL" if key in TECHNICAL else "COMMERCIAL", status=status,
                severity=severity, baseline=left, final=right,
                explanation=f"{key.replace('_', ' ').capitalize()}: {status.lower().replace('_', ' ')}"
                    + (f" for item {item}." if item else ".")))
    return findings
