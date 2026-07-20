# Monitoring & Observability — Helios

> **Location:** Confluence → Helios Engineering Space → Platform → Monitoring & Observability  
> **Owner:** Marcus Webb (SRE Lead) · @marcus.webb  
> **Last Updated:** 2024-11-02  
> **Status:** Current  
> **Related:** [Logging Standards](/04-platform/logging-standards.md) · [Alerting Strategy](/04-platform/alerting-strategy.md) · [Incident Response Runbook](/06-operations/incident-response-runbook.md)

---

## Observability Stack

Helios uses the **Prometheus + Grafana + Loki + Jaeger** stack — all self-hosted on EKS in the `monitoring` namespace. We evaluated Datadog in 2022 and decided against it based on cost (~$40K/month estimate at our telemetry volume) and data residency concerns for EU customer metrics. This decision is revisited annually.

| Tool | Purpose | Access |
|---|---|---|
| **Prometheus** | Metrics collection, alerting rules | Internal only (port-forward or Grafana) |
| **Grafana** | Dashboards and visualization | `https://grafana.internal.luminaenergy.com` |
| **Loki** | Log aggregation | Via Grafana (Explore → Loki datasource) |
| **Jaeger** | Distributed tracing | `https://jaeger.internal.luminaenergy.com` |
| **Alertmanager** | Alert routing (to PagerDuty, Slack) | Internal only |
| **OpenTelemetry Collector** | Telemetry pipeline (traces + metrics) | Internal (sidecar or DaemonSet) |

---

## Metrics — Prometheus

### Collection Architecture

```mermaid
graph LR
    subgraph "Applications"
        GW[api-gateway\n:4000/metrics]
        GM[grid-monitor\n:9090/metrics]
        DISP[dispatch\n:3001/metrics]
        OD[outage-detect\n:9090/metrics]
    end
    subgraph "Infrastructure"
        KSM[kube-state-metrics]
        NE[node-exporter\n(DaemonSet)]
        MSK_E[MSK JMX exporter]
        RDS_E[RDS Enhanced\nMonitoring → CW → scrape]
    end
    PROM[Prometheus\n(2x, HA)]
    THANOS[Thanos\n(long-term storage → S3)]

    GW --> PROM
    GM --> PROM
    DISP --> PROM
    OD --> PROM
    KSM --> PROM
    NE --> PROM
    MSK_E --> PROM
    RDS_E --> PROM
    PROM --> THANOS
    THANOS --> S3[(S3 Metrics\nLong-term)]
```

Prometheus is deployed in HA mode (2 replicas) with Thanos sidecars for long-term storage. Metrics are retained locally for 15 days; Thanos compacts and stores up to 2 years in S3.

### Service Instrumentation

Every service must expose a `/metrics` endpoint (or use the Prometheus gRPC adapter) with the following base metrics. The `@helios/metrics` library (Go and Node.js) provides these automatically:

**Go services (`@helios/metrics` Go package):**
```go
// internal/metrics/metrics.go
var (
    RequestsTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Namespace: "helios",
            Subsystem: "service",
            Name:      "requests_total",
            Help:      "Total requests processed",
        },
        []string{"method", "status", "tenant_id"},
    )

    RequestDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Namespace: "helios",
            Subsystem: "service",
            Name:      "request_duration_seconds",
            Help:      "Request duration in seconds",
            Buckets:   []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5},
        },
        []string{"method", "tenant_id"},
    )

    KafkaConsumerLag = prometheus.NewGaugeVec(
        prometheus.GaugeOpts{
            Namespace: "helios",
            Subsystem: "kafka",
            Name:      "consumer_lag",
            Help:      "Kafka consumer lag in messages",
        },
        []string{"topic", "partition", "consumer_group"},
    )

    ActiveAlerts = prometheus.NewGaugeVec(
        prometheus.GaugeOpts{
            Namespace: "helios",
            Subsystem: "grid",
            Name:      "active_alerts",
            Help:      "Currently active grid alerts",
        },
        []string{"severity", "tenant_id"},
    )
)
```

### Key Dashboards

Grafana dashboards are stored as JSON in `helios-infra/monitoring/grafana/dashboards/`. They are loaded automatically by Grafana via the `grafana-dashboard-provider` ConfigMap.

