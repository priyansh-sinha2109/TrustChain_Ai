"""Run from backend: python -m scripts.tinyfish_smoke. Never prints the API key."""
import asyncio
import json

from app.config import Settings
from app.errors import AppError
from app.tinyfish import TinyFish


async def main():
    adapter = TinyFish(Settings())
    try:
        run_id = await adapter.start_public_research("https://example.com", smoke=True)
        print(json.dumps({"run_id": run_id, "status": "STARTED"}))
        for _ in range(45):
            run = await adapter.get_research_run(run_id)
            if run["status"] in {"COMPLETED", "FAILED", "CANCELLED"}:
                evidence = await adapter.normalize_public_result(run, "https://example.com")
                print(json.dumps({"run_id": run_id, "status": run["status"],
                    "observations": [e.model_dump(mode="json") for e in evidence]}))
                return 0 if evidence else 1
            await asyncio.sleep(5)
        print(json.dumps({"run_id": run_id, "status": "POLL_WINDOW_EXPIRED"}))
        return 1
    except AppError as exc:
        print(json.dumps({"error": exc.code, "message": exc.message}))
        return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
