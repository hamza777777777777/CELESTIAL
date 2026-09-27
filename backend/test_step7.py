"""
Tests for Next Best Action (Day 3 Step 2)

All tests accept `test_db` from conftest.py. This activates the FastAPI
`get_db` dependency override, ensuring every route call (including the
audit-log write inside /api/intelligence/next-action) uses the isolated
in-memory SQLite DB — and NEVER touches backend/app.db.
"""
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.models import Task, Staff, AuditLog
import os
from unittest.mock import patch
# test_db fixture is provided by conftest.py (isolated in-memory SQLite)

from backend.auth import get_token_verifier
from fastapi import HTTPException, status

client = TestClient(app)

def mock_firebase_verifier(token: str) -> str:
    if not token or not token.startswith("test-"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return "test-manager-uid"

@pytest.fixture(scope="module", autouse=True)
def setup_auth_manager():
    app.dependency_overrides[get_token_verifier] = lambda: mock_firebase_verifier
    yield
    app.dependency_overrides.pop(get_token_verifier, None)

AUTH_HEADER = {"Authorization": "Bearer test-manager-uid"}


def test_intelligence_endpoint_no_key(test_db):
    """Rule-based fallback when OPENAI_API_KEY is absent."""
    if "OPENAI_API_KEY" in os.environ:
        del os.environ["OPENAI_API_KEY"]

    response = client.get("/api/intelligence/next-action", headers=AUTH_HEADER)
    assert response.status_code == 200
    data = response.json()
    assert "action" in data
    assert "reason" in data
    assert "priority" in data
    assert "evidence" in data
    assert data["source"] == "rule_based"


@patch("backend.services.intelligence_service.httpx.post")
def test_intelligence_endpoint_llm_success(mock_post, monkeypatch, test_db):
    """LLM response is parsed and returned correctly."""
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    class MockResponse:
        def raise_for_status(self): pass
        def json(self):
            return {
                "choices": [{
                    "message": {
                        "content": '{"action": "Do this", "reason": "Because", "priority": "high", "evidence": ["fact 1"]}'
                    }
                }]
            }

    mock_post.return_value = MockResponse()

    response = client.get("/api/intelligence/next-action", headers=AUTH_HEADER)
    assert response.status_code == 200
    data = response.json()
    assert data["source"] == "ai"
    assert data["action"] == "Do this"


@patch("backend.services.intelligence_service.httpx.post")
def test_intelligence_endpoint_llm_malformed(mock_post, monkeypatch, test_db):
    """Malformed AI response gracefully falls back to rule_based."""
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    class MockResponse:
        def raise_for_status(self): pass
        def json(self):
            return {
                "choices": [{
                    "message": {
                        "content": "Not valid JSON"
                    }
                }]
            }

    mock_post.return_value = MockResponse()

    response = client.get("/api/intelligence/next-action", headers=AUTH_HEADER)
    assert response.status_code == 200
    data = response.json()
    assert data["source"] == "rule_based"


def test_audit_log_created_and_deduplicated(test_db):
    """
    Verify audit deduplication using isolated in-memory test DB.
    test_db (from conftest.py) starts empty — no prior audit records.
    The FastAPI dependency override ensures the route uses this same session.
    """
    initial_count = test_db.query(AuditLog).filter(
        AuditLog.action == "NEXT_BEST_ACTION"
    ).count()
    assert initial_count == 0  # fresh isolated DB starts empty

    # First call should create a log
    response1 = client.get("/api/intelligence/next-action", headers=AUTH_HEADER)
    assert response1.status_code == 200

    first_call_count = test_db.query(AuditLog).filter(
        AuditLog.action == "NEXT_BEST_ACTION"
    ).count()
    assert first_call_count == initial_count + 1

    # Second call with identical action should NOT create a duplicate log
    response2 = client.get("/api/intelligence/next-action", headers=AUTH_HEADER)
    assert response2.status_code == 200

    second_call_count = test_db.query(AuditLog).filter(
        AuditLog.action == "NEXT_BEST_ACTION"
    ).count()
    assert second_call_count == first_call_count
