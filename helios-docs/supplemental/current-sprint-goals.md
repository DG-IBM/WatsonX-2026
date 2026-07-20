# Current Sprint Goals

**Sprint:** Helios Sprint 89
**Dates:** 2024-11-11 – 2024-11-22
**Sprint Planning Date:** 2024-11-11
**Sprint Review/Retro:** 2024-11-22 @ 14:00 UTC

**Document maintained in:** Jira (Board: HELIOS Sprint Board) + this reference doc for onboarding context.
**Related Docs:** [Product Roadmap](/supplemental/product-roadmap.md) · [Technical Debt Register](/05-engineering/technical-debt-register.md) · [Known Issues](/05-engineering/known-issues.md) · [Team Structure](/07-onboarding/team-structure.md)

---

> **Kwame Asante (Sprint 89 opening note, 2024-11-11):** This sprint is a bit unusual because we're running two parallel tracks: the v4.7 feature work (Adaptive Forecasting Thresholds — the main commitment to TransnetBW) and a tech debt sprint for Platform Engineering, focused on the dispatch Node.js migration foundation. We've been promising ourselves the tech debt sprint for two quarters. This one is happening.
>
> **Tanvir Rahman:** Platform team is focusing almost entirely on TD-002 (dispatch Node.js 16 → 20 migration) this sprint. We've been blocked on this because the dispatch service codebase needs significant refactoring before we can safely upgrade. Leon and Nkechi are leading it. Goal by end of sprint: staging environment running on Node 20, zero regressions.

---

## Sprint 89 Goals Summary

| Team | Primary Goal | Secondary Goal |
|------|-------------|---------------|
| Grid Intelligence | Adaptive Forecasting Thresholds v1 (TransnetBW) | Outage confidence score UI |
| Platform Engineering | Dispatch service Node 20 migration (staging) | mTLS rollout: 2 more service pairs |
| Customer Experience | Mobile offline mode fixes (v4.6.1 bugs) | Notification retry logic improvements |
| AI/Data Engineering | Forecasting model seasonal recalibration (October drift) | Redshift dbt CI pipeline hardening |

---

## Grid Intelligence Sprint 89 Commitments

**Scrum Lead:** Chidi Eze
**Standup:** Daily, 09:30 UTC, `#grid-intelligence-standup`

### Epic: Adaptive Forecasting Thresholds (HELIOS-1943)
*Committed — delivery for TransnetBW Nov 30 demo*

Adaptive thresholds allow customers to configure alert thresholds for demand forecast deviations that adjust based on time-of-day and seasonal patterns. Currently thresholds are static per customer, leading to noisy alerts during peak periods and missed alerts during off-peak.

| Ticket | Description | Assignee | Points | Status |
|--------|-------------|----------|--------|--------|
| HELIOS-2001 | API: `PUT /v3/forecasting/thresholds/adaptive` endpoint | Farah Okonkwo | 5 | In Progress |
| HELIOS-2002 | Backend: Threshold calculation engine (per hour-of-week) | Yuki Nakamura | 8 | In Progress |
| HELIOS-2003 | DB migration: adaptive_thresholds table | Chidi Eze | 3 | Done |
| HELIOS-2004 | Portal UI: Threshold configuration screen | Mateus Costa | 8 | In Progress |
| HELIOS-2005 | Portal UI: Forecast chart with dynamic threshold bands | Mateus Costa | 5 | Not Started |
| HELIOS-2006 | Integration tests: adaptive threshold triggers | Ami Tanaka | 3 | Not Started |
| HELIOS-2007 | Docs: Customer-facing API docs for threshold config | Farah Okonkwo | 2 | Not Started |

**Risk:** HELIOS-2002 (threshold calculation engine) is more complex than initially estimated — Yuki flagged on Day 2 that the per-hour-of-week calculation needs to account for DST transitions. Added 2 points. Chidi is monitoring.

### Epic: Outage Confidence Score UI (HELIOS-1887)
*Stretch goal — carry from Sprint 88*

Display a confidence score alongside each detected outage (0–100%) to help operators distinguish high-confidence outages (likely real) from low-confidence ones (might be sensor noise).

| Ticket | Description | Assignee | Points | Status |
|--------|-------------|----------|--------|--------|
| HELIOS-1887-1 | API: confidence_score field in outage response | Farah Okonkwo | 2 | Done (Sprint 88) |
| HELIOS-1887-2 | Portal: confidence badge on outage list | Mateus Costa | 3 | In Progress |
| HELIOS-1887-3 | Portal: confidence explanation tooltip | Clara Dupont | 2 | Not Started |

---

## Platform Engineering Sprint 89 Commitments

**Scrum Lead:** Tanvir Rahman
**Standup:** Daily, 10:00 UTC, `#platform-standup`

### Epic: Dispatch Service Node 20 Migration — Phase 1 (HELIOS-TD-002)
*High priority — linked to Technical Debt TD-002 and Security finding SEC-HIGH-002*

The dispatch service currently runs Node.js 16 (EOL since April 2024). This migration is the first phase: assess, refactor breaking dependencies, and get the service running on Node 20 in staging.

| Ticket | Description | Assignee | Points | Status |
|--------|-------------|----------|--------|--------|
| INFRA-3001 | Audit: document all Node 16-specific dependencies | Leon Brandt | 3 | Done |
| INFRA-3002 | Upgrade: `express` 4 → 5, `sequelize` 6 → 7 | Leon Brandt | 8 | In Progress |
| INFRA-3003 | Upgrade: `node-rdkafka` 2.x → compatible 3.x | Nkechi Uzoma | 5 | In Progress |
| INFRA-3004 | Update Dockerfile: `node:16` → `node:20-alpine` | Nkechi Uzoma | 2 | Not Started |
| INFRA-3005 | Run full dispatch test suite on Node 20 | Leon Brandt | 3 | Not Started |
| INFRA-3006 | Deploy to staging; smoke test dispatch flow end-to-end | Leon Brandt + Nkechi | 3 | Not Started |
| INFRA-3007 | Performance comparison: Node 16 vs 20 memory profiles | Leon Brandt | 2 | Not Started |

