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

    # ✅ studenti speciali per backdoor applicativa
    DEBUG_PEER_STUDENT_EMAILS = {
        "student1@test.com",
        "student3@test.com",
    }

    # ==========================================================
    # HELPERS
    # ==========================================================

    @staticmethod
    def _is_debug_peer_student(student: User) -> bool:
        email = (getattr(student, "email", None) or "").strip().lower()
        return email in EvaluationService.DEBUG_PEER_STUDENT_EMAILS

    @staticmethod
    async def _get_debug_exam_ids(
        db: AsyncSession,
        *,
        exam_id: int | None = None,
    ) -> list[int]:
        stmt = select(Exam.id).where(Exam.peer_debug_broadcast.is_(True))

        if exam_id is not None:
            stmt = stmt.where(Exam.id == exam_id)

        res = await db.execute(stmt)
        return [int(x) for x in res.scalars().all()]

    @staticmethod
    async def _refill_peer_queue_if_needed(
        db: AsyncSession,
        *,
        student: User,
        exam_id: int | None = None,
    ) -> list[int]:
        """
        Ritorna:
        - lista exam_ids in debug mode se lo studente è debug e ci sono esami flaggati
        - [] in modalità normale
        """

        # =========================
        # DEBUG MODE
        # =========================
        if EvaluationService._is_debug_peer_student(student):
            debug_exam_ids = await EvaluationService._get_debug_exam_ids(
                db,
                exam_id=exam_id,
            )

            if debug_exam_ids:
                created_any = False

                for ex_id in debug_exam_ids:
                    candidates = await EvaluationRepository.pick_random_peer_candidates(
                        db,
                        student_id=student.id,
                        limit=None,  # ✅ nessun limite
                        exam_id=ex_id,
                        randomize=False,  # ✅ ordine stabile, non random
                    )

                    if candidates:
                        await EvaluationRepository.create_peer_assignments(
                            db,
                            student_id=student.id,
                            submissions=candidates,
                        )
                        created_any = True

                if created_any:
                    await db.commit()

                return debug_exam_ids

        # =========================
        # NORMAL MODE
        # =========================
        assigned = await EvaluationRepository.list_peer_assigned(
            db,
            student_id=student.id,
            limit=EvaluationService.PEER_QUEUE_SIZE,
        )

        missing = EvaluationService.PEER_QUEUE_SIZE - len(assigned)

        if missing > 0:
            candidates = await EvaluationRepository.pick_random_peer_candidates(
                db,
                student_id=student.id,
                limit=missing,
                exam_id=exam_id,
                randomize=True,
            )

            if candidates:
                await EvaluationRepository.create_peer_assignments(
                    db,
                    student_id=student.id,
                    submissions=candidates,
                )
                await db.commit()

        return []

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

        debug_exam_ids = await EvaluationService._refill_peer_queue_if_needed(
            db,
            student=student,
            exam_id=exam_id,
        )

        # ✅ debug mode: ritorna TUTTE le assegnazioni degli esami flaggati
        if debug_exam_ids:
            assigned = await EvaluationRepository.list_peer_assigned_for_exam_ids(
                db,
                student_id=student.id,
                exam_ids=debug_exam_ids,
            )
        else:
            assigned = await EvaluationRepository.list_peer_assigned(
                db,
                student_id=student.id,
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
                detail="Invalid evaluator_type. Use: student|peer|ai",
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
                    detail="This submission is not assigned to you for peer review (or already completed).",
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

            # ✅ refill normale / debug dopo la completion
            await EvaluationService._refill_peer_queue_if_needed(
                db,
                student=user,
                exam_id=submission.exam_id,
            )

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
            db, submission_id=submission_id
        )
        return {
            "submission_id": submission_id,
            "count": stats["count"],
            "avg": stats["avg"],
            "min": stats["min"],
            "max": stats["max"],
            "closed_at": getattr(sub, "peer_reviews_closed_at", None),
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
                db, teacher=teacher, submission_id=submission_id
            )

        stats = await EvaluationRepository.peer_stats_for_submission(
            db, submission_id=submission_id
        )
        if stats["count"] == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot close: no completed peer evaluations yet.",
            )

        await EvaluationRepository.close_peer_reviews_for_submission(
            db, submission_id=submission_id
        )
        await EvaluationRepository.delete_peer_assigned_for_submission(
            db, submission_id=submission_id
        )

        await db.commit()

        return {
            "submission_id": submission_id,
            "count": stats["count"],
            "avg": stats["avg"],
            "min": stats["min"],
            "max": stats["max"],
            "closed_at": datetime.utcnow(),
        }
