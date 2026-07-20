# Architecture Decision Records — Helios

> **Location:** Confluence → Helios Engineering Space → Engineering → ADRs  
> **Owner:** Architecture Review Board (ARB) · @david.okafor · @priya.nair  
> **Last Updated:** 2024-10-10  
> **Status:** Living document — new ADRs added after ARB approval  
> **Related:** [System Overview](/02-architecture/system-overview.md) · [High-Level Architecture](/02-architecture/high-level-architecture.md) · [Technical Debt Register](/05-engineering/technical-debt-register.md)

---

> *ADRs are the institutional memory of our engineering decisions. When a new engineer asks "why did we use Go here instead of Node?" or "why don't we just use a single PostgreSQL database?", the answer is in an ADR. When you are about to make a significant decision, check here first — someone may have already evaluated the same options.*

---

## ADR Process

1. **Proposal:** Engineer opens an RFC in the `helios-rfcs` GitHub repository using the RFC template
2. **Discussion:** 5 business days minimum for comment. Tag relevant stakeholders.
3. **ARB Review:** Presented at bi-weekly ARB meeting (Thursdays 10am CT)
4. **Decision:** ARB reaches consensus (majority vote for controversial decisions)
5. **ADR Written:** Engineer writes the ADR and opens a PR to `helios-docs`
6. **Status:** ADRs are `ACCEPTED`, `SUPERSEDED`, or `DEPRECATED`. They are never deleted.

---

## ADR Index

