# Technical Debt Register — Helios

> **Location:** Confluence → Helios Engineering Space → Engineering → Technical Debt Register  
> **Owner:** David Okafor (Principal Engineer) · @david.okafor  
> **Co-maintained:** Team Leads  
> **Last Updated:** 2024-11-01  
> **Status:** Living document — reviewed quarterly  
> **Related:** [Known Issues](/05-engineering/known-issues.md) · [Performance Bottlenecks](/05-engineering/performance-bottlenecks.md) · [ADRs](/05-engineering/adrs.md) · [Product Roadmap](/supplemental/product-roadmap.md)

---

> *"Technical debt is not inherently bad. Debt taken on consciously to hit a deadline, with a repayment plan, is a business tool. Debt accumulated accidentally, without awareness, is a liability. This document tracks both — but the distinction matters."*

---

## Debt Classification

| Priority | Description |
|---|---|
| **P1 — Critical** | Actively harming reliability, security, or compliance. Must be fixed this quarter. |
| **P2 — High** | Causes regular pain, limits scale, or poses medium-term risk. In the roadmap within 6 months. |
| **P3 — Medium** | Causes inefficiency or maintenance burden. Planned but not urgent. |
| **P4 — Low** | Known warts. Tracked for awareness. Fix opportunistically. |

---

## Active Debt Items

---

### TD-001: Dispatch Service on Node.js 16
**ID:** TD-001  
**Priority:** P1  
**Status:** In remediation  
**Owner:** @raj.patel  
**Introduced:** v3.0 (2023-01)  
**Estimated remediation effort:** 3 weeks  
**Target:** Sprint 91 (Q1 2025)

**Description:**  
`helios-dispatch` runs on Node.js 16, which reached End-of-Life in October 2023. Node.js 16 no longer receives security patches. This is an active security risk.

**Root cause:**  
The `offline-sync-protocol` package (used for the mobile app WatermelonDB sync endpoint) has a native dependency on `better-sqlite3` compiled with `node-gyp`. The build fails on Node.js 18+ with the current version of `better-sqlite3` and the build toolchain in the Docker image.

**Remediation plan:**  
1. Replace `offline-sync-protocol` with a custom WatermelonDB-compatible sync endpoint built in-house (the library was doing very little beyond what we need)
2. Upgrade `better-sqlite3` to a version with Node.js 18 pre-built binaries
3. Upgrade Node.js to 20 LTS
4. Run full offline sync regression test suite (maintained in `helios-dispatch/tests/offline/`)

**Impact of delay:**  
Node.js 16 receives no security patches. A CVE in Node.js 16's HTTP or TLS layer could expose the dispatch service. Trivy scans are flagging this service as HIGH severity in every CI run.

---

### TD-002: GDPR Data Residency Gap (EU Customer Data in US-East)
**ID:** TD-002  
**Priority:** P1  
**Status:** In scoping  
**Owner:** @helena.muller (Compliance), @lin.chen (Data)  
**Introduced:** v2.0 (2022) — EU customers added before data residency architecture was designed  
**Estimated remediation effort:** 6–8 engineer-weeks  
**Target:** Q1 2025

**Description:**  
EU customer data (Oresund Grid, Demark) is processed through the `us-east-1` analytics pipeline (Redshift, EMR Spark jobs). Under GDPR Article 44–46, transferring personal data from the EU to a third country requires either an adequacy decision or appropriate safeguards (SCCs). Our DPA with Oresund Grid includes SCCs, but our infra architecture does not comply with our stated data processing terms.

**Specifically:**
- Meter readings for EU customers are written to `s3://helios-data-lake-prod` in `us-east-1`
- Spark batch jobs in `us-east-1` process EU customer data
- Redshift analytics in `us-east-1` stores EU customer aggregates

**Remediation plan:**  
1. Deploy Redshift and EMR in `eu-west-1`
2. Configure S3 bucket replication policies to ensure EU tenant data writes to `eu-west-1` only
3. Update data pipeline configuration to route EU tenant processing to EU region
4. Audit and confirm no EU PII crosses to `us-east-1` 
5. Update DPA with Oresund Grid to reflect compliant architecture

**Risk of non-remediation:**  
GDPR enforcement action. Maximum fine: 4% of global annual turnover. Reputational damage. Potential contract termination with Oresund Grid.

---

