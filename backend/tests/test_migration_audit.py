from app.config import Settings
from scripts.verify_supabase import audit


def test_missing_credentials_report_is_not_a_success():
    result=audit(Settings(_env_file=None))
    assert result["database_verified"] is False
    assert result["database_error"]=="DATABASE_URL_UNCONFIGURED"
    assert len(result["local_migration_files"])>=8