| ID | Title | Status | Date | Teams Affected |
|---|---|---|---|---|
| [ADR-001](#adr-001) | Use Go for performance-critical services | ACCEPTED | 2022-08-14 | All |
| [ADR-002](#adr-002) | Support both GraphQL and REST APIs | ACCEPTED | 2022-01-12 | Platform, All consumers |
| [ADR-003](#adr-003) | Kafka as event backbone (event sourcing light) | ACCEPTED | 2022-03-01 | All |
| [ADR-004](#adr-004) | Replace Google Maps with MapLibre GL JS | ACCEPTED | 2022-11-08 | Grid UI, GIS |
| [ADR-005](#adr-005) | EMQX as MQTT broker over AWS IoT Core | ACCEPTED | 2022-06-15 | IoT & Devices |
| [ADR-006](#adr-006) | Replace Redux with Zustand | ACCEPTED | 2023-04-22 | Grid UI, Customer Experience |
| [ADR-007](#adr-007) | TimescaleDB for meter time-series storage | ACCEPTED | 2022-09-30 | Data & AI, Platform |
| [ADR-008](#adr-008) | Defer service mesh adoption (no Istio) | ACCEPTED | 2023-01-18 | Platform |
| [ADR-009](#adr-009) | Defer IoT Bridge multi-region deployment | ACCEPTED | 2023-11-05 | IoT & Devices, SRE |
| [ADR-010](#adr-010) | Decline direct grid control capabilities | ACCEPTED | 2021-10-20 | Product, All |

---

## ADR-001

### Use Go for Performance-Critical Services

**Status:** ACCEPTED  
**Date:** 2022-08-14  
**Deciders:** James Whitfield (CTO), David Okafor, Priya Nair, Lars Eriksson  
**RFC:** `helios-rfcs#004`

#### Context

In v1.x, all backend services were written in Node.js (TypeScript). By mid-2022, the grid monitor and IoT bridge were struggling to keep up with Kafka consumer lag under peak load. Profiling revealed two bottlenecks:

1. **IoT Bridge:** The Node.js event loop was saturating at ~80,000 messages/second during load tests. We needed ~250,000/second headroom.
2. **Grid Monitor:** In-memory state management with complex JS objects was causing GC pauses of 200–400ms, directly impacting alert latency.

We evaluated four options:
- **Optimize the Node.js code:** Profiling showed we were near the theoretical limit of single-threaded JS with our workload. Worker threads would help but not enough.
- **Move to Java/JVM:** Performance would be better, but startup time, container size, and team expertise pointed against it.
- **Move to Go:** Go's goroutine model, minimal GC pressure, and efficient memory layout are well-suited. The founding team had Go expertise. EMQX itself is written in Erlang and has first-class Go client libraries.
- **Move to Rust:** Theoretical performance advantage over Go, but steep learning curve and longer development time.

#### Decision

Migrate the IoT bridge and grid monitor to Go. Maintain Node.js for the API gateway, dispatch, and notify services (where I/O orchestration is the primary workload and Node.js async model is a good fit).

**Rule:** New services use Go if they are in the hot path (> 50,000 events/second, latency SLO < 1 second) or if they perform intensive CPU operations. New services use Node.js if they primarily orchestrate I/O and have moderate throughput.

#### Consequences

**Positive:**
- IoT bridge now sustains 380,000+ messages/second without lag at P95
- Grid monitor alert latency reduced from P95 ~8s to P95 ~340ms
- Go's compile-time error checking has reduced production null pointer panics to near zero

**Negative:**
- Two languages in the backend increases onboarding complexity
- Go expertise is required for new grid intelligence engineers
- Shared libraries must be maintained in both Go (`helios-go-sdk`) and Node.js (`@helios/sdk`)

**Technical Debt Introduced:** The original Node.js grid monitor code was not fully migrated — some edge cases in the alert rule evaluator are still handled by a compatibility shim. Tracked in [Technical Debt Register — Grid Monitor Legacy Shim](/05-engineering/technical-debt-register.md#grid-monitor-shim).

---

## ADR-002

### Support Both GraphQL and REST APIs

**Status:** ACCEPTED  
**Date:** 2022-01-12  
**Deciders:** Priya Nair, James Whitfield, Nina Patel (then Staff Eng)  
**RFC:** `helios-rfcs#001`

#### Context

The Grid Operations Portal was built using a GraphQL API from day one. GraphQL's flexibility for complex nested queries (a dashboard query that federates grid state, alerts, and forecasts in one request) was a strong fit.

In Q4 2021, Midwest Grid Co. (our first enterprise customer) informed us their integration team wanted to pull grid data into their existing middleware platform (MuleSoft). MuleSoft had poor GraphQL support in 2021 and their team strongly preferred REST with JSON.

We also had IoT device registration endpoints that didn't benefit from GraphQL's flexibility but were called by simple scripts and low-power gateway devices. REST is more appropriate there.

#### Options Considered

1. **GraphQL only:** Midwest Grid Co. either adapts or we lose the customer. High customer risk.
2. **REST only:** Rebuild the portal data layer. Loses GraphQL's federation benefits. High engineering cost.
3. **Both, via separate gateways:** Two API surfaces to maintain, different auth, different rate limiting. High operational complexity.
4. **Both, via single API gateway:** GraphQL for portal/complex queries; REST for integrations and IoT. Moderate added complexity; unified auth and rate limiting.

#### Decision

Implement both GraphQL and REST in the same `helios-api-gateway`. GraphQL (Apollo Federation) is the primary API for the Grid Ops Portal and Customer Portal. REST (`/api/v1/`) is for third-party integrations, IoT device registration, regulatory report downloads, and any consumer that cannot consume GraphQL.

**Which to use when:**
- Client controls the query shape and needs flexible data fetching → GraphQL
- Server-defined operation, simple request/response → REST
- Integration with external systems → REST
- IoT device operations → REST
- Batch data exports → REST (streaming response)

#### Consequences

**Positive:**
- Midwest Grid Co. retained as customer (now our most profitable account)
- Flexibility for future integrations without requiring GraphQL capability
- Single auth and rate limiting layer

**Negative:**
- Two API styles to document, test, and maintain
- Risk of feature parity drift (new features added to GraphQL but not REST or vice versa)
- New engineers must understand when to use which

**Mitigation:** We maintain a feature parity tracking document (Notion: "GraphQL/REST Feature Parity") and review it quarterly.

---

## ADR-003

### Kafka as Event Backbone (Event Sourcing Light)

**Status:** ACCEPTED  
**Date:** 2022-03-01  
**Deciders:** ARB full board  
**RFC:** `helios-rfcs#006`

#### Context

The v1.x architecture was a conventional 3-tier web application. The IoT bridge wrote readings directly to PostgreSQL. The grid monitor polled PostgreSQL. The customer portal polled PostgreSQL. This worked for two customers but showed clear scaling problems:

1. **Fan-out problem:** Every new consumer (forecasting, compliance reporting, analytics) required either polling PostgreSQL (contention) or adding a direct API call to the IoT bridge (coupling)
2. **Reprocessing:** When we found a bug in the grid monitor's alert logic, we had no way to replay the last 24 hours of readings to correct alerts
3. **Database pressure:** Peak IoT ingest saturated RDS I/O at 3 customers; we projected catastrophic failure at 8 customers

We evaluated:
- **SQS/SNS (AWS native):** Simple but limited retention, no replay, poor ordering guarantees for high-volume streams
- **Kafka (self-managed):** Full control, excellent performance. High operational burden.
- **Kafka (MSK):** Managed Kafka on AWS. Lower operational burden, same programming model.
- **Kinesis:** AWS-native streaming. Good performance but lower throughput ceiling and less flexible consumer model than Kafka.
- **Pulsar:** More feature-rich than Kafka but smaller ecosystem, less team familiarity.

#### Decision

Apache Kafka via AWS MSK as the primary event streaming backbone. Key design principles:
- Kafka topics are the source of truth, not the database
- Every service that processes events is a consumer; no direct API calls in the hot path
- All topics require Avro schemas registered in the Schema Registry
- Messages are retained for at least 7 days to enable reprocessing

This is "event sourcing light" — we get the benefits of event replayability and consumer decoupling without implementing a full event sourcing pattern with event store and projections.

#### Consequences

**Positive:**
- IoT bridge decoupled from all consumers — new consumers add themselves
- Full replay capability: we have replayed topics to recover from bugs three times
- Horizontal scaling without coordination between producers and consumers
- Natural fan-out: grid state, forecasting, analytics, notifications all consume independently

**Negative:**
- Added operational complexity (MSK management, schema registry, consumer group monitoring)
- Eventual consistency: consumers are behind producers by their processing lag
- Schema evolution requires careful coordination
- Debugging distributed message flows is harder than direct calls

**The Cedar Rapids Incident (2021 Q3)** directly motivated this decision — we saw a fault coming but couldn't surface it fast enough because all state flowed through a bottlenecked PostgreSQL query. The Kafka architecture directly reduced our alert latency from ~8 seconds (v1.x) to ~340ms (current).

---

## ADR-004

### Replace Google Maps with MapLibre GL JS

**Status:** ACCEPTED  
**Date:** 2022-11-08  
**Deciders:** Hana Kobayashi, Ana Lima, Meera Pillai (Product), Priya Nair  
**RFC:** `helios-rfcs#014`

#### Context

The Grid Operations Portal originally used Google Maps JavaScript API for the GIS visualization layer. By Q3 2022, two problems emerged:

1. **Cost:** Google Maps API pricing for our usage pattern (high zoom, many custom overlays, ~50,000 daily portal sessions) was projected to cost ~$85,000/year at our customer growth trajectory. This was not in the original cost model.
2. **Customization limits:** Google Maps has strict constraints on custom styling and overlay behavior. We needed to render custom grid topology layers (feeder lines, transformer states, outage overlays) that were difficult or impossible to style correctly in Google Maps.

We evaluated:
- **Continue with Google Maps:** Expensive. Customization limits would eventually block product features.
- **Mapbox GL JS:** More flexible and cheaper than Google Maps. But Mapbox changed its license in 2021 to require a commercial license for offline use — a problem for the technician mobile app.
- **MapLibre GL JS:** Open-source fork of Mapbox GL JS (pre-license-change). MIT license. No per-tile costs if self-hosting tiles. Full GL rendering pipeline. Large and active open-source community after the Mapbox license change drove many companies to adopt it.
- **Leaflet.js:** Simpler, lighter. Insufficient for our GL-rendered topology layers and the performance characteristics we need.

#### Decision

Migrate from Google Maps to MapLibre GL JS. Self-host tile data using OpenStreetMap as the base map (tiles generated and served from S3). Custom grid topology layers served from our GIS service.

#### Consequences

**Positive:**
- Eliminated ~$85,000/year in projected Maps API costs
- Full control over styling, layer rendering, and interaction behavior
- MIT license allows use in the offline-capable mobile app
- MapLibre community is large and the library is actively maintained

**Negative:**
- Migration took one full sprint (2 weeks) — the existing code was deeply coupled to the Google Maps API
- We must self-manage base map tile generation (runs on a monthly EMR Spark job consuming OSM data)
- OpenStreetMap data quality varies by region — our APAC maps have lower detail than US maps

**Migration note:** The migration was completed by @hana.kobayashi in v2.4. There are a few residual Google Maps API key references in the codebase in the `helios-compliance` module that were missed during migration. Tracked in [Known Issues — Google Maps Key Residual](/05-engineering/known-issues.md#google-maps-residual).

---

## ADR-005

### EMQX as MQTT Broker over AWS IoT Core

**Status:** ACCEPTED  
**Date:** 2022-06-15  
**Deciders:** Lars Eriksson, Ngozi Williams, David Okafor, Tom Reeves  
**RFC:** `helios-rfcs#009`

#### Context

When designing the IoT ingestion layer, we needed to choose an MQTT broker capable of handling 42M+ concurrent connections.

Options evaluated:
- **AWS IoT Core:** Fully managed, scales automatically, native Kafka integration via rules engine. Higher per-message cost; less control over message routing; limited support for custom authentication protocols; connection limits per account.
- **HiveMQ:** Enterprise MQTT broker. Good performance, strong support, expensive license.
- **Mosquitto:** Open source, simple, not designed for millions of concurrent connections.
- **EMQX:** Open source MQTT broker built on Erlang/OTP. Purpose-built for massive scale (tested at 100M+ connections by the EMQX team). Active open source community. Enterprise support available. Kafka integration via built-in ExHook mechanism.

#### Decision

EMQX deployed as a self-managed 3-node cluster on dedicated EC2 instances.

Key reasons:
1. **Scale:** EMQX is designed for the connection counts we need. AWS IoT Core has per-account connection limits that would require multi-account workarounds at our scale.
2. **Cost:** AWS IoT Core pricing at 42M connections + 380K messages/sec would be ~$45,000/month. EMQX on EC2 costs ~$2,100/month.
3. **Control:** We can customize authentication (mTLS with custom CA), message routing (ExHook), and protocol behavior (supporting older AMI meter protocols).

The decision to run on EC2 (not Kubernetes) is deliberate — MQTT sessions require stable endpoint addresses for reconnection. Pod IPs are ephemeral.

#### Consequences

**Positive:**
- Connection cost: ~$2,100/month vs. ~$45,000/month projected for AWS IoT Core
- Full control over device certificate management (our own CA)
- ExHook mechanism gives us clean MQTT → Kafka bridge without protocol overhead
- EMQX cluster has been reliable: zero broker failures since deployment

**Negative:**
- We own EMQX operations: upgrades, node failures, configuration management
- Not Kubernetes-managed — separate operational surface
- Horizontal scaling requires manual reconfiguration of the cluster (EMQX clustering protocol requires node address changes)

---

## ADR-006

### Replace Redux with Zustand in Frontend State Management

**Status:** ACCEPTED  
**Date:** 2023-04-22  
**Deciders:** Ana Lima, Ben Ostrowski, Mei Zhang (Grid UI team)  
**RFC:** `helios-rfcs#021`

#### Context

The Grid Operations Portal was built with Redux Toolkit for global state management. By 2023, the portal team had accumulated significant complaints:

1. **Boilerplate:** Adding a new piece of state required: action creators, reducers, selectors, potentially middleware, and thunks. A simple "which alerts are acknowledged" feature took 150+ lines of Redux code.
2. **Developer experience:** New portal engineers spent 2-3 days learning Redux patterns before contributing. This was disproportionate to the benefit.
3. **Bundle size:** Redux Toolkit added ~25KB gzip to the bundle.
4. **Overkill:** Redux's architecture was designed for complex, large-scale applications. The portal's state management needs are primarily: "current user/tenant context" + "live grid state from WebSocket" + "UI preferences." This does not require Redux's complexity.

We evaluated:
- **Redux Toolkit (keep):** Familiar to some engineers, mature ecosystem. But boilerplate problem remains.
- **Jotai:** Atomic state. Elegant but unfamiliar pattern for the team.
- **Recoil:** Facebook's atomic state. Not well maintained.
- **Zustand:** Minimal API (one `create` function), no boilerplate, first-class TypeScript support, subscribeWithSelector for selective re-renders. Tiny bundle (~1KB gzip).
- **Context API (React):** Zero deps, but performance issues with frequent updates (the live alert feed re-renders everything subscribed to the context).

#### Decision

Replace Redux with Zustand. Migrate incrementally — new stores use Zustand, old Redux slices migrated as touched.

The key distinction: **Zustand for client-side global state; TanStack Query for server state.** Redux was being used for both — server data fetched by Redux thunks and client UI state in Redux reducers. Separating these concerns is the cleaner design.

#### Consequences

**Positive:**
- Reduced boilerplate: same "acknowledged alerts" feature is 12 lines in Zustand vs. 150+ in Redux
- Bundle size: -23KB gzip (meaningful for 3G connections on field tablets)
- New engineers are productive in the portal within hours, not days
- TanStack Query handles server state cache and invalidation correctly; Redux was re-implementing this badly

**Negative:**
- Redux DevTools no longer available for Zustand stores (Zustand has its own devtools, less mature)
- Some engineers familiar with Redux Redux patterns had to re-learn
- Redux Toolkit is still used in 3 legacy slices that haven't been migrated (tracked in [Technical Debt Register](/05-engineering/technical-debt-register.md#redux-legacy))

---

## ADR-007

### TimescaleDB for Meter Time-Series Storage

**Status:** ACCEPTED  
**Date:** 2022-09-30  
**Deciders:** Lin Chen, Fatou Diallo (then Data Eng), Priya Nair  
**RFC:** `helios-rfcs#012`

#### Context

The meter readings data set is the largest in the platform: 42M meters × 96 readings/day × 7-year retention = ~107 billion rows at full maturity. We needed a time-series storage solution.

Options evaluated:
- **PostgreSQL (plain):** Query performance on billions of rows degrades badly without partitioning; manual partition management is error-prone; no built-in compression.
- **InfluxDB:** Purpose-built time-series database. Good for metrics. Poor SQL support makes integration with our PostgreSQL-based tooling hard. Separate operational surface.
- **Amazon Timestream:** Fully managed, AWS-native. Limited query flexibility (no arbitrary SQL). Vendor lock-in. Expensive at scale.
- **ClickHouse:** Excellent analytical performance. But not designed for OLTP patterns (we have real-time inserts at high rate). Complex operations model.
- **TimescaleDB:** PostgreSQL extension. Full PostgreSQL compatibility (same tooling, same team skills). Automatic time-based partitioning (hypertables). 10:1 compression for time-series data. Continuous aggregates (materialized views that update incrementally). Used in production by companies with larger datasets than ours.

#### Decision

TimescaleDB as a PostgreSQL extension on a dedicated RDS instance (`helios-ts`). This gives us:
- PostgreSQL-compatible SQL (same ORM, same migration tools, same team knowledge)
- Automatic partitioning: daily chunks that constrain queries to relevant partitions
- Compression: 10:1 reduces our projected 40TB to ~4TB
- Continuous aggregates: pre-computed hourly/daily rollups for the Customer Portal

#### Consequences

**Positive:**
- Single SQL dialect across all data stores
- Compression delivered: raw readings are ~4.2TB at 7 years (projected), not 40TB
- Query performance: queries scoped to a time range touch only relevant partitions
- Continuous aggregates: customer usage queries are sub-100ms against aggregates

**Negative:**
- TimescaleDB has some PostgreSQL-incompatible behaviors (UPDATE/DELETE on compressed chunks not allowed; some VACUUM behavior differs)
- Partition (chunk) count growth is higher than projected — see [Performance Bottlenecks](/05-engineering/performance-bottlenecks.md#timescale-partitions)
- We had to replace Fatou's original schema design once — TimescaleDB requires the partition column (time) in the primary key, which required a schema rework

---

## ADR-008

### Defer Service Mesh Adoption (No Istio)

**Status:** ACCEPTED  
**Date:** 2023-01-18  
**Deciders:** David Okafor, Kenji Watanabe, Marcus Webb  
**RFC:** `helios-rfcs#018`

#### Context

As we added more Go services in v3.0, the question arose: should we adopt a service mesh (Istio or Linkerd) for mTLS between services, traffic management, and observability?

Arguments for a service mesh:
- Automatic mTLS between all services (zero-trust networking within the cluster)
- Traffic management (canary deployments, circuit breakers at the mesh level)
- Out-of-the-box distributed tracing via sidecar proxies
- Service discovery

Arguments against:
- **Operational complexity:** Istio adds significant operational overhead. It has a history of performance issues, upgrade difficulties, and subtle misconfiguration causing mysterious failures. We estimated 1–2 engineer-months per year for mesh operations.
- **Marginal security benefit:** We already have Kubernetes NetworkPolicies and AWS security groups enforcing network segmentation. mTLS between services adds defense-in-depth but the incremental security benefit vs. cost is not compelling at our scale.
- **We already have OpenTelemetry:** We already instrument all services with OpenTelemetry for distributed tracing. The mesh's sidecar tracing would be redundant.
- **Team bandwidth:** We were in the middle of the v3.0 major version. Adding a service mesh was not the right priority.

#### Decision

Defer service mesh adoption indefinitely. Revisit when:
1. Service count exceeds 25 (currently 9), at which point operational benefits may outweigh costs
2. There is a concrete security or reliability requirement that a service mesh uniquely addresses
3. The team has bandwidth to implement and operate it properly

Inter-service mTLS is implemented at the application level for the gRPC services (Vault PKI-issued certs, rotated automatically). HTTP services within the cluster use internal JWTs.

#### Consequences

**Positive:**
- Saved ~1-2 engineer-months/year in operational overhead
- Simpler debugging: no sidecar proxy in the call path
- Reduced resource consumption: Envoy sidecars consume ~50MB RAM per pod

**Negative:**
- No automatic mTLS for HTTP services within the cluster (mitigated by NetworkPolicies)
- Traffic management (e.g., canary deploys) is done at the Kubernetes deployment level, not mesh level
- When we do eventually adopt a mesh, migration will be more work than day-one adoption

---

## ADR-009

### Defer IoT Bridge Multi-Region Deployment

**Status:** ACCEPTED  
**Date:** 2023-11-05  
**Deciders:** David Okafor, Lars Eriksson, Marcus Webb, Tom Reeves  
**RFC:** `helios-rfcs#028`

#### Context

The IoT Bridge (EMQX + helios-iot-bridge) runs only in `us-east-1`. This is our most significant single-region risk. If `us-east-1` is unavailable, IoT telemetry ingestion stops entirely.

Multi-region IoT bridge was proposed in RFC-028. The design was evaluated:

**Technical challenges:**
1. **MQTT session persistence:** MQTT clients maintain a session (persistent subscription state) with a specific broker. Moving to multi-region active-active requires session migration, which EMQX supports but is complex to configure and test.
2. **Device certificate routing:** Devices connect to a specific broker endpoint. DNS-based failover has 60-120 second propagation delay — unacceptable for millions of simultaneous reconnects.
3. **Kafka replication coordination:** Producing to two MSK clusters (primary + regional) with exactly-once guarantees requires careful sequencing.
4. **Cost:** A second EMQX cluster in `eu-west-1` adds ~$4,200/month. The latency benefit for North American devices connecting to `eu-west-1` is negligible.

**Risk assessment:**
- AWS `us-east-1` regional failure probability: ~0.01% per month (based on historical data)
- Impact duration of a regional failure: historically < 4 hours
- Impact: IoT ingestion stops; grid state stops updating; grid operators see frozen dashboard; alerts stop
- Contractual impact: SLA breach possible for customers with 99.99% grid monitoring SLA (Midwest Grid Co.)

**Decision:** The P(failure) × impact is real but the engineering cost of correct multi-region IoT infrastructure is ~4 engineer-weeks. Given current priorities (GDPR data residency, APAC expansion, predictive fault modeling), we defer with a committed timeline.

#### Decision

Defer multi-region IoT bridge to Q2 2025. Mitigations in place:
1. Monitoring alerts fire within 2 minutes of EMQX node failure
2. Grid operators are trained to recognize the "frozen grid state" pattern
3. Runbook updated: operators can fall back to SCADA direct monitoring during IoT outage

#### Consequences

**Risk accepted:** Single-region IoT ingestion is our most significant operational risk. This is documented prominently in [Microservices Overview](/02-architecture/microservices-overview.md) and [System Overview](/02-architecture/system-overview.md).

**Q2 2025 implementation plan:** Multi-region active-passive EMQX with MQTT routing via Route 53 latency-based routing and 30-second failover health check interval. Kafka MirrorMaker2 to replicate IoT topics cross-region.

---

## ADR-010

### Decline Direct Grid Control Capabilities

**Status:** ACCEPTED  
**Date:** 2021-10-20  
**Deciders:** James Whitfield (CTO), Anjali Singh (CEO), Yasmin Osei (Security), legal counsel  
**RFC:** Not applicable — executive decision

#### Context

In Q3 2021, two customers (Midwest Grid Co. and Southwest Energy Cooperative) requested that Helios add the ability to issue direct control commands to grid assets — specifically:
- Open/close substation circuit breakers remotely
- Adjust load setpoints on battery systems
- Dispatch demand response signals directly to controllable loads

This is technically feasible. SCADA systems perform these operations today. Adding this capability would significantly expand Helios's value proposition.

#### Arguments Considered

**For adding control capabilities:**
- Significant product differentiation and competitive advantage
- Strong customer demand (2 of 2 customers asked within 6 months)
- Natural extension of our monitoring and forecasting capabilities
- Potential for "closed loop" automation: forecast peak → automatically dispatch battery

**Against adding control capabilities:**
- **Safety and liability:** A software error in a control action can cause physical damage to grid equipment, power outages, and potentially safety incidents for workers and the public. The liability exposure is existential for a Series A company.
- **Regulatory complexity:** Direct grid control requires NERC CIP operational technology certification. This is an expensive, multi-year process that would distract from product development.
- **Security surface:** Every control capability is a potential attack vector. A compromised Helios instance that can open circuit breakers is a national infrastructure attack vector. This is incompatible with our current security posture.
- **Trust:** We are two years old. Utilities will not trust a Series A vendor with direct control authority over national grid infrastructure. This trust must be earned over years of demonstrated reliability in monitoring and advisory roles first.

#### Decision

Helios will not implement direct grid control capabilities. This decision is permanent for at least 3 years (reviewed in 2024) and requires board-level approval to revisit.

Helios **will** implement:
- Advisory recommendations that operators can approve and execute
- Integration with utility SCADA for read access
- Demand response signal generation (for customer-side devices enrolled by the customer), which is on the boundary and being evaluated separately

#### Consequences

**Positive:**
- Eliminates existential safety/liability risk
- Allows us to maintain "advisory software" regulatory positioning (not subject to NERC CIP operational technology certification)
- Simpler security model: Helios has no write access to physical grid infrastructure
- Customers trust a monitoring tool; control tool would require a much higher trust bar

**Negative:**
- Product scope is narrower than some customers want
- Competitive risk: if a well-funded competitor adds control capabilities safely, they close the gap

**Review:** This ADR was reviewed in Q4 2024 as scheduled. The decision stands. Board consensus is that Helios should remain advisory-only until we have 5+ years of operational data and formal safety certification processes. "Grid Autonomy" (automated demand response) is the first step toward advisory automation — it will inform whether and how to approach control.

---

*Document maintained by @david.okafor and @priya.nair*  
*New ADR proposals → `helios-rfcs` GitHub repository + ARB agenda (`#helios-architecture`)*  
*Related: [System Overview](/02-architecture/system-overview.md) · [Technical Debt Register](/05-engineering/technical-debt-register.md) · [Project Timeline](/supplemental/project-timeline-history.md)*
