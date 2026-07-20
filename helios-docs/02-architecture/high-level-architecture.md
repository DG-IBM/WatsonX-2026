# High-Level Architecture — Helios

> **Location:** Confluence → Helios Engineering Space → Architecture → High-Level Architecture  
> **Owner:** Priya Nair (Staff Engineer, Platform) · @priya.nair  
> **Last Updated:** 2024-10-22  
> **Status:** Current — reflects v4.7 architecture  
> **Related:** [System Overview](/02-architecture/system-overview.md) · [Microservices Overview](/02-architecture/microservices-overview.md) · [AWS Architecture](/04-platform/aws-architecture.md) · [Kubernetes Guide](/04-platform/kubernetes-guide.md)

---

> *This document is diagram-heavy by design. Architecture diagrams should be the fastest way to orient yourself. The narrative lives in [System Overview](/02-architecture/system-overview.md). Read both.*

---

## Platform Architecture Overview

The following diagram represents the full Helios platform architecture at the component level. It shows external actors, the ingestion layer, the event streaming backbone, the processing and API layers, the data layer, and the three user-facing surfaces.

```mermaid
graph TB
    subgraph "External"
        SM["🔌 Smart Meters\n(42M+ devices)"]
        SCADA["🏭 SCADA Systems\nUtility Substations"]
        BATTERY["🔋 Battery Storage\nSystems"]
        SOLAR["☀️ Renewable Sources\nWind / Solar"]
        WEATHER["🌤 Weather API\n(Tomorrow.io)"]
        BILLING["💳 Billing Systems\n(Oracle CC&B / SAP)"]
    end

    subgraph "Ingestion Layer — us-east-1"
        EMQX["EMQX MQTT Broker\nClustered, 3 nodes"]
        SCADA_A["SCADA Adapters\nIEC 61968 / DNP3 / Modbus"]
        IOT_B["helios-iot-bridge\n(Go) — validates & normalizes"]
    end

    subgraph "Event Backbone"
        MSK["AWS MSK (Kafka 3.5)\n12 brokers, 3 AZs\n>100 topics"]
    end

    subgraph "Processing Services — EKS"
        GM["helios-grid-monitor\n(Go)\nState management, alerts"]
        OD["helios-outage-detect\n(Go)\nFault isolation, topology"]
        FC["helios-forecasting\n(Go + Python)\nDemand, fault prediction"]
        GIS_S["helios-gis\n(Go)\nAsset topology, geospatial"]
        DP["helios-data-pipeline\n(Spark on EMR)\nBatch enrichment, S3"]
    end

    subgraph "API Layer — EKS"
        GW["helios-api-gateway\n(Node.js)\nGraphQL + REST"]
        AUTH["Auth — Cognito + OPA\nJWT validation, RBAC"]
        NOTIFY["helios-notify\n(Node.js)\nEmail / SMS / Push"]
        DISPATCH["helios-dispatch\n(Node.js)\nWork orders, routing"]
    end

    subgraph "Data Layer"
        TSDB[("TimescaleDB\nMeter readings\n~4TB compressed")]
        PGMAIN[("PostgreSQL Main\nAssets, tenants\nalerts, work orders")]
        REDIS_C[("Redis Cluster\nLive grid state\nSessions, cache")]
        RS[("Redshift\nAnalytics warehouse")]
        S3L[("S3 Data Lake\nParquet + model artifacts")]
    end

    subgraph "User Surfaces"
        PORTAL["Grid Ops Portal\n(Next.js 14)\nControl room UI"]
        CUST_P["Customer Portal\n(React SPA)\nConsumer-facing"]
        MOBILE["Technician App\n(React Native)\nField operations"]
    end

    SM -->|"MQTT TLS"| EMQX
    BATTERY -->|"MQTT TLS"| EMQX
    SCADA -->|"IEC 61968 / DNP3"| SCADA_A
    SOLAR -->|"IEC 61968"| SCADA_A
    EMQX --> IOT_B
    SCADA_A --> IOT_B
    IOT_B -->|"Avro schema"| MSK

    MSK --> GM
    MSK --> OD
    MSK --> FC
    MSK --> GIS_S
    MSK --> DP
    MSK --> NOTIFY

    WEATHER -->|"REST poll, 5min"| FC
    BILLING -->|"REST API"| GW

    GM --> TSDB
    GM --> PGMAIN
    GM <--> REDIS_C
    OD --> PGMAIN
    OD --> DISPATCH
    FC --> PGMAIN
    FC --> S3L
    GIS_S --> PGMAIN
    DP --> S3L
    DP --> RS

    GW <--> AUTH
    GW --> GM
    GW --> FC
    GW --> DISPATCH
    GW --> GIS_S
    GW <--> REDIS_C

    PORTAL -->|"HTTPS + WSS"| GW
    CUST_P -->|"HTTPS"| GW
    MOBILE -->|"HTTPS"| GW
```

