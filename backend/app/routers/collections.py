"""
CRUD API коллекций — контракт как у api.mock / фронта.

Все эндпоинты требуют Bearer (get_current_user).
Данные всегда фильтруются по user_id.
"""
from datetime import date
from decimal import Decimal
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query, status

from app import crud
from app.crud import ConflictError, NotFoundError, ValidationError
from app.deps import CurrentUser, DbSession
from app.schemas import (
    CategoryIn,
    CategoryOut,
    DebtIn,
    DebtOut,
    GoalIn,
    GoalOut,
    LoanIn,
    LoanOut,
    AmountIn,
    OperationIn,
    OperationOut,
)

router = APIRouter(tags=["collections"])


def _http(exc: Exception) -> HTTPException:
    if isinstance(exc, NotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not found")
    if isinstance(exc, ConflictError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail="integrity")
    if isinstance(exc, ValidationError):
        return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="validation")
    raise exc


def _dec(v: Any) -> Any:
    """Decimal → float для JSON (как на фронте)."""
    if isinstance(v, Decimal):
        return float(v)
    return v


def _model_dump_out(obj: Any, schema: type) -> Any:
    data = schema.model_validate(obj)
    # pydantic v2
    d = data.model_dump()
    return {k: _dec(v) for k, v in d.items()}


# ---------- categories ----------

@router.get("/categories", response_model=list[CategoryOut])
def get_categories(user: CurrentUser, db: DbSession) -> list[CategoryOut]:
    return [CategoryOut.model_validate(c) for c in crud.list_categories(db, user.id)]


