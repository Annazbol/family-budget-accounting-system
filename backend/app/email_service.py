"""Отправка писем. Без SMTP / при сбое SMTP в dev — код в лог."""
from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from app.config import get_settings

logger = logging.getLogger(__name__)


def _dev_print(to_email: str, code: str) -> None:
    logger.warning("DEV verification code for %s: %s", to_email, code)
    print(f"[DEV] Verification code for {to_email}: {code}", flush=True)


def send_verification_email(to_email: str, code: str) -> None:
    settings = get_settings()
    subject = "Код подтверждения — Семейный бюджет"
    body = (
        f"Ваш код подтверждения: {code}\n\n"
        f"Код действует {settings.verify_code_ttl_minutes} минут.\n"
        "Если вы не регистрировались, просто игнорируйте письмо.\n"
    )

    if not settings.smtp_host:
        if settings.allow_dev_code:
            _dev_print(to_email, code)
            return
        raise RuntimeError(
            "SMTP is not configured; set SMTP_HOST or use APP_ENV=development with AUTH_DEV_RETURN_CODE=true"
        )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from or settings.smtp_user
    msg["To"] = to_email
    msg.set_content(body)

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
            if settings.smtp_tls:
                smtp.starttls()
            if settings.smtp_user:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(msg)
        logger.info("verification email sent to %s", to_email)
    except Exception as e:
        logger.exception("SMTP failed: %s", e)
        if settings.allow_dev_code:
            _dev_print(to_email, code)
            return
        raise RuntimeError(f"SMTP error: {e}") from e