---

## Network and Zone Architecture

```mermaid
graph TB
    subgraph "Public Internet"
        USERS["Users\n(browsers, mobile)"]
        IOT_DEVICES["IoT Devices\n(meters, SCADA)"]
    end

    subgraph "AWS us-east-1"
        subgraph "Public Subnet"
            CF["CloudFront CDN\n(portal static assets)"]
            ALB["Application Load Balancer\n(HTTPS termination)"]
            NLB["Network Load Balancer\n(MQTT / 8883)"]
        end

        subgraph "Private Subnet — App Tier"
            EKS["EKS Cluster\nhelios-prod-eks\n(40+ nodes, 3 AZs)"]
        end

        subgraph "Private Subnet — Data Tier"
            RDS["RDS PostgreSQL\nMulti-AZ (primary + 2 read replicas)"]
            ELASTICACHE["ElastiCache Redis\nCluster mode, 3 shards"]
            MSK_CLUSTER["MSK Kafka\n12 brokers, 3 AZs"]
            TIMESCALE["RDS PostgreSQL\n+ TimescaleDB ext\n(helios-ts cluster)"]
        end

        subgraph "Isolated Subnet — IoT"
            EMQX_CLUSTER["EMQX Broker Cluster\n3 nodes, dedicated subnet"]
        end
    end

    subgraph "AWS us-east-1 — Data"
        RS_CLUSTER["Redshift Cluster\n(helios-analytics)"]
        S3_LAKE["S3 Buckets\nhelios-data-lake\nhelios-artifacts"]
        EMR["EMR Spark Cluster\n(batch jobs, on-demand)"]
    end

    subgraph "AWS eu-west-1 — DR"
        EKS_DR["EKS Cluster (standby)\nhelios-dr-eks"]
        RDS_DR["RDS Read Replica\n(cross-region)"]
    end

    USERS --> CF
    CF --> ALB
    ALB --> EKS
    IOT_DEVICES -->|"MQTT/8883 TLS"| NLB
    NLB --> EMQX_CLUSTER
    EMQX_CLUSTER --> EKS
    EKS --> RDS
    EKS --> ELASTICACHE
    EKS --> MSK_CLUSTER
    EKS --> TIMESCALE
    EKS --> S3_LAKE
    MSK_CLUSTER -->|"MSK replication"| EKS_DR
    RDS -->|"cross-region replica"| RDS_DR
    EMR --> S3_LAKE
    EMR --> RS_CLUSTER
```

---

## Service Communication Patterns

Helios uses three distinct communication patterns, chosen based on the characteristics of each interaction:

### 1. Event Streaming (Kafka) — Async, Durable
**Used for:** IoT telemetry, grid events, alert propagation, state changes  
**When to choose:** When the producer does not need to know whether the consumer processed the message. When messages need to be replayable. When there are multiple consumers of the same data.

```
Producer → Kafka Topic → Consumer Group A (grid-monitor)
                       → Consumer Group B (forecasting)
                       → Consumer Group C (notification)
                       → Consumer Group D (data-pipeline)
```

### 2. REST/GraphQL via API Gateway — Sync, Request/Response
**Used for:** User-initiated actions (loading the portal, submitting work orders), client-to-server queries  
**When to choose:** When the client needs an immediate response. When the operation is transactional (create/update/delete).

```
Portal → HTTPS → API Gateway (GraphQL) → Service → Response
Mobile → HTTPS → API Gateway (REST)    → Service → Response
```

### 3. gRPC — Sync, Service-to-Service
**Used for:** Internal service-to-service calls where latency is critical and the payload schema is stable  
**Currently used for:** Forecasting engine ↔ Grid Monitor (model inference results), GIS Service ↔ Grid Monitor (topology queries)

```
Grid Monitor → gRPC → Forecasting Engine (get current 72hr forecast for feeder X)
Grid Monitor → gRPC → GIS Service (get downstream topology from node Y)
```

