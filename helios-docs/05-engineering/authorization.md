# Authorization — Helios

> **Location:** Confluence → Helios Engineering Space → Engineering → Authorization  
> **Owner:** Rosa Lindqvist (Senior Engineer, Platform) · @rosa.lindqvist  
> **Security Review:** Yasmin Osei · @yasmin.osei  
> **Last Updated:** 2024-10-15  
> **Status:** Active  
> **Related:** [Authentication](/05-engineering/authentication.md) · [User Roles & Permissions](/05-engineering/user-roles-permissions.md) · [Security Architecture](/06-operations/security-architecture.md)

---

## Authorization Model

Helios uses **Role-Based Access Control (RBAC)** with **multi-tenant isolation** enforced at every layer. The authorization stack is:

```
Request arrives at API Gateway
    ↓
JWT validation (is this token valid and not expired?)
    ↓
Tenant extraction (what tenantId does this token claim?)
    ↓
OPA policy evaluation (does this role have permission for this operation?)
    ↓
Module flag check (does this tenant have the required module licensed?)
    ↓
Data-layer tenant filter (does the data belong to this tenant?)
```

Every layer is independently enforced. Bypassing one layer does not grant access — all layers must pass.

---

## Enforcement Points

### 1. API Gateway Middleware

```typescript
// src/middleware/authz.ts (helios-api-gateway)
import { OPAClient } from '@helios/opa-client';

const opa = new OPAClient(process.env.OPA_URL!);

export async function authzMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { claims } = req;  // Populated by auth middleware upstream

  const input = {
    claims: {
      userId:   claims.sub,
      tenantId: claims['custom:tenantId'],
      role:     claims['custom:role'],
    },
    operation: resolveOperation(req),  // e.g., 'query.gridDashboard'
    resource: {
      tenantId: extractResourceTenantId(req),
    },
    tenant: await getTenantConfig(claims['custom:tenantId']),
  };

  const { allow } = await opa.evaluate('helios/authz/allow', input);

  if (!allow) {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'You do not have permission to perform this operation',
        statusCode: 403,
        requestId: req.id,
      },
    });
  }

  next();
}
```

### 2. Database Row-Level Security

PostgreSQL RLS policies ensure that even if application code has a bug in tenant filtering, the database enforces isolation:

```sql
-- The application sets the tenant context at the start of each transaction
SET LOCAL app.current_tenant_id = 'CUST-MWG';

-- RLS policy ensures this session can only see CUST-MWG data
CREATE POLICY tenant_isolation ON grid_alerts
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Each service uses a per-tenant DB role
-- Role helios_tenant_cust_mwg can only set app.current_tenant_id to CUST-MWG's UUID
-- (enforced by a function that validates the role matches the tenant_id being set)
```

### 3. Redis Key Namespacing

All Redis keys are prefixed with `t:{tenantId}:`. The application enforces this through the `@helios/cache` library, which wraps Redis and prepends the tenant prefix automatically:

```typescript
// packages/cache/src/tenantCache.ts
export class TenantCache {
  constructor(
    private redis: Redis,
    private tenantId: string
  ) {}

  async get<T>(key: string): Promise<T | null> {
    const prefixedKey = `t:${this.tenantId}:${key}`;
    const value = await this.redis.get(prefixedKey);
    return value ? JSON.parse(value) : null;
  }

  async set(key: string, value: unknown, ttlMs?: number): Promise<void> {
    const prefixedKey = `t:${this.tenantId}:${key}`;
    if (ttlMs) {
      await this.redis.set(prefixedKey, JSON.stringify(value), 'PX', ttlMs);
    } else {
      await this.redis.set(prefixedKey, JSON.stringify(value));
    }
  }
}
```

### 4. Kafka Message Filtering

Kafka consumers filter messages by `tenantId` before processing. No consumer processes messages for tenants it is not responsible for:

```go
// internal/consumer/consumer.go
func (c *Consumer) processMessage(msg *kafka.Message) {
    var reading types.MeterReading
    if err := avro.Unmarshal(msg.Value, &reading); err != nil {
        c.metrics.DecodeErrors.Inc()
        return
    }
    
    // Only process messages for tenants this instance serves
    // (In practice: all tenants, but we always verify)
    if !c.tenantRegistry.IsValid(reading.TenantID) {
        c.log.Warn().Str("tenant_id", reading.TenantID).
            Msg("Received message for unknown tenant — dropping")
        return
    }
    
    // Pass tenantID explicitly through all subsequent calls
    c.processor.Process(ctx, reading.TenantID, reading)
}
```

### 5. S3 Bucket Policies

S3 paths are prefixed by `tenantId`. IAM policies for service roles are scoped to specific tenant prefixes. No service can access another tenant's S3 data.

---

## Cross-Tenant Access (Support and Admin)

`HELIOS_SUPPORT` and `HELIOS_ADMIN` roles can access data across tenants. This access is:
1. **Logged to the immutable audit trail** for every cross-tenant data access
2. **Time-limited** — the HELIOS_SUPPORT token is valid for 4 hours maximum
3. **Scoped to the operation** — support can only read, never write cross-tenant

The audit log entry for cross-tenant access:
```json
{
  "timestamp": "2024-11-08T14:32:07Z",
  "event_type": "CROSS_TENANT_ACCESS",
  "actor": {
    "userId": "usr-lumina-support-001",
    "role": "HELIOS_SUPPORT",
    "email_hash": "a1b2c3..."
  },
  "accessed_tenant": "CUST-MWG",
  "operation": "query.gridDashboard",
  "reason": "INC-2024-047 — customer-reported alert gap investigation",
  "requestId": "req-xyz789"
}
```

---

## Things Every New Engineer Should Know

1. **Never trust `tenantId` from the request body or URL parameters.** Always use `tenantId` from the validated JWT claims. An attacker can forge request body parameters; they cannot forge a JWT signed by Cognito.

2. **The OPA evaluation is in the hot path.** OPA decisions are cached for 30 seconds per input combination. If the OPA server is unavailable, the gateway fails closed (denies all requests). This is intentional — security over availability.

3. **RLS is defense-in-depth, not the primary control.** If you write a query without a `tenant_id` filter and RLS catches it by returning empty results instead of the wrong tenant's data, that is the RLS working correctly. But you still have a bug — fix the query. Don't rely on RLS as the only protection.

4. **Data analysts cannot see individual customer PII.** If you add a new analytics query that returns individual-level data (meter serial, customer address), it will fail the `DATA_ANALYST` role permission check. Analysts see aggregated data only.

5. **Module flags can change.** If a customer's contract changes, their module flags change. Don't cache module flags for longer than 5 minutes in application code. The `@helios/tenant-config` library has a 5-minute TTL by default.

---

*Document maintained by @rosa.lindqvist*  
*OPA policy changes require security review from @yasmin.osei*  
*Related: [Authentication](/05-engineering/authentication.md) · [User Roles & Permissions](/05-engineering/user-roles-permissions.md) · [Security Architecture](/06-operations/security-architecture.md)*
