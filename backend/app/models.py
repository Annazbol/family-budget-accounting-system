"""
ORM-модели = таблицы PostgreSQL.

Соответствуют sql/001_init.sql и контракту api.mock (фронт).
Все сущности пользователя привязаны к user_id.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    CHAR,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    SmallInteger,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

CURRENCIES = ("RUB", "USD", "EUR", "KZT", "BYN")


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("email", name="users_email_unique"),
        UniqueConstraint("login", name="users_login_unique"),
        CheckConstraint("char_length(email) BETWEEN 3 AND 255", name="users_email_len"),
        CheckConstraint("char_length(login) BETWEEN 1 AND 100", name="users_login_len"),
        CheckConstraint("char_length(name) BETWEEN 1 AND 100", name="users_name_len"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    login: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    categories: Mapped[list["Category"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    operations: Mapped[list["Operation"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    goals: Mapped[list["Goal"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    debts: Mapped[list["Debt"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    loans: Mapped[list["Loan"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (
        CheckConstraint("type IN ('i', 'e')", name="categories_type_check"),
        CheckConstraint("char_length(name) BETWEEN 1 AND 100", name="categories_name_len"),
        Index("categories_user_id_idx", "user_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[str] = mapped_column(CHAR(1), nullable=False)  # i | e
    name: Mapped[str] = mapped_column(Text, nullable=False)

    user: Mapped["User"] = relationship(back_populates="categories")
    operations: Mapped[list["Operation"]] = relationship(back_populates="category")


class Operation(Base):
    __tablename__ = "operations"
    __table_args__ = (
        CheckConstraint("type IN ('i', 'e')", name="operations_type_check"),
        CheckConstraint("amount > 0", name="operations_amount_pos"),
        CheckConstraint("currency IN ('RUB', 'USD', 'EUR', 'KZT', 'BYN')", name="operations_currency"),
        CheckConstraint("char_length(name) BETWEEN 1 AND 100", name="operations_name_len"),
        CheckConstraint("char_length(note) <= 255", name="operations_note_len"),
        Index("operations_user_id_idx", "user_id"),
        Index("operations_user_date_idx", "user_id", "date"),
        Index("operations_category_id_idx", "category_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[str] = mapped_column(CHAR(1), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(CHAR(3), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    # RESTRICT: нельзя удалить категорию, пока есть операции
    category_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False
    )
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # goal | loan | null — связь платежа с целью/кредитом
    source_type: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    source_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, default=None)

    user: Mapped["User"] = relationship(back_populates="operations")
    category: Mapped["Category"] = relationship(back_populates="operations")


class Goal(Base):
    __tablename__ = "goals"
    __table_args__ = (
        CheckConstraint("target > 0", name="goals_target_pos"),
        CheckConstraint("saved >= 0", name="goals_saved_nonneg"),
        CheckConstraint("currency IN ('RUB', 'USD', 'EUR', 'KZT', 'BYN')", name="goals_currency"),
        CheckConstraint("char_length(name) BETWEEN 1 AND 100", name="goals_name_len"),
        Index("goals_user_id_idx", "user_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    target: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    saved: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    currency: Mapped[str] = mapped_column(CHAR(3), nullable=False)
    due: Mapped[date] = mapped_column(Date, nullable=False)

    user: Mapped["User"] = relationship(back_populates="goals")


class Debt(Base):
    __tablename__ = "debts"
    __table_args__ = (
        CheckConstraint("direction IN ('owe', 'owed')", name="debts_direction"),
        CheckConstraint("amount > 0", name="debts_amount_pos"),
        CheckConstraint("currency IN ('RUB', 'USD', 'EUR', 'KZT', 'BYN')", name="debts_currency"),
        CheckConstraint("char_length(note) <= 255", name="debts_note_len"),
        Index("debts_user_id_idx", "user_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    direction: Mapped[str] = mapped_column(Text, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(CHAR(3), nullable=False)
    due: Mapped[date] = mapped_column(Date, nullable=False)
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")

    user: Mapped["User"] = relationship(back_populates="debts")


class Loan(Base):
    __tablename__ = "loans"
    __table_args__ = (
        CheckConstraint("amount > 0", name="loans_amount_pos"),
        CheckConstraint("paid >= 0", name="loans_paid_nonneg"),
        CheckConstraint("rate >= 0 AND rate <= 100", name="loans_rate_range"),
        CheckConstraint("term_months >= 1 AND term_months <= 600", name="loans_term_range"),
        CheckConstraint("currency IN ('RUB', 'USD', 'EUR', 'KZT', 'BYN')", name="loans_currency"),
        CheckConstraint("char_length(name) BETWEEN 1 AND 100", name="loans_name_len"),
        Index("loans_user_id_idx", "user_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    rate: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    paid: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    term_months: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    currency: Mapped[str] = mapped_column(CHAR(3), nullable=False)

    user: Mapped["User"] = relationship(back_populates="loans")



# реэкспорт для create_all / импортов
from app.models_verification import EmailVerification  # noqa: E402,F401