### 4. Redis Pub/Sub — Real-time Portal Push
**Used for:** Streaming live grid state changes to connected portal clients  
**How it works:** Grid Monitor writes to Redis channel `alerts:{tenant_id}` and `state:{tenant_id}`. The API Gateway subscribes to these channels and pushes updates to connected browser clients over WebSocket.

```
Grid Monitor → Redis PubSub → API Gateway → WebSocket → Browser
```

---

## Request Lifecycle: Grid Operations Portal

A complete trace of loading the main grid dashboard:

```mermaid
sequenceDiagram
    participant Browser as Browser (Grid Ops Portal)
    participant GW as API Gateway
    participant Auth as Auth Middleware (OPA)
    participant Redis as Redis Cache
    participant GM as Grid Monitor Service
    participant TSDB as TimescaleDB

    Browser->>GW: GraphQL query: gridDashboard(tenantId, region)
    GW->>Auth: Validate JWT + check permissions
    Auth-->>GW: Authorized (role: GRID_OPERATOR, tenantId: CUST-MWG)
    GW->>Redis: GET t:CUST-MWG:grid:state:region:cedar-rapids
    Redis-->>GW: Cache HIT — return live state (< 1ms)
    GW->>GM: gRPC GetAlertSummary(tenantId, region, last24h)
    GM->>TSDB: SELECT COUNT, severity FROM alerts WHERE...
    TSDB-->>GM: Alert summary data
    GM-->>GW: AlertSummary response
    GW-->>Browser: Combined GraphQL response (grid state + alerts)
    Note over Browser,GW: Total: ~45ms (cache hit path)
    Browser->>GW: WS upgrade: SUBSCRIBE grid.state.CUST-MWG
    GW->>Redis: SUBSCRIBE alerts:CUST-MWG
    Note over GW,Redis: WebSocket connection established
    Redis-->>GW: Push: new alert (async)
    GW-->>Browser: WS message: alert event
```

---

## Multi-Region Architecture

```mermaid
graph LR
    subgraph "Primary — us-east-1"
        P_EKS["EKS (active)"]
        P_RDS["RDS (primary)"]
        P_MSK["MSK (active)"]
        P_REDIS["ElastiCache (primary)"]
    end

    subgraph "DR — eu-west-1"
        DR_EKS["EKS (standby/warm)"]
        DR_RDS["RDS (read replica, cross-region)"]
        DR_MSK["MSK (MirrorMaker2 replica)"]
    end

    subgraph "APAC — ap-southeast-2"
        AP_EKS["EKS (active — APAC tenants)"]
        AP_RDS["RDS (APAC tenants only)"]
        AP_MSK["MSK (APAC tenants only)"]
    end

    P_RDS -->|"async replication"| DR_RDS
    P_MSK -->|"MirrorMaker2"| DR_MSK
    
    style DR_EKS fill:#fff3cd,stroke:#ffc107
    style DR_RDS fill:#fff3cd,stroke:#ffc107
    style DR_MSK fill:#fff3cd,stroke:#ffc107
```

> **Note on DR:** The EU DR cluster (`eu-west-1`) is a warm standby. It has the EKS cluster configured and the RDS read replica running, but the application services are not actively processing. Failover requires approximately 15–25 minutes of manual steps. This is inadequate for our 99.99% SLA commitment to Midwest Grid Co. The full DR automation plan is in [Disaster Recovery Plan](/06-operations/disaster-recovery-plan.md). Automated failover is a Q2 2025 infrastructure investment.

---

## Security Perimeter

```mermaid
graph TB
    subgraph "Zone: Internet"
        EXT_USER["Grid Operators\n(browsers)"]
        EXT_IOT["IoT Devices"]
        EXT_API["Third-Party API\nConsumers"]
    end

    subgraph "Zone: Edge"
        WAF["AWS WAF\n(rate limiting, bot detection)"]
        CF2["CloudFront\n(DDoS protection, caching)"]
        CERT["ACM Certificate\nTLS termination"]
    end

    subgraph "Zone: Application (VPC Private)"
        EKS2["EKS Services\n(no public IPs)"]
        SECRETS["HashiCorp Vault\n(secrets injection)"]
    end

    subgraph "Zone: Data (VPC Isolated)"
        DATA_STORES["PostgreSQL / Redis / MSK\n(security group: data-tier)"]
    end

    EXT_USER --> WAF --> CF2 --> CERT --> EKS2
    EXT_IOT -->|"mTLS"| EKS2
    EXT_API --> WAF --> EKS2
    EKS2 --> SECRETS
    EKS2 --> DATA_STORES
    SECRETS -.->|"no direct access"| EXT_USER
```

