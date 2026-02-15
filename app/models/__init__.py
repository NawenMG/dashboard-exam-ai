from .user import User
from .exam import Exam
from .submission import Submission
from .answer import Answer
from .evaluation import Evaluation
from .final_grade import FinalGrade

__all__ = [
    "User",
    "Exam",
    "Submission",
    "Answer",
    "Evaluation",
    "FinalGrade",
]

# QUesto file rende la cartella models un package Python
# Cosi possiamo fare tipo: import app.models
