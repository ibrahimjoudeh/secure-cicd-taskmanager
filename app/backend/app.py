from __future__ import annotations

import datetime as dt
import logging
import os
from functools import wraps
from typing import Any, Callable

import jwt
from flask import Flask, abort, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_sqlalchemy import SQLAlchemy
from pythonjsonlogger import jsonlogger
from sqlalchemy import inspect, text
from werkzeug.exceptions import HTTPException
from werkzeug.security import check_password_hash, generate_password_hash

from config import Config

db = SQLAlchemy()

ALLOWED_STATUSES = {"todo", "in-progress", "done"}
ALLOWED_PRIORITIES = {"low", "medium", "high"}


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=dt.datetime.utcnow, nullable=False)


class Task(db.Model):
    __tablename__ = "tasks"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(140), nullable=False)
    description = db.Column(db.String(1000), nullable=True)
    completed = db.Column(db.Boolean, default=False, nullable=False)
    status = db.Column(db.String(20), default="todo", nullable=False)
    priority = db.Column(db.String(20), default="medium", nullable=False)
    due_date = db.Column(db.Date, nullable=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=dt.datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=dt.datetime.utcnow, onupdate=dt.datetime.utcnow, nullable=False)

    def to_dict(self) -> dict[str, Any]:
        # Keep the older `completed` flag for backward compatibility while adding
        # enterprise task fields used by the redesigned dashboard.
        normalized_status = self.status or ("done" if self.completed else "todo")
        is_completed = normalized_status == "done" or bool(self.completed)
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description or "",
            "completed": is_completed,
            "status": "done" if is_completed else normalized_status,
            "priority": self.priority or "medium",
            "due_date": self.due_date.isoformat() if self.due_date else "",
            "created_at": self.created_at.isoformat() + "Z",
            "updated_at": self.updated_at.isoformat() + "Z",
        }



def configure_logging(app: Flask) -> None:
    handler = logging.StreamHandler()
    formatter = jsonlogger.JsonFormatter(
        "%(asctime)s %(levelname)s %(name)s %(message)s %(path)s %(method)s %(status_code)s"
    )
    handler.setFormatter(formatter)
    app.logger.handlers.clear()
    app.logger.addHandler(handler)
    app.logger.setLevel(os.getenv("LOG_LEVEL", "INFO"))


