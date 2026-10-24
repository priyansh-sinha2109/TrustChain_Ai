"""Isolated parser process; private bytes never touch disk or stdout logs."""
import io
import json
import sys

import pdfplumber


def main():
    content = sys.stdin.buffer.read(10_000_001)
    if len(content) > 10_000_000:
        return 1
    try:
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            if len(pdf.pages) > 40:
                return 1
            pages = []
            total = 0
            for page in pdf.pages:
                # Bound object-heavy PDFs before text assembly.
                if len(page.chars) > 50_000:
                    return 1
                text = page.extract_text() or ""
                total += len(text)
                if total > 200_000:
                    return 1
                pages.append(text)
        sys.stdout.buffer.write(json.dumps(pages).encode("utf-8"))
        return 0
    except Exception:
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
