# Logging Standards — Helios

> **Location:** Confluence → Helios Engineering Space → Platform → Logging Standards  
> **Owner:** Marcus Webb (SRE Lead) · @marcus.webb  
> **Co-authored:** Priya Nair · @priya.nair  
> **Last Updated:** 2024-09-12  
> **Status:** Current  
> **Related:** [Monitoring & Observability](/04-platform/monitoring-observability.md) · [Alerting Strategy](/04-platform/alerting-strategy.md) · [Security Architecture](/06-operations/security-architecture.md) · [Coding Standards](/05-engineering/coding-standards.md)

---

## Why Logging Standards Matter Here

Helios processes hundreds of millions of events per day across a dozen services. When something goes wrong at 3 AM during a winter storm affecting 80,000 customers, the on-call engineer has one tool: Loki. If logs are inconsistent, missing context, or written to stdout as unstructured text, root-cause analysis takes hours instead of minutes.

These standards are not bureaucracy. They are the difference between a 15-minute incident and a 90-minute one.

---

## Core Rules

1. **All logs must be structured JSON.** No printf-style strings, no stack traces as raw text. Every log line is a JSON object.
2. **Every log line must have `tenant_id` when processing tenant data.** This is a security and debugging requirement.
3. **No PII in logs.** Phone numbers, email addresses, and meter serial numbers are hashed. Customer names are never logged.
4. **Logs go to stdout only.** Never write to files. The container runtime captures stdout and Promtail ships it to Loki.
5. **Use log levels correctly.** Definitions are below. Do not use `INFO` for things that need investigation, and do not use `WARN` for expected errors.

---

## Log Levels

| Level | When to Use | Examples |
|---|---|---|
| `DEBUG` | Detailed developer information. Disabled in production by default. | Processing a single reading, cache lookup details |
| `INFO` | Normal operational events — state changes, lifecycle events. | Service started, tenant onboarded, model reloaded |
| `WARN` | Unexpected situations that the system handled gracefully — worth knowing about. | Cache miss on device registry, retry succeeded after 1 failure, deprecated API endpoint called |
| `ERROR` | Errors the system could NOT handle — a request failed, a message was dropped, a downstream was unavailable. Requires investigation. | Kafka produce failed, DLQ write, database connection error |
| `FATAL` | Unrecoverable error — service is shutting down. | Vault unreachable at startup, required config missing |

**Common mistakes:**
- Using `WARN` for errors (hides real problems from alerting)
- Using `ERROR` for expected business logic failures (a meter being offline is not an error)
- Using `INFO` for every processed event at full volume (100K INFO logs/sec floods Loki and makes signal finding impossible)

In the hot path (grid-monitor processing meter readings), log at `DEBUG` for individual readings, `INFO` for significant events (alert generated, outage detected), `WARN` for anomalies.

---

## Required Log Fields

Every log line must contain these fields:

| Field | Type | Example | Notes |
|---|---|---|---|
| `timestamp` | ISO 8601 | `"2024-11-08T14:32:07.451Z"` | UTC always |
| `level` | string | `"INFO"` | Uppercase |
| `service` | string | `"helios-grid-monitor"` | Service name |
| `version` | string | `"4.7.1"` | Embedded at build time |
| `env` | string | `"prod"` | `prod`, `staging`, `dev` |
| `message` | string | `"Alert generated for device"` | Human-readable summary |
| `trace_id` | string | `"3a7f9c2d8b1e4f6a"` | From OpenTelemetry context; `""` if no trace |
| `span_id` | string | `"8c1b3f2e"` | From OpenTelemetry context |

When processing tenant data, also include:

| Field | Type | Example |
|---|---|---|
| `tenant_id` | string | `"CUST-MWG"` |
| `device_id` | string | `"sm-42a9b7"` |
| `operation` | string | `"alert_generated"` |

---

## Go Logging (`zerolog`)

All Go services use **zerolog** via the `@helios/logger` wrapper package.

