from pydantic import BaseModel, EmailStr
from typing import Optional


class UserOut(BaseModel):
    id: int
    email: EmailStr
    role: str
    first_name: str
    last_name: str
    matricola: Optional[str] = None
    subject: Optional[str] = None

    class Config:
        from_attributes = True


class PageMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class PagedUsers(BaseModel):
    items: list[UserOut]
    meta: PageMeta
