# Helios — Smart Energy Grid Management Platform

> **Internal Engineering Knowledge Base**
> Maintained by the Helios Platform Engineering team · Last substantive edit: 2024-11-14 · Owner: @priya.nair (Staff Eng, Platform)

---

## What Is This Repository?

This is the **living engineering knowledge base** for the Helios platform. It is not a polished marketing site. It is the collection of documents, decisions, runbooks, architecture diagrams, and institutional memory that keeps 70-odd engineers aligned across six teams.

If you're a new engineer, start at [`/07-onboarding/new-engineer-first-week.md`](/07-onboarding/new-engineer-first-week.md). If you got paged at 2 AM, jump to [`/06-operations/incident-response-runbook.md`](/06-operations/incident-response-runbook.md). If you're trying to understand why we made a particular technology choice, look in [`/05-engineering/adrs.md`](/05-engineering/adrs.md).

These docs live in Confluence under the **Helios Engineering Space**, are mirrored to the `helios-docs` GitHub repository, and are indexed by the internal AI onboarding assistant **Beacon** (see [`/07-onboarding/faq.md#what-is-beacon`](/07-onboarding/faq.md)).

---

## Project At a Glance

| Field | Value |
|---|---|
| **Product Name** | Helios |
| **Company** | Lumina Energy |
| **Domain** | Enterprise Smart Grid Management |
| **Current Version** | 4.7.1 |
| **Production Region** | `us-east-1` (primary), `eu-west-1` (DR), `ap-southeast-2` (APAC) |
| **Launch Date** | Q1 2021 |
| **Engineering Team Size** | ~70 engineers across 6 teams |
| **Primary Tech** | Next.js · Node.js · Go · PostgreSQL · Redis · Kafka · Kubernetes · AWS |
| **SLA Target** | 99.95% uptime (grid monitoring subsystem: 99.99%) |
| **On-call** | PagerDuty — [rotation schedule](/06-operations/on-call-rotation-guide.md) |

---

## What Helios Does

Helios is deployed by national and regional utility companies to operate their electrical grid infrastructure. It is a horizontally scaled, event-driven platform that ingests telemetry from tens of millions of IoT devices (smart meters, substation sensors, SCADA adapters), applies AI-driven demand forecasting, detects faults and outages in near-real-time, and dispatches field technicians through a mobile workflow system.

The platform has **three primary user surfaces**:

1. **Grid Operations Portal** — a Next.js web app used by grid operators and control room staff to monitor the live grid state, manage incidents, and approve AI recommendations.
2. **Customer Portal** — a React SPA (separately deployed, shared component library) used by end consumers of utility companies to view energy usage, manage billing, and enroll in demand-response programs.
3. **Mobile Technician App** — a React Native app (separate repo: `helios-tech-mobile`) used by field engineers for work-order management, on-site diagnostics, and photographic documentation.

There are also internal tooling surfaces: the **Data Platform Dashboard**, the **Compliance Reporting UI**, and the **AI Model Management Console** (`helios-model-ops`).

---

## Repository Map

