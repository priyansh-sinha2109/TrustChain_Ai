import asyncio
import httpx
import json

async def main():
    key = "sk-tinyfish-ltJ28asDxqAvLH0uSJRZUh5eM97Z4ipD"
    url = "https://www.iafcertsearch.org/"
    headers = {"X-API-Key": key, "Content-Type": "application/json"}
    goal = (
        "Read this public website. Extract the exact observable website title, primary organization name, "
        "and visible verification/certification capabilities or features. "
        "Return an array of observations with source_url and observation text."
    )
    schema = {
        "type": "object",
        "properties": {
            "observations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "source_url": {"type": "string"},
                        "observation": {"type": "string"}
                    },
                    "required": ["source_url", "observation"]
                }
            }
        },
        "required": ["observations"]
    }
    payload = {
        "url": url,
        "goal": goal,
        "output_schema": schema,
        "agent_config": {"max_duration_seconds": 60}
    }
    
    print(f"Submitting crawl for {url}...", flush=True)
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post("https://agent.tinyfish.ai/v1/automation/run-async", headers=headers, json=payload)
        print(f"Submit status: {res.status_code}", flush=True)
        if res.status_code >= 300:
            print(f"Error response: {res.text}", flush=True)
            return
        
        data = res.json()
        run_id = data.get("run_id")
        print(f"Received Run ID: {run_id}", flush=True)
        
        for i in range(20):
            await asyncio.sleep(4)
            poll = await client.get(f"https://agent.tinyfish.ai/v1/runs/{run_id}", headers=headers)
            poll_data = poll.json()
            status = poll_data.get("status")
            print(f"Poll {i+1}: {status}", flush=True)
            if status in ("COMPLETED", "FAILED"):
                print("--- FINAL RESULT ---", flush=True)
                print(json.dumps(poll_data, indent=2), flush=True)
                break

if __name__ == "__main__":
    asyncio.run(main())
