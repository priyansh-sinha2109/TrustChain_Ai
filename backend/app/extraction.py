"""Extraction of labelled single-item or explicitly identified item sections."""
import json
import os
import subprocess
import sys
from pathlib import Path

from .errors import AppError
from .models import Document, SourceField
from .normalization import normalize

LABELS = {"product": "product_name", "product name": "product_name", "part number": "part_number",
    "material grade": "material_grade", "thickness": "material_thickness", "dimensions": "dimensions",
    "quantity": "quantity", "unit price": "unit_price", "total amount": "total_amount",
    "order value": "total_amount", "currency": "currency", "advance": "advance_percentage",
    "advance payment": "advance_percentage", "advance amount": "advance_amount",
    "delivery": "delivery_days", "delivery time": "delivery_days", "freight": "freight",
    "replacement policy": "replacement_policy", "unit of measurement": "unit_of_measurement"}


def fields_from_pages(document: Document, pages: list[str]) -> list[SourceField]:
    fields = []
    item = None
    for number, text in enumerate(pages, 1):
        for line in text.splitlines():
            label, separator, raw_value = line.partition(":")
            if not separator or label.strip().casefold() not in LABELS or not raw_value.strip():
                continue
            key = LABELS[label.strip().casefold()]
            if key == "part_number":
                item = " ".join(raw_value.strip().casefold().split())
            try:
                value, unit = normalize(key, raw_value)
            except ValueError:
                # Preserve unsupported values as evidence without pretending normalization succeeded.
                value, unit = raw_value.strip(), "UNSUPPORTED"
            fields.append(SourceField(document_id=document.id, document_type=document.document_type,
                field_key=key, value=value, unit=unit,
                line_item=item if key in {"part_number", "product_name", "material_grade",
                    "material_thickness", "dimensions", "quantity", "unit_price"} else None,
                page_number=number, raw_text=line))
    return fields


def extract_pdf(document: Document, content: bytes) -> list[SourceField]:
    if document.content_type != "application/pdf" or not content.startswith(b"%PDF-"):
        raise AppError("UNSUPPORTED_DOCUMENT", "Only text-based PDF documents are supported.", 422)
    if len(content) > 10_000_000 or len(content) != document.size_bytes:
        raise AppError("INVALID_DOCUMENT_SIZE", "Document size does not match its registered metadata.", 422)
    # A separate process enforces a wall-clock bound even if the parser stalls.
    environment = os.environ.copy()
    environment["PYTHONPATH"] = str(Path(__file__).resolve().parents[1])
    try:
        result = subprocess.run([sys.executable, "-m", "app.pdf_worker"], input=content,
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=20, env=environment, check=False)
        if result.returncode or len(result.stdout) > 1_000_000:
            raise ValueError
        data = json.loads(result.stdout)
    except subprocess.TimeoutExpired:
        raise AppError("EXTRACTION_TIMEOUT", "PDF extraction exceeded its processing limit.", 422) from None
    except (ValueError, OSError):
        raise AppError("INVALID_PDF", "PDF is corrupt, encrypted, or exceeds extraction limits.", 422) from None
    if not isinstance(data, list) or not data or not all(isinstance(page, str) for page in data):
        raise AppError("INVALID_PDF", "PDF contains no readable pages.", 422)
    if any(not page.strip() for page in data):
        raise AppError("OCR_REQUIRED", "At least one page has no readable text; OCR review is required.", 422)
    return fields_from_pages(document, data)
