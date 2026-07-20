# Project Timeline and History

**Owner:** Elena Vasquez (VP Engineering) — with contributions from James Whitfield (CTO), David Okafor, Priya Nair, Chidi Eze
**Format:** Narrative history + milestone timeline. Opinionated — this is a genuine account of how we got here, not a sanitised corporate history.
**Last Updated:** 2024-11-01
**Related Docs:** [Product Vision](/01-company/product-vision.md) · [Architecture Decision Records](/05-engineering/adrs.md) · [Technical Debt Register](/05-engineering/technical-debt-register.md) · [Business Context](/01-company/business-context.md)

---

> **James Whitfield (CTO), 2024-11-01:** I asked Elena and some of the longer-tenured engineers to write down the actual history of this project — the decisions that seemed sensible at the time and turned out to be wrong, the crises that shaped the architecture, the moments where we got lucky. This isn't a triumphant story; it's a real one. I think the team that joined in 2024 deserves to understand how things got to where they are, good and bad.
>
> A note on the early chapters: before Helios was a product, it was a 3-person prototype I built with David Okafor and an intern (Chidi, who is now our Grid Intelligence Staff Engineer). Some of the decisions we made in that prototype are still lurking in the codebase as technical debt. That's the reality of building software under pressure with uncertain requirements.

---

## Part 1: Founding (2019–2020)

### The Origin

Lumina Energy was founded in 2017 by Anjali Singh and three co-founders to build "software for the energy transition" — a deliberately broad mandate. For two years, the company existed in research and consulting mode, working with utility companies to understand what digital infrastructure they actually needed.

The consistent answer from grid operators was: **real-time visibility**. Utilities had operational technology (OT) systems — SCADA, EMS, DMS — but these were expensive, siloed, and not designed for modern cloud-scale data analysis. A medium-sized utility might know their total grid load from a control room, but they had no way to see individual meter behaviour across a district, correlate weather patterns with outage probability, or optimize maintenance scheduling based on historical failure data.

James Whitfield joined as CTO in late 2018 with a mandate to build a platform that could change this.

### The Prototype (2019)

In mid-2019, James, David Okafor (the third full-time engineering hire), and Chidi Eze (then an intern from Imperial College London) built the first version of Helios over three months. It was built for a single customer — a mid-sized UK distribution network operator who agreed to be a development partner in exchange for a heavily discounted pilot.

**Technology choices at prototype stage:**
- Node.js + Express API (James knew Node well)
- PostgreSQL (standard choice)
- AWS Lambda for IoT message processing
- Simple React frontend

These choices were fast and pragmatic. They were not designed for the scale Helios would eventually operate at.

**What was built:**
- Basic IoT device management (200 meters in the pilot)
- Simple real-time dashboard showing meter status
- Manual outage detection (rule-based threshold alerts)
- No forecasting, no dispatch, no GIS

The prototype worked. The pilot customer was impressed enough to sign an initial contract. Lumina raised a Series A round of £12M in October 2019, partly on the strength of this pilot.

---

## Part 2: First Product (2020)

### v1.0 — January 2020

Helios v1.0 launched with a team of 12 engineers. The first two paying customers were UK distribution network operators.

**Key technical reality of v1.0:**
- Lambda-based IoT processing was already showing cracks at ~200K meters
- No Kafka — everything was direct Lambda → PostgreSQL writes
- The "grid monitoring" was a polling-based dashboard (refresh every 60 seconds)
- No multi-tenancy — each customer had a separate database (!)

The separate-database-per-customer model was a deliberate early decision. It was simpler to implement, it gave strong data isolation, and it was fine for two customers. It became a severe operational problem by the time we had eight customers — eight separate databases to maintain, migrate, and monitor. We migrated to multi-tenancy in 2021 (see §3 — this migration was painful).

**Team structure in 2020:**
- James Whitfield: CTO + principal engineer
- David Okafor: lead backend engineer
- Chidi Eze: grid services engineer (returning after graduation)
- Priya Nair: (joined Feb 2020) frontend engineer
- 8 others across frontend, backend, and DevOps

