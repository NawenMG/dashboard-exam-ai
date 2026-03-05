import math
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole


PAGE_SIZE_DEFAULT = 5
PAGE_SIZE_MAX = 50


def _normalize_like(s: str) -> str:
    # Escape semplice per LIKE; in MariaDB backslash funziona con ESCAPE default.
    s = s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{s.strip()}%"


class UserRepository:
    # Lista degli studenti con filtri opzionali (GET: role)
    @staticmethod
    async def list_students(
        db: AsyncSession,
        *,
        page: int = 1,
        page_size: int = PAGE_SIZE_DEFAULT,
        first_name: str | None = None,
        last_name: str | None = None,
        email: str | None = None,
        matricola: str | None = None,
    ) -> tuple[list[User], int]:
        """
        Ritorna (items, total) di studenti con filtri LIKE opzionali.
        """
        page = max(page, 1)
        page_size = min(max(page_size, 1), PAGE_SIZE_MAX)
        offset = (page - 1) * page_size

        stmt = select(User).where(User.role == UserRole.student)

        if first_name:
            stmt = stmt.where(User.first_name.ilike(_normalize_like(first_name)))
        if last_name:
            stmt = stmt.where(User.last_name.ilike(_normalize_like(last_name)))
        if email:
            stmt = stmt.where(User.email.ilike(_normalize_like(email)))
        if matricola:
            stmt = stmt.where(User.matricola.ilike(_normalize_like(matricola)))

        # count
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await db.execute(count_stmt)).scalar_one()

        # data
        stmt = (
            stmt.order_by(User.last_name.asc(), User.first_name.asc())
            .offset(offset)
            .limit(page_size)
        )
        items = (await db.execute(stmt)).scalars().all()

        return items, total

    # Lista degli insegnanti (GET: role)
    @staticmethod
    async def list_teachers(
        db: AsyncSession,
        *,
        page: int = 1,
        page_size: int = PAGE_SIZE_DEFAULT,
        first_name: str | None = None,
        last_name: str | None = None,
        subject: str | None = None,
    ) -> tuple[list[User], int]:
        """
        Ritorna (items, total) di docenti con filtri LIKE opzionali.
        """
        page = max(page, 1)
        page_size = min(max(page_size, 1), PAGE_SIZE_MAX)
        offset = (page - 1) * page_size

        stmt = select(User).where(User.role == UserRole.teacher)

        if first_name:
            stmt = stmt.where(User.first_name.ilike(_normalize_like(first_name)))
        if last_name:
            stmt = stmt.where(User.last_name.ilike(_normalize_like(last_name)))
        if subject:
            stmt = stmt.where(User.subject.ilike(_normalize_like(subject)))

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await db.execute(count_stmt)).scalar_one()

        stmt = (
            stmt.order_by(User.last_name.asc(), User.first_name.asc())
            .offset(offset)
            .limit(page_size)
        )
        items = (await db.execute(stmt)).scalars().all()

        return items, total
