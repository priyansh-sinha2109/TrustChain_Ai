"""Secret-safe helper behaviour with mocked Auth responses; no hosted writes."""
import json

import httpx
import pytest
from dotenv import dotenv_values

from scripts import configure_live_tokens as helper


@pytest.fixture
def setup_helper(tmp_path, monkeypatch):
    monkeypatch.setattr(helper, "ROOT", tmp_path)
    path = tmp_path / ".env"
    path.write_text("SUPABASE_URL=https://synthetic.test\nSUPABASE_ANON_KEY=synthetic-anon\nSUPABASE_SERVICE_ROLE_KEY=synthetic-server-secret\nTRUSTCHAIN_TEST_BUYER_PASSWORD=synthetic-buyer-password\nTRUSTCHAIN_TEST_REVIEWER_PASSWORD=synthetic-reviewer-password\n", encoding="utf-8")
    approved = {role: {"id": role + "-id", "email": role + "@example.com", "confirmed": True, "org_id": "synthetic"} for role in ("buyer", "reviewer")}
    monkeypatch.setattr(helper, "accounts", lambda values: approved)
    original_client = httpx.Client
    def transport(handler):
        monkeypatch.setattr(helper.httpx, "Client", lambda **kwargs: original_client(**kwargs, transport=httpx.MockTransport(handler)))
    return approved, path, transport


def test_no_login_before_both_emails_confirmed(setup_helper):
    approved, path, transport = setup_helper
    approved["reviewer"]["confirmed"] = False
    def unexpected(request):
        pytest.fail("Unconfirmed account must not start a login request")
    transport(unexpected)
    assert helper.run() == 1
    assert not dotenv_values(path).get("TRUSTCHAIN_TEST_BUYER_ACCESS_TOKEN")


def test_failed_second_login_does_not_write_partial_tokens_or_retry(setup_helper, capsys):
    approved, path, transport = setup_helper
    requests = []
    def response(request):
        requests.append(request)
        if len(requests) == 1:
            return httpx.Response(200, json={"user": {"id": "buyer-id"}, "access_token": "synthetic-access-secret"})
        return httpx.Response(429, json={"code": "over_request_rate_limit"})
    transport(response)
    assert helper.run() == 1 and len(requests) == 2
    assert not dotenv_values(path).get("TRUSTCHAIN_TEST_BUYER_ACCESS_TOKEN")
    assert "synthetic-access-secret" not in capsys.readouterr().out


def test_confirmation_only_targets_approved_reviewer(setup_helper, capsys):
    approved, path, transport = setup_helper
    approved["reviewer"]["confirmed"] = False
    def response(request):
        assert request.method == "PUT" and request.url.path == "/auth/v1/admin/users/reviewer-id"
        assert json.loads(request.content) == {"email_confirm": True}
        return httpx.Response(200, json={"id": "reviewer-id", "email_confirmed_at": "2026-10-24T00:00:00Z"})
    transport(response)
    assert helper.run(confirm_reviewer=True) == 0
    assert "synthetic-server-secret" not in capsys.readouterr().out


def test_tokens_saved_only_after_both_auth_identities_match(setup_helper, capsys):
    approved, path, transport = setup_helper
    def response(request):
        role = json.loads(request.content)["email"].split("@")[0]
        return httpx.Response(200, json={"user": {"id": role + "-id"}, "access_token": role + "-synthetic-secret-token"})
    transport(response)
    assert helper.run() == 0
    saved = dotenv_values(path)
    assert saved["TRUSTCHAIN_TEST_REVIEWER_ACCESS_TOKEN"] == "reviewer-synthetic-secret-token"
    assert saved["SUPABASE_SERVICE_ROLE_KEY"] == "synthetic-server-secret"
    assert "synthetic-secret-token" not in capsys.readouterr().out


async def test_chargeable_provider_requires_its_own_opt_in(monkeypatch):
    import test_live_supabase as live
    monkeypatch.delenv("TRUSTCHAIN_LIVE_TINYFISH", raising=False)
    monkeypatch.setattr(live, "dotenv_values", lambda path: {"TRUSTCHAIN_LIVE_TESTS": "1"})
    with pytest.raises(pytest.skip.Exception, match="Chargeable TinyFish"):
        await live.test_controlled_live_tinyfish_smoke()


@pytest.mark.parametrize("code,expected", [("invalid_credentials", "invalid_credentials"), ("synthetic-secret-response", "unclassified")])
def test_login_diagnostics_only_print_allowlisted_codes(setup_helper, capsys, code, expected):
    _, _, transport = setup_helper
    transport(lambda request: httpx.Response(400, json={"error_code": code, "msg": "synthetic-private-response"}))
    assert helper.run() == 1
    output = capsys.readouterr().out
    assert f"HTTP 400, {expected}" in output
    assert "synthetic-private-response" not in output
    assert "synthetic-secret-response" not in output
