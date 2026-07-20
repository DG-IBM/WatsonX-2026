# On-Call Rotation Guide

**Owner:** Marcus Webb (SRE Lead)
**Team:** Site Reliability Engineering
**Last Updated:** 2024-11-01
**Schedule Tool:** PagerDuty (primary) / Google Calendar (reference only)
**Related Docs:** [Incident Response Runbook](/06-operations/incident-response-runbook.md) · [Alerting Strategy](/04-platform/alerting-strategy.md) · [Team Structure](/07-onboarding/team-structure.md) · [Engineering Directory](/01-company/engineering-directory.md)

---

> **Note (Marcus, 2024-11-01):** We restructured the on-call rotation significantly in Q3 2024 to address engineer burnout. The old model had a single on-call pool pulling from all teams which meant frontend engineers getting paged for Kafka issues at 3am. The new model has two tracks — Platform On-Call and Application On-Call — each drawing from engineers with relevant expertise. It's still not perfect (see §6 for outstanding issues) but the feedback from the team has been much more positive.
>
> If you are a new engineer reading this: you will NOT be placed on the primary on-call rotation until you have been at Lumina for at least 90 days and have completed the on-call certification checklist in §9. This is firm policy.

---

## Table of Contents

1. [On-Call Structure Overview](#on-call-structure-overview)
2. [Rotation Schedules](#rotation-schedules)
3. [Escalation Paths](#escalation-paths)
4. [On-Call Responsibilities](#on-call-responsibilities)
5. [Compensation Policy](#compensation-policy)
6. [On-Call Health & Burnout Policy](#on-call-health--burnout-policy)
7. [Handoff Procedures](#handoff-procedures)
8. [Tools Setup](#tools-setup)
9. [On-Call Certification Checklist](#on-call-certification-checklist)
10. [Historical Context: Why We Changed the Rotation](#historical-context-why-we-changed-the-rotation)

---

## 1. On-Call Structure Overview

Helios operates two parallel on-call tracks:

```
┌─────────────────────────────────────────────────────────────────┐
│                    HELIOS ON-CALL STRUCTURE                     │
├───────────────────────────┬─────────────────────────────────────┤
│   PLATFORM ON-CALL        │   APPLICATION ON-CALL               │
│                           │                                     │
│  Covers:                  │  Covers:                            │
│  • Infrastructure         │  • Grid monitoring service          │
│  • Kubernetes             │  • AI forecasting engine            │
│  • Database               │  • Outage detection                 │
│  • Kafka/messaging        │  • Dispatch service                 │
│  • Networking/DNS         │  • Customer portal                  │
│  • AWS services           │  • Notification service             │
│  • CI/CD pipeline         │  • GIS mapping                      │
│  • IoT ingestion layer    │  • IoT device management (app side) │
│                           │                                     │
│  Pool: ~12 engineers      │  Pool: ~20 engineers                │
│  Rotation: Weekly         │  Rotation: Weekly                   │
│  Primary + Secondary      │  Primary + Secondary                │
└───────────────────────────┴─────────────────────────────────────┘
                            │
              Both tracks escalate to:
              Marcus Webb (SRE Lead) for SEV-1
              then Elena Vasquez (VP Eng) if needed
```

### Which Alert Goes to Which Track?

PagerDuty routing rules are configured in the [PagerDuty Service Directory](https://lumina.pagerduty.com/services). Quick reference:

| Alert | Track | Reasoning |
|-------|-------|-----------|
| `kafka_consumer_lag_*` | Platform | Kafka is infra |
| `aurora_replication_lag_*` | Platform | Database is infra |
| `pod_oom_killed` | Platform | Container infra |
| `grid_telemetry_gap_*` | Application | Grid service owns this |
| `outage_detection_unhealthy` | Application | App service |
| `forecast_mae_*` | Application | ML service |
| `dispatch_api_error_rate_*` | Application | App service |
| `iot_device_auth_failure_rate_*` | **Both** (simultaneously) | Could be app or infra |
| `ssl_certificate_expiry_*` | Platform | Infra owns certs |
| `customer_portal_error_rate_*` | Application | App service |

When in doubt, PagerDuty routes to Platform. An incorrect page is less bad than a missed one.

---

## 2. Rotation Schedules

### Current On-Call Roster (Q4 2024)

Schedules are managed in PagerDuty. The Google Calendar reference copies are updated monthly. If they disagree, PagerDuty is authoritative.

#### Platform On-Call — Primary Rotation

7-day shifts, Monday 09:00 UTC handoff.

| Week | Primary | Secondary (escalation) |
|------|---------|----------------------|
| 2024-W46 (Nov 11) | Rosa Lindqvist | Marcus Webb |
| 2024-W47 (Nov 18) | Priya Nair | Marcus Webb |
| 2024-W48 (Nov 25) | Deepak Mehta | Marcus Webb |
| 2024-W49 (Dec 2) | Aysha Karimi | Marcus Webb |
| 2024-W50 (Dec 9) | Rosa Lindqvist | Marcus Webb |
| 2024-W51 (Dec 16) | Priya Nair | Marcus Webb |
| 2024-W52 (Dec 23) | Deepak Mehta | Marcus Webb |
| 2024-W1 (Dec 30) | **HOLIDAY COVER** | Marcus Webb + Rosa |

> Marcus is permanent secondary for Platform track. He made this call himself after INC-2024-0312 where the secondary escalated too slowly. He reviews this annually.

#### Application On-Call — Primary Rotation

7-day shifts, Monday 09:00 UTC handoff.

| Week | Primary | Secondary | Focus area |
|------|---------|-----------|------------|
| 2024-W46 | Chidi Eze | David Okafor | Grid/AI |
| 2024-W47 | Farah Okonkwo | Chidi Eze | Grid/Outage |
| 2024-W48 | Mateus Costa | David Okafor | Dispatch/Portal |
| 2024-W49 | Ami Tanaka | Chidi Eze | IoT/Notifications |
| 2024-W50 | Chidi Eze | David Okafor | Grid/AI |
| 2024-W51 | Farah Okonkwo | Mateus Costa | Outage/Portal |
| 2024-W52 | David Okafor | Chidi Eze | All services |
| 2024-W1 | **HOLIDAY COVER** | Chidi Eze + David | Reduced coverage |

#### Holiday Coverage Policy

Christmas/New Year (Dec 24 – Jan 2): Reduced coverage. During this period:
- Only SEV-1 and SEV-2 incidents are paged immediately
- SEV-3 and SEV-4 alerts are suppressed until Jan 3
- Two volunteers cover the full period (rotated annually; different people each year)
- Holiday cover receives **3x** their normal on-call supplement

---

## 3. Escalation Paths

### Platform Track

```
Alert fires
    │
    ▼
Platform Primary (5 min ack window)
    │ not acknowledged
    ▼
Platform Secondary (10 min cumulative)
    │ not acknowledged / SEV-1 at T+60min
    ▼
Marcus Webb — SRE Lead (24/7, +44-7700-900-141)
    │ SEV-1 unresolved T+2hr
    ▼
Elena Vasquez — VP Engineering (+1-415-555-0192)
    │ SEV-1 unresolved T+3hr or major customer impact
    ▼
James Whitfield — CTO (via Elena only, not direct page)
```

### Application Track

```
Alert fires
    │
    ▼
Application Primary (5 min ack window)
    │ not acknowledged
    ▼
Application Secondary (10 min cumulative)
    │ not acknowledged / SEV-1 at T+60min
    ▼
Relevant Team Lead:
  Grid/AI → Kwame Asante (+44-7911-123-456)
  Platform → Tanvir Rahman (+44-7700-555-123)
    │ SEV-1 unresolved T+2hr
    ▼
Marcus Webb (bridges to Platform if needed)
    │
    ▼
Elena Vasquez
```

### Security Escalation (separate path)

Any incident involving suspected unauthorized access, data breach, or unusual authentication patterns:

```
Platform/Application On-Call (any severity)
    │ immediately, in parallel
    ▼
Yasmin Osei — Security Lead (24/7, +44-7700-900-299)
    │
    ▼
CISO + Legal (Yasmin escalates)
    │ data breach confirmed
    ▼
Regulatory notification procedures (see Compliance doc)
```

---

## 4. On-Call Responsibilities

### During Your Shift

**You are expected to:**
- Acknowledge PagerDuty alerts within the target window
- Triage and respond to incidents per the [Incident Response Runbook](/06-operations/incident-response-runbook.md)
- Be available within 5 minutes of a page (you don't need to be at a desk, but you need to respond)
- Maintain situational awareness — check the Grafana [Operations Dashboard](https://grafana.lumina-internal.com/d/helios-ops) at least once per shift (morning and evening)
- Complete the daily handoff note

**You are NOT expected to:**
- Know everything about every service immediately
- Fix everything yourself — page SMEs when needed
- Skip meals, sleep, or family time for SEV-3/4 alerts
- Stay online past your reasonable working hours for non-SEV-1/2 issues

**Response time expectations by severity:**

| Severity | Response to Page | Response on Non-Working Hours |
|----------|-----------------|------------------------------|
| SEV-1 | 5 minutes, always | Full immediate response |
| SEV-2 | 15 minutes | Respond, triage, may defer non-critical steps to daytime |
| SEV-3 | 30 minutes during business hours | Acknowledge; can address next morning |
| SEV-4 | 2 hours during business hours | Acknowledge; address in normal working hours |

### Daily Operations

- **Morning (09:00 UTC):** Review overnight alerts in PagerDuty and Grafana. Check for any auto-resolved alerts that should have tickets.
- **Evening (18:00 UTC):** Check for anything building (consumer lag, memory trends). Write brief status in `#on-call-handoff` Slack channel.
- **Ongoing:** Monitor `#alerts` Slack channel (Grafana webhook). Not every alert needs a response, but trending issues should be investigated before they become incidents.

---

## 5. Compensation Policy

On-call compensation is governed by the Lumina Engineering Compensation Policy (HR-ENG-2024-03). Summary:

| Compensation Type | Amount |
|------------------|--------|
| Weekly on-call supplement (Platform track) | £350 / €395 |
| Weekly on-call supplement (Application track) | £275 / €310 |
| Out-of-hours callout (per incident, SEV-1/2 only, outside 09:00–18:00 local) | £75 / €85 per hour (min 2 hours) |
| Holiday coverage supplement | 3× weekly rate |
| Incident requiring 4+ consecutive hours overnight | Next business day off in lieu |

Compensation is tracked via the monthly on-call expense form in Workday. You must submit within 30 days. Retroactive claims >30 days are not processed without VP approval.

**IMPORTANT:** The compensation policy is based on UK and EU regulations. For engineers based in other jurisdictions, consult HR. We currently have three engineers on the Application rotation who are based in India — their compensation structure differs.

---

## 6. On-Call Health & Burnout Policy

Following a 2023 burnout survey that showed 6 out of 12 on-call engineers reported "regularly poor sleep during on-call weeks," the following policies were adopted:

### Noise Reduction Commitments

The SRE team reviews alert noise monthly. Metrics:
- Target: <5 actionable pages per engineer per week
- Current average (Q3 2024): 4.2 pages/week (Platform), 5.8 pages/week (Application)
- Application track is still above target — Kwame Asante is owning this

Any alert that pages more than twice in a week without resulting in a real incident gets reviewed for tuning or suppression.

### The "Toil Budget"

Each engineer has a 25% toil budget — if more than 25% of your working time during an on-call week is spent on reactive/toil work, you log it in the monthly toil tracking spreadsheet. If any engineer's toil is consistently >25%, the SRE team prioritises that work for automation.

### Mandatory Post-Week Check-in

After every on-call week, engineers complete a 5-minute survey:
- How many pages did you receive?
- How many were outside working hours?
- How many were false positives or low-signal?
- How was your sleep quality?
- Any concerns to raise?

Results are reviewed in the weekly SRE sync. They are anonymous unless the engineer chooses to identify themselves.

### Rotation Size Targets

We target:
- Platform track: maximum 1 week in 8 (currently 1 in 6 — we need to grow the pool)
- Application track: maximum 1 week in 10 (currently 1 in 7)

We are actively hiring to expand both pools.

---

## 7. Handoff Procedures

### End-of-Shift Handoff

At the end of your on-call week, post a handoff note in `#on-call-handoff` using this template:

```
🔄 ON-CALL HANDOFF — Platform/Application — Week WXX

Outgoing: @your-name
Incoming: @incoming-name

🔴 Open incidents: [list any open INC-XXXX or "none"]
⚠️ Things to watch: 
  - [any trends, elevated metrics, flaky services]
  - [any pending changes that might cause noise]
🛠️ Actions taken this week:
  - [summary of significant incidents or interventions]
📝 Jira tickets opened: [INC/INFRA/etc numbers]
💬 Notes for incoming:
  - [anything the incoming person should know]
```

### Knowledge Transfer for New Engineers

Before your first on-call shift, you must:
1. Shadow a more experienced on-call engineer for at least 2 weeks
2. Complete the certification checklist (§9)
3. Have a 30-minute walkthrough with Marcus Webb or a senior SRE
4. Have PagerDuty phone verification working on your mobile device

---

## 8. Tools Setup

Complete this setup before your first on-call week. Verify it still works before each subsequent week.

### PagerDuty Setup

```
1. Log in via Okta SSO: https://lumina.pagerduty.com
2. Mobile app: Install PagerDuty app, enable push notifications AND SMS
3. Set contact methods: mobile (primary), SMS (backup)
4. Test: Ask Marcus to send you a test page before your first shift
5. Notification rules: Set 2-minute escalation from push to SMS to phone call
```

> **Note:** PagerDuty push notifications alone are NOT reliable enough. You must have SMS and phone call fallback configured. Engineers have missed SEV-1 pages because they relied on push notifications only and their phone was on silent.

### Grafana Access

```bash
# Grafana: https://grafana.lumina-internal.com (Okta SSO)
# Required dashboards — bookmark these:
#   /d/helios-ops         Helios Operations Overview
#   /d/grid-telemetry     Grid Telemetry Health  
#   /d/kafka-lag          Kafka Consumer Lag
#   /d/api-health         API Health
#   /d/iot-fleet          IoT Fleet Status
```

### kubectl Production Access

```bash
# Request access via Jira IT ticket: "Prod kubectl access - on-call"
# Attach: your manager approval + on-call certification completion

# Once granted:
aws configure sso --profile helios-prod
aws eks update-kubeconfig --name helios-prod-eu-west-1 --region eu-west-1 --profile helios-prod

# Test:
kubectl get nodes -n helios-prod
```

### Runbook Quick-Access Bookmarks

Bookmark these pages before your shift:

| Page | URL |
|------|-----|
| Incident Response Runbook | `/06-operations/incident-response-runbook.md` |
| Grid Telemetry Blackout | `/06-operations/incident-response-runbook.md#51-grid-telemetry-blackout` |
| Dispatch Service Down | `/06-operations/incident-response-runbook.md#54-dispatch-api-down` |
| Kafka Lag Runbook | Confluence: [Kafka Troubleshooting](https://lumina-confluence.atlassian.net/wiki/spaces/ENG/pages/kafka-troubleshooting) |
| Database Failover | `/02-architecture/database-architecture.md#failover` |

---

## 9. On-Call Certification Checklist

You must complete this before your first primary on-call shift. Review with your manager. Send completed checklist to Marcus Webb.

```
HELIOS ON-CALL CERTIFICATION CHECKLIST
Engineer: _____________________
Manager: _____________________
Date: _____________________

KNOWLEDGE
[ ] Can explain the difference between Platform and Application on-call tracks
[ ] Has read the Incident Response Runbook end-to-end
[ ] Can describe the SEV-1 through SEV-4 severity criteria from memory
[ ] Has read at least 3 post-mortems from the incident archive
[ ] Understands the Helios service dependency map (see System Overview)
[ ] Knows who to call for each major service (SME contacts in engineering directory)

TOOLS ACCESS
[ ] PagerDuty: app installed, SMS and phone call notifications configured, test page received
[ ] Grafana: can access and navigate all core dashboards
[ ] Kibana: can search logs for a given service and time range
[ ] kubectl: has production read access, can run kubectl get pods, kubectl logs, kubectl describe
[ ] AWS Console: has HeliosProdReadOnly access
[ ] 1Password: has access to SRE vault
[ ] Statuspage: can view current status (SRE members: can also edit)
[ ] Slack: added to #incidents, #on-call-handoff, #alerts, #sre-team

PRACTICAL DRILLS (with senior SRE observer)
[ ] Simulated alert triage: given a PagerDuty alert, correctly triaged severity
[ ] Runbook execution: followed grid telemetry blackout runbook (in staging)
[ ] Incident creation: created a test incident via OpsBot, populated required fields
[ ] Post-mortem: reviewed format, asked clarifying questions

SHADOWING
[ ] Shadowed Platform on-call for at least 1 week
[ ] Shadowed Application on-call for at least 1 week (or completed orientation with Application team lead)

SIGN-OFF
[ ] Engineer sign-off
[ ] Manager sign-off  
[ ] Marcus Webb or SRE Lead sign-off
```

---

## 10. Historical Context: Why We Changed the Rotation

*Written by Marcus Webb, Q3 2024*

When Helios launched in 2020, we had about 15 engineers total and everyone was on a single on-call rotation. It made sense then — everyone kind of knew the whole system.

By 2022, we had grown to ~40 engineers and the rotation was still a single pool. The problem was that engineers were getting pages they had no context to resolve. I remember one incident where a frontend engineer got paged at 2am for a Kafka partition reassignment and spent 3 hours trying to understand what was happening instead of just escalating to someone who knew the system. That was a 3-hour SEV-2 that should have been 30 minutes.

In 2023 we tried splitting into "infra" and "services" tracks but the split wasn't clean — outage detection had elements of both. We also had a period (Q2 2023) where we were getting 15+ pages per week per engineer because we hadn't tuned our alert thresholds properly after the v3.0 release added a bunch of new metrics. Three engineers resigned that year and two cited on-call fatigue as a contributing factor. That was a wake-up call.

The current two-track model (Platform + Application) was designed over the summer of 2024. We spent four weeks auditing every alert and mapping it to the team best positioned to respond. We also got much more aggressive about alert tuning — if an alert doesn't drive action, it doesn't page.

It's not perfect. The Application track still has too many engineers sharing the pool, so the frequency is too high. We're actively recruiting to fix that. But the vibe in the team is much better.

If you're reading this as a new engineer: we take on-call seriously but we also take on-call health seriously. If your on-call experience is bad — too many pages, pages for things outside your expertise, unclear runbooks — please say something. We track it. We act on it.

---

*Questions about on-call: `#sre-team` or ping Marcus Webb directly.*
*PagerDuty administration: Priya Nair (Platform) or Tanvir Rahman (Application).*
