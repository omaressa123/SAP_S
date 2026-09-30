from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Smart Airport System"
    DATABASE_URL: str = "postgresql+asyncpg://postgres:yahya2004718@localhost:5432/smart_airport_db"

    class Config:
        case_sensitive = True

settings = Settings()