# alembic/env.py
import os
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine

from dotenv import load_dotenv

# Carica .env (ok sia in container che in locale se presente)
load_dotenv()

# IMPORTANTE:
# 1) importa Base (target_metadata)
# 2) importa app.models per "registrare" TUTTI i modelli sul metadata
from app.db.base import Base
import app.models  # noqa: F401  # IMPORTANT: registra i model (non rimuovere)

# Alembic Config object
config = context.config

# Logging config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# DB URL
database_url = os.getenv("DATABASE_URL")
if not database_url:
    raise RuntimeError("DATABASE_URL not set")

# Alembic legge l'URL da qui (utile per offline mode e per log)
config.set_main_option("sqlalchemy.url", database_url)

# Metadata da usare per autogenerate
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Migrazioni in modalità offline: non apre connessioni."""
    url = config.get_main_option("sqlalchemy.url")

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        # Se un domani rinomini colonne/tabelle aiuta (opzionale)
        # compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    """Questa gira in sync dentro run_sync()."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        # Se vuoi essere più "strict" su default lato server:
        # compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Migrazioni in modalità online: usa engine ASYNC."""
    connectable = create_async_engine(
        database_url,
        poolclass=pool.NullPool,
        pool_pre_ping=True,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
