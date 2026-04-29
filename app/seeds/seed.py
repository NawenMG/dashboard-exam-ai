# app/seeds/seed.py
import os
import random
from datetime import datetime, timezone

from faker import Faker
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.db.session import SessionLocal as AsyncSessionLocal
from app.models.user import User, UserRole
from app.models.exam import Exam

fake = Faker("it_IT")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ---------- CONFIG ----------
NUM_STUDENTS = 50
NUM_TEACHERS = 10
NUM_EXAMS = 20

SUBJECTS = [
    "Matematica",
    "Fisica",
    "Informatica",
    "Statistica",
    "Algebra",
    "Analisi",
    "Database",
    "Reti",
    "AI",
    "Sistemi Operativi",
]

SEED_STRICT = os.getenv("SEED_STRICT", "false").lower() == "true"


# ---------- TIME HELPERS ----------
def utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ---------- UTILS ----------
def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def random_rubric():
    return {
        "type": "simple",
        "criteria": [
            {"name": "correttezza", "weight": 0.5},
            {"name": "completezza", "weight": 0.3},
            {"name": "chiarezza", "weight": 0.2},
        ],
    }


def random_questions():
    n = random.randint(2, 5)
    return {
        "questions": [
            {
                "text": fake.sentence(),
                "max_score": 30,
            }
            for _ in range(n)
        ]
    }


def default_ai_schema():
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "score": {"type": "number", "minimum": 0, "maximum": 30},
            "honors": {"type": "boolean", "default": False},
            "comment": {"type": "string"},
            "teacher_notes": {"type": "string", "default": ""},
        },
        "required": ["score", "honors", "comment"],
    }


# ---------- SEED HELPERS ----------
async def already_seeded(db) -> bool:
    result = await db.execute(select(User).where(User.email == "teacher0@test.com"))
    return result.scalars().first() is not None


async def get_or_create_user(db, *, email: str, defaults: dict) -> User:
    result = await db.execute(select(User).where(User.email == email))
    u = result.scalars().first()
    if u:
        return u

    u = User(email=email, **defaults)
    db.add(u)
    await db.flush()
    return u


async def seed_users(db):
    students, teachers = [], []

    print("Creating teachers...")
    for i in range(NUM_TEACHERS):
        email = f"teacher{i}@test.com"
        teacher = await get_or_create_user(
            db,
            email=email,
            defaults=dict(
                password_hash=hash_password("password"),
                role=UserRole.teacher.value,
                first_name=fake.first_name(),
                last_name=fake.last_name(),
                subject=SUBJECTS[i % len(SUBJECTS)],
                age=random.randint(30, 60),
            ),
        )
        teachers.append(teacher)

    print("Creating students...")
    for i in range(NUM_STUDENTS):
        email = f"student{i}@test.com"
        student = await get_or_create_user(
            db,
            email=email,
            defaults=dict(
                password_hash=hash_password("password"),
                role=UserRole.student.value,
                first_name=fake.first_name(),
                last_name=fake.last_name(),
                matricola=f"M{i:05d}",
                age=random.randint(18, 30),
            ),
        )
        students.append(student)

    await db.commit()
    return students, teachers


async def seed_exams(db, teachers):
    exams = []
    print("Creating exams...")

    for i in range(NUM_EXAMS):
        title = f"Esame {i}"

        result = await db.execute(select(Exam).where(Exam.title == title))
        existing = result.scalars().first()
        if existing:
            exams.append(existing)
            continue

        teacher = random.choice(teachers)

        exam = Exam(
            teacher_id=teacher.id,
            title=title,
            description=fake.text(),
            questions_json=random_questions(),
            rubric_json=random_rubric(),
            openai_schema_json=default_ai_schema(),
            materials_json=None,
            is_published=True,
            peer_debug_broadcast=False,
        )

        db.add(exam)
        exams.append(exam)

    await db.commit()
    return exams


async def run_seed():
    async with AsyncSessionLocal() as db:
        try:
            print("Seeding database...")

            if await already_seeded(db):
                print("Seed already applied (found teacher0@test.com). Skipping.")
                return

            students, teachers = await seed_users(db)
            await seed_exams(db, teachers)

            print("Seed completed!")
            print("Created users and exams only.")
            print(
                "No submissions, answers, evaluations or final grades were generated."
            )

        except IntegrityError:
            await db.rollback()
            msg = "Seed IntegrityError (likely already seeded)."
            if SEED_STRICT:
                raise
            print(msg)


if __name__ == "__main__":
    import asyncio

    asyncio.run(run_seed())
