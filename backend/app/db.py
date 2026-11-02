"""
Подключение к PostgreSQL (SQLAlchemy 2.x).

Использование в FastAPI:
    from app.db import get_db, SessionLocal, engine

    @app.get(...)
    def handler(db: Session = Depends(get_db)):
        ...
"""
from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

settings = get_settings()

# pool_pre_ping — переподключение, если Postgres перезапустили
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, class_=Session)


class Base(DeclarativeBase):
    """Базовый класс моделей ORM."""


def get_db() -> Generator[Session, None, None]:
    """Зависимость FastAPI: одна сессия на запрос, commit/rollback снаружи или в эндпоинте."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_connection() -> bool:
    """Проверка доступности БД (healthcheck)."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def create_all_tables() -> None:
    """Создать таблицы из моделей (удобно для dev; в проде — миграции Alembic)."""
    # Импорт моделей регистрирует их в Base.metadata
    import app.models  # noqa: F401

    Base.metadata.create_all(bind=engine)
