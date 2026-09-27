import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import Base, engine, SessionLocal
from backend.models.user import User

from backend.auth import get_token_verifier
from fastapi import HTTPException, status

client = TestClient(app)

def mock_firebase_verifier(token: str) -> str:
    """Mock verifier for testing token verification without real Firebase backend."""
    if token == "invalid_token_123" or not token.startswith("test-"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Firebase ID token"
        )
    if not token.endswith("-uid"):
        return f"{token}-uid"
    return token

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    app.dependency_overrides[get_token_verifier] = lambda: mock_firebase_verifier
    
    # Clean up first if they exist
    db.query(User).filter(User.email.in_(["manager@test.com", "guest@test.com", "newguest@test.com"])).delete()
    
    u1 = User(name="Test Manager", email="manager@test.com", role="Manager", firebase_uid="test-manager-uid")
    u2 = User(name="Test Guest", email="guest@test.com", role="Guest", firebase_uid="test-guest-uid")
    db.add_all([u1, u2])
    db.commit()
    yield
    app.dependency_overrides.pop(get_token_verifier, None)
    db.query(User).filter(User.email.in_(["manager@test.com", "guest@test.com", "newguest@test.com"])).delete()
    db.commit()
    db.close()

def test_missing_token():
    response = client.get("/api/auth/me", headers={})
    assert response.status_code == 401
    
def test_empty_token():
    response = client.get("/api/auth/me", headers={"Authorization": ""})
    assert response.status_code == 401

def test_malformed_token():
    response = client.get("/api/auth/me", headers={"Authorization": "MalformedToken123"})
    assert response.status_code == 401

def test_invalid_token():
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid_token_123"})
    assert response.status_code == 401

def test_valid_token_resolves_role():
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer test-manager"})
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "Manager"
    assert data["firebase_uid"] == "test-manager-uid"

def test_valid_token_unmapped_user():
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer test-unmapped"})
    assert response.status_code == 401
    assert "User not mapped" in response.json()["detail"]

def test_public_signup_creates_guest():
    response = client.post("/api/auth/signup", json={
        "name": "New Guest",
        "email": "newguest@test.com",
        "firebase_uid": "test-new-guest-uid"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "Guest"
    assert data["firebase_uid"] == "test-new-guest-uid"