### The First Major Incident (April 2020)

Three months after v1.0 launched, we had our first major incident. A Lambda cold start cascade — all Lambda functions cold-starting simultaneously after a deployment — caused IoT processing to fall 45 minutes behind. The grid dashboard for both customers showed stale data. Neither customer had a SLA with us yet (they were on early-stage contracts) but the incident exposed a fundamental architectural problem: Lambda cold starts were unpredictable and our dependency on Lambda for critical path IoT processing was a risk.

This incident directly led to ADR-001 (move IoT processing to long-running Kubernetes pods, not Lambda). See [Architecture Decision Records](/05-engineering/adrs.md).

### Series B Announcement and First International Customer

By end of 2020, Lumina had raised a £28M Series B and signed its first international customer — ENGIE France. This was a significant milestone but also exposed the single-region limitation (all infrastructure in eu-west-1) and the data residency requirements of European customers.

---

## Part 3: Scaling Crisis (2021)

### The Multi-Tenancy Migration

The decision to migrate from separate-database-per-customer to multi-tenancy was made in Q1 2021 when we signed two new customers and realised the operational overhead of separate databases was going to overwhelm the team. Rosa Lindqvist, who joined in early 2021 as the first dedicated platform/infra engineer, led the migration.

**The migration took 6 months and was genuinely hard:**
- Designed new shared schema with row-level security
- Built migration scripts for each customer
- Had to coordinate zero-downtime migration cutover for each customer
- Discovered data quality issues in customer 2's meter registry that had been masked by the separate DB setup

The multi-tenancy migration was the first time we truly understood the gap between "works for 2 customers" and "works for N customers." Many assumptions in the original code were single-tenant assumptions.

### Kafka Introduction (ADR-002)

By mid-2021 we had signed five customers and were approaching 5 million meters under management. Lambda was clearly not going to work. David Okafor proposed Kafka in March 2021. The team was initially resistant — Kafka is complex, requires operational expertise, and the team had limited experience with it.

The decision was made after a proof-of-concept demonstrated 10× improvement in throughput vs. Lambda and predictable (not cold-start-dependent) latency. ADR-002 was written and accepted.

**The Kafka introduction was rough:**
- First 3 months had multiple consumer group rebalancing incidents
- We underestimated the operational complexity of Kafka — partitioning, offset management, schema evolution
- We brought in an external Kafka expert for two weeks to help the team learn operational patterns
- David Okafor became the team's Kafka expert and remains so today

### The Hiring Wave — and Growing Pains

Between January and December 2021, the team grew from 12 to 24 engineers. This was the fastest growth in Helios's history and it caused problems:

- Code reviews became inconsistent as more engineers meant more PR variability
- No coding standards document existed (written in 2022 retrospectively)
- The oncall rotation was chaotic — everyone was on the same rotation regardless of expertise
- Onboarding was informal and inconsistent

Looking back, this period created a lot of the technical debt we're still paying down in 2024. Under pressure to deliver features for new customers, teams cut corners. The [Technical Debt Register](/05-engineering/technical-debt-register.md) has several items (TD-001, TD-003, TD-005) that trace directly to 2021 decisions.

---

## Part 4: AI, Go, and Growing Up (2022)

### The Go Decision (ADR-003)

By early 2022, the grid event processing layer — handling all IoT telemetry ingest and processing — was a significant Node.js codebase. As meter counts grew, we were seeing consistent CPU saturation on the processing pods during peak hours.

Lin Chen joined in early 2022 as the first ML/AI engineer and immediately proposed the idea of a real demand forecasting engine. This required high-throughput data processing capabilities that Node.js wasn't providing.

David Okafor and Chidi Eze proposed rewriting the hot path (IoT ingest → event processing) in Go. The proposal was contentious — it added a new language to the stack, requiring everyone to learn Go or stay away from that layer. ADR-003 documented the decision after a team vote (not unanimous — some engineers strongly preferred TypeScript all the way down).

