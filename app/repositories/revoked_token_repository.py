from datetime import datetime
from sqlalchemy.orm import Session

from app.models.revoked_token import RevokedToken


class RevokedTokenRepository:
    # Verifica se un token è stato revocato (GET)
    @staticmethod
    def is_revoked(db: Session, jti: str) -> bool:
        row = (
            db.query(RevokedToken)
            .filter(RevokedToken.jti == jti, RevokedToken.is_active == True)
            .first()
        )
        return row is not None

    # Per revocare un token inserendolo in una blacklist (DELETE/PUT)
    @staticmethod
    def revoke(
        db: Session,
        *,
        jti: str,
        user_id: int,
        expires_at: datetime,
        revoked_at: datetime
    ) -> RevokedToken:
        row = RevokedToken(
            jti=jti,
            user_id=user_id,
            revoked_at=revoked_at,
            expires_at=expires_at,
            is_active=True,
        )
        db.add(row)
        db.flush()
        return row
