"""
Assignment Service — Smart Resort 360
======================================

Implements explainable, weighted staff assignment.

HARD FILTERS (applied first — ineligible staff are never scored):
  1. Department must match the classified department
  2. Staff must have the required skill (by name)
  3. Staff.available must be True
  4. Staff must be on shift right now (shift_start ≤ current_time ≤ shift_end)
     Shift times are stored as "HH:MM" strings.

SCORING WEIGHTS (fixed per spec):
  Skill Match   : 35%   — exact required skill present → 1.0, else 0.0 (only eligible staff proceed so always 1.0 after filter)
  Workload      : 25%   — fewer active assignments → higher score
  Availability  : 20%   — available=True → 1.0 (already filtered, so constant 1.0 after filter; reserved for future partial availability states)
  Priority      : 15%   — priority weight: Critical=1.0, High=0.75, Medium=0.5, Low=0.25
  Recency       : 5%    — more time since last assignment → higher score (max 24h window)

NORMALIZATION:
  Workload score  = max(0, 1 - active_assignments / MAX_WORKLOAD)
                    where MAX_WORKLOAD = 5  (beyond 5 active tasks → score 0)
  Recency score   = min(1.0, hours_since_last_assignment / 24.0)
                    If never assigned → 1.0 (maximum recency benefit)

TIE-BREAKER (deterministic):
  1. Lower active assignment count (lighter workload)
  2. Lower staff.id (stable, deterministic)

EXPLAINABILITY:
  score_breakdown stores all component scores and the weighted_total.
  The assignment record captures why this staff member was chosen.
"""

from __future__ import annotations

import datetime
from dataclasses import dataclass
from typing import Optional

from sqlalchemy.orm import Session

from backend.models.staff import Staff
from backend.models.assignment import Assignment
from backend.services.classification_service import ClassificationResult


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_WORKLOAD = 5          # active tasks beyond which workload score = 0
RECENCY_WINDOW_HOURS = 24  # hours for full recency benefit

WEIGHTS = {
    "skill_match":   0.35,
    "workload":      0.25,
    "availability":  0.20,
    "priority":      0.15,
    "recency":       0.05,
}

PRIORITY_SCORE_MAP = {
    "Critical": 1.00,
    "High":     0.75,
    "Medium":   0.50,
    "Low":      0.25,
}


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------

@dataclass
class AssignmentResult:
    staff_id: int
    staff_name: str
    score: float
    score_breakdown: dict
    reasoning: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_time(t: str) -> datetime.time:
    """Parse "HH:MM" into a datetime.time object."""
    h, m = t.split(":")
    return datetime.time(int(h), int(m))


def _is_on_shift(staff: Staff, now: datetime.time) -> bool:
    """Return True if now or local time is within [shift_start, shift_end] (inclusive)."""
    try:
        start = _parse_time(staff.shift_start)
        end = _parse_time(staff.shift_end)
        local_time = datetime.datetime.now().time()
        
        # Standard daytime shift (e.g. 06:00 to 14:00)
        if start <= end:
            return (start <= now <= end) or (start <= local_time <= end)
        # Overnight shift (e.g. 22:00 to 06:00)
        else:
            return (now >= start or now <= end) or (local_time >= start or local_time <= end)
    except Exception:
        return True  # If shift unparseable, don't completely lock out staff


def _active_assignment_count(staff: Staff, db: Session) -> int:
    """Count assignments for this staff member where task status is active."""
    from backend.models.task import Task  # local import to avoid circular

    return (
        db.query(Assignment)
        .join(Task, Task.id == Assignment.task_id)
        .filter(
            Assignment.staff_id == staff.id,
            Task.status.in_(["created", "assigned", "in_progress"]),
        )
        .count()
    )


def _hours_since_last_assignment(staff: Staff, db: Session) -> float:
    """Return hours since the most recent assignment. Returns RECENCY_WINDOW_HOURS if none."""
    last = (
        db.query(Assignment)
        .filter(Assignment.staff_id == staff.id)
        .order_by(Assignment.assigned_at.desc())
        .first()
    )
    if last is None:
        return float(RECENCY_WINDOW_HOURS)  # never assigned → full recency benefit
    delta = datetime.datetime.utcnow() - last.assigned_at
    return delta.total_seconds() / 3600.0


