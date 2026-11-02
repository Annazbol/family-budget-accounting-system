"""
CRUD-операции по коллекциям с фильтрацией по user_id.

Вызываются из роутеров API. При IntegrityError (RESTRICT категории и т.п.)
роутер должен отдавать 409.
"""
from datetime import date
from decimal import Decimal
from typing import Any, Optional, Sequence, Type, TypeVar

from sqlalchemy import Select, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Category, Debt, Goal, Loan, Operation, User
from app.loan_math import remaining_to_pay
from app.system_categories import GOALS as CAT_GOALS, LOANS as CAT_LOANS

T = TypeVar("T")


class NotFoundError(Exception):
    pass


class ConflictError(Exception):
    """Аналог HTTP 409 (категория с операциями, чужая запись и т.п.)."""


class ValidationError(Exception):
    """Аналог HTTP 422."""


# ---------- users ----------

def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.get(User, user_id)


def get_user_by_login_or_email(db: Session, login: str) -> Optional[User]:
    """Поиск только по login или email (не по отображаемому имени)."""
    key = login.strip().lower()
    q = select(User).where(
        (User.login.ilike(key)) | (User.email.ilike(key))
    )
    return db.execute(q).scalars().first()


def create_user(
    db: Session,
    *,
    email: str,
    login: str,
    name: str,
    password_hash: str,
) -> User:
    user = User(email=email, login=login, name=name, password_hash=password_hash)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ---------- generic helpers ----------

def _get_owned(db: Session, model: Type[T], item_id: int, user_id: int) -> T:
    obj = db.get(model, item_id)
    if obj is None or getattr(obj, "user_id", None) != user_id:
        raise NotFoundError()
    return obj


def list_owned(db: Session, model: Type[T], user_id: int) -> Sequence[T]:
    q: Select[tuple[T]] = select(model).where(model.user_id == user_id).order_by(model.id)  # type: ignore[attr-defined]
    return db.execute(q).scalars().all()


def delete_owned(db: Session, model: Type[T], item_id: int, user_id: int) -> None:
    obj = _get_owned(db, model, item_id, user_id)
    try:
        db.delete(obj)
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise ConflictError("integrity") from e


# ---------- categories ----------

def list_categories(db: Session, user_id: int) -> Sequence[Category]:
    return list_owned(db, Category, user_id)


def create_category(db: Session, user_id: int, *, type: str, name: str) -> Category:
    if type not in ("i", "e"):
        raise ValidationError("type")
    cat = Category(user_id=user_id, type=type, name=name)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


def update_category(db: Session, user_id: int, item_id: int, *, type: str, name: str) -> Category:
    cat = _get_owned(db, Category, item_id, user_id)
    if cat.name.startswith("system."):
        raise ConflictError("system category")
    if type not in ("i", "e"):
        raise ValidationError("type")
    # Нельзя сменить тип, пока есть операции (как checkRules в mock)
    if cat.type != type:
        has_ops = db.execute(
            select(Operation.id).where(Operation.category_id == cat.id).limit(1)
        ).first()
        if has_ops:
            raise ConflictError("integrity")
    cat.type = type
    cat.name = name
    db.commit()
    db.refresh(cat)
    return cat


def delete_category(db: Session, user_id: int, item_id: int) -> None:
    # RESTRICT в БД + явная проверка для понятного 409
    cat = _get_owned(db, Category, item_id, user_id)
    if cat.name.startswith("system."):
        raise ConflictError("system category")
    has_ops = db.execute(
        select(Operation.id).where(Operation.category_id == cat.id).limit(1)
    ).first()
    if has_ops:
        raise ConflictError("integrity")
    db.delete(cat)
    db.commit()



def ensure_system_category(db: Session, user_id: int, name: str) -> Category:
    """Категория расхода для системных операций. name — стабильный ключ (system.goals / system.loans)."""
    q = select(Category).where(Category.user_id == user_id, Category.type == "e", Category.name == name)
    cat = db.execute(q).scalars().first()
    if cat:
        return cat
    cat = Category(user_id=user_id, type="e", name=name)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


def _today() -> date:
    from datetime import date as _d
    return _d.today()

# ---------- operations ----------

def list_operations(
    db: Session,
    user_id: int,
    *,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    type: Optional[str] = None,
    category_id: Optional[int] = None,
) -> Sequence[Operation]:
    q = select(Operation).where(Operation.user_id == user_id)
    if date_from is not None:
        q = q.where(Operation.date >= date_from)
    if date_to is not None:
        q = q.where(Operation.date <= date_to)
    if type is not None:
        q = q.where(Operation.type == type)
    if category_id is not None:
        q = q.where(Operation.category_id == category_id)
    q = q.order_by(Operation.id)
    return db.execute(q).scalars().all()


def operations_totals(
    db: Session,
    user_id: int,
    *,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    type: Optional[str] = None,
    category_id: Optional[int] = None,
) -> list[dict[str, Any]]:
    """Агрегация как GET /operations/totals в mock."""
    ops = list_operations(
        db, user_id,
        date_from=date_from, date_to=date_to, type=type, category_id=category_id,
    )
    g: dict[tuple, dict[str, Any]] = {}
    for o in ops:
        key = (o.type, o.currency, o.date.isoformat(), o.category_id)
        if key not in g:
            g[key] = {
                "type": o.type,
                "currency": o.currency,
                "date": o.date.isoformat(),
                "category_id": o.category_id,
                "amount": Decimal("0"),
            }
        g[key]["amount"] = (g[key]["amount"] + o.amount).quantize(Decimal("0.01"))
    rows = list(g.values())
    for r in rows:
        r["amount"] = float(r["amount"])
    rows.sort(key=lambda r: r["date"])
    return rows


