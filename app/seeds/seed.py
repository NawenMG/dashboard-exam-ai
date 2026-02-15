# app/seeds/seed.py
import os
import json
import random
from datetime import datetime, UTC

from faker import Faker
from passlib.context import CryptContext
from sqlalchemy.exc import IntegrityError

from app.db.session import SessionLocal
from app.models.user import User, UserRole
from app.models.exam import Exam
from app.models.submission import Submission, SubmissionStatus
from app.models.answer import Answer
from app.models.evaluation import Evaluation, EvaluatorType
from app.models.final_grade import FinalGrade

fake = Faker("it_IT")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ---------- CONFIG ----------
NUM_STUDENTS = 50
NUM_TEACHERS = 10
NUM_EXAMS = 20
NUM_SUBMISSIONS = 20

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


# ---------- JSON helpers ----------
def dumps_json(obj) -> str:
    return json.dumps(obj, ensure_ascii=False)


def loads_json(val):
    # supporta sia JSON string che già-oggetto (nel caso cambi tipo colonna in futuro)
    if val is None:
        return None
    if isinstance(val, (dict, list)):
        return val
    return json.loads(val)


# ---------- SEED HELPERS (idempotenti) ----------
def already_seeded(db) -> bool:
    # Se esiste il primo teacher "standard", consideriamo seed già fatto
    return db.query(User).filter(User.email == "teacher0@test.com").first() is not None


def get_or_create_user(db, *, email: str, defaults: dict) -> User:
    u = db.query(User).filter(User.email == email).first()
    if u:
        return u
    u = User(email=email, **defaults)
    db.add(u)
    return u


def seed_users(db):
    students, teachers = [], []

    print("Creating teachers...")

    for i in range(NUM_TEACHERS):
        email = f"teacher{i}@test.com"
        teacher = get_or_create_user(
            db,
            email=email,
            defaults=dict(
                password_hash=hash_password("password"),
                role=UserRole.teacher,
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
        student = get_or_create_user(
            db,
            email=email,
            defaults=dict(
                password_hash=hash_password("password"),
                role=UserRole.student,
                first_name=fake.first_name(),
                last_name=fake.last_name(),
                matricola=f"M{i:05d}",
                age=random.randint(18, 30),
            ),
        )
        students.append(student)

    db.commit()
    return students, teachers


def seed_exams(db, teachers):
    exams = []
    print("Creating exams...")

    # Evita di ricreare sempre "Esame i": se esiste, lo riusa
    for i in range(NUM_EXAMS):
        title = f"Esame {i}"
        existing = db.query(Exam).filter(Exam.title == title).first()
        if existing:
            exams.append(existing)
            continue

        teacher = random.choice(teachers)

        # IMPORTANT: serializzo per evitare "dict can not be used as parameter"
        questions = random_questions()
        rubric = random_rubric()

        exam = Exam(
            teacher_id=teacher.id,
            title=title,
            description=fake.text(),
            questions_json=dumps_json(questions),
            rubric_json=dumps_json(rubric),
            is_published=True,
        )
        db.add(exam)
        exams.append(exam)

    db.commit()
    return exams


def seed_submissions(db, students, exams):
    submissions = []
    print("Creating submissions...")

    # Genera coppie uniche (exam_id, student_id) per rispettare uq_submissions_exam_student
    possible_pairs = [(e.id, s.id) for e in exams for s in students]
    random.shuffle(possible_pairs)

    target = min(NUM_SUBMISSIONS, len(possible_pairs))
    created = 0

    # mappa id->exam per lookup veloce
    exam_by_id = {e.id: e for e in exams}

    for exam_id, student_id in possible_pairs:
        if created >= target:
            break

        # se esiste già quella coppia, skip
        exists = (
            db.query(Submission)
            .filter(Submission.exam_id == exam_id, Submission.student_id == student_id)
            .first()
        )
        if exists:
            continue

        submission = Submission(
            exam_id=exam_id,
            student_id=student_id,
            status=SubmissionStatus.finalized,
            submitted_at=datetime.now(UTC),
        )
        db.add(submission)
        db.flush()  # ottieni submission.id senza commit

        exam = exam_by_id[exam_id]
        questions = loads_json(exam.questions_json) or []

        # answers
        for idx, _q in enumerate(questions):
            db.add(
                Answer(
                    submission_id=submission.id,
                    question_index=idx,
                    answer_text=fake.paragraph(),
                )
            )

        # evaluations
        student_eval = Evaluation(
            submission_id=submission.id,
            evaluator_type=EvaluatorType.student,
            score=random.randint(18, 30),
            honors=False,
            comment=fake.sentence(),
        )
        teacher_eval = Evaluation(
            submission_id=submission.id,
            evaluator_type=EvaluatorType.teacher,
            score=random.randint(18, 30),
            honors=False,
            comment=fake.sentence(),
        )
        ai_eval = Evaluation(
            submission_id=submission.id,
            evaluator_type=EvaluatorType.ai,
            score=random.randint(18, 30),
            honors=False,
            comment=fake.sentence(),
        )

        db.add_all([student_eval, teacher_eval, ai_eval])

        final_score = (
            teacher_eval.score * 0.6 + ai_eval.score * 0.3 + student_eval.score * 0.1
        )
        db.add(
            FinalGrade(
                submission_id=submission.id,
                final_score=round(final_score, 2),
                final_honors=False,
            )
        )

        try:
            db.commit()
            submissions.append(submission)
            created += 1
        except IntegrityError:
            db.rollback()
            continue

    return submissions


def run_seed():
    db = SessionLocal()
    try:
        print("Seeding database...")

        if already_seeded(db):
            print("Seed already applied (found teacher0@test.com). Skipping.")
            return

        students, teachers = seed_users(db)
        exams = seed_exams(db, teachers)
        seed_submissions(db, students, exams)

        print("Seed completed!")
    except IntegrityError:
        db.rollback()
        msg = "Seed IntegrityError (likely already seeded)."
        if SEED_STRICT:
            raise
        print(msg)
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