```
helios-docs/
│
├── README.md                          ← you are here
│
├── 01-company/
│   ├── product-vision.md              Product vision, north star metrics, stakeholder alignment
│   ├── business-context.md            Market context, customer types, revenue model, contracts
│   └── engineering-directory.md       Who's who, org chart, Slack handles, time zones
│
├── 02-architecture/
│   ├── system-overview.md             End-to-end narrative of how the platform fits together
│   ├── high-level-architecture.md     Diagrams, component boundaries, external dependencies
│   ├── frontend-architecture.md       Next.js portal, React patterns, state management
│   ├── backend-architecture.md        Node.js API layer, GraphQL gateway, service contracts
│   ├── microservices-overview.md      Service catalog, owners, ports, health endpoints
│   ├── event-driven-architecture.md   Kafka topology, topic naming, consumer groups, ordering guarantees
│   └── database-architecture.md       PostgreSQL schemas, Redis usage, migration strategy
│
├── 03-services/
│   ├── grid-monitoring-service.md     Real-time telemetry ingestion, state machine, alerting
│   ├── ai-forecasting-engine.md       Demand forecasting models, training pipeline, model serving
│   ├── outage-detection-service.md    Fault detection algorithm, topology traversal, isolation logic
│   ├── technician-dispatch-system.md  Work order lifecycle, routing, mobile sync
│   ├── customer-portal.md             Customer-facing features, billing integration, demand response
│   ├── notification-platform.md       Email, SMS, push, in-app — routing rules and templates
│   ├── gis-mapping-service.md         Geospatial data model, MapLibre integration, asset layers
│   └── iot-device-management.md       Device registry, provisioning, firmware OTA, MQTT bridge
│
├── 04-platform/
│   ├── infrastructure-overview.md     High-level AWS + Kubernetes topology
│   ├── aws-architecture.md            Account structure, VPC design, IAM, S3, RDS, MSK, EKS
│   ├── kubernetes-guide.md            Cluster topology, namespaces, Helm charts, GitOps with Flux
│   ├── ci-cd-pipeline.md              GitHub Actions workflows, staging promotion, release gates
│   ├── monitoring-observability.md    Prometheus, Grafana, Jaeger, OpenTelemetry setup
│   ├── logging-standards.md           Structured logging, Loki, retention policy, PII scrubbing
│   └── alerting-strategy.md           Alert taxonomy, PagerDuty routing, runbook links
│
├── 05-engineering/
│   ├── coding-standards.md            Language-specific standards: TS, Go, SQL, naming conventions
│   ├── git-workflow.md                Branching strategy, PR process, commit conventions
│   ├── api-standards.md               REST conventions, GraphQL schema governance, versioning
│   ├── authentication.md              OAuth2, JWTs, Cognito integration, SSO
│   ├── authorization.md               RBAC model, OPA policies, enforcement points
│   ├── user-roles-permissions.md      Role definitions, permission matrix, edge cases
│   ├── adrs.md                        Architecture Decision Records (ADR-001 through ADR-010)
│   ├── technical-debt-register.md     Known debt, owners, estimated cost, remediation plans
│   ├── performance-bottlenecks.md     Profiled hotspots, query analysis, mitigation notes
│   └── known-issues.md                Active bugs, known workarounds, do-not-touch list
│
├── 06-operations/
│   ├── incident-response-runbook.md   Severity taxonomy, communication templates, escalation
│   ├── disaster-recovery-plan.md      RPO/RTO targets, runbooks, cross-region failover
│   ├── on-call-rotation-guide.md      Rotation schedule, tooling, escalation paths
│   ├── security-architecture.md       Threat model, network segmentation, secrets management
│   └── compliance-regulatory.md       NERC CIP, SOC 2, GDPR, audit evidence collection
│
└── 07-onboarding/
    ├── new-engineer-first-week.md     Day-by-day guide: access, reading, first tasks
    ├── faq.md                         200+ questions answered honestly
    ├── glossary.md                    Domain and platform terminology
    ├── team-structure.md              Team charters, missions, Jira project keys
    └── ownership-matrix.md            Service → team → primary contact mapping
│
└── supplemental/
    ├── data-pipeline.md               Batch ingestion, Spark jobs, S3 data lake structure
    ├── analytics-platform.md          Redshift, dbt models, Metabase dashboards
    ├── deployment-guide.md            Step-by-step deployment procedures per service
    ├── feature-specifications.md      Selected feature specs (demand response, outage notify v2)
    ├── current-sprint-goals.md        Sprint 89 goals, blockers, in-flight work
    ├── product-roadmap.md             Q1 2025 – Q4 2025 roadmap (approved by board)
    ├── release-notes.md               Releases v4.0 through v4.7.1
    └── project-timeline-history.md    Year-by-year history from inception to today
```

---

## Quick Navigation by Role

### I'm a new engineer
→ Start at [`/07-onboarding/new-engineer-first-week.md`](/07-onboarding/new-engineer-first-week.md)  
→ Then read [`/07-onboarding/glossary.md`](/07-onboarding/glossary.md)  
→ Check your team's entry in [`/07-onboarding/team-structure.md`](/07-onboarding/team-structure.md)

