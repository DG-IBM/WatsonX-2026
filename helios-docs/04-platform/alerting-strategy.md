# Alerting Strategy — Helios

> **Location:** Confluence → Helios Engineering Space → Platform → Alerting Strategy  
> **Owner:** Marcus Webb (SRE Lead) · @marcus.webb  
> **Last Updated:** 2024-10-22  
> **Status:** Current  
> **Related:** [Monitoring & Observability](/04-platform/monitoring-observability.md) · [Incident Response Runbook](/06-operations/incident-response-runbook.md) · [On-call Rotation Guide](/06-operations/on-call-rotation-guide.md)

---

## Philosophy

**Every alert must be actionable. Every alert must have a runbook. An alert without a runbook does not ship.**

This rule has been violated exactly twice in Helios history — in Q1 2022 (before the rule existed) and in Q2 2023 (a rushed alert added during a release). Both times the violation was followed by an incident where the on-call engineer wasted 30+ minutes figuring out what the alert meant and what to do. The rule exists now. Obey it.

**Alerts are not metrics dashboards.** An alert means "a human needs to wake up and do something." If a metric is interesting to observe but does not require action, it belongs on a Grafana dashboard, not in PagerDuty.

---

## Alert Taxonomy

All alerts are categorized by severity and routing:

| Severity | Meaning | Wake Up? | Response Time | Routing |
|---|---|---|---|---|
| **P1 / Critical** | Production is down or severely degraded. Customer-impacting. | Yes, immediately | 15 min | PagerDuty → on-call engineer |
| **P2 / Warning** | Degradation detected. Action required before it becomes P1. | No (during business hours) | 4 hours | PagerDuty → Slack `#helios-alerts` during hours; page after-hours if sustained |
| **P3 / Info** | Anomalous signal worth investigating. No immediate action required. | No | Next business day | Slack `#helios-alerts` only |

**A note on P2 after-hours:** P2 alerts go to Slack during business hours. If the same P2 alert has been firing for > 30 minutes and it is after hours, PagerDuty escalates it to the on-call engineer. A P2 that has been firing for 30 minutes is becoming a P1.

---

## Alert Routing

```
Prometheus Rule (ALERTS firing)
    → Alertmanager
        → P1 → PagerDuty (helios-platform-oncall or team-specific rotation)
        → P2 → Slack #helios-alerts + PagerDuty (after 30 min)
        → P3 → Slack #helios-alerts
```

### PagerDuty Services

| PagerDuty Service | Escalation Policy | Teams |
|---|---|---|
| `helios-platform-oncall` | Default: Platform on-call → SRE Lead (30 min) → VP Eng (60 min) | Platform, SRE, Infra |
| `helios-grid-oncall` | Grid on-call → @kwame.asante (30 min) | Grid Intelligence, IoT |
| `helios-dispatch-oncall` | Field Ops on-call → @raj.patel (30 min) | Field Ops |
| `helios-data-oncall` | Business hours only → @daniel.park | Data & AI |

---

## Active Alert Inventory

### Infrastructure Alerts

```yaml
# monitoring/prometheus/rules/infrastructure.yaml

groups:
  - name: kubernetes
    rules:
      - alert: KubernetesNodeNotReady
        expr: kube_node_status_condition{condition="Ready",status="true"} == 0
        for: 5m
        labels:
          severity: P1
          team: platform
        annotations:
          summary: "Node {{ $labels.node }} is not ready"
          runbook: "/06-operations/incident-response-runbook.md#node-not-ready"

      - alert: KubernetesPodCrashLooping
        expr: rate(kube_pod_container_status_restarts_total{namespace="helios-prod"}[15m]) > 0
        for: 5m
        labels:
          severity: P2
          team: platform
        annotations:
          summary: "Pod {{ $labels.pod }} is crash looping in {{ $labels.namespace }}"
          runbook: "/06-operations/incident-response-runbook.md#pod-crash-loop"

      - alert: KubernetesPodNotRunning
        expr: |
          kube_pod_status_phase{namespace="helios-prod", phase=~"Pending|Unknown|Failed"} > 0
        for: 10m
        labels:
          severity: P2
          team: platform
        annotations:
          summary: "Pod {{ $labels.pod }} is in {{ $labels.phase }} phase for > 10 minutes"
          runbook: "/06-operations/incident-response-runbook.md#pod-not-running"
```

### Kafka Consumer Lag Alerts

