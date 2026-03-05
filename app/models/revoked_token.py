from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base  # o dove importi Base


# Permette di invalidare un jwt prima della sua scadenza
class RevokedToken(Base):
    __tablename__ = "revoked_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    jti: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False)
    revoked_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        Index("ix_revoked_tokens_user_id", "user_id"),
        Index("ix_revoked_tokens_expires_at", "expires_at"),
    )
