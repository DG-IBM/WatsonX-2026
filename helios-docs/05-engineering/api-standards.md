# API Standards — Helios

> **Location:** Confluence → Helios Engineering Space → Engineering → API Standards  
> **Owner:** Priya Nair (Staff Engineer, Platform) · @priya.nair  
> **Last Updated:** 2024-09-25  
> **Status:** Active  
> **Related:** [Authentication](/05-engineering/authentication.md) · [Authorization](/05-engineering/authorization.md) · [Backend Architecture](/02-architecture/backend-architecture.md) · [Coding Standards](/05-engineering/coding-standards.md)

---

## Overview

Helios exposes both **GraphQL** (primary, for client applications) and **REST** (for third-party integrations, IoT, and select operations). Both are served through the same `helios-api-gateway`. See [ADR-002](/05-engineering/adrs.md#adr-002) for the rationale for maintaining both.

This document defines the standards for both API styles, ensuring consistency in naming, error handling, versioning, authentication, and documentation.

---

## GraphQL Standards

### Schema Design Principles

**1. Schema-first, always**  
The GraphQL schema is the contract. Code is generated from the schema — not the other way around. Schema changes go through a review process before implementation begins.

**2. Types over scalars**  
```graphql
# ❌ Too loose
type Alert {
  id: ID!
  metadata: JSON
}

# ✅ Explicit types enable tooling and validation
type Alert {
  id: ID!
  severity: AlertSeverity!
  affectedAsset: GridAsset
  createdAt: DateTime!
}

enum AlertSeverity {
  CRITICAL
  HIGH
  MEDIUM
  LOW
  INFO
}
```

**3. Connections for lists**  
All list fields use the Relay Connection pattern for consistent pagination:

```graphql
type Query {
  # ❌ Simple array — no pagination, no metadata
  alerts: [Alert!]!

  # ✅ Connection pattern
  alerts(
    first: Int
    after: String
    filter: AlertFilter
    orderBy: AlertOrderBy
  ): AlertConnection!
}

type AlertConnection {
  edges: [AlertEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type AlertEdge {
  node: Alert!
  cursor: String!
}
```

**4. Explicit nullability**  
In our schema, `null` means "this field legitimately may not exist." Non-null (`!`) means "this field is always present when the parent object exists."  
Do not make everything non-null just to avoid null checks — use null to communicate intent.

**5. Mutations return the mutated object**  
```graphql
# ❌ Mutation returns a simple boolean
type Mutation {
  acknowledgeAlert(id: ID!): Boolean!
}

# ✅ Mutation returns the updated entity — enables cache updates in Apollo
type Mutation {
  acknowledgeAlert(id: ID!, notes: String): Alert!
}
```

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Types | PascalCase | `GridRegion`, `MeterReading` |
| Fields | camelCase | `healthScore`, `lastUpdatedAt` |
| Enums | SCREAMING_SNAKE_CASE | `CRITICAL`, `IN_PROGRESS` |
| Queries | camelCase, noun phrase | `gridRegion`, `activeAlerts` |
| Mutations | camelCase, verb+noun | `acknowledgeAlert`, `createWorkOrder` |
| Subscriptions | camelCase, present participle | `alertCreated`, `stateUpdated` |

### Error Handling in GraphQL

We use the standard GraphQL error extension format:

```json
{
  "errors": [{
    "message": "Alert ALERT-12345 not found",
    "extensions": {
      "code": "NOT_FOUND",
      "statusCode": 404,
      "path": ["alert"],
      "tenantId": "CUST-MWG"
    }
  }]
}
```

**Error codes:**

| Code | HTTP Equivalent | When to Use |
|---|---|---|
| `NOT_FOUND` | 404 | Requested resource does not exist for this tenant |
| `UNAUTHORIZED` | 401 | No valid authentication token |
| `FORBIDDEN` | 403 | Authenticated but insufficient permissions |
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `CONFLICT` | 409 | Optimistic locking conflict |
| `INTERNAL_ERROR` | 500 | Unexpected server error (do not expose internal details) |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `TENANT_MISMATCH` | 403 | Resource belongs to different tenant |

### Schema Governance

Schema changes are managed via the **Schema Registry** (Apollo Studio managed schema for our internal GraphQL operations, not to be confused with the Kafka Schema Registry).

**Breaking changes require:**
1. A migration period (minimum 4 weeks) with the old field deprecated via `@deprecated`
2. Notification to all API consumers (tracked in the API changelog)
3. ARB approval for major breaking changes

**Non-breaking changes** (adding optional fields, adding new types) can be merged via normal PR process.

---

## REST API Standards

### URL Structure

```
https://api.luminaenergy.com/api/v1/{resource}/{id}/{sub-resource}

Examples:
GET  /api/v1/tenants/CUST-MWG/grid-regions
GET  /api/v1/grid-regions/reg-12345/alerts?severity=CRITICAL&status=OPEN
POST /api/v1/work-orders
GET  /api/v1/work-orders/WO-2024-108732
PATCH /api/v1/work-orders/WO-2024-108732/status
```

### HTTP Methods

| Method | Use | Body | Idempotent |
|---|---|---|---|
| `GET` | Read resource(s) | None | Yes |
| `POST` | Create resource or trigger action | JSON | No |
| `PUT` | Replace resource (full update) | JSON | Yes |
| `PATCH` | Partial update | JSON Merge Patch | No |
| `DELETE` | Delete resource | None | Yes |

### Request / Response Format

**All requests and responses use JSON.** Content-Type: `application/json`.

**Dates:** ISO 8601 with timezone: `"2024-11-08T14:32:07.451Z"`. Always UTC.

**IDs:** UUIDs (36 chars, lowercase, hyphenated) for database IDs. Human-readable codes where applicable (e.g., `WO-2024-108732` for work orders).

**Pagination:**

```
GET /api/v1/alerts?page=2&pageSize=50&sortBy=createdAt&sortOrder=desc

Response:
{
  "data": [...],
  "pagination": {
    "page": 2,
    "pageSize": 50,
    "totalItems": 1247,
    "totalPages": 25,
    "hasNextPage": true,
    "hasPrevPage": true
  }
}
```

### REST Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "statusCode": 400,
    "requestId": "req-a1b2c3d4",
    "details": [
      {
        "field": "priority",
        "message": "priority must be one of: EMERGENCY, HIGH, NORMAL, LOW",
        "received": "URGENT"
      }
    ]
  }
}
```

### REST API Versioning

The current version is `v1`. When breaking changes are needed:
1. Create `/api/v2/` endpoints
2. Keep `/api/v1/` running for at least 12 months with a deprecation header
3. Notify all API consumers (tracked via the developer portal when it launches in Q3 2025)

The only current version is `v1`. The deprecated `v0` was removed in v4.5.

### Health Endpoints

All services expose:
```
GET /health    → 200 OK (liveness)
GET /ready     → 200 OK when fully ready, 503 during startup/shutdown (readiness)
GET /metrics   → Prometheus text format (metrics scraping)
```

Health response format:
```json
{
  "status": "ok",
  "version": "4.7.1",
  "uptime": 1234567,
  "dependencies": {
    "postgres": "ok",
    "redis": "ok",
    "kafka": "ok"
  }
}
```

---

## Authentication in the API

All API requests must include a valid JWT in the `Authorization: Bearer {token}` header. See [Authentication](/05-engineering/authentication.md) for the full auth architecture.

The API gateway validates the token and rejects requests without a valid token before forwarding to any service.

**Internal service-to-service calls** use a separate mechanism (internal JWT signed by a Vault-managed key). See [Authentication — Internal Service Auth](/05-engineering/authentication.md#internal-service-auth).

---

## Rate Limiting

Rate limits are applied per tenant per operation:

| Operation Type | Limit | Window |
|---|---|---|
| All GraphQL queries (default) | 1,000 requests | 60 seconds |
| Heavy queries (`meterHistory`, `exportData`) | 10 requests | 60 seconds |
| All REST endpoints (default) | 500 requests | 60 seconds |
| IoT device registration | 100 requests | 60 seconds |
| Report downloads | 20 requests | 60 seconds |

When rate limited, the response is:
```
HTTP 429 Too Many Requests
Retry-After: 45
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1699456927
```

Custom limits can be configured per tenant. Contact @priya.nair to adjust.

---

## API Documentation

The REST API is documented using **OpenAPI 3.1**. The spec is auto-generated from code annotations and lives at:
- Source: `helios-api-gateway/openapi/`
- Staging UI: `https://api.staging.luminaenergy.com/api/docs`
- Production (read-only): `https://api.luminaenergy.com/api/docs` (auth required)

