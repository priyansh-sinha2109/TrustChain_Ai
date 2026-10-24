import httpx
from fastapi import Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .errors import AppError
from .models import User

bearer = HTTPBearer(auto_error=False)


async def authenticate(request: Request) -> User:
    credentials: HTTPAuthorizationCredentials | None = await bearer(request)
    if not credentials:
        raise AppError("UNAUTHENTICATED", "A Bearer access token is required.", 401)
    settings = request.app.state.settings
    if not settings.supabase_url or not settings.supabase_anon_key.get_secret_value():
        raise AppError("AUTH_UNAVAILABLE", "Supabase authentication is not configured.", 503)
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=False) as client:
            response = await client.get(
                settings.supabase_url.rstrip("/") + "/auth/v1/user",
                headers={"apikey": settings.supabase_anon_key.get_secret_value(),
                         "Authorization": f"Bearer {credentials.credentials}"},
            )
        if response.status_code in (401, 403):
            raise AppError("UNAUTHENTICATED", "Access token is invalid or expired.", 401)
        response.raise_for_status()
        return User.model_validate(response.json())
    except (httpx.HTTPError, ValueError):
        raise AppError("AUTH_UNAVAILABLE", "Authentication could not be verified.", 503) from None
