import json
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import User, UserRole
from app.models.submission import Submission
from app.models.exam import Exam
from app.models.evaluation import Evaluation, EvaluatorType, EvaluationStatus

from app.repositories.evaluation_repository import EvaluationRepository
from app.schemas.evaluation import (
    EvaluationCreate,
    EvaluationsBySubmission,
    PeerTaskOut,
)


def _to_json_str(data) -> str | None:
    if data is None:
        return None
    if isinstance(data, (dict, list)):
        return json.dumps(data, ensure_ascii=False)
    if isinstance(data, str):
        return data
    return json.dumps(data, ensure_ascii=False)


def _from_json_maybe(value):
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except Exception:
            return value
    return value


def _anon_submission_view(s: Submission, exam: Exam | None) -> dict:
    return {
        "id": s.id,
        "exam_id": s.exam_id,
        "exam_title": getattr(exam, "title", None) if exam else None,
        "submitted_at": getattr(s, "submitted_at", None),
        "questions_json": getattr(exam, "questions_json", None) if exam else None,
        "answers": [
            {"question_index": a.question_index, "answer_text": a.answer_text}
            for a in (getattr(s, "answers", None) or [])
        ],
    }


class EvaluationService:
    PEER_QUEUE_SIZE = 5
    CYCLIC_PEER_K_DEFAULT = 5
    REQUIRED_COMPLETED_PEER_REVIEWS = 5

    # ==========================================================
    # CYCLIC PEER ASSIGNMENT GENERATION
    # ==========================================================

    @staticmethod
    async def generate_cyclic_peer_assignments_for_exam(
        db: AsyncSession,
        *,
        teacher: User,
        exam_id: int,
        k: int = CYCLIC_PEER_K_DEFAULT,
    ) -> dict:
        if teacher.role != UserRole.teacher:
            raise HTTPException(
                status_code=403,
                detail="Only teachers can generate peer assignments.",
            )

        exam = (
            (await db.execute(select(Exam).where(Exam.id == exam_id))).scalars().first()
        )

        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found.")

        if exam.teacher_id != teacher.id:
            raise HTTPException(
                status_code=403,
                detail="You can generate peer assignments only for your exams.",
            )

        if k <= 0:
            raise HTTPException(status_code=400, detail="k must be greater than 0.")

        submissions = (
            await EvaluationRepository.list_submissions_for_cyclic_peer_assignment(
                db,
                exam_id=exam_id,
            )
        )

        n = len(submissions)

        if n < 2:
            raise HTTPException(
                status_code=400,
                detail="At least 2 submitted submissions are required for peer assignment.",
            )

        effective_k = min(int(k), n - 1)

        existing_pairs = (
            await EvaluationRepository.list_existing_peer_assignments_for_exam(
                db,
                exam_id=exam_id,
            )
        )

        pairs_to_create: list[tuple[int, int]] = []

        for i, evaluator_submission in enumerate(submissions):
            evaluator_student_id = evaluator_submission.student_id

            for offset in range(1, effective_k + 1):
                target_index = (i + offset) % n
                target_submission = submissions[target_index]

                if target_submission.student_id == evaluator_student_id:
                    continue

                pair = (target_submission.id, evaluator_student_id)

                if pair in existing_pairs:
                    continue

                pairs_to_create.append(pair)

        created_rows: list[Evaluation] = []

        if pairs_to_create:
            try:
                created_rows = (
                    await EvaluationRepository.create_cyclic_peer_assignments(
                        db,
                        pairs=pairs_to_create,
                    )
                )
                await db.commit()
            except IntegrityError:
                await db.rollback()
                raise HTTPException(
                    status_code=409,
                    detail="Peer assignments conflict. Some assignments may already exist.",
                )

        expected_total_pairs = n * effective_k

        return {
            "exam_id": exam_id,
            "k_requested": int(k),
            "k_effective": effective_k,
            "submissions_count": n,
            "assignments_created": len(created_rows),
            "assignments_skipped_existing": expected_total_pairs - len(created_rows),
            "mode": "cyclic",
            "detail": "Cyclic peer assignments generated successfully.",
        }

    # ==========================================================
    # PEER TASK QUEUE
    # ==========================================================

    @staticmethod
    async def get_peer_tasks(
        db: AsyncSession,
        *,
        student: User,
        exam_id: int | None = None,
        limit: int = 5,
    ) -> list[PeerTaskOut]:
        if student.role != UserRole.student:
            raise HTTPException(
                status_code=403,
                detail="Only students can access peer review tasks.",
            )

        limit = max(1, min(limit, EvaluationService.PEER_QUEUE_SIZE))

        assigned = await EvaluationRepository.list_peer_assigned(
            db,
            student_id=student.id,
            exam_id=exam_id,
            limit=limit,
        )

        submission_ids = [e.submission_id for e in assigned]

        if not submission_ids:
            return []

        stmt = (
            select(Submission)
            .options(selectinload(Submission.answers))
            .where(Submission.id.in_(submission_ids))
            .where(Submission.peer_reviews_closed_at.is_(None))
        )

        if exam_id is not None:
            stmt = stmt.where(Submission.exam_id == exam_id)

        res = await db.execute(stmt)
        subs_list = res.scalars().all()
        subs = {s.id: s for s in subs_list}

        exam_ids = list({s.exam_id for s in subs_list})
        exams_by_id: dict[int, Exam] = {}

        if exam_ids:
            exres = await db.execute(select(Exam).where(Exam.id.in_(exam_ids)))
            exams_by_id = {e.id: e for e in exres.scalars().all()}

        out: list[PeerTaskOut] = []

        for e in assigned:
            s = subs.get(e.submission_id)
            if not s:
                continue

            exam = exams_by_id.get(s.exam_id)

            out.append(
                PeerTaskOut(
                    evaluation_id=e.id,
                    submission=_anon_submission_view(s, exam),
                )
            )

        return out

    # ==========================================================
    # CREATE EVALUATION
    # ==========================================================

    @staticmethod
    async def create_evaluation(
        db: AsyncSession, *, user: User, payload: EvaluationCreate
    ) -> Evaluation:
        try:
            etype = EvaluatorType(payload.evaluator_type)
        except Exception:
            raise HTTPException(
                status_code=400,
                detail="Invalid evaluator_type. Use: student|peer|ai.",
            )

        if etype == EvaluatorType.ai:
            raise HTTPException(
                status_code=400,
                detail="AI evaluation must be created via /ai-evaluations/{submission_id}.",
            )

        res = await db.execute(
            select(Submission).where(Submission.id == payload.submission_id)
        )
        submission = res.scalars().first()

        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found.")

        res = await db.execute(select(Exam).where(Exam.id == submission.exam_id))
        exam = res.scalars().first()

        if not exam:
            raise HTTPException(
                status_code=404,
                detail="Exam not found for this submission.",
            )

        now = datetime.utcnow()

        # ==========================================================
        # STUDENT SELF EVALUATION
        # ==========================================================

        if etype == EvaluatorType.student:
            if user.role != UserRole.student:
                raise HTTPException(
                    status_code=403,
                    detail="Only students can create student evaluation.",
                )

            if submission.student_id != user.id:
                raise HTTPException(
                    status_code=403,
                    detail="You can evaluate only your own submission.",
                )

            evaluation = Evaluation(
                submission_id=submission.id,
                evaluator_type=etype.value,
                evaluator_id=user.id,
                status=EvaluationStatus.completed.value,
                score=payload.score,
                honors=payload.honors,
                comment=payload.comment,
                details_json=_to_json_str(payload.details_json),
                assigned_at=None,
                completed_at=now,
                created_at=now,
                updated_at=now,
            )

            try:
                await EvaluationRepository.create(db, evaluation)
                await db.commit()
                await db.refresh(evaluation)

            except IntegrityError:
                await db.rollback()
                raise HTTPException(
                    status_code=409,
                    detail="Evaluation already exists for this submission and evaluator_type.",
                )

            evaluation.details_json = _from_json_maybe(evaluation.details_json)
            return evaluation

        # ==========================================================
        # PEER EVALUATION
        # ==========================================================

        if etype == EvaluatorType.peer:
            if user.role != UserRole.student:
                raise HTTPException(
                    status_code=403,
                    detail="Only students can create peer evaluation.",
                )

            if submission.student_id == user.id:
                raise HTTPException(
                    status_code=403,
                    detail="You cannot peer-evaluate your own submission.",
                )

            if getattr(submission, "peer_reviews_closed_at", None) is not None:
                raise HTTPException(
                    status_code=403,
                    detail="Peer reviews for this submission are closed.",
                )

            assignment = await EvaluationRepository.get_peer_assignment_for_update(
                db,
                student_id=user.id,
                submission_id=submission.id,
            )

            if not assignment or assignment.status != EvaluationStatus.assigned.value:
                raise HTTPException(
                    status_code=403,
                    detail="This submission is not assigned to you for peer review or was already completed.",
                )

            assignment.score = payload.score
            assignment.honors = payload.honors
            assignment.comment = payload.comment
            assignment.details_json = _to_json_str(payload.details_json)
            assignment.status = EvaluationStatus.completed.value
            assignment.completed_at = now
            assignment.updated_at = now

            try:
                db.add(assignment)
                await db.commit()
                await db.refresh(assignment)

            except IntegrityError:
                await db.rollback()
                raise HTTPException(status_code=409, detail="Peer evaluation conflict.")

            assignment.details_json = _from_json_maybe(assignment.details_json)
            return assignment

        raise HTTPException(status_code=400, detail="Unsupported evaluator_type.")

    # ==========================================================
    # TEACHER VIEW
    # ==========================================================

    @staticmethod
    async def list_by_submission_id_for_teacher(
        db: AsyncSession,
        *,
        teacher: User,
        submission_id: int,
    ) -> EvaluationsBySubmission:
        if teacher.role != UserRole.teacher:
            raise HTTPException(
                status_code=403,
                detail="Only teachers can view evaluations by submission.",
            )

        res = await db.execute(select(Submission).where(Submission.id == submission_id))
        submission = res.scalars().first()

        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found.")

        res = await db.execute(select(Exam).where(Exam.id == submission.exam_id))
        exam = res.scalars().first()

        if not exam:
            raise HTTPException(
                status_code=404,
                detail="Exam not found for this submission.",
            )

        if exam.teacher_id != teacher.id:
            raise HTTPException(
                status_code=403,
                detail="You can only view evaluations for your exams.",
            )

        items = await EvaluationRepository.list_by_submission_id(
            db,
            submission_id=submission_id,
        )

        for e in items:
            e.details_json = _from_json_maybe(e.details_json)

        return EvaluationsBySubmission(
            submission_id=submission_id,
            items=items,
        )

    # ==========================================================
    # PEER SUMMARY + CLOSE
    # ==========================================================

    @staticmethod
    async def peer_summary_for_teacher(
        db: AsyncSession, *, teacher: User, submission_id: int
    ) -> dict:
        if teacher.role != UserRole.teacher:
            raise HTTPException(status_code=403, detail="Only teachers allowed.")

        sub = (
            (await db.execute(select(Submission).where(Submission.id == submission_id)))
            .scalars()
            .first()
        )

        if not sub:
            raise HTTPException(status_code=404, detail="Submission not found.")

        exam = (
            (await db.execute(select(Exam).where(Exam.id == sub.exam_id)))
            .scalars()
            .first()
        )

        if not exam or exam.teacher_id != teacher.id:
            raise HTTPException(status_code=403, detail="Not allowed.")

        stats = await EvaluationRepository.peer_stats_for_submission(
            db,
            submission_id=submission_id,
        )

        return {
            "submission_id": submission_id,
            "count": stats["count"],
            "required_count": EvaluationService.REQUIRED_COMPLETED_PEER_REVIEWS,
            "avg": stats["avg"],
            "min": stats["min"],
            "max": stats["max"],
            "closed_at": getattr(sub, "peer_reviews_closed_at", None),
            "can_close": stats["count"]
            >= EvaluationService.REQUIRED_COMPLETED_PEER_REVIEWS,
        }

    @staticmethod
    async def close_peer_reviews_and_compute(
        db: AsyncSession, *, teacher: User, submission_id: int
    ) -> dict:
        if teacher.role != UserRole.teacher:
            raise HTTPException(status_code=403, detail="Only teachers allowed.")

        sub = (
            (await db.execute(select(Submission).where(Submission.id == submission_id)))
            .scalars()
            .first()
        )

        if not sub:
            raise HTTPException(status_code=404, detail="Submission not found.")

        exam = (
            (await db.execute(select(Exam).where(Exam.id == sub.exam_id)))
            .scalars()
            .first()
        )

        if not exam or exam.teacher_id != teacher.id:
            raise HTTPException(status_code=403, detail="Not allowed.")

        if getattr(sub, "peer_reviews_closed_at", None) is not None:
            return await EvaluationService.peer_summary_for_teacher(
                db,
                teacher=teacher,
                submission_id=submission_id,
            )

        stats = await EvaluationRepository.peer_stats_for_submission(
            db,
            submission_id=submission_id,
        )

        required = EvaluationService.REQUIRED_COMPLETED_PEER_REVIEWS

        if stats["count"] < required:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Cannot close: {required} completed peer evaluations are required. "
                    f"Current completed peer evaluations: {stats['count']}."
                ),
            )

        await EvaluationRepository.close_peer_reviews_for_submission(
            db,
            submission_id=submission_id,
        )

        await EvaluationRepository.delete_peer_assigned_for_submission(
            db,
            submission_id=submission_id,
        )

        await db.commit()

        closed_at = datetime.utcnow()

        return {
            "submission_id": submission_id,
            "count": stats["count"],
            "required_count": required,
            "avg": stats["avg"],
            "min": stats["min"],
            "max": stats["max"],
            "closed_at": closed_at,
            "can_close": True,
        }
