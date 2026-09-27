import pytest
import os
from unittest.mock import patch
from fastapi.testclient import TestClient
from backend.main import app
from backend.models.room import Room
from backend.models.competitor import Competitor
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

# test_db fixture is inherited from conftest.py — do NOT redefine it here

def seed_pricing_scenario(db, your_rate, competitors, occupied_count=5, total_count=10):
    # Rooms
    rooms = []
    for i in range(total_count):
        status = "occupied" if i < occupied_count else "available"
        rooms.append(Room(room_number=100+i, room_type="Deluxe", status=status, base_rate=your_rate))
    db.add_all(rooms)
    
    # Competitors
    for c in competitors:
        db.add(Competitor(name=c["name"], room_type="AC Deluxe", rate=c["rate"]))
    
    db.commit()

@patch.dict(os.environ, clear=True)
def test_competitor_calculation(test_db):
    seed_pricing_scenario(test_db, 3500, [
        {"name": "A", "rate": 3000},
        {"name": "B", "rate": 4000},
        {"name": "C", "rate": 5000}
    ])
    
    res = client.get("/api/pricing/competitive-analysis?room_type=AC Deluxe", headers=AUTH_HEADER)
    assert res.status_code == 200
    data = res.json()
    assert len(data["competitors"]) == 3
    assert data["market_average"] == 4000
    assert data["market_min"] == 3000
    assert data["market_max"] == 5000
    assert data["your_rate"] == 3500

@patch.dict(os.environ, clear=True)
def test_below_market_rate(test_db):
    seed_pricing_scenario(test_db, 3500, [
        {"name": "A", "rate": 4500},
        {"name": "B", "rate": 4800}
    ])
    res = client.get("/api/pricing/competitive-analysis?room_type=AC Deluxe", headers=AUTH_HEADER)
    assert res.status_code == 200
    data = res.json()
    # Below market: 3500 vs avg 4650. Difference is -1150
    assert "increasing" in data["recommendation"].lower()
    # Range is 3500 to min(3500*1.2=4200, 4800) = 4200
    assert data["recommended_rate_min"] == 3500
    assert data["recommended_rate_max"] == 4200

@patch.dict(os.environ, clear=True)
def test_near_market_rate(test_db):
    seed_pricing_scenario(test_db, 4000, [
        {"name": "A", "rate": 3900},
        {"name": "B", "rate": 4200}
    ])
    res = client.get("/api/pricing/competitive-analysis?room_type=AC Deluxe", headers=AUTH_HEADER)
    assert res.status_code == 200
    data = res.json()
    assert "hold" in data["recommendation"].lower()
    assert data["recommended_rate_min"] == 4000
    assert data["recommended_rate_max"] == 4000

@patch.dict(os.environ, clear=True)
def test_above_market_rate(test_db):
    seed_pricing_scenario(test_db, 5000, [
        {"name": "A", "rate": 3800},
        {"name": "B", "rate": 4200}
    ])
    res = client.get("/api/pricing/competitive-analysis?room_type=AC Deluxe", headers=AUTH_HEADER)
    assert res.status_code == 200
    data = res.json()
    assert "reviewing" in data["recommendation"].lower()
    # 5000 vs 4000. Above market.
    # Min allowed: max(0.8*5000=4000, 3800) = 4000
    assert data["recommended_rate_min"] == 4000
    assert data["recommended_rate_max"] == 5000

@patch.dict(os.environ, clear=True)
def test_openai_unavailable(test_db):
    seed_pricing_scenario(test_db, 3500, [{"name": "A", "rate": 4500}])
    res = client.get("/api/pricing/competitive-analysis?room_type=AC Deluxe", headers=AUTH_HEADER)
    assert res.status_code == 200
    data = res.json()
    assert data["source"] == "rule_based"

@patch.dict(os.environ, {"OPENAI_API_KEY": "dummy"})
@patch("backend.services.pricing_service.httpx.post")
def test_malformed_ai_response(mock_post, test_db):
    seed_pricing_scenario(test_db, 3500, [{"name": "A", "rate": 4500}])
    mock_post.return_value.status_code = 200
    mock_post.return_value.json.return_value = {"choices": [{"message": {"content": "not json"}}]}
    
    res = client.get("/api/pricing/competitive-analysis?room_type=AC Deluxe", headers=AUTH_HEADER)
    assert res.status_code == 200
    data = res.json()
    assert data["source"] == "rule_based"

@patch.dict(os.environ, {"OPENAI_API_KEY": "dummy"})
@patch("backend.services.pricing_service.httpx.post")
def test_out_of_bounds_ai_recommendation(mock_post, test_db):
    seed_pricing_scenario(test_db, 3500, [{"name": "A", "rate": 4500}, {"name": "B", "rate": 4600}])
    # Allowed bounds are 3500 to 4200
    mock_post.return_value.status_code = 200
    mock_post.return_value.json.return_value = {
        "choices": [{"message": {"content": '{"recommendation":"hi","reason":"why","recommended_rate_min":5000,"recommended_rate_max":6000}'}}]
    }
    
    res = client.get("/api/pricing/competitive-analysis?room_type=AC Deluxe", headers=AUTH_HEADER)
    assert res.status_code == 200
    data = res.json()
    assert data["source"] == "rule_based"
    assert data["recommended_rate_max"] == 4200

def test_no_competitor_data(test_db):
    res = client.get("/api/pricing/competitive-analysis?room_type=AC Deluxe", headers=AUTH_HEADER)
    assert res.status_code == 404
    assert res.json()["detail"] == "No competitor data found."
