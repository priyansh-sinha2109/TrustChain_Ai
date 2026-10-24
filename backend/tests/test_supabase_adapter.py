from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.config import Settings
from app.errors import AppError
from app.models import InvestigationStart
from app.repository import Repository
from app.supabase_adapter import SupabaseAdapter, create_repository, request_fingerprint, resolve_context


async def test_factory_fails_without_cloud_configuration():
    with pytest.raises(AppError, match="credentials are required"):
        await create_repository(Settings(_env_file=None))


def test_adapter_implements_complete_async_contract():
    import inspect
    methods = [name for name in Repository.__dict__ if not name.startswith("_")]
    for name in methods:
        assert inspect.iscoroutinefunction(getattr(SupabaseAdapter, name))


def test_fingerprint_is_stable_and_covers_request():
    data = InvestigationStart(baseline_document_id=uuid4(), final_document_id=uuid4())
    assert request_fingerprint(data) == request_fingerprint(data.model_copy())
    assert request_fingerprint(data) != request_fingerprint(data.model_copy(update={"public_research": False}))


def test_context_comes_from_database():
    connection = MagicMock()
    user, org = uuid4(), uuid4()
    connection.execute.return_value.fetchall.return_value = [{"org_id": org, "role": "buyer"}]
    context = resolve_context(connection, user)
    assert context.user_id == user and context.org_id == org and context.role.value == "buyer"


@pytest.mark.parametrize("rows", [[], [{"org_id": uuid4(), "role": "buyer"},
    {"org_id": uuid4(), "role": "reviewer"}], [{"org_id": uuid4(), "role": "owner"}]])
def test_missing_ambiguous_and_unsupported_memberships_denied(rows):
    connection = MagicMock()
    connection.execute.return_value.fetchall.return_value = rows
    with pytest.raises(AppError):
        resolve_context(connection, uuid4())


def test_unconfigured_data_layer_never_defaults_to_memory():
    from trustchain.database.client import SupabaseClientConfig, SupabaseRestClient
    from trustchain.database.repository import SupabaseRepository
    config = SupabaseClientConfig()
    config.supabase_url = config.anon_key = config.service_role_key = ""
    client = SupabaseRestClient(config)
    with pytest.raises(RuntimeError):
        SupabaseRepository(client)
    with pytest.raises(RuntimeError):
        client.post("purchase_cases", {"title": "must not fake success"})
