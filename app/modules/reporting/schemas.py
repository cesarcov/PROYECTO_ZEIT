from pydantic import BaseModel
from uuid import UUID
from datetime import date


class MaterialRequestsSLAKPI(BaseModel):
    total_decided_requests: int
    within_sla: int
    overdue: int
    sla_compliance_rate: float
    avg_decision_time_hours: float

class MaterialRequestsSummaryKPI(BaseModel):
    total_requests: int
    pending_requests: int
    approved_requests: int
    rejected_requests: int
    overdue_requests: int

class MaterialRequestsLeadTimeKPI(BaseModel):
    avg_lead_time_hours: float
    min_lead_time_hours: float
    max_lead_time_hours: float
    p95_lead_time_hours: float

class MaterialRequestsByApproverKPI(BaseModel):
    approver_id: UUID
    total_decisions: int
    approved_count: int
    rejected_count: int
    sla_compliance_rate: float
    avg_decision_time_hours: float

class MaterialRequestsMonthlyKPI(BaseModel):
    month: date
    total_requests: int
    approved_requests: int
    rejected_requests: int
    pending_requests: int
    overdue_requests: int
    sla_compliance_rate: float