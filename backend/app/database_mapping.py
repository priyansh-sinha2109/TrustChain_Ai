"""Explicit semantic translations. Evidence status is never a review workflow state."""
from trustchain.database.models import DecisionEnum, SeverityEnum, ResearchStatusEnum

SEVERITY_TO_DATABASE = {"INFO": SeverityEnum.LOW, "WARNING": SeverityEnum.MEDIUM, "HIGH": SeverityEnum.HIGH}
REVIEW_TO_DATABASE = {"APPROVE": DecisionEnum.APPROVE_ADVANCE,
    "REJECT": DecisionEnum.REJECT_PAYMENT,
    "REQUEST_CLARIFICATION": DecisionEnum.REQUEST_SUPPLIER_CLARIFICATION}


def finding_details(finding):
    return {**finding.model_dump(mode="json"), "comparison_status": finding.status,
        "backend_severity": finding.severity}


def research_status(provider_status):
    # CANCELLED is not in Member 3's enum. Preserve its actual state separately.
    return {"PENDING": ResearchStatusEnum.PENDING, "RUNNING": ResearchStatusEnum.RUNNING,
        "COMPLETED": ResearchStatusEnum.COMPLETED, "FAILED": ResearchStatusEnum.FAILED,
        "CANCELLED": ResearchStatusEnum.FAILED}.get(provider_status, ResearchStatusEnum.RUNNING)