| Dashboard | URL | Purpose |
|---|---|---|
| **Platform Overview** | `/d/platform-overview` | Top-level health: all services, error rates, latency |
| **Grid Monitor** | `/d/grid-monitor` | Consumer lag, alert throughput, state update latency |
| **IoT Bridge** | `/d/iot-bridge` | Ingest rates, decode errors, MQTT connection count |
| **Kafka Consumer Lag** | `/d/kafka-consumer-lag` | All consumer groups, lag per partition |
| **API Gateway** | `/d/api-gateway` | Request rate, P50/P99/P999 latency, error rate by operation |
| **Database** | `/d/database` | RDS connections, query latency, slow queries |
| **Dispatch** | `/d/dispatch` | Work order counts by status, SLA breach metrics |
| **Forecasting** | `/d/forecasting` | Inference latency, model MAPE, cache hit rate |
| **SLO Dashboard** | `/d/slo-dashboard` | All service SLOs, burn rate, error budget |

---

## Distributed Tracing — Jaeger + OpenTelemetry

Every cross-service request carries a trace context (W3C TraceContext format). This allows us to trace a single user request from the browser through the API gateway, into the grid monitor, and all the way to Kafka.

### Instrumentation

```go
// Go services use the OpenTelemetry Go SDK
// internal/otel/setup.go
func SetupTracing(serviceName string) (func(), error) {
    exporter, err := otlptracehttp.New(
        context.Background(),
        otlptracehttp.WithEndpoint(os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")),
        otlptracehttp.WithInsecure(),
    )
    if err != nil {
        return nil, err
    }

    provider := sdktrace.NewTracerProvider(
        sdktrace.WithBatcher(exporter),
        sdktrace.WithResource(resource.NewWithAttributes(
            semconv.SchemaURL,
            semconv.ServiceName(serviceName),
            semconv.ServiceVersion(Version),
            attribute.String("deployment.environment", os.Getenv("HELIOS_ENV")),
        )),
        sdktrace.WithSampler(sdktrace.ParentBased(
            sdktrace.TraceIDRatioBased(0.1), // 10% sampling in prod
        )),
    )

    otel.SetTracerProvider(provider)
    otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
        propagation.TraceContext{},
        propagation.Baggage{},
    ))

    return func() { provider.Shutdown(context.Background()) }, nil
}
```

```typescript
// Node.js services
// src/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  serviceName: 'helios-api-gateway',
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': { enabled: true },
      '@opentelemetry/instrumentation-graphql': { enabled: true },
      '@opentelemetry/instrumentation-pg': { enabled: true },
    }),
  ],
  sampler: new ParentBasedSampler({
    root: new TraceIdRatioBasedSampler(0.1), // 10% sampling
  }),
});

sdk.start();
```

**Sampling rate:** 10% in production. 100% in staging. For critical operations (outage detection, CRITICAL alerts), traces are always sampled (`force_sampling: true` attribute on the span).

### Example Trace: Alert from Meter to Portal

A complete trace for an overvoltage alert flowing from the IoT bridge to the operator's screen:

```
Trace ID: 3a7f9c2d8b1e4f6a

[IoT Bridge] handle_mqtt_message                          0ms → 28ms
  [IoT Bridge] decode_payload (vendor: itron-centron)     2ms → 9ms
  [IoT Bridge] device_registry_lookup (cache hit)         9ms → 10ms
  [IoT Bridge] kafka_produce (iot.raw.meter.readings.v2)  10ms → 28ms

[Grid Monitor] process_reading                            95ms → 310ms
  [Grid Monitor] validate_reading                         95ms → 102ms
  [Grid Monitor] enrich_reading (cache hit)               102ms → 104ms
  [Grid Monitor] evaluate_alert_rules                     104ms → 117ms
    [Grid Monitor] alert_rule_matched (OVERVOLTAGE-HIGH)  110ms → 117ms
  [Grid Monitor] kafka_produce (grid.alerts.v2)           117ms → 135ms
  [Grid Monitor] redis_publish (alerts:CUST-MWG)          135ms → 137ms
  [Grid Monitor] timescaledb_write                        137ms → 310ms (async)

[API Gateway] websocket_push                              140ms → 143ms
  Delivered to connected client at 143ms

Total end-to-end (MQTT receive → WebSocket delivery): 143ms
```

> Note: This 143ms is the fast path. The P95 is ~2.1s due to the Kafka consumer lag (typically ~100ms) and the variable processing queue depth.

---

## Log Aggregation — Loki

Logs are collected by **Promtail** (DaemonSet, one per node) and shipped to Loki. All logs must be structured JSON (see [Logging Standards](/04-platform/logging-standards.md)).

### Querying Logs (LogQL)