```go
// internal/logger/logger.go — wrapper around zerolog
package logger

import (
    "os"
    "github.com/rs/zerolog"
    "go.opentelemetry.io/otel/trace"
)

// Fields that must always be present
type BaseFields struct {
    Service string
    Version string
    Env     string
}

func New(base BaseFields) zerolog.Logger {
    return zerolog.New(os.Stdout).
        With().
        Timestamp().
        Str("service", base.Service).
        Str("version", base.Version).
        Str("env", base.Env).
        Logger()
}

// WithTrace adds OpenTelemetry trace context to the logger
func WithTrace(ctx context.Context, log zerolog.Logger) zerolog.Logger {
    span := trace.SpanFromContext(ctx)
    if !span.IsRecording() {
        return log
    }
    return log.With().
        Str("trace_id", span.SpanContext().TraceID().String()).
        Str("span_id", span.SpanContext().SpanID().String()).
        Logger()
}

// WithTenant adds tenant and device context
func WithTenant(log zerolog.Logger, tenantID, deviceID string) zerolog.Logger {
    return log.With().
        Str("tenant_id", tenantID).
        Str("device_id", deviceID).
        Logger()
}
```

**Usage in Go:**

```go
// main.go
log := logger.New(logger.BaseFields{
    Service: "helios-grid-monitor",
    Version: Version,
    Env:     os.Getenv("HELIOS_ENV"),
})

// In a request handler
func (h *AlertHandler) processAlert(ctx context.Context, reading types.MeterReading) {
    log := logger.WithTrace(ctx, h.log)
    log = logger.WithTenant(log, reading.TenantID, reading.DeviceID)

    log.Debug().
        Str("metric_type", reading.MetricType).
        Float64("value", reading.Value).
        Msg("Evaluating alert rules")

    alert, err := h.evaluator.Evaluate(reading)
    if err != nil {
        log.Error().
            Err(err).
            Str("operation", "alert_evaluate").
            Msg("Alert evaluation failed")
        return
    }

    if alert != nil {
        log.Info().
            Str("operation", "alert_generated").
            Str("alert_id", alert.ID).
            Str("severity", alert.Severity).
            Float64("threshold_upper", alert.ThresholdMax).
            Msg("Alert generated for device")
    }
}
```

**Resulting log line (formatted for readability):**
```json
{
  "timestamp": "2024-11-08T14:32:07.451Z",
  "level": "INFO",
  "service": "helios-grid-monitor",
  "version": "4.7.1",
  "env": "prod",
  "tenant_id": "CUST-MWG",
  "device_id": "sm-42a9b7",
  "operation": "alert_generated",
  "alert_id": "9f2e1a4b-3c7d-48e2-b0f1-5d8a9c2e7f1b",
  "severity": "HIGH",
  "threshold_upper": 132.0,
  "trace_id": "3a7f9c2d8b1e4f6a8c2b3d4e5f6a7b8c",
  "span_id": "8c1b3f2e4a5b6c7d",
  "message": "Alert generated for device"
}
```

---

## Node.js Logging (`pino`)

All Node.js services use **pino** via the `@helios/logger` Node.js package.

```typescript
// packages/logger/src/index.ts
import pino from 'pino';
import { context, trace } from '@opentelemetry/api';

export function createLogger(service: string, version: string) {
  return pino({
    level: process.env.LOG_LEVEL || 'info',
    base: {
      service,
      version,
      env: process.env.HELIOS_ENV || 'dev',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label.toUpperCase() }),
    },
    redact: {
      paths: ['email', 'phone', 'password', '*.email', '*.phone'],
      censor: '[REDACTED]',
    },
  });
}

// Middleware to attach trace context to logger
export function withTraceContext(baseLogger: pino.Logger) {
  const span = trace.getActiveSpan();
  if (!span) return baseLogger;
  const ctx = span.spanContext();
  return baseLogger.child({
    trace_id: ctx.traceId,
    span_id: ctx.spanId,
  });
}
```

**Usage in Node.js:**

```typescript
// src/server.ts
import { createLogger, withTraceContext } from '@helios/logger';

const baseLogger = createLogger('helios-api-gateway', process.env.npm_package_version);

// In a GraphQL resolver
const gridDashboardResolver = async (_: unknown, args: { regionId: string }, ctx: Context) => {
  const log = withTraceContext(baseLogger).child({
    tenant_id: ctx.tenantId,
    operation: 'gridDashboard',
    region_id: args.regionId,
  });

  log.info({ msg: 'Resolving grid dashboard' });

  try {
    const result = await gridMonitorClient.getRegionState(ctx.tenantId, args.regionId);
    log.info({ msg: 'Grid dashboard resolved', health_score: result.healthScore });
    return result;
  } catch (err) {
    log.error({ err, msg: 'Grid dashboard resolution failed' });
    throw err;
  }
};
```

