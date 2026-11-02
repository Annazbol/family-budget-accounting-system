"""Зависимости FastAPI: БД и текущий пользователь (Bearer или cookie)."""
from typing import Annotated, Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import get_settings
from app.crud import get_user_by_id
from app.db import get_db
from app.models import User
from app.security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


def _extract_token(
    request: Request,
    creds: Optional[HTTPAuthorizationCredentials],
) -> Optional[str]:
    if creds and creds.credentials:
        return creds.credentials
    settings = get_settings()
    return request.cookies.get(settings.cookie_name)


def get_current_user(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    creds: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer_scheme)],
) -> User:
    token = _extract_token(request, creds)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="unauthorized")
    info = decode_access_token(token)
    if info is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="unauthorized")
    user = get_user_by_id(db, info.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="unauthorized")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
DbSession = Annotated[Session, Depends(get_db)]
