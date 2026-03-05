# Connessione a Yugabyte YSQL (Postgres compat) con SQLAlchemy ASYNC
import os
from dotenv import load_dotenv

from sqlalchemy.ext.asyncio import (
    create_async_engine,
    async_sessionmaker,
    AsyncSession,
)

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL non configurato")

engine = create_async_engine(
    DATABASE_URL,
    echo=False,  # metti True per debug SQL
    pool_pre_ping=True,
)

SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)
