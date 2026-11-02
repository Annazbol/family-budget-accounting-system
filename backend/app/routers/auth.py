"""
Auth API: register (email code), login, logout (JWT blacklist), me.

Токен: httpOnly cookie + поле token в JSON (для мобилки / Bearer).
Logout отзывает jti до истечения срока.
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app import crud
from app.config import get_settings
from app.deps import CurrentUser, DbSession
from app.email_service import send_verification_email
from app.models_verification import EmailVerification
from app.rate_limit import allow as rate_allow
from app.schemas import (
    LoginIn,
    LoginOut,
    RegisterConfirmIn,
    RegisterIn,
    RegisterStartOut,
    ResendCodeIn,
    UserOut,
)
from app.security import (
    create_access_token,
    generate_verification_code,
    hash_password,
    hash_verification_code,
    revoke_token,
    verify_password,
    verify_verification_code,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _norm_email(email: str) -> str:
    return str(email).strip().lower()


def _set_auth_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=settings.cookie_name,
        value=token,
        httponly=True,
        secure=settings.cookie_secure or settings.is_production,
        samesite="lax",
        max_age=settings.jwt_expire_minutes * 60,
        path="/",
    )


def _clear_auth_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(key=settings.cookie_name, path="/")


def _extract_raw_token(request: Request) -> str | None:
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if auth and auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return request.cookies.get(get_settings().cookie_name)


def _ensure_free(db: DbSession, email: str, login: str) -> None:
    if crud.get_user_by_login_or_email(db, email) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="login or email taken")
    if crud.get_user_by_login_or_email(db, login) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="login or email taken")


def _save_verification(
    db: DbSession,
    *,
    email: str,
    login: str,
    name: str,
    password_hash: str,
    code: str,
) -> None:
    settings = get_settings()
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.verify_code_ttl_minutes)
    code_hash = hash_verification_code(code)

    row = db.execute(
        select(EmailVerification).where(EmailVerification.email == email)
    ).scalar_one_or_none()
    if row is None:
        row = EmailVerification(
            email=email,
            login=login,
            name=name,
            password_hash=password_hash,
            code_hash=code_hash,
            expires_at=expires,
        )
        db.add(row)
    else:
        row.login = login
        row.name = name
        row.password_hash = password_hash
        row.code_hash = code_hash
        row.expires_at = expires
    db.commit()


@router.post("/register/start", response_model=RegisterStartOut)
def register_start(request: Request, body: RegisterIn, db: DbSession) -> RegisterStartOut:
    ip = request.client.host if request.client else "unknown"
    if not rate_allow(f"reg:{ip}", limit=5, window_sec=600):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="too many requests")

    email = _norm_email(str(body.email))
    login = body.login.strip()
    name = body.name.strip()
    _ensure_free(db, email, login)

    code = generate_verification_code(6)
    _save_verification(
        db,
        email=email,
        login=login,
        name=name,
        password_hash=hash_password(body.password),
        code=code,
    )
    send_verification_email(email, code)

    settings = get_settings()
    return RegisterStartOut(
        email=email,
        message="code_sent",
        dev_code=code if settings.allow_dev_code else None,
    )


@router.post("/register/resend", response_model=RegisterStartOut)
def register_resend(request: Request, body: ResendCodeIn, db: DbSession) -> RegisterStartOut:
    ip = request.client.host if request.client else "unknown"
    if not rate_allow(f"resend:{ip}", limit=5, window_sec=600):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="too many requests")

    email = _norm_email(str(body.email))
    row = db.execute(
        select(EmailVerification).where(EmailVerification.email == email)
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="no pending registration")

    code = generate_verification_code(6)
    row.code_hash = hash_verification_code(code)
    row.expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=get_settings().verify_code_ttl_minutes
    )
    db.commit()
    send_verification_email(email, code)

    settings = get_settings()
    return RegisterStartOut(
        email=email,
        message="code_sent",
        dev_code=code if settings.allow_dev_code else None,
    )


@router.post("/register/confirm", response_model=LoginOut)
def register_confirm(body: RegisterConfirmIn, db: DbSession, response: Response) -> LoginOut:
    email = _norm_email(str(body.email))
    row = db.execute(
        select(EmailVerification).where(EmailVerification.email == email)
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="no pending registration")

    exp = row.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="code expired")

    if not verify_verification_code(body.code, row.code_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid code")

    _ensure_free(db, row.email, row.login)

    try:
        user = crud.create_user(
            db,
            email=row.email,
            login=row.login,
            name=row.name,
            password_hash=row.password_hash,
        )
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="login or email taken")

    db.delete(row)
    db.commit()

    token = create_access_token(user.id)
    _set_auth_cookie(response, token)
    return LoginOut(token=token, user=UserOut.model_validate(user))


@router.post("/register", response_model=RegisterStartOut, include_in_schema=False)
def register_legacy(request: Request, body: RegisterIn, db: DbSession) -> RegisterStartOut:
    return register_start(request, body, db)


@router.post("/login", response_model=LoginOut)
def login(request: Request, body: LoginIn, db: DbSession, response: Response) -> LoginOut:
    ip = request.client.host if request.client else "unknown"
    if not rate_allow(f"login:{ip}", limit=20, window_sec=60):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="too many requests")
    user = crud.get_user_by_login_or_email(db, body.login)
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="unauthorized")
    token = create_access_token(user.id)
    _set_auth_cookie(response, token)
    return LoginOut(token=token, user=UserOut.model_validate(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, user: CurrentUser) -> None:
    _ = user
    raw = _extract_raw_token(request)
    if raw:
        revoke_token(raw)
    _clear_auth_cookie(response)
    return None


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)
