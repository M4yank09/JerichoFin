"""Application configuration settings."""
import os
from typing import List


class Settings:
    PROJECT_NAME: str = os.getenv("PROJECT_NAME", "Jerifin Treasury Risk Platform")
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("DEBUG", "True").lower() in ("true", "1")
    API_V1_STR: str = os.getenv("API_V1_STR", "/api/v1")
    
    # Configurable origins for CORS (default: local Next.js ports 3000 and 3001)
    ALLOWED_ORIGINS: List[str] = [
        origin.strip() 
        for origin in os.getenv(
            "ALLOWED_ORIGINS", 
            "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001"
        ).split(",")
        if origin.strip()
    ]


settings = Settings()
