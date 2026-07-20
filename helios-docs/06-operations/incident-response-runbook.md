# Incident Response Runbook

**Owner:** Marcus Webb (SRE Lead) · `@marcus.webb`
**Team:** Site Reliability Engineering
**Last Updated:** 2024-11-14
**Review Cycle:** Quarterly — next review due 2025-02-14
**Severity Framework Version:** v3.1 (adopted Q3 2023, see [Project Timeline](/supplemental/project-timeline-history.md))
**Related Docs:** [Alerting Strategy](/04-platform/alerting-strategy.md) · [On-Call Rotation Guide](/06-operations/on-call-rotation-guide.md) · [Disaster Recovery Plan](/06-operations/disaster-recovery-plan.md) · [Monitoring & Observability](/04-platform/monitoring-observability.md)

---

> **Note from Marcus (2024-08-01):** This runbook went through a major overhaul following the SEV-1 incident on 2024-07-19 (see post-mortem: [INC-2024-0719](https://incidents.lumina-internal.com/INC-2024-0719)) where we lost grid telemetry for 38 minutes for three UK customers. The old runbook hadn't been updated since v2.3 in early 2023 and contained stale PagerDuty escalation paths. Please read this version carefully and flag anything that no longer reflects reality.
>
> Outstanding: the "Regulatory Notification" section still needs review from Yasmin Osei's team. I've marked it TODO.

---

## Table of Contents

1. [Severity Definitions](#severity-definitions)
2. [First Response Protocol](#first-response-protocol)
3. [Incident Command Structure](#incident-command-structure)
4. [Communication Templates](#communication-templates)
5. [Service-Specific Runbooks](#service-specific-runbooks)
6. [Escalation Matrix](#escalation-matrix)
7. [Post-Incident Process](#post-incident-process)
8. [Common Incident Patterns](#common-incident-patterns)
9. [Regulatory Notification Requirements](#regulatory-notification-requirements)
10. [Tools & Access](#tools--access)

---

## 1. Severity Definitions

We use a four-tier severity model. **Do not guess severity — use the criteria below.** When in doubt, escalate up.

| Severity | Name | Criteria | Target Acknowledgement | Target Resolution | Examples |
|----------|------|----------|----------------------|-------------------|---------|
| **SEV-1** | Critical | Customer-facing grid operations down OR safety risk OR data loss affecting >1 customer | 5 minutes | 4 hours | Grid telemetry blackout, outage detection service down, dispatch API unreachable |
| **SEV-2** | High | Significant degradation affecting ≥1 customer OR single-customer total outage | 15 minutes | 8 hours | AI forecasting service returning stale data >30 min, Customer Portal login broken, notification delivery failure |
| **SEV-3** | Medium | Partial degradation, feature unavailable but workaround exists | 30 minutes | 24 hours | GIS map tiles slow, report generation >5min, single meter registration failure |
| **SEV-4** | Low | Minor issue, no customer impact, cosmetic or edge case | 2 hours | 72 hours | UI typo in admin panel, metric label incorrect, non-critical log noise |

### Automatic SEV-1 Triggers

The following Grafana/PagerDuty alerts automatically create a SEV-1 incident without human triage:

- `grid_telemetry_gap_seconds > 120` for any customer
- `outage_detection_service_health != healthy`
- `kafka_consumer_lag_grid_events > 500000`
- `dispatch_api_error_rate_5m > 0.05`
- `postgres_primary_replication_lag_seconds > 30`
- `iot_device_auth_failure_rate_5m > 0.10` (potential security incident)

---

## 2. First Response Protocol

### Step 1: Acknowledge within target window

```
PagerDuty → Acknowledge the alert
Post in #incidents Slack channel:
  "I'm taking this. [SEV-X] [brief description] — investigating"
```

Do NOT try to fix before acknowledging. Missed acknowledgement windows trigger automatic escalation.

### Step 2: Assess and declare severity

Open the [Helios Operations Dashboard](https://grafana.lumina-internal.com/d/helios-ops) and check:

1. Is grid telemetry flowing? (`helios_grid_events_received_total` counter increasing)
2. Is the outage detection service healthy? (`/health` endpoint on `outage-detection-svc`)
3. Is Kafka consumer lag growing or stable?
4. Are customer-facing APIs returning 2xx?

```bash
# Quick health check from your terminal (requires VPN + kubectl access)
kubectl get pods -n helios-prod --field-selector=status.phase!=Running
kubectl top pods -n helios-prod --sort-by=cpu | head -20

# Check Kafka lag for critical topics
kafka-consumer-groups.sh \
  --bootstrap-server kafka.helios-prod.svc:9092 \
  --describe \
  --group grid-events-consumer \
  | grep -E "(TOPIC|grid\.(telemetry|alerts))"

# Check API health
curl -sS https://api.helios.lumina.energy/health | jq .
```

### Step 3: Declare and create incident

For SEV-1 and SEV-2, create an incident immediately:

```
/incident create sev1 "Grid telemetry blackout - 3 UK customers"
```

This Slack command (via OpsBot) creates:
- A dedicated `#inc-YYYYMMDD-NNN` Slack channel
- A Jira incident ticket (IC-XXXX)
- A PagerDuty incident linked to the alert
- A Statuspage draft (requires manual publishing)

### Step 4: Establish Incident Command

For SEV-1: Incident Commander (IC) role is mandatory. The on-call SRE takes IC unless they are deep in diagnosis, in which case they page the SRE Lead.

```
Post in incident channel:
  "IC: @marcus.webb
   Tech Lead: @[engineer investigating]
   Comms: @[whoever is handling customer comms]
   
   Current status: [what we know]
   Hypothesis: [leading theory]
   ETA to update: 15 min"
```

---

## 3. Incident Command Structure

```
                    ┌─────────────────────────┐
                    │   Incident Commander    │
                    │   (IC — SRE on-call)    │
                    └────────────┬────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
    ┌─────────▼──────┐ ┌─────────▼──────┐ ┌────────▼───────┐
    │  Technical     │ │  Customer      │ │  Executive     │
    │  Lead          │ │  Comms Lead    │ │  Liaison       │
    │  (Eng on-call) │ │  (CSM/Support) │ │  (VP Eng if    │
    │                │ │                │ │  SEV-1 >1hr)   │
    └─────────┬──────┘ └─────────┬──────┘ └────────────────┘
              │                  │
    ┌─────────▼──────┐  ┌────────▼───────┐
    │  Service SMEs  │  │  Status Page   │
    │  (paged as     │  │  Updates       │
    │  needed)       │  │  (every 30min) │
    └────────────────┘  └────────────────┘
```

**Incident Commander Responsibilities:**
- Owns the incident end-to-end
- Makes final call on severity changes
- Decides when to page additional engineers
- Approves any production changes during incident
- Calls the bridge to resolution

**Do NOT have multiple people making independent changes to prod simultaneously without IC awareness.** This was the root cause of INC-2024-0312 escalating from SEV-2 to SEV-1.

---

## 4. Communication Templates

### Slack Status Update (every 15 min for SEV-1, 30 min for SEV-2)

```
🔴 [SEV-1 UPDATE — T+30min]
Incident: INC-2024-XXXX
Status: INVESTIGATING / MITIGATED / RESOLVED

What we know:
- [fact 1]
- [fact 2]

Current action:
- [what is being done right now]

Next update: [time]
IC: @name
```

### Customer Notification (via CSM team, not engineering)

```
Subject: [URGENT] Helios Platform — Service Degradation Notice

Dear [Customer Name],

We are aware of a service degradation affecting [describe impact] 
beginning at approximately [time UTC].

Impact: [specific impact to their environment]
Status: Our engineering team is actively investigating.
ETA: We will provide an update within [30/60] minutes.

Incident Reference: INC-2024-XXXX
Helios Status Page: https://status.helios.lumina.energy

We apologise for the disruption. A full post-incident report will be 
provided within 5 business days.

— Lumina Energy Operations Team
```

**IMPORTANT:** Engineering should NEVER contact customers directly. All customer communication goes through the CSM team. Page `@csm-oncall` in PagerDuty for SEV-1.

---

## 5. Service-Specific Runbooks

### 5.1 Grid Telemetry Blackout

**Symptoms:** `helios_grid_events_received_total` flat; Grafana shows "No Data" on grid heatmaps; customers report stale readings.

**Diagnosis sequence:**

```bash
# 1. Check IoT ingestion pods
kubectl get pods -n helios-prod -l app=iot-ingest-service
kubectl logs -n helios-prod -l app=iot-ingest-service --tail=100 | grep -E "(ERROR|WARN|panic)"

# 2. Check Kafka topic health
kafka-topics.sh --bootstrap-server kafka.helios-prod.svc:9092 \
  --describe --topic grid.telemetry.raw

# 3. Check consumer group lag
kafka-consumer-groups.sh --bootstrap-server kafka.helios-prod.svc:9092 \
  --describe --group grid-processor-consumer

# 4. Check Go event processor
kubectl logs -n helios-prod -l app=grid-event-processor --tail=200 | grep -E "(ERROR|panic|OOM)"

# 5. If all looks healthy on Helios side, check AWS IoT Core
aws iot describe-endpoint --endpoint-type iot:Data-ATS --region eu-west-1
```

**Common causes and fixes:**

| Cause | Indicator | Fix |
|-------|-----------|-----|
| IoT ingest pod OOMKilled | `kubectl describe pod` shows `OOMKilled` | `kubectl rollout restart deployment/iot-ingest-service -n helios-prod` |
| Kafka broker down | Topic has missing partitions | Page Kafka on-call; do NOT manually reassign partitions |
| TLS cert expired on IoT bridge | `CERTIFICATE_EXPIRED` in ingest logs | Run cert rotation playbook: `ansible-playbook iot-cert-rotation.yml` |
| AWS IoT Core rate limit | 429 errors in ingest logs | Contact AWS TAM (account ID in 1Password: "AWS TAM Contact") |
| Network partition between AZs | Only partial lag, some regions flowing | Check AWS VPC Flow Logs; page infra on-call |

### 5.2 Outage Detection False Positive Storm

**Symptoms:** Hundreds of outage alerts firing simultaneously; customers phoning in claiming no actual outage; dispatch queue flooded.

**This happened in November 2023 (INC-2023-1107). Do not suppress alerts globally — that masks real outages.**

```bash
# Check anomaly detection service
kubectl logs -n helios-prod -l app=outage-detection-svc --tail=500 \
  | grep "anomaly_score" | tail -50

# Check if threshold config was recently changed
kubectl get configmap outage-detection-config -n helios-prod -o yaml \
  | grep -A5 "anomaly_threshold"

# Check if upstream model was redeployed
kubectl describe deployment outage-detection-svc -n helios-prod \
  | grep -E "(Image|Updated)"
```

**Emergency brake:** If confirmed false positive storm, enable rate limiting:

```bash
kubectl patch configmap outage-detection-config -n helios-prod \
  --patch '{"data":{"ALERT_RATE_LIMIT_PER_MINUTE":"10","ALERT_COOLDOWN_SECONDS":"300"}}'
kubectl rollout restart deployment/outage-detection-svc -n helios-prod
```

**Alert Chidi Eze** (`@chidi.eze`) — he owns the ML model. Do not tune thresholds without his approval.

### 5.3 AI Forecasting Returning Stale Data

See [AI Forecasting Engine — Troubleshooting section](/03-services/ai-forecasting-engine.md#troubleshooting).

**Quick check:**
```bash
# Check model serving pod
kubectl get pods -n helios-prod -l app=forecasting-engine
kubectl logs -n helios-prod -l app=forecasting-engine --tail=100 | grep "model_version"

# Check Redis cache freshness
redis-cli -h redis.helios-prod.svc -p 6379 TTL forecast:demand:latest
# Should be < 300 (seconds). If -1, the cache has no expiry — bug exists (see KI-004)
```

### 5.4 Dispatch API Down

**Impact:** Technicians cannot receive job assignments. This is SEV-1 if >15 technicians are affected.

See also: [Technician Dispatch System — Runbook section](/03-services/technician-dispatch-system.md#incident-procedures) and [Technical Debt TD-002](/05-engineering/technical-debt-register.md) (Node 16 issue).

```bash
# Check dispatch service
kubectl get pods -n helios-prod -l app=dispatch-service
kubectl logs -n helios-prod -l app=dispatch-service --tail=200 | grep -E "(ERROR|FATAL)"

# The dispatch service is still on Node 16 — if you see V8 heap errors, it's OOM
# Temporary fix: increase memory limit
kubectl set resources deployment/dispatch-service -n helios-prod \
  --limits=memory=2Gi --requests=memory=1Gi
```

### 5.5 Database Primary Failover

See [Database Architecture — Failover Procedures](/02-architecture/database-architecture.md#failover).

**DO NOT attempt manual failover without confirming with Rosa Lindqvist or Marcus Webb.** Aurora auto-failover typically completes in 30–45 seconds. Manual intervention usually makes things worse.

---

## 6. Escalation Matrix

| Condition | Page | Contact |
|-----------|------|---------|
| SEV-1 opened | SRE on-call (auto) | PagerDuty: `helios-sre-primary` |
| SEV-1 unresolved at T+1hr | SRE Lead | Marcus Webb: `@marcus.webb` / +44-7700-900-141 |
| SEV-1 unresolved at T+2hr | VP Engineering | Elena Vasquez: `@elena.vasquez` / +1-415-555-0192 |
| Customer data breach suspected | Security on-call | Yasmin Osei: `@yasmin.osei` + Legal immediately |
| Regulatory notification required | Compliance | See §9 below — TODO: Yasmin to review |
| AWS infrastructure failure | AWS TAM | See 1Password: "AWS Enterprise Support" |
| >3 customers affected | CTO + CEO | James Whitfield + Anjali Singh (Elena escalates) |

---

## 7. Post-Incident Process

### Timeline

| Timeframe | Action | Owner |
|-----------|--------|-------|
| During incident | Maintain timeline notes in incident channel | IC |
| Within 1 hour of resolution | Mark incident resolved in PagerDuty + Jira | IC |
| Within 4 hours | Publish preliminary post-mortem (timeline only) | IC |
| Within 5 business days | Full post-mortem published | IC + Tech Lead |
| Within 10 business days | Customer RCA letter sent (SEV-1 only) | VP Eng + CSM |
| Within 14 business days | Action items reviewed in weekly SRE sync | SRE team |

### Post-Mortem Template

Post-mortems live in Confluence under [Engineering > Post-Mortems](https://lumina-confluence.atlassian.net/wiki/spaces/ENG/pages/post-mortems). Use the standard template:

```markdown
# Post-Mortem: INC-YYYY-NNNN — [Short Description]

**Date:** 
**Severity:** 
**Duration:** [detection time] → [resolution time] = X hours Y minutes
**Impact:** [customers affected, features affected, data affected]
**IC:** 
**Authors:** 

## Summary
[2–3 sentences. What happened, what was the impact, how was it resolved]

## Timeline (all times UTC)
- HH:MM — [event]
- HH:MM — [event]

## Root Cause
[Technical root cause. Be specific. "Human error" is never the root cause.]

## Contributing Factors
[What made this possible / worse]

## What Went Well
- 

## What Went Poorly
- 

## Action Items
| Item | Owner | Due Date | Jira |
|------|-------|----------|------|
| | | | |

## Lessons Learned
```

### Blameless Culture

Post-mortems are blameless. We follow the [Etsy blameless post-mortem](https://codeascraft.com/2012/05/22/blameless-postmortems/) model. **Do not name individuals in root cause sections.** "An engineer deployed X" not "David deployed X and broke everything."

That said — action items should have individual owners with due dates. Blameless ≠ unaccountable.

---

## 8. Common Incident Patterns

Based on 4 years of incidents, these are the patterns we see most often:

### Pattern 1: Kafka consumer lag cascade

**Frequency:** ~3x per quarter
**Trigger:** Usually a bad deploy of the grid-event-processor that introduces a slow deserialization path.
**Signature:** Lag on `grid.telemetry.raw` starts growing; grid monitoring dashboards go stale; outage detection starts running on old data.
**Resolution:** Roll back the deploy. Lag typically self-heals within 20 minutes.

```bash
# Check recent deployments
kubectl rollout history deployment/grid-event-processor -n helios-prod
# Roll back
kubectl rollout undo deployment/grid-event-processor -n helios-prod
```

### Pattern 2: TimescaleDB chunk bloat during month-end

**Frequency:** Monthly, predictable
**Trigger:** Month-end reporting generates large analytical queries that conflict with continuous aggregates. See [Performance Bottleneck PB-003](/05-engineering/performance-bottlenecks.md).
**Signature:** Grid monitoring latency spikes; `pg_stat_activity` shows long-running analytical queries blocking writes.
**Mitigation:** Run `SELECT timescaledb_information.chunks` — if chunks > 2000, run emergency retention compression (see DB runbook in Confluence).

### Pattern 3: IoT auth storm after certificate renewal

**Frequency:** Every 90 days (cert rotation cycle)
**Trigger:** When IoT device certs are rotated, devices re-authenticate in a thundering herd.
**Signature:** `iot_device_auth_failure_rate` spikes for 2–5 minutes; some devices drop offline temporarily.
**Resolution:** This is expected — known issue, not an incident unless devices don't reconnect within 10 minutes. See [IoT Device Management — Certificate Rotation](/03-services/iot-device-management.md#certificate-rotation).

### Pattern 4: Forecasting model drift alert

**Frequency:** ~1x per month
**Trigger:** Seasonal transitions (March, October) cause the demand forecast model to drift outside acceptable bounds.
**Signature:** `forecast_mae_hourly > 150` alert fires; customers report forecast accuracy degraded.
**Resolution:** Page Chidi Eze or Lin Chen — model retraining takes 4–8 hours on the ML training cluster.

### Pattern 5: Dispatch service memory leak

**Frequency:** Every 3–4 weeks (related to TD-002)
**Trigger:** The Node.js 16 dispatch service slowly leaks memory over ~3 weeks until it OOMKills.
**Signature:** Memory usage of dispatch-service pods trending up; eventually OOMKilled.
**Resolution:** Rolling restart buys ~3 weeks. This is in the technical debt register as TD-002.

```bash
# Check memory trend
kubectl top pod -n helios-prod -l app=dispatch-service
# Force restart if > 1.8Gi
kubectl rollout restart deployment/dispatch-service -n helios-prod
```

---

## 9. Regulatory Notification Requirements

> **TODO:** This section needs review from Yasmin Osei (Security/Compliance) and the legal team. Content below is from the v2.3 runbook and may be outdated. Do not rely on this in an actual incident — contact Yasmin directly.

Based on the [Compliance & Regulatory Requirements](/06-operations/compliance-regulatory.md) document, grid operators in several of our customer jurisdictions have mandatory incident notification requirements:

| Jurisdiction | Regulation | Notification Threshold | Deadline |
|---|---|---|---|
| UK | OFGEM Network Security Guidelines | >15,000 customers affected OR grid safety risk | 4 hours |
| Germany | BDEW/BSI Guidelines | Any security incident affecting grid control systems | 2 hours |
| Australia | AEMO Rules | Market-affecting outage detection failure | Immediate |
| USA (pending) | NERC CIP | CIP-008-6 (when US customers go live) | 1 hour |

**For any incident that may trigger regulatory notification, page Yasmin Osei immediately regardless of hour.**

---

## 10. Tools & Access

### Required Access for On-Call

All on-call engineers should verify access weekly. If anything is missing, open an access request in Jira (IT project) before your rotation starts.

| Tool | Purpose | Access Path |
|------|---------|------------|
| PagerDuty | Alert management | SSO via Okta |
| Grafana | Monitoring dashboards | SSO via Okta → [grafana.lumina-internal.com](https://grafana.lumina-internal.com) |
| Kibana | Log search | SSO via Okta → [kibana.lumina-internal.com](https://kibana.lumina-internal.com) |
| kubectl (prod) | Kubernetes access | Requires `helios-sre` IAM role; request via IT ticket |
| AWS Console | Infrastructure | `HeliosProdReadOnly` role (SRE: `HeliosProdAdmin`) |
| 1Password | Shared credentials | SRE vault — request from Marcus Webb |
| Statuspage | Customer status updates | [manage.statuspage.io](https://manage.statuspage.io) — SRE team access |
| OpsBot (Slack) | Incident creation | `/incident help` in any Slack channel |

### Useful Dashboards

| Dashboard | URL |
|-----------|-----|
| Helios Operations Overview | [grafana.lumina-internal.com/d/helios-ops](https://grafana.lumina-internal.com/d/helios-ops) |
| Grid Telemetry Health | [grafana.lumina-internal.com/d/grid-telemetry](https://grafana.lumina-internal.com/d/grid-telemetry) |
| Kafka Consumer Lag | [grafana.lumina-internal.com/d/kafka-lag](https://grafana.lumina-internal.com/d/kafka-lag) |
| API Latency & Error Rates | [grafana.lumina-internal.com/d/api-health](https://grafana.lumina-internal.com/d/api-health) |
| IoT Device Fleet Status | [grafana.lumina-internal.com/d/iot-fleet](https://grafana.lumina-internal.com/d/iot-fleet) |
| AI Forecasting Quality | [grafana.lumina-internal.com/d/forecast-quality](https://grafana.lumina-internal.com/d/forecast-quality) |

### Things Every On-Call Engineer Should Know

1. **Never restart Kafka brokers without paging the Kafka SME (David Okafor)**. Partition leader elections can take several minutes and extend the incident.
2. **Aurora auto-failover is usually faster than manual failover.** Let it work for at least 90 seconds before intervening.
3. **The dispatch service (Node 16) will OOMKill approximately every 3 weeks.** A rolling restart is the fix. Don't spend time debugging — just restart and file a note.
4. **False positive alert storms come from the outage detection service, not real grid events.** Check `ALERT_RATE_LIMIT_PER_MINUTE` in the configmap first.
5. **Customer communications go through the CSM team, not engineering.** Never DM a customer directly even if you know them.
6. **All production changes during a SEV-1 require IC approval**, even small config changes. "I just changed one line" has caused multiple incident escalations.
7. **The `#incidents` Slack channel is logged and retained for 7 years for regulatory purposes.** Don't say anything there you wouldn't want in a regulatory audit.

---

*This runbook is a living document. If you follow a procedure and something doesn't work, please update the doc immediately rather than relying on tribal knowledge. The best time to update a runbook is right after the incident while your memory is fresh.*

*Questions: `#sre-team` on Slack or ping Marcus Webb directly.*