```yaml
  - name: kafka-consumer-lag
    rules:
      - alert: GridMonitorKafkaLagCritical
        expr: |
          sum(kafka_consumer_group_lag{
            consumer_group="grid-monitor-readings",
            topic="iot.raw.meter.readings.v2"
          }) > 100000
        for: 2m
        labels:
          severity: P1
          team: grid-intelligence
        annotations:
          summary: "Grid monitor Kafka lag critically high: {{ $value | humanize }} messages"
          description: |
            Consumer group grid-monitor-readings is significantly behind on iot.raw.meter.readings.v2.
            This means grid state is not being updated in near-real-time.
            Operators may be seeing stale grid state.
          runbook: "/06-operations/incident-response-runbook.md#grid-monitor-kafka-lag"

      - alert: GridMonitorKafkaLagWarning
        expr: |
          sum(kafka_consumer_group_lag{
            consumer_group="grid-monitor-readings"
          }) > 50000
        for: 5m
        labels:
          severity: P2
          team: grid-intelligence
        annotations:
          summary: "Grid monitor Kafka lag elevated: {{ $value | humanize }} messages"
          runbook: "/06-operations/incident-response-runbook.md#grid-monitor-kafka-lag"

      - alert: DLQWriteRateHigh
        expr: |
          rate(helios_kafka_dlq_writes_total[5m]) /
          rate(helios_kafka_messages_consumed_total[5m]) > 0.001
        for: 5m
        labels:
          severity: P2
          team: platform
        annotations:
          summary: "DLQ write rate > 0.1% — processing errors occurring"
          runbook: "/06-operations/incident-response-runbook.md#dlq-write-rate"
```

### API Gateway Alerts

```yaml
  - name: api-gateway
    rules:
      - alert: APIGatewayHighErrorRate
        expr: |
          sum(rate(helios_service_requests_total{app="api-gateway", status=~"5.."}[5m]))
          /
          sum(rate(helios_service_requests_total{app="api-gateway"}[5m]))
          > 0.01
        for: 5m
        labels:
          severity: P1
          team: platform
        annotations:
          summary: "API gateway error rate > 1%: {{ $value | humanizePercentage }}"
          runbook: "/06-operations/incident-response-runbook.md#api-gateway-errors"

      - alert: APIGatewayHighLatency
        expr: |
          histogram_quantile(0.99,
            sum(rate(helios_service_request_duration_seconds_bucket{app="api-gateway"}[5m]))
            by (le)
          ) > 1.0
        for: 5m
        labels:
          severity: P2
          team: platform
        annotations:
          summary: "API gateway P99 latency > 1 second: {{ $value | humanizeDuration }}"
          runbook: "/06-operations/incident-response-runbook.md#api-gateway-latency"
```

### Grid Monitoring Alerts

```yaml
  - name: grid-monitor
    rules:
      - alert: GridAlertLatencyBreached
        expr: |
          histogram_quantile(0.95,
            sum(rate(helios_grid_alert_latency_seconds_bucket[5m])) by (le)
          ) > 4.0
        for: 5m
        labels:
          severity: P1
          team: grid-intelligence
        annotations:
          summary: "Grid alert latency P95 > 4 seconds (SLO breach): {{ $value | humanizeDuration }}"
          description: |
            End-to-end grid alert latency has exceeded the 4-second SLO.
            Operators may be receiving alerts with significant delay.
            This is a contractual SLA risk for customers with P95 < 10s guarantees.
          runbook: "/06-operations/incident-response-runbook.md#alert-latency-breach"

      - alert: GridMonitorRedisConnectivity
        expr: |
          helios_redis_connection_errors_total{app="grid-monitor"} > 0
        for: 2m
        labels:
          severity: P1
          team: grid-intelligence
        annotations:
          summary: "Grid monitor cannot reach Redis — live grid state unavailable"
          runbook: "/06-operations/incident-response-runbook.md#grid-monitor-redis-failure"
```

### Database Alerts

```yaml
  - name: database
    rules:
      - alert: RDSHighConnectionCount
        expr: |
          aws_rds_database_connections_average{dbinstance_identifier="helios-main-primary"} > 400
        for: 10m
        labels:
          severity: P2
          team: platform
        annotations:
          summary: "RDS connection count > 400 (limit: 500)"
          runbook: "/06-operations/incident-response-runbook.md#rds-connection-exhaustion"

      - alert: TimescaleDBPartitionCountHigh
        expr: |
          timescaledb_chunk_count{hypertable="meter_readings"} > 50000
        for: 1h
        labels:
          severity: P3
          team: platform
        annotations:
          summary: "TimescaleDB chunk count exceeds 50,000 — query planning degradation likely"
          runbook: "/05-engineering/performance-bottlenecks.md#timescale-partitions"
```

### IoT Bridge Alerts

