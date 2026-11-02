"""Pydantic-схемы запросов/ответов (контракт как у фронта / api.mock)."""
from datetime import date
from decimal import Decimal
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, PlainSerializer


# ---------- auth ----------

class LoginIn(BaseModel):
    login: str = Field(min_length=1, max_length=255)  # email | ник | имя
    password: str = Field(min_length=1, max_length=200)


class RegisterIn(BaseModel):
    email: EmailStr
    login: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=6, max_length=200)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    login: str


class LoginOut(BaseModel):
    token: str
    user: UserOut


class RegisterStartOut(BaseModel):
    email: str
    message: str = "code_sent"
    # только при AUTH_DEV_RETURN_CODE=true
    dev_code: str | None = None


class RegisterConfirmIn(BaseModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=10)


class ResendCodeIn(BaseModel):
    email: EmailStr


# ---------- общие ----------

Currency = Literal["RUB", "USD", "EUR", "KZT", "BYN"]

# В JSON уходит number, не "123.45"
Dec = Annotated[Decimal, PlainSerializer(lambda v: float(v), return_type=float)]
Kind = Literal["i", "e"]


class CategoryIn(BaseModel):
    type: Kind
    name: str = Field(min_length=1, max_length=100)


class CategoryOut(CategoryIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class OperationIn(BaseModel):
    type: Kind
    name: str = Field(min_length=1, max_length=100)
    amount: Dec = Field(gt=0, decimal_places=2)
    currency: Currency = "RUB"
    date: date
    category_id: int
    note: str = Field(default="", max_length=255)


class OperationOut(OperationIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    locked: bool = False
    source_type: str | None = None
    source_id: int | None = None


class GoalIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    target: Dec = Field(gt=0)
    saved: Dec = Field(default=Decimal("0"), ge=0)
    currency: Currency = "RUB"
    due: date


class GoalOut(GoalIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class DebtIn(BaseModel):
    direction: Literal["owe", "owed"]
    amount: Dec = Field(gt=0)
    currency: Currency = "RUB"
    due: date
    note: str = Field(default="", max_length=255)


class DebtOut(DebtIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class LoanIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    amount: Dec = Field(gt=0)
    rate: Dec = Field(ge=0, le=100)
    paid: Dec = Field(default=Decimal("0"), ge=0)
    start_date: date
    term_months: int = Field(ge=1, le=600)
    currency: Currency = "RUB"

    @field_validator("paid")
    @classmethod
    def paid_not_absurd(cls, v: Decimal, info):  # noqa: ANN001
        amount = info.data.get("amount") if info.data else None
        if amount is not None and v > amount * 3:
            raise ValueError("paid too large")
        return v


class AmountIn(BaseModel):
    amount: Dec = Field(gt=0)


class LoanOut(LoanIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
