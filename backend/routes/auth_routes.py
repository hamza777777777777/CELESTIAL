from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from backend.database import get_db
from backend.models.user import User
from backend.auth import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    firebase_uid: str | None = None
    
    class Config:
        orm_mode = True

class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    firebase_uid: str

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/signup", response_model=UserResponse)
def signup(request: SignupRequest, db: Session = Depends(get_db)):
    # Create Guest only
    existing = db.query(User).filter((User.email == request.email) | (User.firebase_uid == request.firebase_uid)).first()
    if existing:
        if existing.firebase_uid != request.firebase_uid:
            existing.firebase_uid = request.firebase_uid
            db.commit()
            db.refresh(existing)
        return existing
    
    new_user = User(
        name=request.name,
        email=request.email,
        role="Guest",
        firebase_uid=request.firebase_uid
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user
