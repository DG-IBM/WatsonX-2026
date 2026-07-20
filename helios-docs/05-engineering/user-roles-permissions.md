# User Roles & Permissions — Helios

> **Location:** Confluence → Helios Engineering Space → Engineering → User Roles & Permissions  
> **Owner:** Rosa Lindqvist (Senior Engineer, Platform) · @rosa.lindqvist  
> **Last Updated:** 2024-10-18  
> **Status:** Active  
> **Related:** [Authentication](/05-engineering/authentication.md) · [Authorization](/05-engineering/authorization.md) · [Security Architecture](/06-operations/security-architecture.md)

---

## Role Overview

Helios has two separate role systems — one for the Grid Operations Portal (utility company staff) and one for the Customer Portal (residential/commercial customers). They are enforced by separate Cognito User Pools and separate OPA policy sets.

---

## Grid Operations Portal Roles

| Role | Description | Who Gets This |
|---|---|---|
| `GRID_OPERATOR` | Day-to-day grid monitoring and operations | Control room operators |
| `GRID_SUPERVISOR` | All operator permissions + can close incidents, approve dispatches | Senior operators, shift supervisors |
| `DISPATCH_COORDINATOR` | Create and manage work orders, view technician locations | Dispatch desk staff |
| `FIELD_TECHNICIAN` | Read work orders assigned to them, update work order status | Field engineers (mostly via mobile app) |
| `TENANT_ADMIN` | Manage users, alert rules, notification rules for their tenant | Utility IT administrator |
| `DATA_ANALYST` | Read-only access to analytics and reporting | Business intelligence staff |
| `COMPLIANCE_OFFICER` | Read-only access to all data + regulatory report generation | Regulatory compliance staff |
| `HELIOS_SUPPORT` | Read-only access to all tenants for customer support | Lumina Energy support team |
| `HELIOS_ADMIN` | Full access — Lumina Engineering internal use only | Lumina engineers (limited list) |

---

## Permission Matrix — Grid Operations Portal

| Permission | OPERATOR | SUPERVISOR | DISPATCH | TECHNICIAN | TENANT_ADMIN | ANALYST | COMPLIANCE |
|---|---|---|---|---|---|---|---|
| View grid dashboard | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ |
| View alerts | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ |
| Acknowledge alerts | ✅ | ✅ | — | — | — | — | — |
| Close/resolve alerts | — | ✅ | — | — | — | — | — |
| Configure alert rules | — | — | — | — | ✅ | — | — |
| View work orders | ✅ | ✅ | ✅ | Own only | ✅ | — | — |
| Create work orders (manual) | — | ✅ | ✅ | — | — | — | — |
| Assign technicians | — | ✅ | ✅ | — | — | — | — |
| Update work order status | — | ✅ | ✅ | Own only | — | — | — |
| View outage map | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ |
| View demand forecasts | ✅ | ✅ | — | — | — | ✅ | ✅ |
| Trigger demand response | — | ✅ | — | — | — | — | — |
| View analytics reports | — | — | — | — | — | ✅ | ✅ |
| Generate regulatory reports | — | — | — | — | — | — | ✅ |
| Manage tenant users | — | — | — | — | ✅ | — | — |
| View audit log | — | — | — | — | ✅ | — | ✅ |
| Access API keys management | — | — | — | — | ✅ | — | — |

---

## Customer Portal Roles

The Customer Portal has a simpler role model:

| Role | Description |
|---|---|
| `CUSTOMER` | Standard residential or small commercial customer |
| `BUSINESS_ADMIN` | Commercial customer with multiple accounts/meters; can view all accounts |
| `DEMAND_RESPONSE_ENROLLED` | Customer who has enrolled in a DR program (additional DR-specific views) |

Customer roles grant access **only within the customer's own account data**. The row-level isolation is enforced at the BFF API layer using the `externalAccountId` claim from the JWT.

---

## Tenant Module Flags

Role-based permissions are the first gate. The second gate is **tenant module flags** — a tenant that has not licensed a module cannot access it, regardless of role.