The GraphQL schema is introspectable in staging (introspection is disabled in production).

All new REST endpoints must include:
- Path parameters documented
- Request body schema with examples
- All response codes documented (including 4xx)
- Authentication requirement
- Rate limiting note if non-standard

---

## Things Every New Engineer Should Know

1. **Tenant isolation is the first check, always.** Before every API handler returns data, verify the requested resource belongs to the requesting tenant. The pattern: extract `tenantId` from the JWT claim, then filter the query by `tenantId`. Never trust a `tenantId` in the request body — always use the one from the authenticated JWT.

2. **GraphQL partial errors are intentional.** We use `errorPolicy: 'all'` in Apollo Client so that a single failing field does not break the whole response. Grid operators should see partial data over no data. Design resolvers to return null on graceful failures rather than throwing errors that kill the whole response.

3. **Never expose internal IDs in REST URLs.** Use human-readable codes (e.g., `WO-2024-108732`) or UUIDs in URLs. Do not expose database integer IDs — they leak information about data volume and allow enumeration attacks.

4. **The `requestId` in error responses is how support investigates.** Every request gets a UUID `requestId` logged with the full request trace. When a customer reports an error, the `requestId` from the error response lets us find the exact trace in Jaeger and Loki.

5. **Backward compatibility is a hard requirement.** Removing a field from the GraphQL schema or a JSON response is a breaking change. Renaming a field is a breaking change. Adding a new required field to a request is a breaking change. When in doubt, add rather than change.

---

*Document maintained by @priya.nair*  
*GraphQL schema governance → @priya.nair and @rosa.lindqvist*  
*REST API → @dev.sharma and @priya.nair*  
*Related: [Authentication](/05-engineering/authentication.md) · [Authorization](/05-engineering/authorization.md) · [Backend Architecture](/02-architecture/backend-architecture.md)*
