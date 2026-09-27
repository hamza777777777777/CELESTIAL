import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import Base, engine, get_db
from backend.models.notification import Notification
from backend.auth import get_token_verifier
from fastapi import HTTPException, status

client = TestClient(app)

def mock_firebase_verifier(token: str) -> str:
    """Mock verifier for testing guest portal endpoints."""
    if not token or not token.startswith("test-"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Firebase ID token"
        )
    if not token.endswith("-uid"):
        return f"{token}-uid"
    return token

@pytest.fixture(scope="module", autouse=True)
def setup_auth_mock():
    app.dependency_overrides[get_token_verifier] = lambda: mock_firebase_verifier
    yield
    app.dependency_overrides.pop(get_token_verifier, None)

def test_post_guest_service_request(test_db):
    res = client.post('/api/guest/1/requests', data={'room_number': 101, 'text': 'Please bring extra towels', 'request_category': 'service_request'}, headers={'Authorization': 'Bearer test-guest-uid'})
    assert res.status_code == 200
    data = res.json()
    assert data['request_category'] == 'service_request'
    assert data['task_id'] is not None

def test_post_guest_complaint(test_db):
    res = client.post('/api/guest/1/requests', data={'room_number': 101, 'text': 'The AC is broken', 'request_category': 'complaint'}, headers={'Authorization': 'Bearer test-guest-uid'})
    assert res.status_code == 200
    data = res.json()
    assert data['request_category'] == 'complaint'
    assert data['task_id'] is not None
import random

def test_get_guest_requests(test_db):
    g_id = 1
    client.post(f'/api/guest/{g_id}/requests', data={'room_number': 200, 'text': 'Need water', 'request_category': 'service_request'}, headers={'Authorization': 'Bearer test-guest-uid'})
    res2 = client.get(f'/api/guest/{g_id}/requests', headers={'Authorization': 'Bearer test-guest-uid'})
    assert res2.status_code == 200
    assert len(res2.json()) >= 1

def test_status_transition_creates_notification(test_db):
    from backend.models.skill import Skill, staff_skills
    from backend.models.staff import Staff
    # Seed General skill to staff 777 (Maintenance) so assignment succeeds
    sk = test_db.query(Skill).filter_by(name="General").first()
    if not sk:
        sk = Skill(name="General")
        test_db.add(sk)
    staff = test_db.query(Staff).get(777)
    if sk not in staff.skills:
        staff.skills.append(sk)
    test_db.commit()

    g_id = 1
    res = client.post(f'/api/guest/{g_id}/requests', data={'room_number': 103, 'text': 'Fix the TV', 'request_category': 'complaint'}, headers={'Authorization': 'Bearer test-guest-uid'})
    data = res.json()
    task_id = data['task_id']
    res_status = client.patch(f'/api/tasks/{task_id}/status', json={'status': 'in_progress'}, headers={'Authorization': 'Bearer test-manager-uid'})
    assert res_status.status_code == 200
    notifs_after = client.get(f'/api/guest/{g_id}/notifications', headers={'Authorization': 'Bearer test-guest-uid'}).json()
    assert len(notifs_after) == 2
    assert notifs_after[0]['message'] == 'Your request is currently being worked on.'
    unread = [n for n in notifs_after if not n['read']]
    assert len(unread) == 2

def test_get_notifications_and_mark_read(test_db):
    from backend.models.skill import Skill, staff_skills
    from backend.models.staff import Staff
    sk = test_db.query(Skill).filter_by(name="General").first()
    if not sk:
        sk = Skill(name="General")
        test_db.add(sk)
    staff = test_db.query(Staff).get(777)
    if sk not in staff.skills:
        staff.skills.append(sk)
    test_db.commit()

    g_id = 1
    client.post(f'/api/guest/{g_id}/requests', data={'room_number': 1, 'text': 'Fix the TV', 'request_category': 'complaint'}, headers={'Authorization': 'Bearer test-guest-uid'})
    res = client.get(f'/api/guest/{g_id}/notifications', headers={'Authorization': 'Bearer test-guest-uid'})
    notifs = res.json()
    assert len(notifs) > 0
    notif_id = notifs[0]['id']
    res_read = client.post(f'/api/guest/{g_id}/notifications/{notif_id}/read', headers={'Authorization': 'Bearer test-guest-uid'})
    assert res_read.status_code == 200
    assert res_read.json()['read'] is True
    res2 = client.get(f'/api/guest/{g_id}/notifications', headers={'Authorization': 'Bearer test-guest-uid'})
    notifs2 = res2.json()
    assert notifs2[0]['read'] is True
    unread_now = [n for n in notifs2 if not n['read']]
    assert len(unread_now) == len(notifs) - 1