```typescript
// How modules are checked in the API gateway
const MODULE_PERMISSION_MAP: Record<string, string[]> = {
  'query.demandForecast':        ['MODULE_AI_FORECASTING'],
  'mutation.triggerDemandResponse': ['MODULE_DEMAND_RESPONSE'],
  'query.predictiveFaultRisk':   ['MODULE_PREDICTIVE_ANALYTICS'],
  'query.complianceReport':      ['MODULE_COMPLIANCE_REPORTING'],
};

async function checkModuleAccess(
  tenantId: string,
  operation: string
): Promise<boolean> {
  const requiredModules = MODULE_PERMISSION_MAP[operation];
  if (!requiredModules) return true;  // No module restriction
  
  const tenant = await getTenantConfig(tenantId);
  return requiredModules.every(m => tenant.modules.includes(m));
}
```

---

## OPA Policy Enforcement

Authorization decisions are made by **Open Policy Agent (OPA)**. The OPA server runs as a sidecar in the API gateway pod. Policy bundles are stored in S3 and updated via OPA's bundle API when policies change.

```rego
# policies/grid_operations.rego
package helios.authz

import future.keywords.if

# Allow if all conditions are met
allow if {
    has_valid_tenant
    has_required_role
    has_module_access
    not is_suspended_tenant
}

has_valid_tenant if {
    input.claims.tenantId == input.resource.tenantId
}

has_required_role if {
    required_roles := role_requirements[input.operation]
    input.claims.role in required_roles
}

has_module_access if {
    required_module := module_requirements[input.operation]
    required_module in input.tenant.modules
}

# Role requirements per operation
role_requirements := {
    "acknowledgeAlert":     {"GRID_OPERATOR", "GRID_SUPERVISOR"},
    "resolveAlert":         {"GRID_SUPERVISOR"},
    "createWorkOrder":      {"GRID_SUPERVISOR", "DISPATCH_COORDINATOR"},
    "triggerDemandResponse": {"GRID_SUPERVISOR"},
    "generateComplianceReport": {"COMPLIANCE_OFFICER"},
    "manageTenantUsers":    {"TENANT_ADMIN"},
}
```

---

## Edge Cases and Common Pitfalls

### 1. HELIOS_SUPPORT Access
The `HELIOS_SUPPORT` role gives Lumina Engineering's support team read-only access to all tenants. This is used for customer support investigations. **Every use of HELIOS_SUPPORT access is logged to the audit trail.** Customers can request an audit log of when their data was accessed by Lumina staff.

### 2. Technician Self-Service
`FIELD_TECHNICIAN` can only update work orders assigned to them. A technician cannot see work orders assigned to other technicians. The filter is `assignedTechId == jwtClaims.userId`.

### 3. DATA_ANALYST and PII
Analysts have access to aggregated usage data but not raw meter readings at the address level. The analytics reports automatically aggregate to feeder level. Individual meter readings are not exposed to the `DATA_ANALYST` role.

### 4. TENANT_ADMIN Scope
A `TENANT_ADMIN` at Midwest Grid Co. has no access to data from Southwest Energy Cooperative. `TENANT_ADMIN` is fully scoped to the admin's `tenantId` claim.

### 5. Role Assignment
Roles are assigned in Cognito by `HELIOS_ADMIN` (for initial setup) and by `TENANT_ADMIN` (for their own tenant's users). A `TENANT_ADMIN` cannot create a `HELIOS_ADMIN` or `HELIOS_SUPPORT` account — those can only be created by Lumina Engineering.

---

## Adding a New Role or Permission

1. Define the role in this document and the permission matrix
2. Add the role to the OPA policy bundle (`helios-infra/policies/`)
3. Add the Cognito group for the role in Terraform (`helios-infra/terraform/`)
4. Update the permission check in the API gateway middleware
5. Write integration tests for the new role's access patterns
6. Security review by @yasmin.osei required for any new role that expands data access

---

*Document maintained by @rosa.lindqvist*  
*OPA policy questions → @rosa.lindqvist or @yasmin.osei*  
*Cognito group management → @tom.reeves (infra)*  
*Related: [Authentication](/05-engineering/authentication.md) · [Authorization](/05-engineering/authorization.md) · [Security Architecture](/06-operations/security-architecture.md)*
