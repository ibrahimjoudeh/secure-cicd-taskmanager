from __future__ import annotations

import pytest

from app import create_app, db


@pytest.fixture()
def client():
    app = create_app(
        {
            "TESTING": True,
            "JWT_SECRET": "test-secret",
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "SQLALCHEMY_ENGINE_OPTIONS": {},
            "RATE_LIMIT_DEFAULT": "1000 per minute",
        }
    )
    with app.app_context():
        db.create_all()
    return app.test_client()


def auth_headers(client):
    resp = client.post("/api/auth/register", json={"email": "student@example.com", "password": "StrongPass123"})
    assert resp.status_code == 201
    token = resp.get_json()["token"]
    return {"Authorization": f"Bearer {token}"}


def test_health_endpoint(client):
    resp = client.get("/health")
    body = resp.get_json()
    assert resp.status_code == 200
    assert body["status"] == "healthy"
    assert body["database"] == "connected"
    assert "response_time_ms" in body


def test_register_and_login(client):
    client.post("/api/auth/register", json={"email": "student@example.com", "password": "StrongPass123"})
    resp = client.post("/api/auth/login", json={"email": "student@example.com", "password": "StrongPass123"})
    assert resp.status_code == 200
    assert "token" in resp.get_json()


def test_task_crud_with_enterprise_fields(client):
    headers = auth_headers(client)

    created = client.post(
        "/api/tasks",
        json={
            "title": "Write report",
            "description": "Security analysis",
            "status": "in-progress",
            "priority": "high",
            "due_date": "2025-12-20",
        },
        headers=headers,
    )
    assert created.status_code == 201
    task = created.get_json()["task"]
    task_id = task["id"]
    assert task["status"] == "in-progress"
    assert task["priority"] == "high"
    assert task["due_date"] == "2025-12-20"

    listed = client.get("/api/tasks", headers=headers)
    assert listed.status_code == 200
    assert len(listed.get_json()["tasks"]) == 1

    updated = client.put(f"/api/tasks/{task_id}", json={"status": "done", "completed": True}, headers=headers)
    assert updated.status_code == 200
    assert updated.get_json()["task"]["completed"] is True
    assert updated.get_json()["task"]["status"] == "done"

    deleted = client.delete(f"/api/tasks/{task_id}", headers=headers)
    assert deleted.status_code == 200

    empty = client.get("/api/tasks", headers=headers)
    assert empty.get_json()["tasks"] == []


def test_requires_authentication(client):
    resp = client.get("/api/tasks")
    assert resp.status_code == 401
