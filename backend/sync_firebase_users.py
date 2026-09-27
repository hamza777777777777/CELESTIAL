import os
import sys
import json

_root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _root_dir not in sys.path:
    sys.path.insert(0, _root_dir)

import firebase_admin
from firebase_admin import credentials, auth
from backend.database import SessionLocal
from backend.models.user import User

# Load from backend/.env manually
env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(env_path):
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f.read().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                k, v = k.strip(), v.strip().strip("'").strip('"')
                if k not in os.environ:
                    os.environ[k] = v

def main():
    cred_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH")
    service_account_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    
    cred = None
    if cred_path and os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
    elif service_account_json:
        try:
            cred = credentials.Certificate(json.loads(service_account_json))
        except Exception:
            pass

    if not cred:
        print("ERROR: Neither FIREBASE_SERVICE_ACCOUNT_PATH nor valid FIREBASE_SERVICE_ACCOUNT_JSON found.")
        return

    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    print("Firebase Admin SDK initialized successfully.")

    # Connect to the DB
    db = SessionLocal()
    
    users_to_seed = [
        {"email": "staff@smartresort360.com", "role": "Staff", "name": "Test Staff"},
        {"email": "admin@smartresort360.com", "role": "Manager", "name": "Test Admin"},
    ]

    for u in users_to_seed:
        try:
            # Fetch the real Firebase User
            fb_user = auth.get_user_by_email(u["email"])
            real_uid = fb_user.uid
            print(f"Found real Firebase UID for {u['email']}: {real_uid}")
            
            # Check if user already exists in DB
            db_user = db.query(User).filter(User.email == u["email"]).first()
            if db_user:
                db_user.firebase_uid = real_uid
                db_user.role = u["role"]
                print(f"Updated existing DB user {u['email']} with UID {real_uid}")
            else:
                db_user = User(
                    name=u["name"],
                    email=u["email"],
                    role=u["role"],
                    firebase_uid=real_uid
                )
                db.add(db_user)
                print(f"Created new DB user for {u['email']} with UID {real_uid}")
        
        except auth.UserNotFoundError:
            print(f"WARNING: User {u['email']} does not exist in the Firebase project!")
        except Exception as e:
            print(f"ERROR processing {u['email']}: {e}")

    db.commit()
    db.close()
    print("Database seeding completed successfully.")

if __name__ == "__main__":
    main()