### TD-003: IoT Bridge Single-Region
**ID:** TD-003  
**Priority:** P2 (elevated from P3 in Q3 2024 after MSK incident)  
**Status:** Planned  
**Owner:** @lars.eriksson  
**Introduced:** Initial architecture (2022) — never multi-region  
**Estimated remediation effort:** 4–6 engineer-weeks  
**Target:** Q2 2025

**Description:**  
EMQX and `helios-iot-bridge` run only in `us-east-1`. A `us-east-1` failure stops all IoT telemetry ingestion. See [ADR-009](/05-engineering/adrs.md#adr-009) for the original decision context.

The MSK replication incident in Q3 2024 (see [INC-2024-047](/06-operations/incident-response-runbook.md#inc-2024-047)) demonstrated that `us-east-1` degradation events do happen and their impact on Helios is significant. This elevated the priority.

**Remediation plan:**  
Multi-region active-passive EMQX:
- EMQX cluster in `us-east-1` (primary) + `eu-west-1` (standby)
- Route 53 health-check-based MQTT endpoint failover (target: 30s failover)
- Kafka MirrorMaker2 to replicate `iot.*` topics from primary to standby MSK
- IoT bridge deployed in both regions; standby runs in passive mode until DNS failover

---

### TD-004: GIS Asset Sync Is Nightly Batch Only
**ID:** TD-004  
**Priority:** P2  
**Status:** Roadmap  
**Owner:** @alejandro.reyes  
**Introduced:** v1.0 — real-time sync was never implemented  
**Estimated remediation effort:** 8–12 engineer-weeks  
**Target:** Q3 2025

**Description:**  
GIS asset data (grid topology) is synchronized from utility SCADA systems via nightly batch. Assets installed or modified during the day are invisible to outage detection topology traversal and the portal map until the next morning.

This causes approximately 8% of outage records to be `UNLOCALIZED` due to topology gaps from new assets not yet synchronized. It also means the portal map may show incorrect asset states during the first day after a topology change.

**Remediation plan:**  
- Design a real-time change notification interface for SCADA GIS systems (complex because the 11 different source formats have different event/change notification mechanisms)
- Implement per-vendor change adapters (ESRI webhook, GML change feed, etc.)
- Fall back to hourly delta sync for vendors without real-time notification

---

### TD-005: Redux Legacy in Frontend (3 Slices Not Migrated)
**ID:** TD-005  
**Priority:** P3  
**Status:** Opportunistic  
**Owner:** @ana.lima  
**Introduced:** v1.0 — migrated to Zustand in v3.2 but 3 slices were missed  
**Estimated remediation effort:** 3–5 days  
**Target:** Opportunistic — next time we touch those components

**Description:**  
Three Redux slices in `helios-portal` were not migrated to Zustand when we did the Zustand migration ([ADR-006](/05-engineering/adrs.md#adr-006)):
- `userPreferencesSlice` (alerts panel column config, map layer visibility)
- `reportingFiltersSlice` (compliance report filter state)
- `tenantSettingsSlice` (tenant configuration cache in UI)

These work correctly but having two state management libraries in the same app is confusing for new portal engineers.

---

### TD-006: Grid Monitor Alert Rule Evaluator Legacy Shim
**ID:** TD-006  
**Priority:** P3  
**Status:** Planned  
**Owner:** @david.okafor  
**Introduced:** v3.0 — the Go rewrite of grid-monitor had edge cases not ported from Node.js  
**Estimated remediation effort:** 1 week  
**Target:** Q2 2025

**Description:**  
When the grid monitor was rewritten in Go (v3.0, [ADR-001](/05-engineering/adrs.md#adr-001)), 12 edge cases in the alert rule evaluator were not ported because they were complex and poorly documented. A compatibility shim was added: for readings that match these edge cases, the Go service makes an internal HTTP call to a tiny Node.js Lambda function (`helios-alert-compat-lambda`) that contains the original logic.

This Lambda costs ~$12/month and adds ~80ms to alert evaluation for the ~0.3% of readings that hit these edge cases. More importantly, it's an operational dependency that new engineers don't know about and that isn't monitored well.

The edge cases are now documented in `helios-grid-monitor/docs/alert-edge-cases.md`. The remediation is to port them to Go properly.

---

### TD-007: Missing ADR for Customer Portal Deployment Architecture
**ID:** TD-007  
**Priority:** P4  
**Status:** Documentation debt  
**Owner:** @sofia.marchetti  
**Introduced:** v2.0 — decision made under pressure without ADR  
**Estimated remediation effort:** 2 hours  
**Target:** Next documentation sprint

**Description:**  
The decision to build the Customer Portal as a Vite SPA rather than Next.js was made during a product spike in v2.0. It was the right decision (utility companies need a static deployable) but it was never recorded as an ADR. New engineers and interviewees occasionally ask why the Customer Portal isn't Next.js like the Grid Ops Portal, and there's no authoritative written answer.

**Remediation:** Write ADR-011 documenting the decision and rationale. Assign to @sofia.marchetti.

---

### TD-008: No Automated DR Failover
**ID:** TD-008  
**Priority:** P2  
**Status:** Planned  
**Owner:** @marcus.webb  
**Introduced:** DR cluster was built as manual-only from inception  
**Estimated remediation effort:** 6–8 engineer-weeks  
**Target:** Q2 2025

**Description:**  
The DR failover from `us-east-1` to `eu-west-1` requires 15–25 minutes of manual steps (see [Disaster Recovery Plan](/06-operations/disaster-recovery-plan.md#regional-failover)). This violates our contractual RTO of 30 minutes for Midwest Grid Co. (at scale, manual steps under stress regularly exceed 25 minutes).

**Remediation plan:**  
- Implement automated DNS failover via Route 53 health checks (2 minutes)
- Automate EKS service scale-up in DR region via Lambda + CloudWatch Events
- Automate RDS promotion via Aurora Global Database (replacing cross-region read replica)
- Automate Kafka failover via MirrorMaker2 source-of-truth switching
- End-to-end failover target: < 5 minutes with zero manual steps

---

### TD-009: APAC Cluster in Wrong AWS Account
**ID:** TD-009  
**Priority:** P3  
**Status:** Planned  
**Owner:** @tom.reeves  
**Introduced:** v4.0 — APAC was added quickly to an existing account to hit a customer deadline  
**Estimated remediation effort:** 2–3 weeks  
**Target:** Q3 2025

**Description:**  
The APAC production cluster runs in the `helios-dev` AWS account rather than a dedicated `helios-apac` account. This means:
- APAC prod IAM roles are in the same account as dev resources
- Cost allocation is mixed (APAC costs appear under dev)
- SCPs applied to the dev account (permissive for development) apply to APAC prod
- Audit trail for APAC prod actions is mixed with dev activity

**Remediation plan:**  
Create a dedicated `helios-apac` AWS account, migrate the APAC EKS cluster and all associated resources (RDS, MSK, ElastiCache) to the new account. This is a significant infrastructure migration requiring a maintenance window.

---

### TD-010: Redshift Analytics Not Available for APAC Tenants
**ID:** TD-010  
**Priority:** P3  
**Status:** Planned (customer-driven)  
**Owner:** @preethi.subramaniam  
**Introduced:** APAC was launched before analytics infrastructure was extended  
**Estimated remediation effort:** 3–4 weeks  
**Target:** Q3 2025

**Description:**  
TasNetworks (our only APAC tenant) cannot access the Analytics Platform (historical analysis, BI dashboards). The Redshift cluster runs only in `us-east-1`. APAC tenant data must remain in `ap-southeast-2` for regulatory compliance. This is a product gap that TasNetworks has flagged.

---

## Paying Down Debt

### Debt Sprint Policy

Every even-numbered sprint includes a "Debt Sprint Day" — one day where engineers work only on technical debt items, no new features. This was introduced in Sprint 60 and has resulted in:
- TD-005 (partial): 2 of 3 Redux slices migrated during Debt Sprint Days
- TD-007: ADR written
- Several TD-004 sub-tasks completed

This is not a substitute for allocating proper sprint capacity to P1 and P2 debt items. Those require full sprint planning commitment.

### How to Add a New Debt Item

1. Fill out the standard template above
2. Assign a priority (be honest — P2 inflation makes the list useless)
3. Assign an owner (debt without an owner never gets paid)
4. Estimate effort (rough is fine: days, not hours)
5. Open a PR to this document
6. Create a Jira epic in the relevant project with tag `technical-debt`

---

*Document maintained by @david.okafor*  
*Quarterly review: first sprint of each quarter with team leads*  
*Related: [Known Issues](/05-engineering/known-issues.md) · [Performance Bottlenecks](/05-engineering/performance-bottlenecks.md) · [Product Roadmap](/supplemental/product-roadmap.md)*