The Go rewrite happened over Q2–Q3 2022. The results were significant: peak throughput went from ~80K events/sec to ~380K events/sec on the same hardware.

### Forecasting Engine v1.0

Lin Chen shipped the first demand forecasting engine in Q3 2022. Initially it was a simple ARIMA model running as a Python service. The initial version had an MAE of ~300MW — not great, but a starting point. By end of 2022, Lin had iterated to an XGBoost model that brought MAE down to ~180MW.

The first version ran on the main EKS cluster and occasionally caused latency spikes during training runs. This was accepted as a temporary situation that would be fixed "when we had time." (We didn't fix it until 2024.)

### INC-2022-0817 — The "Great Kafka Lag" Incident

In August 2022, a bad deploy of the grid event processor introduced a slow deserialization path. Kafka consumer lag grew from ~500 messages to over 2 million messages over 4 hours before anyone noticed. Grid monitoring data for all customers was 4 hours stale.

This was our first truly significant production incident with multiple enterprise customers affected. NW Grid UK's control room called our CSM in a panic because their outage detection was not working. We narrowly avoided a contractual SLA breach.

The incident was the catalyst for several improvements:
- Kafka consumer lag alerting (implemented within a week of the incident)
- The incident response runbook was formalized (previously existed as informal tribal knowledge)
- On-call rotations were restructured to separate infra and application

### Series C and Expansion

Lumina raised a £62M Series C in November 2022. By this point we had 8 customers across UK, Germany, and France, and approximately 15 million meters under management.

---

## Part 5: Enterprise Scale (2023)

### Ten Customers, First Australian Customers

2023 was the year Helios became unambiguously enterprise-scale. We signed Ausgrid and AusNet in Q1, requiring:
- Australian data residency (ap-southeast-2 deployment)
- AEMO compliance
- Support for AEDT and AEST timezones (which sounds trivial but broke several date calculation bugs that had been lurking since 2020)

The Australian expansion also drove the first real conversation about multi-region infrastructure. Until this point "multi-region" meant "our DR standby in eu-central-1." Genuinely operating customer-specific data in a new AWS region required significant platform work from Rosa Lindqvist's team.

### IoT Fleet Reaches 30 Million Devices

Crossing 30 million smart meters under management in Q2 2023 was a milestone we celebrated — and then immediately worried about. The IoT ingest service, while performant in Go, was running on a single-region architecture. Lars Eriksson (who joined in early 2023 as the first dedicated IoT engineer) immediately identified the single-region IoT Core dependency as a critical DR gap. This is still not fully resolved (TD-007, INFRA-2901 targeting Q1 2025).

### The Dispatch Service Problem Begins

The technician dispatch service was originally built in mid-2021 by a contractor team under time pressure. It was delivered in Node.js 14 (later upgraded to 16), has no integration tests, and uses an ORM pattern that's incompatible with modern Node.js versions. By 2023, Node 16 reached EOL. The service still runs on Node 16 in late 2024 — this is TD-002, our most persistent piece of technical debt.

The dispatch service memory leak was first noticed in mid-2023 — every 3–4 weeks, it OOMKills and requires a rolling restart. The root cause has never been definitively identified (suspected to be a connection pool leak in the ORM). The migration to Node 20 is finally happening in Q4 2024/Q1 2025.

### The On-Call Burnout Crisis

Q2 2023 brought a team health crisis. An anonymous survey (Marcus Webb's initiative) revealed that 6 of 12 on-call engineers reported "regularly poor sleep" during on-call weeks. Three engineers left Lumina that year; two cited on-call fatigue as a contributing factor.

This led directly to the on-call restructuring described in the [On-Call Rotation Guide](/06-operations/on-call-rotation-guide.md) and the formal adoption of the Toil Budget. Marcus Webb wrote about this period in the guide itself — it's worth reading.

---

## Part 6: Maturity and Complexity (2024)

### The July 2024 Incident (INC-2024-0719)

On July 19, 2024, three UK customers lost grid telemetry for 38 minutes. This was our most significant production incident in two years. Root cause: a cascading failure where a Kafka broker upgrade caused unexpected partition leader elections, which combined with an IoT ingest service that hadn't been tested against Kafka broker restarts.

The post-mortem is public internally — see INC-2024-0719. Key learnings that changed our practices:
- The incident response runbook was rewritten from scratch (v3.1)
- Kafka broker upgrades now require an explicit runbook and SRE sign-off
- IoT ingest service chaos testing was added to the quarterly operational readiness review

### The Q3 2024 Organisational Restructure

For the first four years of Helios, engineering was organised functionally: Frontend, Backend, Infrastructure. This made sense at 20 engineers. At 65 engineers it meant teams building features needed coordination across three separate functional teams.

Elena Vasquez drove a reorganisation in August 2024 to a hybrid product/platform model: Grid Intelligence (owns the grid and AI domain), Platform Engineering (owns infrastructure and shared services), Customer Experience (owns the portal and notifications). The restructure was disruptive — some people were unhappy about their team changes, some ownership questions remain unresolved — but the early signs are positive.

### Where We Are Now (November 2024)

- 14 customers, 6 countries
- 42 million smart meters
- 71 engineers
- 99.961% average uptime (12-month rolling)
- v4.7.1 in production
- Preparing for US market expansion in 2025

The platform is genuinely enterprise-grade. The architecture is sound. The technical debt is real but understood and being addressed. The team is experienced and (mostly) healthy.

The biggest risks looking forward:
1. IoT cross-region gap — if we have a true eu-west-1 failure, 42 million device registrations need manual work
2. Dispatch service tech debt — the Node 16 situation is a security and stability risk
3. US expansion complexity — NERC CIP compliance is genuinely difficult
4. Hiring to meet the roadmap — we need 14 more engineers in 2025

---

## Key Milestones Timeline

| Date | Milestone |
|------|-----------|
| 2017 | Lumina Energy founded by Anjali Singh |
| 2018 | James Whitfield joins as CTO |
| 2019-Q2 | First Helios prototype (3 engineers, 200 meters) |
| 2019-Q4 | Series A (£12M). First paying customer |
| 2020-01 | Helios v1.0 launches. 2 customers, 12 engineers |
| 2020-04 | First major incident — Lambda cold start cascade (ADR-001) |
| 2020-Q4 | Series B (£28M). First international customer (ENGIE France) |
| 2021-Q1 | Multi-tenancy migration (6 months) |
| 2021-Q3 | Kafka introduced (ADR-002). 5 customers, 5M meters |
| 2021-Q4 | 24 engineers. Hiring wave brings technical debt |
| 2022-Q1 | Lin Chen joins as first ML engineer |
| 2022-Q2 | Go hot path rewrite (ADR-003). 10× throughput improvement |
| 2022-Q3 | AI Forecasting Engine v1.0 |
| 2022-Q3 | "Great Kafka Lag" incident — 4-hour telemetry staleness |
| 2022-Q4 | Series C (£62M). 8 customers, 38 engineers |
| 2023-Q1 | Australian customers (Ausgrid, AusNet). Multi-region expansion |
| 2023-Q2 | 30M meters milestone. IoT DR gap identified |
| 2023-Q2 | On-call burnout crisis. Rotation restructured |
| 2023-Q3 | 55 engineers. Grid Intelligence pod formed |
| 2024-Q1 | ML training moved off main EKS → SageMaker |
| 2024-Q2 | 14 customers. 40M+ meters |
| 2024-07 | INC-2024-0719: 38-minute telemetry blackout. Runbook rewritten |
| 2024-08 | Q3 organisational restructure (functional → product pods) |
| 2024-09 | DR test: 4h 22min RTO (revised target from 2h → 4h) |
| 2024-Q4 | 71 engineers. v4.7.1. 42M meters. US expansion planning begins |

---

*This document is intentionally opinionated and candid. Engineering history should inform future decisions, not just celebrate past successes.*
*Questions about specific historical decisions: James Whitfield, David Okafor, or Chidi Eze are the longest-tenured engineers.*