**Dependency:** INFRA-3002 and INFRA-3003 are on the critical path. Both are discovered to be more complex than estimated. Tanvir has buffer in the sprint if needed.

**Out of scope for this sprint:** Production deployment (Phase 2, Sprint 90) and the memory leak investigation (Phase 3).

### Epic: mTLS Rollout — Service Pairs 3 & 4 (HELIOS-SEC-003)
*Continuing from Sprint 88 — 2 more service pairs this sprint*

Expanding Istio mTLS to additional service pairs. Previously: grid-event-processor ↔ outage-detection (done Sprint 86), forecasting-engine ↔ grid-api (done Sprint 87). This sprint: iot-ingest ↔ grid-event-processor, and grid-api ↔ dispatch-service.

| Ticket | Description | Assignee | Points | Status |
|--------|-------------|----------|--------|--------|
| INFRA-2998 | Istio PeerAuthentication policy: iot-ingest ↔ grid-event-proc | Rosa Lindqvist | 3 | In Progress |
| INFRA-2999 | Istio PeerAuthentication: grid-api ↔ dispatch-service | Rosa Lindqvist | 3 | Not Started |
| INFRA-3000 | Staging validation + performance test (mTLS overhead) | Deepak Mehta | 2 | Not Started |

---

## Customer Experience Sprint 89 Commitments

**Scrum Lead:** Tanvir Rahman (interim)
**Standup:** Daily, 10:30 UTC, `#cx-standup`

### Mobile Offline Mode Bug Fixes (HELIOS-4.6.1)

Following the v4.6 release of offline mode, two bugs were reported from the NW Grid UK pilot:

| Ticket | Bug | Assignee | Priority |
|--------|-----|----------|---------|
| HELIOS-2015 | Photo sync fails silently when >80 photos queued | Ami Tanaka | High |
| HELIOS-2016 | "Conflict" notification UI is confusing — needs copy revision | Kezia Mwangi | Medium |
| HELIOS-2017 | Samsung A34: SQLite migration on first launch crashes app | Ami Tanaka | High |

HELIOS-2015 and HELIOS-2017 are blocking the wider rollout of offline mode to remaining customers. Target: fix and ship v4.6.1 by Nov 18.

### Notification Retry Logic (HELIOS-1977)

Current notification delivery has no retry on transient failure — if Twilio returns a 5xx, the notification is lost. This is a known issue (KI-007 in [Known Issues](/05-engineering/known-issues.md)).

| Ticket | Description | Assignee | Points |
|--------|-------------|----------|--------|
| HELIOS-1977-1 | Add exponential backoff retry to notification service | Yuki Nakamura | 5 |
| HELIOS-1977-2 | Dead-letter notifications to Kafka DLQ after 3 retries | Yuki Nakamura | 3 |
| HELIOS-1977-3 | Grafana panel: notification delivery success rate | Marcus Webb | 2 |

---

## AI/Data Engineering Sprint 89 Commitments

**Lead:** Lin Chen
**Standup:** Mon/Wed/Fri 11:00 UTC, `#ai-data-standup`

### Forecasting Model Seasonal Recalibration

The October forecast accuracy degradation (flagged in Sprint 88 via `forecast_mae_hourly > 180` alert) needs a model retrain with updated seasonal features. This is expected every autumn transition.

| Ticket | Description | Assignee |
|--------|-------------|----------|
| AI-445 | Retrain TFT + XGBoost with Oct–Nov 2024 data included | Lin Chen |
| AI-446 | Validate new model: MAE comparison on holdout set | Ravi Krishnan |
| AI-447 | Champion/challenger evaluation: 72-hour parallel run in staging | Lin Chen |
| AI-448 | If challenger wins: promote to production | Lin Chen |

**Decision gate:** Lin Chen will make the go/no-go call on model promotion by Nov 19 based on holdout MAE.

### dbt CI Pipeline Hardening (INFRA-2790)

The known issue where dbt run failures don't alert on-call is being fixed this sprint.

| Ticket | Description | Assignee |
|--------|-------------|----------|
| INFRA-2790 | Add PagerDuty alerting for dbt run failures | Ravi Krishnan |

---

## Sprint 89 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Node upgrade blockers discovered mid-sprint (INFRA-3002/3003) | High | Medium | Tanvir has buffer capacity identified; Leon+Nkechi have explicit unblock path |
| TransnetBW deadline (Nov 30) tight for adaptive thresholds | Medium | High | Chidi monitoring daily; escalation path to Meera if needed |
| Seasonal model retrain takes longer than expected | Low | Low | Model retraining is well-understood; 5-day buffer |
| mTLS rollout causes latency regression | Low | High | Staging validation includes performance testing before prod |

---

## Sprint 89 Definition of Done

A ticket is "Done" when:
- [ ] Code merged to `develop` (or `main` for hotfixes)
- [ ] Unit tests written and passing
- [ ] Deployed to staging
- [ ] Smoke tested by someone other than the author
- [ ] Relevant documentation updated (if applicable)
- [ ] Acceptance criteria from Jira ticket checked off

---

*Sprint board: [Jira HELIOS Sprint 89](https://lumina-jira.atlassian.net/boards/helios-sprint-89)*
*Sprint questions: `#sprint-planning` Slack or your team scrum lead.*