@router.post("/categories", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def post_category(body: CategoryIn, user: CurrentUser, db: DbSession) -> CategoryOut:
    try:
        c = crud.create_category(db, user.id, type=body.type, name=body.name)
    except (ValidationError, ConflictError) as e:
        raise _http(e) from e
    return CategoryOut.model_validate(c)


@router.put("/categories/{item_id}", response_model=CategoryOut)
def put_category(item_id: int, body: CategoryIn, user: CurrentUser, db: DbSession) -> CategoryOut:
    try:
        c = crud.update_category(db, user.id, item_id, type=body.type, name=body.name)
    except (NotFoundError, ValidationError, ConflictError) as e:
        raise _http(e) from e
    return CategoryOut.model_validate(c)


@router.delete("/categories/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(item_id: int, user: CurrentUser, db: DbSession) -> None:
    try:
        crud.delete_category(db, user.id, item_id)
    except (NotFoundError, ConflictError) as e:
        raise _http(e) from e


# ---------- operations ----------

@router.get("/operations", response_model=list[OperationOut])
def get_operations(
    user: CurrentUser,
    db: DbSession,
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    type: Optional[str] = Query(None, pattern="^[ie]$"),
    category_id: Optional[int] = Query(None),
) -> list[OperationOut]:
    rows = crud.list_operations(
        db, user.id,
        date_from=date_from, date_to=date_to, type=type, category_id=category_id,
    )
    return [OperationOut.model_validate(o) for o in rows]


@router.get("/operations/totals")
def get_operations_totals(
    user: CurrentUser,
    db: DbSession,
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    type: Optional[str] = Query(None, pattern="^[ie]$"),
    category_id: Optional[int] = Query(None),
) -> list[dict[str, Any]]:
    return crud.operations_totals(
        db, user.id,
        date_from=date_from, date_to=date_to, type=type, category_id=category_id,
    )


@router.post("/operations", response_model=OperationOut, status_code=status.HTTP_201_CREATED)
def post_operation(body: OperationIn, user: CurrentUser, db: DbSession) -> OperationOut:
    data = body.model_dump()
    try:
        o = crud.create_operation(db, user.id, data)
    except (ValidationError, ConflictError) as e:
        raise _http(e) from e
    return OperationOut.model_validate(o)


@router.put("/operations/{item_id}", response_model=OperationOut)
def put_operation(item_id: int, body: OperationIn, user: CurrentUser, db: DbSession) -> OperationOut:
    data = body.model_dump()
    try:
        o = crud.update_operation(db, user.id, item_id, data)
    except (NotFoundError, ValidationError, ConflictError) as e:
        raise _http(e) from e
    return OperationOut.model_validate(o)


@router.delete("/operations/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_operation(item_id: int, user: CurrentUser, db: DbSession) -> None:
    try:
        crud.delete_operation(db, user.id, item_id)
    except NotFoundError as e:
        raise _http(e) from e


# ---------- goals ----------

@router.get("/goals", response_model=list[GoalOut])
def get_goals(user: CurrentUser, db: DbSession) -> list[GoalOut]:
    return [GoalOut.model_validate(g) for g in crud.list_goals(db, user.id)]


@router.post("/goals", response_model=GoalOut, status_code=status.HTTP_201_CREATED)
def post_goal(body: GoalIn, user: CurrentUser, db: DbSession) -> GoalOut:
    try:
        g = crud.create_goal(db, user.id, body.model_dump())
    except ValidationError as e:
        raise _http(e) from e
    return GoalOut.model_validate(g)


@router.put("/goals/{item_id}", response_model=GoalOut)
def put_goal(item_id: int, body: GoalIn, user: CurrentUser, db: DbSession) -> GoalOut:
    try:
        g = crud.update_goal(db, user.id, item_id, body.model_dump())
    except (NotFoundError, ValidationError) as e:
        raise _http(e) from e
    return GoalOut.model_validate(g)


@router.delete("/goals/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(item_id: int, user: CurrentUser, db: DbSession) -> None:
    try:
        crud.delete_goal(db, user.id, item_id)
    except NotFoundError as e:
        raise _http(e) from e


@router.post("/goals/{item_id}/contribute", response_model=GoalOut)
def contribute_goal(item_id: int, body: AmountIn, user: CurrentUser, db: DbSession) -> GoalOut:
    try:
        g = crud.contribute_goal(db, user.id, item_id, body.amount)
    except (NotFoundError, ValidationError) as e:
        raise _http(e) from e
    return GoalOut.model_validate(g)


# ---------- debts ----------

@router.get("/debts", response_model=list[DebtOut])
def get_debts(user: CurrentUser, db: DbSession) -> list[DebtOut]:
    return [DebtOut.model_validate(d) for d in crud.list_debts(db, user.id)]


@router.post("/debts", response_model=DebtOut, status_code=status.HTTP_201_CREATED)
def post_debt(body: DebtIn, user: CurrentUser, db: DbSession) -> DebtOut:
    d = crud.create_debt(db, user.id, body.model_dump())
    return DebtOut.model_validate(d)


@router.put("/debts/{item_id}", response_model=DebtOut)
def put_debt(item_id: int, body: DebtIn, user: CurrentUser, db: DbSession) -> DebtOut:
    try:
        d = crud.update_debt(db, user.id, item_id, body.model_dump())
    except NotFoundError as e:
        raise _http(e) from e
    return DebtOut.model_validate(d)


@router.delete("/debts/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_debt(item_id: int, user: CurrentUser, db: DbSession) -> None:
    try:
        crud.delete_debt(db, user.id, item_id)
    except NotFoundError as e:
        raise _http(e) from e


# ---------- loans ----------

@router.get("/loans", response_model=list[LoanOut])
def get_loans(user: CurrentUser, db: DbSession) -> list[LoanOut]:
    return [LoanOut.model_validate(l) for l in crud.list_loans(db, user.id)]


@router.post("/loans", response_model=LoanOut, status_code=status.HTTP_201_CREATED)
def post_loan(body: LoanIn, user: CurrentUser, db: DbSession) -> LoanOut:
    try:
        loan = crud.create_loan(db, user.id, body.model_dump())
    except ValidationError as e:
        raise _http(e) from e
    return LoanOut.model_validate(loan)


@router.put("/loans/{item_id}", response_model=LoanOut)
def put_loan(item_id: int, body: LoanIn, user: CurrentUser, db: DbSession) -> LoanOut:
    try:
        loan = crud.update_loan(db, user.id, item_id, body.model_dump())
    except (NotFoundError, ValidationError) as e:
        raise _http(e) from e
    return LoanOut.model_validate(loan)


@router.delete("/loans/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_loan(item_id: int, user: CurrentUser, db: DbSession) -> None:
    try:
        crud.delete_loan(db, user.id, item_id)
    except NotFoundError as e:
        raise _http(e) from e


@router.post("/loans/{item_id}/pay", response_model=LoanOut)
def pay_loan(item_id: int, body: AmountIn, user: CurrentUser, db: DbSession) -> LoanOut:
    try:
        loan = crud.pay_loan(db, user.id, item_id, body.amount)
    except (NotFoundError, ValidationError) as e:
        raise _http(e) from e
    return LoanOut.model_validate(loan)
