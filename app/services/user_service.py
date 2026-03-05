import math
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.user_repository import UserRepository, PAGE_SIZE_DEFAULT
from app.schemas.user import PagedUsers, PageMeta, UserOut


class UserService:
    @staticmethod
    async def get_students(
        db: AsyncSession,
        *,
        page: int = 1,
        page_size: int = 5,
        first_name: str | None = None,
        last_name: str | None = None,
        email: str | None = None,
        matricola: str | None = None,
    ) -> PagedUsers:
        items, total = await UserRepository.list_students(
            db,
            page=page,
            page_size=page_size,
            first_name=first_name,
            last_name=last_name,
            email=email,
            matricola=matricola,
        )

        total_pages = max(1, math.ceil(total / page_size)) if page_size else 1

        return PagedUsers(
            items=[UserOut.model_validate(u) for u in items],
            meta=PageMeta(
                page=page,
                page_size=page_size,
                total=total,
                total_pages=total_pages,
            ),
        )

    @staticmethod
    async def get_teachers(
        db: AsyncSession,
        *,
        page: int = 1,
        page_size: int = 5,
        first_name: str | None = None,
        last_name: str | None = None,
        subject: str | None = None,
    ) -> PagedUsers:
        items, total = await UserRepository.list_teachers(
            db,
            page=page,
            page_size=page_size,
            first_name=first_name,
            last_name=last_name,
            subject=subject,
        )

        total_pages = max(1, math.ceil(total / page_size)) if page_size else 1

        return PagedUsers(
            items=[UserOut.model_validate(u) for u in items],
            meta=PageMeta(
                page=page,
                page_size=page_size,
                total=total,
                total_pages=total_pages,
            ),
        )
