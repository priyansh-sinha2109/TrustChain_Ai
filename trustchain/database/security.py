"""
TrustChain AI — Zero-Trust Tenant Security & RBAC Enforcement
Role: Member 3 (Supabase Architecture, Data Persistence, Security & Audit)

Provides backend-side tenant verification and role-based access control.
Because privileged backend service-role connections bypass PostgreSQL RLS,
application-layer authorization is mandatory to eliminate cross-tenant data leaks.
"""

from dataclasses import dataclass
from typing import Collection, Optional, Union
import uuid
from trustchain.database.models import RoleEnum


@dataclass(frozen=True)
class TenantSecurityContext:
    user_id: uuid.UUID
    org_id: uuid.UUID
    role: RoleEnum
    email: Optional[str] = None

    def has_role(self, roles: Collection[Union[RoleEnum, str]]) -> bool:
        role_values = {r.value if isinstance(r, RoleEnum) else str(r) for r in roles}
        return self.role.value in role_values


class TenantAuthorizer:
    @staticmethod
    def verify_tenant_isolation(context: TenantSecurityContext, target_org_id: uuid.UUID) -> None:
        """
        Enforces tenant isolation: Prevents User from Org A accessing data from Org B.
        Guessed UUIDs across organizations are strictly blocked.
        """
        if context.org_id != target_org_id:
            raise PermissionError(
                f"Tenant Isolation Violation: User '{context.user_id}' in Org '{context.org_id}' "
                f"attempted to access resource owned by Org '{target_org_id}'."
            )

    @staticmethod
    def verify_role_permission(
        context: TenantSecurityContext,
        allowed_roles: Collection[Union[RoleEnum, str]],
        action_description: str = "perform this operation",
    ) -> None:
        """Enforces Role-Based Access Control (RBAC)."""
        if not context.has_role(allowed_roles):
            role_names = [r.value if isinstance(r, RoleEnum) else str(r) for r in allowed_roles]
            raise PermissionError(
                f"RBAC Violation: Role '{context.role.value}' is not authorized to {action_description}. "
                f"Required role: {role_names}."
            )

    @staticmethod
    def verify_case_ownership(context: TenantSecurityContext, case_org_id: uuid.UUID) -> None:
        """Validates case ownership before any case read/write operation."""
        TenantAuthorizer.verify_tenant_isolation(context, case_org_id)

    @staticmethod
    def verify_reviewer_authority(context: TenantSecurityContext) -> None:
        """Ensures buyers cannot approve their own advance payments or review line-items."""
        TenantAuthorizer.verify_role_permission(
            context,
            allowed_roles=[RoleEnum.REVIEWER, RoleEnum.ADMIN],
            action_description="submit commercial review decisions or deal change actions",
        )
