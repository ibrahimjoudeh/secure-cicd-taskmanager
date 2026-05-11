"""Application configuration.

The app intentionally supports SQLite for local/test use and PostgreSQL for AWS.
Production secrets are injected by ECS from AWS Secrets Manager; no secret value
belongs in the repository or Docker image.
"""

from __future__ import annotations

import os


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-change-me")
    JWT_SECRET = os.getenv("JWT_SECRET", SECRET_KEY)
    JWT_EXP_MINUTES = int(os.getenv("JWT_EXP_MINUTES", "60"))
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "sqlite:////tmp/taskmanager.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        # Pool settings matter in ECS because containers are recycled and concurrent
        # requests should reuse DB connections rather than opening one per request.
        "pool_pre_ping": True,
        "pool_recycle": 280,
        "pool_size": int(os.getenv("DB_POOL_SIZE", "5")),
        "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "5")),
    }
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
    RATE_LIMIT_DEFAULT = os.getenv("RATE_LIMIT_DEFAULT", "100 per minute")
    ENV = os.getenv("APP_ENV", "local")