---

## PII Handling in Logs

The following fields are **never** logged in plain text. They must be hashed (SHA-256) or omitted:

| Data Type | What To Do | Example |
|---|---|---|
| Customer phone number | Hash with SHA-256 | `phone_hash: "a1b2c3..."` |
| Customer email address | Hash with SHA-256 | `email_hash: "d4e5f6..."` |
| Meter serial number (external ID) | Use internal `device_id` only | `device_id: "sm-42a9b7"` |
| Customer name | Omit entirely | — |
| Customer address | Log only lat/lng rounded to 3 decimal places | `location: "41.587,-91.666"` |
| API keys / tokens | Never log | — |
| Passwords | Never log | — |

The pino `redact` configuration handles email and phone automatically in Node.js. In Go, the `logger.WithTenant()` helper only accepts `device_id` (our internal ID), not `external_device_id` (the meter serial).

See [Security Architecture — PII Handling](/06-operations/security-architecture.md#pii-handling) and [Compliance & Regulatory — GDPR Logging](/06-operations/compliance-regulatory.md#gdpr-logging).

---

## Log Retention

| Category | Retention | Storage |
|---|---|---|
| Application logs (all services) | 30 days | Loki (S3 backend) |
| Audit logs (API access, auth events, admin actions) | 7 years | S3 `helios-audit-logs` (immutable) |
| Security logs (WAF, GuardDuty, CloudTrail) | 7 years | S3 `helios-audit-logs` |
| Kubernetes control plane logs | 90 days | CloudWatch Logs |
| Slow query logs (RDS) | 30 days | CloudWatch Logs |

Audit logs are written to a separate, immutable S3 bucket with Object Lock enabled. No service has `s3:DeleteObject` permissions on `helios-audit-logs`. This satisfies NERC CIP-012 requirements for audit trail immutability.

---

## Querying Logs in Practice

### Find all CRITICAL alerts for a tenant in the last hour

```logql
{app="grid-monitor", namespace="helios-prod"} 
  | json 
  | tenant_id = "CUST-MWG" 
  | level = "INFO" 
  | operation = "alert_generated" 
  | severity = "CRITICAL"
```

### Find all errors for a specific trace ID

```logql
{namespace="helios-prod"} 
  | json 
  | trace_id = "3a7f9c2d8b1e4f6a8c2b3d4e5f6a7b8c"
  | level = "ERROR"
```

### Find DLQ writes (dropped messages) in the IoT bridge

```logql
{app="iot-bridge"} 
  | json 
  | operation = "dlq_write"
```

### Count errors per service in the last 30 minutes (metric query for Grafana)

```logql
sum by (app) (
  rate(
    {namespace="helios-prod"} | json | level="ERROR" [5m]
  )
)
```

---

## Things Every New Engineer Should Know

1. **Structured logs only.** If you `fmt.Println` or `console.log` in a service, your log will be ingested as an unstructured text blob by Promtail. It will not be parseable or searchable in Loki. Use the `@helios/logger` library.

2. **tenant_id is not optional in the hot path.** Any log line emitted while processing a Kafka message must include `tenant_id`. Without it, isolating a tenant's logs during an incident is nearly impossible.

3. **Do not log at INFO in tight loops.** A single high-frequency processing loop logging at INFO can generate millions of log lines per minute, costing money and drowning out real signals. Log at DEBUG for per-message events; log at INFO only when something significant happens (state change, alert generated, error handled).

4. **The `redact` config in pino does not recursively traverse all objects.** If you nest PII in a deeply nested structure, specify the full path in `redact.paths` (e.g., `'customer.billing.email'`). Do not assume top-level redaction protects nested fields.

5. **Audit logs are write-once.** Do not attempt to write to the audit log bucket from application code directly. The `@helios/audit` library handles audit logging with the correct IAM credentials and format. If you need to add a new audit event type, open a PR to `helios-api-gateway/src/audit/`.

---

*Document maintained by @marcus.webb*  
*PII questions → @yasmin.osei (Security)*  
*Log infrastructure questions → @aisha.kamara (Monitoring)*  
*Related: [Monitoring & Observability](/04-platform/monitoring-observability.md) · [Security Architecture](/06-operations/security-architecture.md) · [Coding Standards](/05-engineering/coding-standards.md)*
