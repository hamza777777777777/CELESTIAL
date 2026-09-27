from fastapi.testclient import TestClient
from backend.main import app
import json

client = TestClient(app)

print("--- Testing GET /health ---")
response = client.get("/health")
print(response.status_code, response.json())

print("\n--- Testing POST /api/complaints ---")
new_complaint = {
    "guest_id": 1,
    "room_number": 205,
    "text": "The AC in my room is not working",
    "language": "en"
}
response = client.post("/api/complaints", data=new_complaint)
print(response.status_code, response.json())

print("\n--- Testing GET /api/complaints ---")
response = client.get("/api/complaints")
print(response.status_code, f"Count: {len(response.json())}")

print("\n--- Testing GET /api/complaints/1 ---")
response = client.get("/api/complaints/1")
print(response.status_code, response.json())

print("\n--- Testing GET /api/tasks ---")
response = client.get("/api/tasks")
print(response.status_code, f"Count: {len(response.json())}")

# Try to get task 1, might be 404 since no tasks were seeded
print("\n--- Testing GET /api/tasks/1 ---")
response = client.get("/api/tasks/1")
print(response.status_code, response.json())