### I need to understand the system architecture
→ [`/02-architecture/system-overview.md`](/02-architecture/system-overview.md) — narrative walk-through  
→ [`/02-architecture/high-level-architecture.md`](/02-architecture/high-level-architecture.md) — diagrams  
→ [`/02-architecture/microservices-overview.md`](/02-architecture/microservices-overview.md) — service catalog

### I got paged / there's an incident
→ [`/06-operations/incident-response-runbook.md`](/06-operations/incident-response-runbook.md)  
→ [`/06-operations/on-call-rotation-guide.md`](/06-operations/on-call-rotation-guide.md)  
→ Grafana: `https://grafana.internal.luminaenergy.com`  
→ PagerDuty: `https://lumina.pagerduty.com`

### I'm working on a specific service
→ [`/03-services/`](/03-services/) — each service has its own doc  
→ [`/07-onboarding/ownership-matrix.md`](/07-onboarding/ownership-matrix.md) — find who owns it

### I want to understand why we built it this way
→ [`/05-engineering/adrs.md`](/05-engineering/adrs.md) — Architecture Decision Records  
→ [`/supplemental/project-timeline-history.md`](/supplemental/project-timeline-history.md) — historical context

### I'm deploying something
→ [`/supplemental/deployment-guide.md`](/supplemental/deployment-guide.md)  
→ [`/04-platform/ci-cd-pipeline.md`](/04-platform/ci-cd-pipeline.md)  
→ [`/04-platform/kubernetes-guide.md`](/04-platform/kubernetes-guide.md)

---

## Core Repositories

> All repos live in the `lumina-energy` GitHub organization.

| Repository | Description | Team Owner |
|---|---|---|
| `helios-portal` | Next.js Grid Operations Portal | Grid UI |
| `helios-api-gateway` | GraphQL + REST API gateway (Node.js) | Platform |
| `helios-grid-monitor` | Real-time grid state service (Go) | Grid Intelligence |
| `helios-forecasting` | AI demand forecasting engine (Python/Go) | Data & AI |
| `helios-outage-detect` | Fault detection and isolation service (Go) | Grid Intelligence |
| `helios-iot-bridge` | MQTT → Kafka IoT bridge (Go) | IoT & Devices |
| `helios-dispatch` | Technician work order system (Node.js) | Field Ops |
| `helios-customer-portal` | Customer-facing React SPA | Customer Experience |
| `helios-notify` | Multi-channel notification service (Node.js) | Platform |
| `helios-gis` | GIS mapping and asset layer service (Go) | GIS & Mapping |
| `helios-data-pipeline` | Spark batch pipelines and dbt models | Data & AI |
| `helios-infra` | Terraform, Helm charts, Flux GitOps config | Platform Infra |
| `helios-docs` | This repository | All teams |
| `helios-tech-mobile` | React Native technician mobile app | Field Ops |
| `helios-model-ops` | MLflow, model registry, training pipelines | Data & AI |
| `helios-compliance` | Regulatory reporting and audit tooling | Platform |

---

## Technology Stack Summary