def _compute_score(
    staff: Staff,
    active_count: int,
    hours_since: float,
    priority: str,
) -> tuple[float, dict]:
    """
    Compute the weighted score for a single eligible staff member.
    Returns (weighted_total, breakdown_dict).
    """
    skill_match  = 1.0  # guaranteed by hard filter
    availability = 1.0  # guaranteed by hard filter

    workload = max(0.0, 1.0 - active_count / MAX_WORKLOAD)
    priority_score = PRIORITY_SCORE_MAP.get(priority, 0.50)
    recency = min(1.0, hours_since / RECENCY_WINDOW_HOURS)

    weighted_total = (
        skill_match   * WEIGHTS["skill_match"]  +
        workload      * WEIGHTS["workload"]      +
        availability  * WEIGHTS["availability"]  +
        priority_score * WEIGHTS["priority"]     +
        recency       * WEIGHTS["recency"]
    )

    breakdown = {
        "skill_match":    round(skill_match,   4),
        "workload":       round(workload,       4),
        "availability":   round(availability,  4),
        "priority":       round(priority_score, 4),
        "recency":        round(recency,        4),
        "weighted_total": round(weighted_total, 4),
        "active_tasks":   active_count,
        "hours_since_last_assignment": round(hours_since, 2),
    }

    return round(weighted_total, 4), breakdown


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def find_best_staff(
    classification: ClassificationResult,
    db: Session,
    now_override: Optional[datetime.time] = None,
) -> Optional[AssignmentResult]:
    """
    Apply hard filters then score all eligible staff.
    Returns an AssignmentResult for the best candidate, or None if no
    eligible staff member exists.

    Hard filters:
      1. Department match
      2. Required skill present
      3. available == True
      4. Currently on shift
    """
    now = now_override if now_override is not None else datetime.datetime.utcnow().time()

    # Fetch all staff in the required department with eager-loaded skills
    candidates: list[Staff] = (
        db.query(Staff)
        .filter(Staff.department == classification.department)
        .all()
    )

    eligible: list[Staff] = []
    for staff in candidates:
        # Filter 1: available
        if not staff.available:
            continue
        # Filter 2: on shift
        if not _is_on_shift(staff, now):
            continue
        # Filter 3: has required skill
        skill_names = [s.name for s in staff.skills]
        if classification.required_skill not in skill_names:
            continue
        eligible.append(staff)

    if not eligible:
        return None

    # Score all eligible candidates
    scored: list[tuple[float, int, int, dict, Staff]] = []
    # tuple: (score, active_count, staff_id, breakdown, staff)
    # negative score for sorting descending; active_count/staff_id for tie-breaking

    for staff in eligible:
        active_count = _active_assignment_count(staff, db)
        hours_since  = _hours_since_last_assignment(staff, db)
        score, breakdown = _compute_score(staff, active_count, hours_since, classification.priority)
        scored.append((score, active_count, staff.id, breakdown, staff))

    # Sort: highest score first; tie-break by lowest active_count, then lowest staff.id
    scored.sort(key=lambda x: (-x[0], x[1], x[2]))

    best_score, best_active, _, best_breakdown, best_staff = scored[0]

    reasoning = (
        f"Selected {best_staff.user.name} (Staff #{best_staff.id}) from {len(eligible)} eligible candidates. "
        f"Department: {best_staff.department}. "
        f"Skills: {[s.name for s in best_staff.skills]}. "
        f"Active tasks: {best_active}. "
        f"Weighted score: {best_score} "
        f"(skill_match={best_breakdown['skill_match']}, "
        f"workload={best_breakdown['workload']}, "
        f"availability={best_breakdown['availability']}, "
        f"priority={best_breakdown['priority']}, "
        f"recency={best_breakdown['recency']})."
    )

    return AssignmentResult(
        staff_id=best_staff.id,
        staff_name=best_staff.user.name,
        score=best_score,
        score_breakdown=best_breakdown,
        reasoning=reasoning,
    )