def create_app(test_config: dict[str, Any] | None = None) -> Flask:
    app = Flask(__name__, static_folder="../frontend", static_url_path="")
    app.config.from_object(Config)
    if test_config:
        app.config.update(test_config)

    configure_logging(app)
    CORS(app, origins=app.config["CORS_ORIGINS"])
    db.init_app(app)
    Limiter(get_remote_address, app=app, default_limits=[app.config["RATE_LIMIT_DEFAULT"]])

    with app.app_context():
        db.create_all()
        _ensure_task_schema(app)

    @app.before_request
    def log_request() -> None:
        app.logger.info("request_started", extra={"path": request.path, "method": request.method})

    @app.after_request
    def log_response(response):
        app.logger.info(
            "request_finished",
            extra={"path": request.path, "method": request.method, "status_code": response.status_code},
        )
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        return response

    @app.errorhandler(Exception)
    def handle_error(error: Exception):
        if isinstance(error, HTTPException):
            return jsonify(error=error.name, message=error.description), error.code
        app.logger.exception("unhandled_exception")
        return jsonify(error="Internal Server Error", message="Unexpected server error"), 500

    @app.get("/")
    def index():
        return send_from_directory(app.static_folder, "index.html")

    @app.get("/dashboard")
    def dashboard_page():
        return send_from_directory(app.static_folder, "dashboard.html")

    @app.get("/status")
    def status_page():
        return send_from_directory(app.static_folder, "health.html")

    @app.get("/health")
    def health():
        started = dt.datetime.now(dt.timezone.utc)
        try:
            db.session.execute(text("SELECT 1"))
            db_status = "connected"
        except Exception:
            app.logger.exception("health_db_check_failed")
            return jsonify(status="unhealthy", database="unreachable", timestamp=_utc_now()), 503

        elapsed_ms = round((dt.datetime.now(dt.timezone.utc) - started).total_seconds() * 1000, 2)
        return jsonify(
            status="healthy",
            database=db_status,
            api="operational",
            authentication="operational",
            response_time_ms=elapsed_ms,
            version=os.getenv("APP_VERSION", "1.0.0-free-aws"),
            commit=os.getenv("COMMIT_SHA", "local-dev"),
            deployed_at=os.getenv("DEPLOYED_AT", "local"),
            timestamp=_utc_now(),
        )

    @app.post("/api/auth/register")
    def register():
        payload = request.get_json(silent=True) or {}
        email = _clean_email(payload.get("email"))
        password = str(payload.get("password", ""))

        if not email or len(password) < 8:
            return jsonify(error="ValidationError", message="Valid email and 8+ character password required"), 400
        if User.query.filter_by(email=email).first():
            return jsonify(error="Conflict", message="User already exists"), 409

        user = User(email=email, password_hash=generate_password_hash(password))
        db.session.add(user)
        db.session.commit()
        return jsonify(message="registered", token=_make_token(app, user), user={"id": user.id, "email": user.email}), 201

    @app.post("/api/auth/login")
    def login():
        payload = request.get_json(silent=True) or {}
        email = _clean_email(payload.get("email"))
        password = str(payload.get("password", ""))
        user = User.query.filter_by(email=email).first() if email else None

        if not user or not check_password_hash(user.password_hash, password):
            return jsonify(error="Unauthorized", message="Invalid credentials"), 401

        return jsonify(message="logged_in", token=_make_token(app, user), user={"id": user.id, "email": user.email})

    @app.get("/api/tasks")
    @require_auth(app)
    def list_tasks(current_user: User):
        tasks = Task.query.filter_by(owner_id=current_user.id).order_by(Task.created_at.desc()).all()
        return jsonify(tasks=[task.to_dict() for task in tasks])

    @app.post("/api/tasks")
    @require_auth(app)
    def create_task(current_user: User):
        payload = request.get_json(silent=True) or {}
        title = _sanitize_text(payload.get("title"), max_len=140)
        description = _sanitize_text(payload.get("description"), max_len=1000, required=False)
        status = _normalize_status(payload.get("status"), payload.get("completed"))
        priority = _normalize_priority(payload.get("priority"))
        due_date = _parse_due_date(payload.get("due_date"))

        if not title:
            return jsonify(error="ValidationError", message="Task title is required"), 400

        task = Task(
            title=title,
            description=description,
            completed=status == "done",
            status=status,
            priority=priority,
            due_date=due_date,
            owner_id=current_user.id,
        )
        db.session.add(task)
        db.session.commit()
        return jsonify(task=task.to_dict()), 201

    @app.put("/api/tasks/<int:task_id>")
    @require_auth(app)
    def update_task(current_user: User, task_id: int):
        task = _get_owned_task_or_404(current_user.id, task_id)
        payload = request.get_json(silent=True) or {}

        if "title" in payload:
            title = _sanitize_text(payload.get("title"), max_len=140)
            if not title:
                return jsonify(error="ValidationError", message="Task title cannot be empty"), 400
            task.title = title
        if "description" in payload:
            task.description = _sanitize_text(payload.get("description"), max_len=1000, required=False)
        if "status" in payload or "completed" in payload:
            task.status = _normalize_status(payload.get("status", task.status), payload.get("completed"))
            task.completed = task.status == "done"
        if "priority" in payload:
            task.priority = _normalize_priority(payload.get("priority"))
        if "due_date" in payload:
            task.due_date = _parse_due_date(payload.get("due_date"))

        db.session.commit()
        return jsonify(task=task.to_dict())

    @app.delete("/api/tasks/<int:task_id>")
    @require_auth(app)
    def delete_task(current_user: User, task_id: int):
        task = _get_owned_task_or_404(current_user.id, task_id)
        db.session.delete(task)
        db.session.commit()
        return jsonify(message="deleted")

    return app