def _check_op_category(db: Session, user_id: int, category_id: int, op_type: str) -> None:
    cat = db.get(Category, category_id)
    if cat is None or cat.user_id != user_id:
        raise ConflictError("integrity")  # 409 как в mock
    if cat.type != op_type:
        raise ValidationError("category type mismatch")


def create_operation(db: Session, user_id: int, data: dict[str, Any]) -> Operation:
    _check_op_category(db, user_id, int(data["category_id"]), data["type"])
    op = Operation(user_id=user_id, **data)
    db.add(op)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise ConflictError("integrity") from e
    db.refresh(op)
    return op


def update_operation(db: Session, user_id: int, item_id: int, data: dict[str, Any]) -> Operation:
    op = _get_owned(db, Operation, item_id, user_id)
    if getattr(op, "locked", False):
        raise ConflictError("locked")
    _check_op_category(db, user_id, int(data["category_id"]), data["type"])
    for k, v in data.items():
        setattr(op, k, v)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise ConflictError("integrity") from e
    db.refresh(op)
    return op


def delete_operation(db: Session, user_id: int, item_id: int) -> None:
    op = _get_owned(db, Operation, item_id, user_id)
    if getattr(op, "locked", False):
        raise ConflictError("locked")
    db.delete(op)
    db.commit()


# ---------- goals / debts / loans ----------

def list_goals(db: Session, user_id: int) -> Sequence[Goal]:
    return list_owned(db, Goal, user_id)


def create_goal(db: Session, user_id: int, data: dict[str, Any]) -> Goal:
    g = Goal(user_id=user_id, **data)
    db.add(g)
    db.commit()
    db.refresh(g)
    return g


def update_goal(db: Session, user_id: int, item_id: int, data: dict[str, Any]) -> Goal:
    g = _get_owned(db, Goal, item_id, user_id)
    for k, v in data.items():
        setattr(g, k, v)
    db.commit()
    db.refresh(g)
    return g


def delete_goal(db: Session, user_id: int, item_id: int) -> None:
    delete_owned(db, Goal, item_id, user_id)


def contribute_goal(db: Session, user_id: int, item_id: int, amount: Decimal) -> Goal:
    g = _get_owned(db, Goal, item_id, user_id)
    if amount <= 0:
        raise ValidationError("amount")
    new_saved = (g.saved or Decimal("0")) + amount
    if new_saved > g.target:
        raise ValidationError("over target")
    cat = ensure_system_category(db, user_id, CAT_GOALS)
    op = Operation(
        user_id=user_id,
        type="e",
        name=f"goal:{g.id}",
        amount=amount,
        currency=g.currency,
        date=_today(),
        category_id=cat.id,
        note=g.name,
        locked=True,
        source_type="goal",
        source_id=g.id,
    )
    db.add(op)
    g.saved = new_saved
    db.commit()
    db.refresh(g)
    return g




def list_debts(db: Session, user_id: int) -> Sequence[Debt]:
    return list_owned(db, Debt, user_id)


def create_debt(db: Session, user_id: int, data: dict[str, Any]) -> Debt:
    d = Debt(user_id=user_id, **data)
    db.add(d)
    db.commit()
    db.refresh(d)
    return d


def update_debt(db: Session, user_id: int, item_id: int, data: dict[str, Any]) -> Debt:
    d = _get_owned(db, Debt, item_id, user_id)
    for k, v in data.items():
        setattr(d, k, v)
    db.commit()
    db.refresh(d)
    return d


def delete_debt(db: Session, user_id: int, item_id: int) -> None:
    delete_owned(db, Debt, item_id, user_id)


def list_loans(db: Session, user_id: int) -> Sequence[Loan]:
    return list_owned(db, Loan, user_id)


def create_loan(db: Session, user_id: int, data: dict[str, Any]) -> Loan:
    if data.get("paid", 0) > data.get("amount", 0):
        raise ValidationError("paid > amount")
    loan = Loan(user_id=user_id, **data)
    db.add(loan)
    db.commit()
    db.refresh(loan)
    return loan


def update_loan(db: Session, user_id: int, item_id: int, data: dict[str, Any]) -> Loan:
    loan = _get_owned(db, Loan, item_id, user_id)
    if data.get("paid", 0) > data.get("amount", 0):
        raise ValidationError("paid > amount")
    for k, v in data.items():
        setattr(loan, k, v)
    db.commit()
    db.refresh(loan)
    return loan


def delete_loan(db: Session, user_id: int, item_id: int) -> None:
    delete_owned(db, Loan, item_id, user_id)


def pay_loan(db: Session, user_id: int, item_id: int, amount: Decimal) -> Loan:
    """Платёж по кредиту: проверка остатка по аннуитету + locked-операция с source."""
    loan = _get_owned(db, Loan, item_id, user_id)
    if amount <= 0:
        raise ValidationError("amount")
    left = remaining_to_pay(
        float(loan.amount),
        float(loan.rate),
        int(loan.term_months),
        float(loan.paid or 0),
    )
    if float(amount) > left + 0.02:
        raise ValidationError("over remaining")
    new_paid = (loan.paid or Decimal("0")) + amount
    cat = ensure_system_category(db, user_id, CAT_LOANS)
    op = Operation(
        user_id=user_id,
        type="e",
        name=f"loan:{loan.id}",
        amount=amount,
        currency=loan.currency,
        date=_today(),
        category_id=cat.id,
        note=loan.name,
        locked=True,
        source_type="loan",
        source_id=loan.id,
    )
    db.add(op)
    loan.paid = new_paid
    db.commit()
    db.refresh(loan)
    return loan


