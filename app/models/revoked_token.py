from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Index
from app.db.base import Base  # o dove importi Base


# Permette di invalidare un jwt prima della sua scadenza
class RevokedToken(Base):
    __tablename__ = "revoked_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    jti = Column(String(64), unique=True, nullable=False)
    user_id = Column(Integer, nullable=False)
    revoked_at = Column(DateTime, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)

    __table_args__ = (
        Index("ix_revoked_tokens_user_id", "user_id"),
        Index("ix_revoked_tokens_expires_at", "expires_at"),
    )
