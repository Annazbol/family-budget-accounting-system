"""
Пароли и JWT.

- Пароль: только хеш (argon2).
- Access JWT (HS256): sub=user_id, jti=уникальный id (для logout/blacklist).
"""
from __future__ import annotations

import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any, NamedTuple, Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import get_settings
from app.token_blacklist import is_revoked, revoke

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, password_hash: str) -> bool:
    try:
        return pwd_context.verify(plain, password_hash)
    except Exception:
        return False


class TokenInfo(NamedTuple):
    user_id: int
    jti: str
    exp_ts: float


def create_access_token(user_id: int, expires_minutes: Optional[int] = None) -> str:
    settings = get_settings()
    minutes = expires_minutes if expires_minutes is not None else settings.jwt_expire_minutes
    now = datetime.now(timezone.utc)
    jti = secrets.token_urlsafe(16)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "jti": jti,
        "iat": now,
        "exp": now + timedelta(minutes=minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[TokenInfo]:
    """user_id + jti или None (битый/протух/отозван)."""
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        jti = payload.get("jti")
        exp = payload.get("exp")
        if sub is None:
            return None
        if jti and is_revoked(str(jti)):
            return None
        exp_ts = float(exp) if exp is not None else time.time() + 3600
        return TokenInfo(user_id=int(sub), jti=str(jti or ""), exp_ts=exp_ts)
    except (JWTError, ValueError, TypeError):
        return None


def revoke_token(token: str) -> None:
    """Добавить token в blacklist до его exp."""
    info = decode_access_token(token)
    # decode уже отсекает revoked; для отзыва нужно парсить без blacklist
    settings = get_settings()
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[ALGORITHM],
            options={"verify_exp": False},
        )
        jti = payload.get("jti")
        exp = payload.get("exp")
        if jti and exp:
            revoke(str(jti), float(exp))
    except (JWTError, ValueError, TypeError):
        if info and info.jti:
            revoke(info.jti, info.exp_ts)


def generate_verification_code(length: int = 6) -> str:
    return "".join(secrets.choice("0123456789") for _ in range(length))


def hash_verification_code(code: str) -> str:
    return hash_password(code.strip())


def verify_verification_code(plain: str, code_hash: str) -> bool:
    return verify_password(plain.strip(), code_hash)
