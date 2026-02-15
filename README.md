📚 FastAPI Exam Dashboard with AI Evaluation

Sistema completo per la gestione di esami universitari con:

👨‍🏫 gestione docenti e studenti

📝 creazione e sottomissione esami

🤖 valutazione automatica tramite AI (Ollama / LLM locale)

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
 ├── api/              # endpoints FastAPI
 ├── core/             # config e security
 ├── db/               # engine, session, base
 ├── models/           # modelli SQLAlchemy
 ├── repositories/     # accesso DB
 ├── services/         # business logic
 ├── schemas/          # DTO (Pydantic)
 ├── seeds/            # seed database
 ├── static/           # JS frontend
 └── templates/        # HTML templates

alembic/               # migrations database
docker-compose.yml
dockerfile

⚙️ Prerequisiti

Per eseguire il progetto su un altro PC serve:

Obbligatori

Docker

Docker Compose

Git

Verifica:

docker --version
docker compose version
git --version


Installare Ollama:

https://ollama.com/download

E scaricare un modello:

ollama pull llama3.1:8b

🚀 Avvio rapido (raccomandato)
1. Clonare il repository
git clone https://github.com/TUO_USERNAME/dashboard-exam-ai.git
cd dashboard-exam-ai


1. Avviare tutto con Docker
docker compose up --build


Oppure in background:

docker compose up -d --build

✅ Cosa succede automaticamente

All'avvio:

MariaDB viene creato

Alembic esegue migrations

seed iniziale viene eseguito

FastAPI parte

Log visibili con:

docker compose logs -f api

🌐 Accesso applicazione

Aprire browser:

http://localhost:8000

📘 Documentazione API (Swagger)

FastAPI genera automaticamente due documentazioni:

Swagger UI

URL:

http://localhost:8000/docs


Permette di:

testare endpoints

autenticarsi

inviare richieste

Interfaccia interattiva.

ReDoc

URL:

http://localhost:8000/redoc


Versione più leggibile e formale.

🔐 Autenticazione
Per il login la password è: password e per l'email:
- Insegnanti: teacher0@test.com, teacher1@test.com, teacher2@test.com ...
- Studenti: student0@test.com, student1@test.com, student2@test.com ...

Il sistema usa JWT Ed25519.

Workflow:

Login endpoint:

POST /auth/login


Copiare token

Usarlo in Swagger:

Authorize → Bearer <token>

🤖 AI Evaluation

Sistema supporta valutazione automatica usando Ollama.

Endpoint:

POST /ai-evaluations/{submission_id}


Richiede:

Ollama installato

modello scaricato

🗄 Database

Database: MariaDB

Gestione migrations con Alembic.

Migrazione manuale:

docker compose exec api alembic upgrade head

🌱 Seed database

Seed automatico all'avvio.

Contiene:

docenti

studenti

esami

sottomissioni

valutazioni

🐳 Servizi Docker

Container:

fastapi_api
fastapi_mariadb
fastapi_adminer


Adminer accessibile su:

http://localhost:8080

🛑 Stop applicazione
docker compose down

🔄 Reset completo database
docker compose down -v
docker compose up --build

🧠 Architettura software

Pattern utilizzati:

Repository Pattern
Service Layer Pattern
Dependency Injection (FastAPI)
DTO pattern (Pydantic)
Clean architecture concepts

🔒 Sicurezza

JWT Ed25519
Password hashing bcrypt
Token revocation support
Role-based access control

🧪 Ambiente sviluppo senza Docker (opzionale)

Creare venv:

python -m venv .venv


Attivare:

Windows:

.venv\Scripts\activate


Linux/Mac:

source .venv/bin/activate


Installare:

pip install -r requirements.txt


Avviare:

uvicorn app.main:app --reload

👨‍💻 Autore

Progetto dimostrativo per:

gestione esami

valutazione AI

architettura backend moderna

📄 Licenza

Uso didattico / dimostrativo.