from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./traffic.db"
    PROJECT_NAME: str = "Intelligent Traffic System Command Center"
    API_STR: str = "/api/v1"

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
    }

settings = Settings()
