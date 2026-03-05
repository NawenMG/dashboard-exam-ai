# app/seeds/seed.py
import os
import random
from datetime import datetime, timezone
from decimal import Decimal

from faker import Faker
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.db.session import SessionLocal as AsyncSessionLocal
from app.models.user import User, UserRole
from app.models.exam import Exam
from app.models.submission import Submission, SubmissionStatus
from app.models.answer import Answer
from app.models.evaluation import Evaluation, EvaluatorType, EvaluationStatus
from app.models.final_grade import FinalGrade

fake = Faker("it_IT")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ---------- CONFIG ----------
NUM_STUDENTS = 50
NUM_TEACHERS = 10
NUM_EXAMS = 20
NUM_SUBMISSIONS = 120
PEER_TASKS_PER_STUDENT = 5
PEER_ASSIGNMENT_STUDENTS = 20

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
        "criteria": [
            {"name": "correttezza", "weight": 0.5},
            {"name": "completezza", "weight": 0.3},
            {"name": "chiarezza", "weight": 0.2},
        ]
    }


def random_questions():
    n = random.randint(2, 5)
    return [{"question": fake.sentence(), "max_score": 30} for _ in range(n)]


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
            openai_schema_json=None,
            materials_json=None,
            is_published=True,
        )
        db.add(exam)
        exams.append(exam)

    await db.commit()
    return exams


async def seed_submissions(db, students, exams):
    submissions = []
    print("Creating submissions...")

    possible_pairs = [(e.id, s.id) for e in exams for s in students]
    random.shuffle(possible_pairs)

    target = min(NUM_SUBMISSIONS, len(possible_pairs))
    created = 0

    for exam_id, student_id in possible_pairs:
        if created >= target:
            break

        # skip se già esiste
        result = await db.execute(
            select(Submission).where(
                Submission.exam_id == exam_id,
                Submission.student_id == student_id,
            )
        )
        if result.scalars().first():
            continue

        now = utcnow_naive()

        submission = Submission(
            exam_id=exam_id,
            student_id=student_id,
            status=SubmissionStatus.finalized,
            submitted_at=now,
        )
        db.add(submission)
        await db.flush()

        # questions per answers
        qres = await db.execute(select(Exam.questions_json).where(Exam.id == exam_id))
        questions = qres.scalar_one_or_none() or []

        for idx, _q in enumerate(questions):
            db.add(
                Answer(
                    submission_id=submission.id,
                    question_index=idx,
                    answer_text=fake.paragraph(),
                )
            )

        # student eval COMPLETED con evaluator_id=student_id
        student_eval = Evaluation(
            submission_id=submission.id,
            evaluator_type=EvaluatorType.student.value,
            evaluator_id=student_id,
            status=EvaluationStatus.completed.value,
            score=random.randint(18, 30),
            honors=False,
            comment=fake.sentence(),
            details_json=None,
            assigned_at=None,
            completed_at=now,
            created_at=now,
            updated_at=now,
        )

        # AI eval COMPLETED con evaluator_id=None
        ai_eval = Evaluation(
            submission_id=submission.id,
            evaluator_type=EvaluatorType.ai.value,
            evaluator_id=None,
            status=EvaluationStatus.completed.value,
            score=random.randint(18, 30),
            honors=False,
            comment=fake.sentence(),
            details_json=None,
            assigned_at=None,
            completed_at=now,
            created_at=now,
            updated_at=now,
        )

        db.add_all([student_eval, ai_eval])

        # Final grade iniziale SENZA peer (renormalizzato su ai+self: 0.3 + 0.1 = 0.4)
        final_score = (ai_eval.score * 0.3 + student_eval.score * 0.1) / 0.4

        db.add(
            FinalGrade(
                submission_id=submission.id,
                peer_weight=Decimal("0.60"),
                ai_weight=Decimal("0.30"),
                self_weight=Decimal("0.10"),
                final_score=round(final_score, 2),
                final_honors=False,
                computed_at=now,
            )
        )

        try:
            await db.commit()
            submissions.append(submission)
            created += 1
        except IntegrityError:
            await db.rollback()
            continue

    return submissions


async def seed_peer_assignments(db, students, exams):
    """
    Pre-assegna PEER_TASKS_PER_STUDENT stub peer assigned a un subset di studenti.
    Così testi /evaluations/peer/tasks subito.
    """
    print("Creating peer assignments (stubs in evaluations)...")

    subres = await db.execute(select(Submission))
    all_subs = subres.scalars().all()
    if not all_subs:
        return

    random.shuffle(all_subs)

    chosen_students = students[: min(PEER_ASSIGNMENT_STUDENTS, len(students))]
    now = utcnow_naive()

    idx = 0

    for st in chosen_students:
        assigned = 0
        attempts = 0

        while assigned < PEER_TASKS_PER_STUDENT and attempts < len(all_subs) * 2:
            attempts += 1
            if idx >= len(all_subs):
                idx = 0
            s = all_subs[idx]
            idx += 1

            # no self
            if s.student_id == st.id:
                continue

            # evita doppio assignment stesso studente + stessa submission
            exists_q = await db.execute(
                select(Evaluation.id).where(
                    Evaluation.submission_id == s.id,
                    Evaluation.evaluator_type == EvaluatorType.peer.value,
                    Evaluation.evaluator_id == st.id,
                )
            )
            if exists_q.scalar_one_or_none():
                continue

            stub = Evaluation(
                submission_id=s.id,
                evaluator_type=EvaluatorType.peer.value,
                evaluator_id=st.id,
                status=EvaluationStatus.assigned.value,
                score=None,
                honors=False,
                comment=None,
                details_json=None,
                assigned_at=now,
                completed_at=None,
                created_at=now,
                updated_at=now,
            )
            db.add(stub)
            assigned += 1

        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            continue


async def run_seed():
    async with AsyncSessionLocal() as db:
        try:
            print("Seeding database...")

            if await already_seeded(db):
                print("Seed already applied (found teacher0@test.com). Skipping.")
                return

            students, teachers = await seed_users(db)
            exams = await seed_exams(db, teachers)
            await seed_submissions(db, students, exams)

            await seed_peer_assignments(db, students, exams)

            print("Seed completed!")
        except IntegrityError:
            await db.rollback()
            msg = "Seed IntegrityError (likely already seeded)."
            if SEED_STRICT:
                raise
            print(msg)


if __name__ == "__main__":
    import asyncio

    asyncio.run(run_seed())
