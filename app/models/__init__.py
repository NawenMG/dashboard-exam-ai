from .user import User
from .exam import Exam
from .submission import Submission
from .answer import Answer
from .evaluation import Evaluation
from .final_grade import FinalGrade
from .revoked_token import RevokedToken  # ✅ AGGIUNGI QUESTA RIGA

__all__ = [
    "User",
    "Exam",
    "Submission",
    "Answer",
    "Evaluation",
    "FinalGrade",
    "RevokedToken",  # ✅ AGGIUNGI QUESTA RIGA
]

# Questo file rende la cartella models un package Python
# e registra tutti i modelli su Base.metadata per Alembic