### Frontend
- **Next.js 14** (App Router) — Grid Operations Portal
- **React 18** — shared component library (`@helios/ui`)
- **TypeScript** — mandatory across all front-end code
- **Zustand** — global state management (replaced Redux in v3.2, see [ADR-006](/05-engineering/adrs.md#adr-006))
- **TanStack Query** — server-state and cache management
- **MapLibre GL JS** — GIS mapping (replaced Google Maps in v2.4, see [ADR-004](/05-engineering/adrs.md#adr-004))
- **Recharts** — time-series charts in the grid dashboard

### Backend
- **Node.js 20 LTS** — API gateway, notification service, dispatch service
- **Go 1.22** — grid monitoring, IoT bridge, outage detection, GIS service (performance-critical paths)
- **Python 3.11** — AI/ML training, data pipeline, model serving helpers
- **GraphQL (Apollo Server 4)** — primary client-facing API
- **REST** — internal service-to-service, IoT device registration, third-party integrations

### Data
- **PostgreSQL 15** — primary relational store (RDS Multi-AZ)
- **Redis 7** — caching, session store, real-time pub/sub for grid state
- **Apache Kafka 3.5** (AWS MSK) — event streaming backbone
- **Amazon S3** — data lake, model artifacts, audit logs
- **Amazon Redshift** — analytics warehouse
- **TimescaleDB** (PostgreSQL extension) — meter time-series data (`helios-ts` RDS cluster)

### Infrastructure
- **AWS** — primary cloud provider (us-east-1 primary)
- **Kubernetes 1.29** (EKS) — container orchestration
- **Helm 3** — Kubernetes package management
- **Flux v2** — GitOps continuous deployment
- **Terraform 1.7** — infrastructure-as-code
- **GitHub Actions** — CI/CD pipelines
- **PagerDuty** — on-call alerting
- **Prometheus + Grafana** — metrics and dashboards
- **Loki** — log aggregation
- **Jaeger** — distributed tracing
- **Vault (HashiCorp)** — secrets management

---

## Key Metrics (as of Q4 2024)

| Metric | Value |
|---|---|
| Smart meters managed | ~42 million |
| IoT telemetry events/sec (peak) | ~380,000 |
| API requests/day | ~1.4 billion |
| Forecasting model inference/day | ~8 million |
| Utility company customers | 14 |
| Countries deployed | 6 |
| P99 API response time | 94ms |
| Grid monitoring latency (meter → alert) | < 4 seconds |
| Uptime (trailing 12 months) | 99.961% |

---

## Principles We Actually Follow

These aren't from a poster on the wall. They're things that have been hard-won from incidents, post-mortems, and architecture reviews over four years.

1. **Grid data is safety-critical.** A wrong reading that causes a missed outage is worse than a missed reading. We prefer false positives in alerting over false negatives. See [`/03-services/outage-detection-service.md`](/03-services/outage-detection-service.md).

2. **Event streams are the source of truth, not the database.** The `grid.events` Kafka topic is authoritative. PostgreSQL is a materialized view of that stream, not the other way around. This matters during recovery. See [ADR-003](/05-engineering/adrs.md#adr-003).

3. **We do not skip the data contract.** Every Kafka topic has a registered Avro schema. No topic produces without a schema. This caused pain when we first added it in v2.0 and has saved us from data corruption at least six times since.

4. **Observe before you optimize.** We have a [`/05-engineering/performance-bottlenecks.md`](/05-engineering/performance-bottlenecks.md) document. Nothing goes on the optimization roadmap without a profiler trace attached.

5. **Tenancy is load-bearing.** Every database row, every API response, every Kafka message has a `tenant_id`. Mixing tenant data is a regulatory violation. See [`/06-operations/security-architecture.md`](/06-operations/security-architecture.md) and [`/05-engineering/authorization.md`](/05-engineering/authorization.md).

6. **The mobile app is a first-class citizen.** Field technicians operate in low-connectivity environments. Features that assume reliable internet fail in the field. The dispatch system must work offline-first. See [`/03-services/technician-dispatch-system.md`](/03-services/technician-dispatch-system.md).

7. **We write runbooks before we go on-call.** If there's no runbook for an alert, the alert doesn't ship. This rule has been violated exactly twice and both times produced our worst incidents.

---

## Getting Started: Local Development

> Full setup instructions are in [`/07-onboarding/new-engineer-first-week.md`](/07-onboarding/new-engineer-first-week.md). The below is a quick reference.

### Prerequisites

- Node.js 20 LTS (`nvm use 20`)
- Go 1.22+
- Docker Desktop (for local Kafka, Postgres, Redis)
- AWS CLI v2 (configured with `helios-dev` SSO profile)
- `kubectl` + `helm` (for staging access)
- `vault` CLI (for secrets)

### Bootstrapping the dev environment

```bash
# Clone the main repos you'll need
git clone git@github.com:lumina-energy/helios-portal.git
git clone git@github.com:lumina-energy/helios-api-gateway.git
git clone git@github.com:lumina-energy/helios-docs.git

# Start local backing services (Kafka, Postgres, Redis, Zookeeper)
cd helios-portal
docker compose -f docker-compose.dev.yml up -d

# Install portal deps
npm install

# Copy env config
cp .env.example .env.local
# Edit .env.local — ask your team lead for dev secrets or retrieve from Vault:
vault kv get -format=json secret/helios/dev/portal | jq '.data.data' > .env.local.json

# Start the dev server
npm run dev
# Portal: http://localhost:3000
```

```bash
# For Go services (e.g. grid monitor)
cd helios-grid-monitor
cp config/config.dev.yaml.example config/config.dev.yaml
go run ./cmd/gridmonitor/main.go --config config/config.dev.yaml
```

### Connecting to Staging

```bash
# Authenticate to staging EKS cluster
aws eks update-kubeconfig \
  --name helios-staging-eks \
  --region us-east-1 \
  --profile helios-dev

# Verify access
kubectl get pods -n helios-staging
```

---

## Governance

| Area | Owner | Process |
|---|---|---|
| Architecture changes | Architecture Review Board (ARB) | RFC → discussion → ADR |
| Breaking API changes | @platform-team | RFC with 2-week notice |
| Schema migrations | Database Guild | Migration PR reviewed by @db-team |
| Security changes | Security Eng (@yasmin.osei) | Security review required |
| Infra changes | Platform Infra (@tom.reeves) | Terraform PR + infra review |
| Model deployments | Data & AI (@lin.chen) | A/B test required before full rollout |

### RFC Process

When proposing significant changes, open an RFC in the `helios-rfcs` GitHub repository using the RFC template. Tag the relevant team leads. RFCs that reach consensus become ADRs. See [`/05-engineering/adrs.md`](/05-engineering/adrs.md) for the full list and process.

---

## Known Ongoing Challenges

We believe in radical transparency. These are the real problems we're actively dealing with:

- **TimescaleDB partition growth** — meter time-series partitions are growing faster than we projected. Compression and tiering work is underway. See [`/05-engineering/performance-bottlenecks.md#timescale-partitions`](/05-engineering/performance-bottlenecks.md).
- **IoT Bridge single-region** — the IoT MQTT bridge still runs only in `us-east-1`. A multi-region deployment is planned for Q2 2025. See [ADR-009](/05-engineering/adrs.md#adr-009).
- **Dispatch service legacy Node.js** — the dispatch service is still on Node.js 16 due to a transitive dependency conflict. A major upgrade is in the technical debt register. See [`/05-engineering/technical-debt-register.md#dispatch-node16`](/05-engineering/technical-debt-register.md).
- **GIS asset data freshness** — the GIS asset sync from utility company SCADA systems runs nightly. There is no real-time asset update pipeline yet. This is tracked as a P2 roadmap item.

---

## Contact & Escalation

| Need | Where to go |
|---|---|
| Technical question | `#helios-engineering` (Slack) |
| Production incident | PagerDuty → `helios-platform-oncall` |
| Security concern | `security@luminaenergy.com` or Slack `#security-private` |
| Architecture question | `#helios-architecture` + tag ARB members |
| Access request | IT ServiceNow ticket → `HELIOS-ACCESS` template |
| New engineer help | `#helios-onboarding` — team is welcoming, ask anything |

---

## Document Maintainers

| Document Area | Primary Maintainer | Backup |
|---|---|---|
| Architecture | Priya Nair (Staff Eng, Platform) | David Okafor (Principal Eng) |
| Services | Per-service ownership in [ownership matrix](/07-onboarding/ownership-matrix.md) | — |
| Operations / Runbooks | Marcus Webb (SRE Lead) | Aisha Kamara (SRE) |
| Onboarding | Tanvir Rahman (Eng Manager, Platform) | Rosa Lindqvist (Sr. Eng) |
| Security | Yasmin Osei (Security Eng) | — |
| Data & AI | Lin Chen (Staff Eng, Data) | Soren Andersen (ML Eng) |

> **Note to all engineers:** If you find something out of date, fix it. You don't need permission. Docs PRs are reviewed within 24 hours. The worst thing you can do is read something wrong and not correct it for the next person.

---

*Helios Engineering Knowledge Base · Lumina Energy · Internal Use Only*  
*Last generated index: 2024-11-14 · helios-docs@v4.7.1*
