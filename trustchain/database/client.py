"""
TrustChain AI — Supabase Client Wrapper & Connection Factory
Role: Member 3 (Supabase Architecture, Data Persistence, Security & Audit)

Provides unified connection management for:
1. Supabase REST API (PostgREST)
2. Supabase Storage API
3. Connection fallback and test configuration
"""

import os
import json
from typing import Any, Dict, Optional
from urllib import request, parse, error


class SupabaseClientConfig:
    def __init__(
        self,
        supabase_url: Optional[str] = None,
        supabase_key: Optional[str] = None,
        service_role_key: Optional[str] = None,
    ):
        self.supabase_url = (supabase_url or os.getenv("SUPABASE_URL", "")).rstrip("/")
        self.anon_key = supabase_key or os.getenv("SUPABASE_ANON_KEY", "")
        self.service_role_key = service_role_key or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    @property
    def is_configured(self) -> bool:
        return bool(self.supabase_url and (self.anon_key or self.service_role_key))

    @property
    def active_key(self) -> str:
        return self.service_role_key or self.anon_key


class SupabaseRestClient:
    """
    Lightweight REST client for Supabase PostgREST and Storage APIs.
    Zero external dependency — runs with Python standard library.
    """

    def __init__(self, config: Optional[SupabaseClientConfig] = None):
        self.config = config or SupabaseClientConfig()

    def _headers(self, use_service_key: bool = True) -> Dict[str, str]:
        key = self.config.service_role_key if use_service_key else self.config.anon_key
        return {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    def post(self, table: str, payload: Dict[str, Any], use_service_key: bool = True) -> Dict[str, Any]:
        """Performs HTTP POST /rest/v1/{table}."""
        if not self.config.is_configured:
            raise RuntimeError("Supabase is not configured.")

        url = f"{self.config.supabase_url}/rest/v1/{table}"
        data = json.dumps(payload).encode("utf-8")
        req = request.Request(url, data=data, headers=self._headers(use_service_key), method="POST")

        try:
            with request.urlopen(req, timeout=10) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except error.HTTPError as e:
            err_body = e.read().decode("utf-8")
            raise RuntimeError(f"Supabase REST error on POST {table}: {e.code} - {err_body}")

    def get(self, table: str, query_params: Optional[Dict[str, str]] = None, use_service_key: bool = True) -> Any:
        """Performs HTTP GET /rest/v1/{table}?{query}."""
        if not self.config.is_configured:
            raise RuntimeError("Supabase is not configured.")

        url = f"{self.config.supabase_url}/rest/v1/{table}"
        if query_params:
            url += f"?{parse.urlencode(query_params)}"

        req = request.Request(url, headers=self._headers(use_service_key), method="GET")

        try:
            with request.urlopen(req, timeout=10) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw else []
        except error.HTTPError as e:
            err_body = e.read().decode("utf-8")
            raise RuntimeError(f"Supabase REST error on GET {table}: {e.code} - {err_body}")
