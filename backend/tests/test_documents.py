from uuid import uuid4

import pytest

from app.errors import AppError
from app.extraction import extract_pdf, fields_from_pages
from app.models import Document
from app.normalization import decimal_number, normalize
from pdf_fixture import pdf_bytes


def document(size=10):
    return Document(id=uuid4(), case_id=uuid4(), document_type="FINAL_PI", size_bytes=size)


@pytest.mark.parametrize("text", ["8 mm", "8.0 millimetres", "0.8 cm"])
def test_units(text):
    value, unit = normalize("material_thickness", text)
    assert decimal_number(value) == 8 and unit == "mm"


def test_real_pdf_extraction():
    content = pdf_bytes(["Part number: PANEL-A", "Thickness: 6 mm", "Order value: INR 4,80,000",
        "Advance: 80%", "Delivery: 20 days"])
    doc = document(len(content))
    fields = extract_pdf(doc, content)
    assert len(fields) == 5
    assert fields[1].value == "6" and fields[1].line_item == "panel-a"
    assert fields[2].value == "480000" and fields[2].unit == "INR"
    assert all(f.document_id == doc.id and f.page_number == 1 for f in fields)
    assert fields[1].raw_text == "Thickness: 6 mm"


def test_conflicting_values_and_pages_preserved():
    fields = fields_from_pages(document(), ["Advance: 30%", "Advance: 80%"])
    assert [f.page_number for f in fields] == [1, 2]
    assert len(fields) == 2


@pytest.mark.parametrize("data,code", [(b"not pdf", "UNSUPPORTED_DOCUMENT"),
    (b"%PDF-corrupt", "INVALID_PDF")])
def test_bad_pdf(data, code):
    with pytest.raises(AppError) as error:
        extract_pdf(document(len(data)), data)
    assert error.value.code == code


def test_blank_pdf_needs_ocr():
    content = pdf_bytes([])
    with pytest.raises(AppError) as error:
        extract_pdf(document(len(content)), content)
    assert error.value.code == "OCR_REQUIRED"


def test_invalid_number_and_percentage():
    for value in ["NaN", "1,2,3", "1e10"]:
        with pytest.raises(ValueError):
            decimal_number(value)
    with pytest.raises(ValueError):
        normalize("advance_percentage", "101%")


def test_unsupported_unit_preserved():
    assert fields_from_pages(document(), ["Thickness: eight-ish"])[0].unit == "UNSUPPORTED"
