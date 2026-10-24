from pydantic import SecretStr
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(Path(__file__).resolve().parents[2] / ".env",
        Path(__file__).resolve().parents[1] / ".env"), extra="ignore")
    environment: str = "development"
    frontend_origin: str = "http://localhost:3000"
    supabase_url: str = ""
    supabase_anon_key: SecretStr = SecretStr("")
    supabase_service_role_key: SecretStr = SecretStr("")
    database_url: SecretStr = SecretStr("")
    tinyfish_api_key: SecretStr = SecretStr("")
    repository_factory: str = ""
    public_research_hosts: str = "example.com"
