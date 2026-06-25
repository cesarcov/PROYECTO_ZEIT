from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # 🔐 Seguridad
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ALGORITHM: str = "HS256"

    # 🗄️ Base de datos tenant (fallback dev)
    DATABASE_URL: str

    # 🗄️ Master DB (registro de tenants)
    MASTER_DATABASE_URL: str = ""

    # 👑 Superadmin (credenciales en env, no en DB)
    SUPERADMIN_USERNAME: str = ""
    SUPERADMIN_PASSWORD_HASH: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
