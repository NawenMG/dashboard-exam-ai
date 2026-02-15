# Configurazione centrale di fastAPI
# Pydantic per leggere automaticamente le variabili di ambiente, os e docker e convertirle in attributi Python tipizzati
from pydantic_settings import BaseSettings, SettingsConfigDict


# Classe che rappresenta la configurazione globale dell'app
class Settings(BaseSettings):
    # --- App ---
    app_name: str = "FastAPI Project"
    environment: str = "dev"
    debug: bool = True

    # --- JWT / Auth ---
    JWT_ALG: str = "EdDSA"  # Ed25519
    JWT_ISSUER: str = "fastapi-exam-dashboard"
    JWT_AUDIENCE: str = "fastapi-exam-dashboard"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Percorsi chiavi Ed25519 (PEM)
    JWT_PRIVATE_KEY_PATH: str = "keys/ed25519_private.pem"
    JWT_PUBLIC_KEY_PATH: str = "keys/ed25519_public.pem"

    # Mock auth fallback (se vuoi tenerlo in dev), per la simulazione del login senza provider.
    MOCK_AUTH_FALLBACK_TEACHER: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
