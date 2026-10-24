from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "backend/.env"), extra="ignore")
    environment: str = "development"
    frontend_origin: str = "http://localhost:3000"
    supabase_url: str = ""
    supabase_anon_key: SecretStr = SecretStr("")
    tinyfish_api_key: SecretStr = SecretStr("")
    repository_factory: str = ""
    public_research_hosts: str = "example.com"
