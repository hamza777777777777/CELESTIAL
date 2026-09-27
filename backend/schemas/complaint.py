from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime


class ComplaintCreate(BaseModel):
    guest_id: int = Field(..., gt=0)
    room_number: int = Field(..., gt=0, description="Room number is mandatory")
    text: str = Field(..., min_length=1)
    language: str
    request_category: str = "complaint"


class ComplaintResponse(BaseModel):
    """Backward-compatible complaint response (used by GET endpoints)."""
    id: int
    guest_id: int
    room_number: Optional[int] = None
    text: str
    language: Optional[str] = "en"
    request_category: str = "complaint"
    photo_path: Optional[str] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class ClassificationInfo(BaseModel):
    """Classification details embedded in the enriched POST response."""
    issue_type: str
    department: str
    priority: str
    location: Optional[str]
    required_skill: str
    confidence: float
    source: str       # "rule_based" | "llm"
    reasoning: str


class AssignmentInfo(BaseModel):
    """Assignment details embedded in the enriched POST response."""
    assignment_id: Optional[int]
    staff_id: Optional[int]
    staff_name: Optional[str]
    score: Optional[float]
    score_breakdown: Optional[Any]
    reasoning: Optional[str]


class ComplaintCreateResponse(BaseModel):
    """
    Enriched response for POST /api/complaints.
    Exposes complaint + classification + task + assignment in one payload.
    Backward-compatible: complaint fields are identical to ComplaintResponse.
    """
    # Complaint fields (same as ComplaintResponse)
    id: int
    guest_id: int
    room_number: int
    text: str
    language: str
    request_category: str = "complaint"
    photo_path: Optional[str] = None
    status: str
    created_at: datetime

    # Operational intelligence
    task_id: Optional[int] = None
    task_status: Optional[str] = None
    classification: Optional[ClassificationInfo] = None
    assignment: Optional[AssignmentInfo] = None

    class Config:
        from_attributes = True
