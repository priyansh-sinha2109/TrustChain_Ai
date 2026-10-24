"""Export plain TypeScript DTOs from the committed OpenAPI component schemas."""
import json
from pathlib import Path


def typescript(schema):
    if "$ref" in schema:
        return schema["$ref"].split("/")[-1]
    if "anyOf" in schema:
        return " | ".join(typescript(item) for item in schema["anyOf"])
    if "enum" in schema:
        return " | ".join(json.dumps(value) for value in schema["enum"])
    kind=schema.get("type")
    if kind=="array":
        return "Array<"+typescript(schema["items"])+">"
    if kind=="object":
        required=set(schema.get("required",[]))
        fields=[json.dumps(key)+("" if key in required else "?")+": "+typescript(value)+";"
            for key,value in schema.get("properties",{}).items()]
        return "{ "+" ".join(fields)+" }"
    return {"string":"string","integer":"number","number":"number","boolean":"boolean","null":"null"}.get(kind,"unknown")


def export():
    root=Path(__file__).resolve().parents[2]
    schema=json.loads((root/"docs/backend-openapi.json").read_text(encoding="utf-8"))
    output="// Generated from backend-openapi.json. Do not edit by hand.\n// UUIDs, dates and monetary JSON strings retain their OpenAPI string type.\n\n"
    output+="\n\n".join("export type "+name+" = "+typescript(value)+";"
        for name,value in schema["components"]["schemas"].items())+"\n"
    (root/"docs/backend-api-types.ts").write_text(output,encoding="utf-8")


if __name__=="__main__":
    export()
