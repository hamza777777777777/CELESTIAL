"""
Complaints route — Smart Resort 360
=====================================

POST /api/complaints
  Full operational flow:
  1. Validate complaint input
  2. Persist complaint (status = "submitted")
  3. Classify complaint via classification_service
  4. Update complaint status → "classified"
  5. Create Task from classification
  6. Run assignment engine (hard filters + weighted scoring)
  7. If staff found: create Assignment, update Task status → "assigned"
     If no staff: Task remains "created", assignment info = null
  8. Append TaskStatusHistory records
  9. Write AuditLog entry
 10. Return enriched ComplaintCreateResponse

GET /api/complaints       — list all complaints (backward-compatible)
GET /api/complaints/{id}  — single complaint (backward-compatible)
"""

import datetime
import traceback

from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from sqlalchemy.orm import Session
from typing import List
import os
import shutil

from backend.database import get_db
from backend.models import Complaint, Task, Assignment, TaskStatusHistory, AuditLog, Skill, Notification
from backend.schemas.complaint import (
    ComplaintCreate,
    ComplaintResponse,
    ComplaintCreateResponse,
    ClassificationInfo,
    AssignmentInfo,
)
from backend.services.classification_service import classify_complaint
from backend.services.assignment_service import find_best_staff

router = APIRouter(prefix="/api/complaints", tags=["complaints"])

VALID_LANGUAGES = {"en", "hi", "mr", "ta", "hinglish"}


# ---------------------------------------------------------------------------
# POST — create + classify + assign
# ---------------------------------------------------------------------------