```logql
# All ERROR logs from grid-monitor in the last 1 hour
{app="grid-monitor", namespace="helios-prod"} |= "level=error" | json

# Logs for a specific tenant (always filter by tenant early)
{app="grid-monitor"} | json | tenant_id="CUST-MWG" | level="error"

# Slow Kafka produce operations (> 100ms)
{app="grid-monitor"} | json | operation="kafka_produce" | duration_ms > 100

# Alert events for a specific device
{app="grid-monitor"} | json | device_id="sm-42a9b7" | operation="alert_generated"

# API gateway 5xx errors
{app="api-gateway"} | json | status_code >= 500

# Count of errors per service in last 30 min (metric query)
sum by (app) (
  rate({namespace="helios-prod"} |= "level=error" [5m])
)
```

**Log retention:** Loki retains logs for **30 days** in object storage (S3). For compliance and audit logs, a separate path ships to the immutable audit log bucket (7-year retention).

---

## SLO Monitoring

SLOs are tracked as Prometheus recording rules and visualized on the SLO Dashboard.

```yaml
# monitoring/prometheus/rules/slo-grid-monitor.yaml
groups:
  - name: slo-grid-monitor
    interval: 30s
    rules:
      # Availability SLO: 99.99% uptime
      - record: slo:grid_monitor:availability_ratio
        expr: |
          1 - (
            sum(rate(helios_service_requests_total{app="grid-monitor",status=~"5.."}[5m]))
            /
            sum(rate(helios_service_requests_total{app="grid-monitor"}[5m]))
          )

      # Latency SLO: P95 alert latency < 4 seconds
      - record: slo:grid_monitor:alert_latency_p95
        expr: |
          histogram_quantile(0.95,
            sum(rate(helios_grid_alert_latency_seconds_bucket[5m])) by (le)
          )

      # Error budget burn rate
      - alert: GridMonitorErrorBudgetBurnRateCritical
        expr: |
          (
            1 - slo:grid_monitor:availability_ratio
          ) > (1 - 0.9999) * 14.4
        for: 5m
        labels:
          severity: critical
          team: grid-intelligence
        annotations:
          summary: "Grid monitor error budget burning at 14.4x rate (2-hour window)"
          runbook: "https://docs.luminaenergy.com/06-operations/incident-response-runbook.md#grid-monitor"
```

---

## Capacity Planning

Capacity metrics are reviewed monthly in the SRE capacity review meeting (first Monday of each month, 10am CT).

**Key capacity signals we track:**

| Signal | Current | Warning Threshold | Action |
|---|---|---|---|
| TimescaleDB chunk count | ~38,000 | 50,000 | Increase compression, evaluate tiering |
| Kafka broker disk usage | 68% avg | 80% | Add brokers or reduce retention |
| Redis memory usage | 71% avg | 85% | Add shard or tune eviction |
| EKS node CPU (avg) | 42% | 70% | Review autoscaling limits |
| MSK throughput | 340MB/s peak | 400MB/s | Upgrade broker instance type |

---

## Things Every New Engineer Should Know

1. **Grafana is your first stop for any production concern.** Before opening a Jira ticket or pinging a team, check the relevant Grafana dashboard. 80% of "is something wrong?" questions can be answered in 30 seconds with Grafana.

2. **Traces are sampled at 10%.** If you're debugging a specific request and it's not showing in Jaeger, it may have been sampled out. Use the `force_sampling: true` baggage attribute in tests, or look for correlated log entries instead.

3. **Add metrics before you add features.** When building a new feature, define the metrics you need to observe it before writing the business logic. The `@helios/metrics` library makes it easy. A feature you can't measure is a feature you can't operate.

4. **Loki queries can be slow if you don't filter early.** Always start with a `{app="...", namespace="helios-prod"}` label filter. Never start a LogQL query with just a content match (`|= "error"`) without a label filter — it will scan all logs and time out.

5. **The SLO dashboard shows error budget burn rate.** If a service is burning its error budget at > 2x the normal rate, it should be the team's top priority. Error budget burn rate is more actionable than uptime percentage alone.

---

*Document maintained by @marcus.webb*  
*Grafana dashboard questions → @marcus.webb or @aisha.kamara*  
*Tracing setup → @kenji.watanabe*  
*Related: [Logging Standards](/04-platform/logging-standards.md) · [Alerting Strategy](/04-platform/alerting-strategy.md) · [Incident Response Runbook](/06-operations/incident-response-runbook.md)*