---

## Key Architecture Decisions (Summary)

| Decision | Choice | Rationale | ADR |
|---|---|---|---|
| Primary API style | GraphQL (client) + REST (internal/IoT) | Client flexibility + IoT simplicity | [ADR-002](/05-engineering/adrs.md#adr-002) |
| Event backbone | Apache Kafka (MSK) | Durability, replay, fan-out | [ADR-003](/05-engineering/adrs.md#adr-003) |
| GIS mapping library | MapLibre GL JS | License cost, self-hosting | [ADR-004](/05-engineering/adrs.md#adr-004) |
| IoT broker | EMQX | Scale, clustering, Kafka integration | [ADR-005](/05-engineering/adrs.md#adr-005) |
| Frontend state | Zustand (replaced Redux) | Bundle size, simplicity | [ADR-006](/05-engineering/adrs.md#adr-006) |
| Time-series storage | TimescaleDB | PostgreSQL compatibility + compression | [ADR-007](/05-engineering/adrs.md#adr-007) |
| Service mesh | None (currently) | Complexity vs. benefit trade-off | [ADR-008](/05-engineering/adrs.md#adr-008) |
| IoT multi-region | Deferred | Cost vs. current risk profile | [ADR-009](/05-engineering/adrs.md#adr-009) |
| Direct grid control | Declined | Safety, liability | [ADR-010](/05-engineering/adrs.md#adr-010) |

---

## Component Port Reference

Quick reference for service-to-service communication:

| Service | Internal Port | Protocol | Health Check |
|---|---|---|---|
| `helios-api-gateway` | 4000 | HTTP/GraphQL | `GET /health` |
| `helios-grid-monitor` | 8080 (gRPC) | gRPC | gRPC health protocol |
| `helios-outage-detect` | 8081 | gRPC | gRPC health protocol |
| `helios-forecasting` | 9000 | gRPC | gRPC health protocol |
| `helios-iot-bridge` | 8883 (MQTT) / 9090 (internal) | MQTT / HTTP | `GET /healthz` |
| `helios-dispatch` | 3001 | HTTP/REST | `GET /health` |
| `helios-notify` | 3002 | HTTP/REST | `GET /health` |
| `helios-gis` | 8082 | gRPC + REST | `GET /healthz` |
| EMQX | 8883 (MQTT), 18083 (dashboard) | MQTT | EMQX health API |

---

## Things Every New Engineer Should Know

1. **The Kafka topics are documented in [`/02-architecture/event-driven-architecture.md`](/02-architecture/event-driven-architecture.md).** Do not produce to a topic without checking its Avro schema. The Schema Registry will reject malformed messages and your events will drop silently to the DLQ.

2. **The API Gateway is the only public ingress for application traffic.** Do not add `LoadBalancer` type Services to EKS for application services. Everything goes through the gateway. See [Kubernetes Guide — Ingress](/04-platform/kubernetes-guide.md#ingress).

3. **Live grid state reads from Redis, not from Postgres.** If your feature needs "current" grid state, read from Redis using the `t:{tenant_id}:grid:state:*` key pattern, not from a database query. The database is for history and reporting.

4. **CloudFront caches the portal static assets.** After a deployment, cache invalidation runs automatically in the CI/CD pipeline (`aws cloudfront create-invalidation`). If you're seeing stale portal assets in production, check the deployment logs first before assuming a bug.

5. **The APAC cluster is NOT a full replica of us-east-1.** It runs the core services but not the full analytics pipeline. Features that depend on Redshift are unavailable to APAC tenants (TasNetworks). This is documented in [AWS Architecture — APAC Cluster](/04-platform/aws-architecture.md#apac-cluster).

---

*Document maintained by @priya.nair*  
*Architecture diagrams updated by @kenji.watanabe and @tom.reeves when infrastructure changes*  
*Related: [System Overview](/02-architecture/system-overview.md) · [AWS Architecture](/04-platform/aws-architecture.md) · [ADRs](/05-engineering/adrs.md)*