@router.post("", response_model=ComplaintCreateResponse)
def create_complaint(
    guest_id: int = Form(...),
    room_number: int = Form(...),
    text: str = Form(...),
    language: str = Form(...),
    request_category: str = Form("complaint"),
    photo: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    complaint = ComplaintCreate(guest_id=guest_id, room_number=room_number, text=text, language=language, request_category=request_category)
    # ── Validate ────────────────────────────────────────────────────────────
    if complaint.language not in VALID_LANGUAGES:
        raise HTTPException(status_code=400, detail=f"Invalid language. Allowed: {sorted(VALID_LANGUAGES)}")
    if not complaint.text.strip():
        raise HTTPException(status_code=400, detail="Complaint text must not be empty.")

    # ── 1. Persist complaint ─────────────────────────────────────────────────
    db_complaint = Complaint(
        guest_id=complaint.guest_id,
        room_number=complaint.room_number,
        text=complaint.text.strip(),
        language=complaint.language,
        request_category=complaint.request_category,
        status="submitted",
    )
    db.add(db_complaint)
    db.commit()
    db.refresh(db_complaint)

    if photo:
        if not photo.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Photo must be an image file.")
        
        os.makedirs("uploads/complaints", exist_ok=True)
        file_location = f"uploads/complaints/{db_complaint.id}_{photo.filename}"
        with open(file_location, "wb") as buffer:
            shutil.copyfileobj(photo.file, buffer)
        
        db_complaint.photo_path = file_location
        db.commit()
        db.refresh(db_complaint)

    task_id: int | None = None
    task_status: str | None = None
    classification_info: ClassificationInfo | None = None
    assignment_info: AssignmentInfo | None = None

    try:
        # ── 2. Classify ──────────────────────────────────────────────────────
        clf = classify_complaint(db_complaint.text)

        # Update complaint status
        db_complaint.status = "classified"
        db.commit()

        classification_info = ClassificationInfo(
            issue_type=clf.issue_type,
            department=clf.department,
            priority=clf.priority,
            location=clf.location,
            required_skill=clf.required_skill,
            confidence=clf.confidence,
            source=clf.source,
            reasoning=clf.reasoning,
        )

        # ── 3. Resolve required skill ID ────────────────────────────────────
        skill_record = db.query(Skill).filter(Skill.name == clf.required_skill).first()
        required_skill_id = skill_record.id if skill_record else None

        # ── 4. Run assignment engine ─────────────────────────────────────────
        assignment_result = find_best_staff(clf, db)

        if not assignment_result:
            raise HTTPException(
                status_code=409,
                detail="No eligible staff member is currently available for this complaint."
            )

        # ── 5. Create Task ───────────────────────────────────────────────────
        task = Task(
            complaint_id=db_complaint.id,
            issue_type=clf.issue_type,
            department=clf.department,
            priority=clf.priority,
            location=clf.location or f"Room {complaint.room_number}",
            required_skill_id=required_skill_id,
            status="assigned",
        )
        db.add(task)
        db.commit()
        db.refresh(task)

        # Status history: None → created, created → assigned
        db.add(TaskStatusHistory(
            task_id=task.id,
            old_status=None,
            new_status="created",
        ))
        db.add(TaskStatusHistory(
            task_id=task.id,
            old_status="created",
            new_status="assigned",
        ))

        # Create assignment record
        db_assignment = Assignment(
            task_id=task.id,
            staff_id=assignment_result.staff_id,
            score=assignment_result.score,
            score_breakdown=assignment_result.score_breakdown,
        )
        db.add(db_assignment)

        # Guest Notification
        db.add(Notification(
            guest_id=complaint.guest_id,
            message="Your request has been accepted and assigned to our team.",
            related_request_id=db_complaint.id
        ))
        db.commit()
        db.refresh(db_assignment)

        task_id = task.id
        task_status = task.status

        assignment_info = AssignmentInfo(
            assignment_id=db_assignment.id,
            staff_id=assignment_result.staff_id,
            staff_name=assignment_result.staff_name,
            score=assignment_result.score,
            score_breakdown=assignment_result.score_breakdown,
            reasoning=assignment_result.reasoning,
        )

        # ── 6. Audit log ─────────────────────────────────────────────────────
        db.add(AuditLog(
            action="COMPLAINT_CLASSIFICATION",
            user_id=complaint.guest_id,
            resource_type="complaint",
            resource_id=db_complaint.id,
            details_json={
                "complaint_id": db_complaint.id,
                "model": clf.source,
                "source": "llm" if clf.source == "gpt-4o-mini" else "rule_based",
                "prediction": clf.issue_type,
                "confidence": clf.confidence,
                "evidence": f"Text: {db_complaint.text}",
                "reasoning": clf.reasoning,
                "features": {
                    "department": clf.department,
                    "priority": clf.priority,
                    "required_skill": clf.required_skill
                }
            }
        ))
        
        if assignment_result:
            db.add(AuditLog(
                action="STAFF_ASSIGNMENT",
                user_id=complaint.guest_id,
                resource_type="task",
                resource_id=task_id,
                details_json={
                    "task_id": task_id,
                    "complaint_id": db_complaint.id,
                    "source": "algorithmic",
                    "algorithm": "weighted_scoring",
                    "prediction": assignment_result.staff_name,
                    "confidence": assignment_result.score,
                    "features": assignment_result.score_breakdown,
                    "reasoning": assignment_result.reasoning
                }
            ))
        db.commit()

    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        # If anything in the operational pipeline fails, the complaint is
        # still safely stored. We log the error and return a partial response.
        db.rollback()
        print(f"[complaints route] Pipeline error for complaint {db_complaint.id}: {exc}")
        traceback.print_exc()
        # Re-fetch complaint after rollback to ensure it's still accessible
        db_complaint = db.query(Complaint).filter(Complaint.id == db_complaint.id).first()

    return ComplaintCreateResponse(
        id=db_complaint.id,
        guest_id=db_complaint.guest_id,
        room_number=db_complaint.room_number,
        text=db_complaint.text,
        language=db_complaint.language,
        request_category=db_complaint.request_category,
        status=db_complaint.status,
        photo_path=db_complaint.photo_path,
        created_at=db_complaint.created_at,
        task_id=task_id,
        task_status=task_status,
        classification=classification_info,
        assignment=assignment_info,
    )


# ---------------------------------------------------------------------------
# GET — list all (backward-compatible)
# ---------------------------------------------------------------------------

@router.get("", response_model=List[ComplaintResponse])
def get_complaints(db: Session = Depends(get_db)):
    return db.query(Complaint).all()


# ---------------------------------------------------------------------------
# GET — single complaint (backward-compatible)
# ---------------------------------------------------------------------------

@router.get("/{complaint_id}", response_model=ComplaintResponse)
def get_complaint(complaint_id: int, db: Session = Depends(get_db)):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return complaint
