import os
import json
import sys
from typing import Optional
from fastapi import Request, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import auth as fb_auth, credentials
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.user import User

def init_firebase_admin():
    if not firebase_admin._apps:
        if not os.getenv('FIREBASE_SERVICE_ACCOUNT_JSON') and not os.getenv('FIREBASE_SERVICE_ACCOUNT_PATH'):
            env_file = os.path.join(os.path.dirname(__file__), ".env")
            if os.path.exists(env_file):
                try:
                    with open(env_file, "r", encoding="utf-8") as f:
                        for line in f.read().splitlines():
                            line = line.strip()
                            if line and not line.startswith("#") and "=" in line:
                                k, v = line.split("=", 1)
                                k, v = k.strip(), v.strip().strip("'").strip('"')
                                if k not in os.environ:
                                    os.environ[k] = v
                except Exception:
                    pass

        cred_path = os.getenv('FIREBASE_SERVICE_ACCOUNT_PATH')
        cred_json = os.getenv('FIREBASE_SERVICE_ACCOUNT_JSON')
        project_id = os.getenv('FIREBASE_PROJECT_ID', 'smart-resot-360')
        if cred_path and os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred, {'projectId': project_id})
        elif cred_json and cred_json.strip():
            try:
                parsed = json.loads(cred_json)
                cred = credentials.Certificate(parsed)
                firebase_admin.initialize_app(cred, {'projectId': project_id})
            except Exception as e:
                print(f'Warning: Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON: {e}')
                firebase_admin.initialize_app(options={'projectId': project_id})
        else:
            try:
                firebase_admin.initialize_app(options={'projectId': project_id})
            except Exception as e:
                pass
init_firebase_admin()
bearer_scheme = HTTPBearer(auto_error=False)

from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests
import requests

GOOGLE_CLIENT_ID = os.getenv(
    "GOOGLE_CLIENT_ID",
    "992989791821-45v9om88hqleien9u1mruaems40b9nqr.apps.googleusercontent.com"
)

# Lightweight in-memory cache for validated token metadata { token: { "uid": ..., "email": ..., "name": ... } }
_token_cache = {}

def verify_firebase_token(token: str) -> str:
    """
    Verify authentication token.
    Supports:
    1. Direct Google OAuth2 ID Token (JWT)
    2. Direct Google OAuth2 Access Token (via Google UserInfo)
    3. Firebase ID Token fallback
    """
    if token in _token_cache:
        return _token_cache[token]["uid"]

    # Support dummy role tokens for rapid role testing / demo
    if token.startswith("dummy-"):
        return token

    # Check if token directly matches an existing registered user's UID, ID, or Email
    from backend.database import SessionLocal
    _db = SessionLocal()
    try:
        user_match = None
        if token.isdigit():
            user_match = _db.query(User).filter(User.id == int(token)).first()
        if not user_match:
            user_match = _db.query(User).filter(User.firebase_uid == token).first()
        if not user_match and "@" in token:
            user_match = _db.query(User).filter(User.email == token.lower()).first()
        if user_match:
            return user_match.firebase_uid
    except Exception:
        pass
    finally:
        _db.close()

    # 1. Try Google ID token (JWT format: 3 segments)
    if token.count('.') == 2:
        try:
            idinfo = google_id_token.verify_oauth2_token(
                token,
                google_requests.Request(),
                GOOGLE_CLIENT_ID
            )
            if idinfo and "sub" in idinfo:
                uid = idinfo["sub"]
                _token_cache[token] = {
                    "uid": uid,
                    "email": idinfo.get("email"),
                    "name": idinfo.get("name")
                }
                return uid
        except Exception:
            pass

    # 2. Try Google OAuth2 Access Token via Google UserInfo
    try:
        resp = requests.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {token}"},
            timeout=4
        )
        if resp.status_code == 200:
            data = resp.json()
            if "sub" in data:
                uid = data["sub"]
                _token_cache[token] = {
                    "uid": uid,
                    "email": data.get("email"),
                    "name": data.get("name")
                }
                return uid
    except Exception:
        pass

    # 3. Try Firebase ID Token if Firebase app is initialized
    if firebase_admin._apps:
        try:
            decoded = fb_auth.verify_id_token(token, check_revoked=False)
            uid = decoded.get('uid')
            _token_cache[token] = {
                "uid": uid,
                "email": decoded.get("email"),
                "name": decoded.get("name")
            }
            return uid
        except Exception:
            pass

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail='Invalid or expired authentication token.'
    )

def get_token_verifier():
    """Dependency provider returning the token verifier callable."""
    return verify_firebase_token

def get_firebase_uid(
    request: Request,
    auth_header: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    verifier = Depends(get_token_verifier)
) -> str:
    token = None
    if auth_header and auth_header.credentials:
        token = auth_header.credentials
    else:
        raw = request.headers.get('Authorization') or request.headers.get('authorization')
        if raw and raw.startswith('Bearer '):
            token = raw[7:].strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Authentication required. Missing Bearer token in Authorization header.'
        )
    return verifier(token)

def get_current_user(request: Request, uid: str = Depends(get_firebase_uid), db: Session = Depends(get_db)) -> User:
    user = db.query(User).filter(User.firebase_uid == uid).first()
    if not user:
        # Check token cache to auto-link by verified email
        raw = request.headers.get('Authorization') or request.headers.get('authorization') or ""
        token = raw.replace("Bearer ", "").strip()
        cached = _token_cache.get(token)
        if cached and cached.get("email"):
            email = cached["email"]
            user = db.query(User).filter(User.email == email).first()
            if user:
                user.firebase_uid = uid
                db.commit()
                db.refresh(user)

    if not user and uid.isdigit():
        user = db.query(User).filter(User.id == int(uid)).first()
    if not user and "@" in uid:
        user = db.query(User).filter(User.email == uid.lower()).first()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='User not mapped in Smart Resort system.')

    # Ensure Staff role user has a corresponding Staff profile
    if user.role == 'Staff' and not user.staff_profile:
        from backend.models.staff import Staff
        new_staff = Staff(
            user_id=user.id,
            department="Operations",
            available=True,
            shift_start="08:00",
            shift_end="16:00"
        )
        db.add(new_staff)
        db.commit()
        db.refresh(user)

    return user

def require_roles(allowed_roles: list[str]):

    def role_checker(current_user: User=Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles and current_user.role != 'Owner':
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f'Access forbidden: requires one of {allowed_roles}')
        return current_user
    return role_checker
require_manager = require_roles(['Manager'])
require_team_head = require_roles(['Manager', 'Team Head'])
require_staff = require_roles(['Manager', 'Team Head', 'Staff'])
require_guest = require_roles(['Guest'])

def get_current_guest(current_user: User=Depends(require_guest)) -> User:
    return current_user