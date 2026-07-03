from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    data_dir: str = Field(default="../data", alias="DATA_DIR")
    api_title: str = Field(default="Protein Network Explorer API", alias="API_TITLE")

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()