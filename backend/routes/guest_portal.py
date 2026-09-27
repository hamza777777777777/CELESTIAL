from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from backend.database import get_db
from backend.models.complaint import Complaint
from backend.models.notification import Notification
from backend.models.task import Task
from backend.models.user import User
from backend.auth import get_current_guest
from backend.routes.complaints import create_complaint
from backend.schemas.complaint import ComplaintCreateResponse

router = APIRouter(prefix="/api/guest", tags=["guest_portal"])

# ── Schemas ────────────────────────────────────────────────────────────

class GuestRequestResponse(BaseModel):
    id: int
    request_category: str
    text: str
    status: str # Submitted / Accepted / In Progress / Completed
    photo_path: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class NotificationResponse(BaseModel):
    id: int
    message: str
    related_request_id: Optional[int]
    read: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# ── Endpoints ──────────────────────────────────────────────────────────

def map_task_status_to_guest_status(task_status: Optional[str], complaint_status: str) -> str:
    if not task_status:
        return "Submitted"
    if task_status in ["created", "assigned"]:
        return "Accepted"
    elif task_status == "in_progress":
        return "In Progress"
    elif task_status in ["completed", "verified", "closed"]:
        return "Completed"
    return "Submitted"

@router.get("/{guest_id}/requests", response_model=List[GuestRequestResponse])
def get_guest_requests(guest_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_guest)):
    if current_user.id != guest_id:
        raise HTTPException(status_code=403, detail="Forbidden: You can only access your own requests")
    complaints = db.query(Complaint).filter(Complaint.guest_id == guest_id).order_by(Complaint.created_at.desc()).all()
    
    results = []
    for c in complaints:
        # Get latest task if any
        latest_task = db.query(Task).filter(Task.complaint_id == c.id).order_by(Task.id.desc()).first()
        task_status = latest_task.status if latest_task else None
        
        guest_status = map_task_status_to_guest_status(task_status, c.status)
        
        results.append(GuestRequestResponse(
            id=c.id,
            request_category=c.request_category,
            text=c.text,
            status=guest_status,
            photo_path=c.photo_path,
            created_at=c.created_at
        ))
        
    return results

@router.post("/{guest_id}/requests", response_model=ComplaintCreateResponse)
def create_guest_request(
    guest_id: int,
    room_number: int = Form(...),
    text: str = Form(...),
    request_category: str = Form(...),
    photo: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_guest)
):
    if current_user.id != guest_id:
        raise HTTPException(status_code=403, detail="Forbidden: You can only create requests for yourself")
    # Delegate to the existing pipeline
    return create_complaint(
        guest_id=guest_id,
        room_number=room_number,
        text=text,
        language="en", # default for requests, or can be passed
        request_category=request_category,
        photo=photo,
        db=db
    )

@router.get("/{guest_id}/notifications", response_model=List[NotificationResponse])
def get_guest_notifications(guest_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_guest)):
    if current_user.id != guest_id:
        raise HTTPException(status_code=403, detail="Forbidden: You can only access your own notifications")
    notifications = db.query(Notification).filter(Notification.guest_id == guest_id).order_by(Notification.created_at.desc()).all()
    return notifications

@router.post("/{guest_id}/notifications/{notification_id}/read")
def mark_notification_read(guest_id: int, notification_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_guest)):
    if current_user.id != guest_id:
        raise HTTPException(status_code=403, detail="Forbidden: You can only modify your own notifications")
    notif = db.query(Notification).filter(Notification.id == notification_id, Notification.guest_id == guest_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    notif.read = True
    db.commit()
    return {"status": "success", "read": True}
