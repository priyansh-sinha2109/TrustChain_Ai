"""Explicit test-project maintenance. Never prints credentials or response bodies.

Default: sign in each pre-approved account once and save real access tokens to ignored
root .env. Passwords are read from ignored .env or hidden interactive prompts.
--confirm-reviewer: an administrator's explicit, account-specific test confirmation.
This never disables project email verification and never changes a password.
"""
import argparse
from getpass import getpass
from pathlib import Path
from urllib.parse import urlsplit
from uuid import UUID

import httpx
import psycopg
from dotenv import dotenv_values, set_key

ROOT = Path(__file__).resolve().parents[2]


def accounts(values):
    project = values.get("TRUSTCHAIN_TEST_PROJECT_REF")
    if values.get("TRUSTCHAIN_LIVE_TESTS") != "1" or not project or urlsplit(values.get("SUPABASE_URL", "")).hostname != project + ".supabase.co":
        raise ValueError("Dedicated test-project opt-in/reference is missing or mismatched.")
    result = {}
    with psycopg.connect(values["DATABASE_URL"], connect_timeout=10) as connection:
        connection.execute("SET TRANSACTION READ ONLY")
        for role in ("buyer", "reviewer"):
            user_id = UUID(values[f"TRUSTCHAIN_TEST_{role.upper()}_USER_ID"])
            rows = connection.execute("""SELECT u.email,u.email_confirmed_at IS NOT NULL,m.org_id,o.slug
                FROM auth.users u JOIN public.organization_members m ON m.user_id=u.id
                JOIN public.organizations o ON o.id=m.org_id
                WHERE u.id=%s AND m.is_active AND m.role=%s""", (user_id, role)).fetchall()
            if len(rows) != 1 or rows[0][3] != "synthetic-trustchain-live-integration":
                raise ValueError("Expected approved test membership was not found.")
            active = connection.execute("SELECT count(*) FROM public.organization_members WHERE user_id=%s AND is_active", (user_id,)).fetchone()[0]
            if active != 1:
                raise ValueError("Ambiguous test membership; sign-in setup stopped.")
            result[role] = {"id": str(user_id), "email": rows[0][0], "confirmed": rows[0][1], "org_id": rows[0][2]}
    if result["buyer"]["org_id"] != result["reviewer"]["org_id"]:
        raise ValueError("Test accounts must belong to the same approved test organisation.")
    return result


def run(confirm_reviewer=False):
    env_path = ROOT / ".env"
    values = dotenv_values(env_path)
    approved = accounts(values)
    with httpx.Client(base_url=values["SUPABASE_URL"], timeout=15, follow_redirects=False) as client:
        if confirm_reviewer:
            reviewer = approved["reviewer"]
            if reviewer["confirmed"]:
                print("Reviewer email is already confirmed; no change made.")
                return 0
            key = values["SUPABASE_SERVICE_ROLE_KEY"]
            response = client.put("/auth/v1/admin/users/" + reviewer["id"],
                headers={"apikey": key, "Authorization": "Bearer " + key}, json={"email_confirm": True})
            body = response.json()
            if response.status_code != 200 or body.get("id") != reviewer["id"] or not body.get("email_confirmed_at"):
                print(f"Reviewer admin confirmation failed (HTTP {response.status_code}); no success claimed.")
                return 1
            print("Approved test reviewer email confirmed through Auth Admin API. Project verification remains enabled.")
            return 0
        if not all(account["confirmed"] for account in approved.values()):
            print("A test email is unconfirmed. Confirm through its inbox or an authorised account-specific test admin action first.")
            return 1
        tokens = {}
        for role, account in approved.items():
            password = values.get(f"TRUSTCHAIN_TEST_{role.upper()}_PASSWORD") or getpass(f"Existing {role} account password (hidden): ")
            response = client.post("/auth/v1/token?grant_type=password", headers={"apikey": values["SUPABASE_ANON_KEY"]},
                json={"email": account["email"], "password": password})
            body = response.json()
            if response.status_code != 200 or body.get("user", {}).get("id") != account["id"] or not body.get("access_token"):
                code = body.get("error_code", body.get("code"))
                safe_code = code if code in {"invalid_credentials", "email_not_confirmed", "over_request_rate_limit", "over_email_send_rate_limit"} else "unclassified"
                print(f"{role.capitalize()} sign-in failed (HTTP {response.status_code}, {safe_code}); no retry attempted.")
                return 1
            tokens[f"TRUSTCHAIN_TEST_{role.upper()}_ACCESS_TOKEN"] = body["access_token"]
        for name, value in tokens.items():
            set_key(str(env_path), name, value)
        for role, account in approved.items():
            set_key(str(env_path), f"TRUSTCHAIN_TEST_{role.upper()}_EMAIL", account["email"])
        print("Both real test sessions verified and access tokens saved to ignored root .env. Passwords were not written by this helper.")
        return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--confirm-reviewer", action="store_true", help="Explicit admin confirmation of the approved development reviewer only")
    args = parser.parse_args()
    try:
        raise SystemExit(run(args.confirm_reviewer))
    except (ValueError, KeyError, EOFError, OSError, psycopg.Error, httpx.HTTPError):
        print("Test-account setup could not complete. Check ignored configuration and account status; no response or secret was logged.")
        raise SystemExit(1) from None
