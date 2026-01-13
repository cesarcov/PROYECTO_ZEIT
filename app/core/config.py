from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # 🔐 Seguridad
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ALGORITHM: str = "HS256"

    # 🗄️ Base de datos
    DATABASE_URL: str

    class Config:
        env_file = ".env"
        extra = "forbid"   # 👈 explícito (buena práctica)

settings = Settings()
