📚 FastAPI Exam Dashboard with AI Evaluation

Sistema completo per la gestione di esami universitari con:

👨‍🏫 gestione docenti e studenti
📝 creazione e sottomissione esami
🤖 valutazione automatica tramite AI (Ollama / LLM locale)
👥 peer evaluation tra studenti (anonima e ciclica)
📊 calcolo voto finale
🔐 autenticazione JWT Ed25519
🐳 containerizzazione completa con Docker
🗄 database MariaDB con Alembic migrations

🧱 Architettura

Stack utilizzato:

FastAPI
SQLAlchemy 2.0
Alembic
MariaDB
Docker + Docker Compose
Ollama (per AI evaluation)
JWT Ed25519 authentication
Repository pattern + Service layer
Frontend con Jinja2 + JS

📁 Struttura progetto
app/
 ├── api/
 ├── core/
 ├── db/
 ├── models/
 ├── repositories/
 ├── services/
 ├── schemas/
 ├── seeds/
 ├── static/
 └── templates/

alembic/
docker-compose.yml
dockerfile
⚙️ Prerequisiti

Docker
Docker Compose
Git

Verifica:

docker --version
docker compose version
git --version

Installare Ollama:

https://ollama.com/download

Scaricare modello:

ollama pull llama3.1:8b
🚀 Avvio rapido
git clone https://github.com/TUO_USERNAME/dashboard-exam-ai.git
cd dashboard-exam-ai

docker compose up --build

Oppure:

docker compose up -d --build
✅ Cosa succede automaticamente
DB creato
Migrations eseguite
Seed iniziale
Backend avviato

Log:

docker compose logs -f api
🌐 Accesso

http://localhost:8000

Swagger:

http://localhost:8000/docs

🔐 Login

Password: password

Teacher:

teacher0@test.com
teacher1@test.com
...

Student:

student0@test.com
student1@test.com
...
👥 Peer Evaluation (COME TESTARLA)

Questa è la parte più importante del sistema.

🔁 Logica implementata
Ogni studente valuta k = 5 submission di altri studenti
Assegnazione ciclica
Nessuno valuta sé stesso
Nessun duplicato
Anonimato garantito
🧪 Test step-by-step
1. Login come teacher
teacher0@test.com
2. Crea un esame

Dashboard teacher → "Create exam"

3. Pubblica esame

👉 IMPORTANTE: solo esami pubblicati funzionano per peer

4. Login come studenti

Esempio:

student0@test.com
student1@test.com
student2@test.com
student3@test.com
student4@test.com
5. Ogni studente invia una submission

Vai su:

/dashboard/execution-exam/{exam_id}

Completa esame + self evaluation

6. Torna come teacher

Clicca:

👉 Generate peer assignments

Questo chiama:

POST /evaluations/peer/generate/{exam_id}
7. Verifica assegnazioni

Ogni studente ora ha:

k = min(5, n-1)

Esempio:

5 studenti → 4 peer ciascuno
8. Login come studente

Vai su:

👉 Dashboard → Peer Review

Vedrai:

Anonymous submission #...
9. Completa peer evaluation

Ogni studente deve fare:

score (0–30)
commento
10. Chiusura peer (teacher)

Quando tutte le peer sono completate:

👉 Teacher → Submission → Close peer reviews

Questo:

blocca nuove peer
elimina pending
calcola stats
11. AI evaluation
POST /ai-evaluations/{submission_id}
12. Final grade
POST /final-grades
📊 Distribuzione peer

Con N studenti:

assegnazioni totali = N * k

Esempio:

Studenti	k	Totale
5	4	20
10	5	50
50	5	250
⚠️ Errori comuni
1. Nessuna peer generata

✔ studenti < 2

2. Generate cliccato più volte

✔ idempotente (no duplicati)

3. Studente non vede task

✔ non ha submission
✔ peer già chiuse

4. Faker rompe test

✔ ora NON genera peer automaticamente

🤖 AI Evaluation

Endpoint:

POST /ai-evaluations/{submission_id}

Richiede:

Ollama attivo
modello scaricato
🗄 Database

MariaDB + Alembic

docker compose exec api alembic upgrade head
🌱 Seed

Genera:

utenti
esami
submission

⚠️ NON genera peer automaticamente (modificato)

🐳 Servizi
fastapi_api
fastapi_mariadb
fastapi_adminer

Adminer:

http://localhost:8080

🔄 Reset DB
docker compose down -v
docker compose up --build
🧠 Architettura

Pattern:

Repository Pattern
Service Layer
Dependency Injection
DTO (Pydantic)

🔒 Sicurezza

JWT Ed25519
bcrypt
RBAC

🧪 Dev senza Docker
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
👨‍💻 Autore

Progetto dimostrativo per:

peer evaluation avanzata
AI grading con RAG
architettura backend moderna
📄 Licenza

Uso didattico / dimostrativo.