# Connessione a MariaDB, creazione dell'engine SQLAlchemy e la creazione delle sessioni del db usate dall'app
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from dotenv import load_dotenv

load_dotenv()


DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL non configurato")


engine = create_engine(
    DATABASE_URL,
    echo=False,  # metti True per debug SQL
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)