def _ensure_task_schema(app: Flask) -> None:
    # Lightweight schema upgrade keeps old local Docker volumes working after the
    # UI adds enterprise task fields. This avoids forcing students to delete data.
    inspector = inspect(db.engine)
    if "tasks" not in inspector.get_table_names():
        return
    existing_columns = {column["name"] for column in inspector.get_columns("tasks")}
    statements = []
    dialect = db.engine.dialect.name
    if "status" not in existing_columns:
        statements.append("ALTER TABLE tasks ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'todo'")
    if "priority" not in existing_columns:
        statements.append("ALTER TABLE tasks ADD COLUMN priority VARCHAR(20) NOT NULL DEFAULT 'medium'")
    if "due_date" not in existing_columns:
        statements.append("ALTER TABLE tasks ADD COLUMN due_date DATE")
    for statement in statements:
        try:
            db.session.execute(text(statement))
        except Exception:
            app.logger.warning("schema_upgrade_statement_failed", extra={"statement": statement, "dialect": dialect})
            db.session.rollback()
            raise
    if statements:
        db.session.execute(text("UPDATE tasks SET status = CASE WHEN completed THEN 'done' ELSE 'todo' END WHERE status IS NULL OR status = ''"))
        db.session.execute(text("UPDATE tasks SET priority = 'medium' WHERE priority IS NULL OR priority = ''"))
        db.session.commit()


def _utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def _clean_email(value: Any) -> str:
    return str(value or "").strip().lower()


def _sanitize_text(value: Any, max_len: int, required: bool = True) -> str:
    text_value = str(value or "").strip()
    text_value = text_value.replace("<", "").replace(">", "")
    if required and not text_value:
        return ""
    return text_value[:max_len]


def _normalize_status(value: Any, completed: Any = None) -> str:
    if completed is not None:
        return "done" if bool(completed) else "todo"
    status = str(value or "todo").strip().lower()
    return status if status in ALLOWED_STATUSES else "todo"


def _normalize_priority(value: Any) -> str:
    priority = str(value or "medium").strip().lower()
    return priority if priority in ALLOWED_PRIORITIES else "medium"


def _parse_due_date(value: Any) -> dt.date | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        return dt.date.fromisoformat(raw[:10])
    except ValueError:
        abort(400, description="Invalid due_date. Expected YYYY-MM-DD")


def _make_token(app: Flask, user: User) -> str:
    now = dt.datetime.now(dt.timezone.utc)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "iat": int(now.timestamp()),
        "exp": int((now + dt.timedelta(minutes=app.config["JWT_EXP_MINUTES"])).timestamp()),
    }
    return jwt.encode(payload, app.config["JWT_SECRET"], algorithm="HS256")


def require_auth(app: Flask) -> Callable:
    def decorator(fn: Callable) -> Callable:
        @wraps(fn)
        def wrapper(*args, **kwargs):
            header = request.headers.get("Authorization", "")
            if not header.startswith("Bearer "):
                return jsonify(error="Unauthorized", message="Missing bearer token"), 401
            token = header.split(" ", 1)[1]
            try:
                payload = jwt.decode(token, app.config["JWT_SECRET"], algorithms=["HS256"])
                user = db.session.get(User, int(payload["sub"]))
            except Exception:
                return jsonify(error="Unauthorized", message="Invalid or expired token"), 401
            if not user:
                return jsonify(error="Unauthorized", message="User not found"), 401
            return fn(user, *args, **kwargs)

        return wrapper

    return decorator


def _get_owned_task_or_404(owner_id: int, task_id: int) -> Task:
    task = Task.query.filter_by(id=task_id, owner_id=owner_id).first()
    if not task:
        abort(404, description="Task not found")
    return task


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")))
