"""Read-only hosted configuration audit. Never prints credentials or record contents."""
import json
from pathlib import Path

import httpx
import psycopg

from app.config import Settings

EXPECTED = {"organizations","organization_members","suppliers","purchase_cases","case_suppliers",
    "documents","deal_versions","public_research_runs","evidence_sources","claims","findings",
    "deal_changes","deal_change_reviews","review_decisions","audit_events","investigation_jobs",
    "investigation_results","document_uploads","document_approvals"}


def audit(settings):
    report = {"local_migration_files": [p.name for p in sorted(
        (Path(__file__).resolve().parents[2]/"supabase"/"migrations").glob("*.sql"))],
        "database_verified": False, "missing_tables": [], "live_storage_verified": False}
    key = settings.supabase_service_role_key.get_secret_value()
    if settings.supabase_url and key:
        try:
            with httpx.Client(base_url=settings.supabase_url,timeout=15,follow_redirects=False,
                    headers={"apikey":key,"Authorization":f"Bearer {key}"}) as client:
                response=client.get("/storage/v1/bucket")
                report["storage_api_http_status"]=response.status_code
                if response.status_code==200:
                    report["buckets"]=[{"name":b["name"],"public":b["public"],
                        "file_size_limit":b.get("file_size_limit")} for b in response.json()]
                    report["live_storage_verified"]=any(b["name"]=="case-documents" and
                        not b["public"] and b.get("file_size_limit")==10_000_000 for b in response.json())
                schema=client.get("/rest/v1/")
                report["rest_schema_http_status"]=schema.status_code
                if schema.status_code==200:
                    report["exposed_rest_resources"]=sorted(schema.json().get("paths",{}))
        except (httpx.HTTPError,ValueError,KeyError):
            report["storage_api_error"]="HTTP_AUDIT_UNAVAILABLE"
    if not settings.database_url.get_secret_value():
        report["database_error"]="DATABASE_URL_UNCONFIGURED"
        return report
    try:
        with psycopg.connect(settings.database_url.get_secret_value(),connect_timeout=10) as connection:
            connection.execute("SET TRANSACTION READ ONLY")
            rows=connection.execute("SELECT relname,relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'").fetchall()
            tables={name:rls for name,rls in rows}
            report["missing_tables"]=sorted(EXPECTED-set(tables))
            report["rls_disabled"]=sorted(name for name in EXPECTED if name in tables and not tables[name])
            history=connection.execute("SELECT to_regclass('supabase_migrations.schema_migrations')").fetchone()[0]
            report["applied_migrations"]=([str(row[0]) for row in connection.execute(
                "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version").fetchall()] if history else None)
            report["migration_history_available"]=bool(history)
            report["database_verified"]=not report["missing_tables"] and not report["rls_disabled"]
            report["policy_names"]=[row[0] for row in connection.execute(
                "SELECT policyname FROM pg_policies WHERE schemaname IN ('public','storage') ORDER BY policyname").fetchall()]
    except psycopg.Error:
        report["database_error"]="DATABASE_AUDIT_UNAVAILABLE"
    return report


if __name__=="__main__":
    result=audit(Settings())
    print(json.dumps(result,indent=2))
    raise SystemExit(0 if result["database_verified"] and result["live_storage_verified"] else 1)