```yaml
  - name: iot-bridge
    rules:
      - alert: EMQXBrokerDown
        expr: |
          up{job="emqx"} == 0
        for: 1m
        labels:
          severity: P1
          team: iot-devices
        annotations:
          summary: "EMQX broker node {{ $labels.instance }} is down"
          runbook: "/06-operations/incident-response-runbook.md#emqx-broker-down"

      - alert: IoTBridgeDecodeErrorRateHigh
        expr: |
          rate(helios_iot_decode_errors_total[5m]) /
          rate(helios_iot_messages_received_total[5m]) > 0.001
        for: 5m
        labels:
          severity: P2
          team: iot-devices
        annotations:
          summary: "IoT bridge decode error rate > 0.1%: vendor {{ $labels.vendor_id }}"
          runbook: "/06-operations/incident-response-runbook.md#iot-decode-errors"

      - alert: IoTIngestRateDrop
        expr: |
          rate(helios_iot_messages_received_total[5m]) <
          rate(helios_iot_messages_received_total[30m] offset 1h) * 0.5
        for: 10m
        labels:
          severity: P2
          team: iot-devices
        annotations:
          summary: "IoT ingest rate dropped > 50% compared to 1 hour ago"
          description: "Could indicate EMQX issue, network problem, or mass device disconnection"
          runbook: "/06-operations/incident-response-runbook.md#iot-ingest-rate-drop"
```

### SLO Burn Rate Alerts

```yaml
  - name: slo-burn-rate
    rules:
      # Error budget burn rate alerts using multi-window multi-burn-rate approach
      - alert: GridMonitorSLOBurnRateCritical
        expr: |
          (
            slo:grid_monitor:error_rate:5m > (14.4 * (1 - 0.9999))
          ) and (
            slo:grid_monitor:error_rate:1h > (14.4 * (1 - 0.9999))
          )
        for: 2m
        labels:
          severity: P1
          team: grid-intelligence
        annotations:
          summary: "Grid monitor burning error budget at 14.4x rate"
          description: "At this rate, entire monthly error budget will be consumed in 2 hours"
          runbook: "/06-operations/incident-response-runbook.md#error-budget-burn"
```

---

## Runbook Requirement

**Before any alert ships to production, a runbook entry must exist in [Incident Response Runbook](/06-operations/incident-response-runbook.md).**

The runbook entry must include:
1. What the alert means in plain English
2. What the likely causes are
3. Step-by-step investigation procedure
4. Step-by-step remediation options
5. When to escalate (and to whom)

If you add an alert without a runbook, Marcus or the on-call engineer will find it during the next incident and come looking for you. This is not a hypothetical threat.

---

## Alert Noise Management

### Grouping

Alertmanager groups related alerts to prevent notification storms:

```yaml
# alertmanager.yaml
route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 30s       # Wait 30s for more alerts before sending first notification
  group_interval: 5m    # Wait 5m between notifications for the same group
  repeat_interval: 4h   # Repeat unresolved alerts every 4 hours
```

### Inhibition Rules

When a higher-severity alert is firing, suppress related lower-severity alerts:

```yaml
inhibit_rules:
  # If the entire grid-monitor service is down, suppress consumer lag alerts
  - source_match:
      alertname: GridMonitorServiceDown
      severity: P1
    target_match:
      alertname: GridMonitorKafkaLagWarning
    equal: ['namespace']

  # If EMQX is down, suppress IoT bridge alerts (they're symptoms of the EMQX problem)
  - source_match:
      alertname: EMQXBrokerDown
      severity: P1
    target_match:
      team: iot-devices
    equal: ['cluster']
```

---

## Alert Review Process

Alerts are reviewed monthly in the SRE Observability Review (monthly, held by @marcus.webb):
1. Fired alert count per alert in the past 30 days
2. True positive rate (did the alert indicate a real problem?)
3. Time to acknowledge per alert (slow acknowledgement = unclear runbook or wrong severity)
4. Alerts that never fired in 90 days → candidates for removal

---

## Things Every New Engineer Should Know

1. **If you add a new alert, you own its runbook.** The runbook review is part of the PR review. `#helios-engineering` will reject alert PRs without runbook sections.

2. **P1 alerts wake people up at 3 AM.** Set P1 only for truly critical, customer-impacting conditions. If in doubt, use P2. An alert that fires P1 when nothing is actually wrong trains engineers to ignore alerts.

3. **Test your alert before merging.** Use the staging Prometheus to validate alert expressions: `kubectl port-forward -n monitoring svc/prometheus 9090:9090`, then use the Prometheus UI to test the expression. Many alert bugs are caught here.

4. **`for:` duration matters.** A `for: 0s` alert will fire on a single data point — this causes flapping alerts during brief spikes. Most alerts should have at least `for: 5m` to confirm sustained problems.

5. **Alertmanager silences are a last resort.** If you silence an alert because it's noisy, the right fix is to tune the alert or fix the underlying issue. A silenced P1 alert is an invisible blind spot. Document every silence with a reason and a resolution date.

---

*Document maintained by @marcus.webb*  
*Alert expression questions → @marcus.webb*  
*PagerDuty routing questions → @marcus.webb or @tanvir.rahman*  
*Related: [Monitoring & Observability](/04-platform/monitoring-observability.md) · [Incident Response Runbook](/06-operations/incident-response-runbook.md) · [On-call Rotation Guide](/06-operations/on-call-rotation-guide.md)*
