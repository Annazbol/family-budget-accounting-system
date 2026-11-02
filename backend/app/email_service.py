"""Отправка писем. Без SMTP — код только в лог (удобно для локальной разработки)."""
from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from app.config import get_settings

logger = logging.getLogger(__name__)


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
            logger.warning("SMTP not configured — verification code for %s: %s", to_email, code)
            print(f"[DEV] Verification code for {to_email}: {code}", flush=True)
            return
        raise RuntimeError(
            "SMTP is not configured; set SMTP_HOST or use APP_ENV=development with AUTH_DEV_RETURN_CODE=true"
        )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to_email
    msg.set_content(body)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
        if settings.smtp_tls:
            smtp.starttls()
        if settings.smtp_user:
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(msg)
    logger.info("verification email sent to %s", to_email)
