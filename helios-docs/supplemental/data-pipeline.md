# Data Pipeline

**Owner:** David Okafor (Principal Engineer, Messaging) + Lin Chen (Staff Engineer, AI/Data)
**Team:** Platform Engineering / AI & Data Engineering
**Last Updated:** 2024-10-28
**Related Docs:** [Event-Driven Architecture](/02-architecture/event-driven-architecture.md) · [Database Architecture](/02-architecture/database-architecture.md) · [AI Forecasting Engine](/03-services/ai-forecasting-engine.md) · [Analytics Platform](/supplemental/analytics-platform.md) · [IoT Device Management](/03-services/iot-device-management.md) · [Performance Bottlenecks](/05-engineering/performance-bottlenecks.md)

---

> **David, 2024-10-28:** I wrote the first version of this pipeline in 2020 with Chidi Eze over three weekends. It was a simpler time — we had 8 customers and maybe 2 million meters. The architecture has evolved significantly since then (see §8 for history), but there are still some rough edges from those early decisions baked in. The Kafka topic naming convention is one — I would not choose the same names today, but changing them now would be a significant migration.
>
> **Lin, 2024-09-05:** Adding a note that the ML training pipeline section (§5) was rewritten in Q3 2024 after we moved model training off the main EKS cluster. The old process was genuinely terrible — training jobs would occasionally spike CPU on the main cluster and affect production latency. That's fixed now.

---

## Table of Contents

1. [Pipeline Overview](#pipeline-overview)
2. [Ingestion Layer (IoT → Kafka)](#ingestion-layer-iot--kafka)
3. [Stream Processing (Kafka → Consumers)](#stream-processing-kafka--consumers)
4. [Storage Layer](#storage-layer)
5. [ML Training Pipeline](#ml-training-pipeline)
6. [Analytics Pipeline (Kafka → Redshift)](#analytics-pipeline-kafka--redshift)
7. [Data Quality & Validation](#data-quality--validation)
8. [Kafka Topic Design](#kafka-topic-design)
9. [Monitoring & Alerting](#monitoring--alerting)
10. [Pipeline History & Decisions](#pipeline-history--decisions)

---

## 1. Pipeline Overview

The Helios data pipeline processes telemetry from 42 million smart meters and thousands of grid assets, transforming it into stored time-series data, AI model inputs, analytics warehouse data, and real-time operational insights.

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│                          HELIOS DATA PIPELINE                                       │
│                                                                                      │
│  ┌─────────────┐     ┌─────────────┐     ┌──────────────────────────────────────┐  │
│  │  IoT Devices │────►│  AWS IoT    │────►│          KAFKA CLUSTER               │  │
│  │  (42M meters)│  MQTT│  Core       │ raw │  grid.telemetry.raw                  │  │
│  └─────────────┘     └─────────────┘     │  grid.meter.events                   │  │
│                                          │  grid.device.status                  │  │
│  ┌─────────────┐     ┌─────────────┐     │  grid.alerts.outage                  │  │
│  │  Substations │────►│  IoT Ingest │────►│  grid.forecasting.requests           │  │
│  │  & RTUs     │  MQTT│  Service    │     │  helios.dispatch.jobs                │  │
│  └─────────────┘  HTTPS│  (Go)       │     │  helios.notifications.outbound      │  │
│                        └─────────────┘     │  helios.audit.events                 │  │
│                                           └──────────────┬───────────────────────┘  │
│                                                          │                           │
│                   ┌──────────────────┬───────────────────┼────────────────────┐     │
│                   │                  │                   │                    │     │
│                   ▼                  ▼                   ▼                    ▼     │
│          ┌─────────────┐   ┌──────────────┐   ┌───────────────┐   ┌────────────┐  │
│          │ Grid Event   │   │  Outage Det. │   │  Forecasting  │   │  Analytics │  │
│          │ Processor   │   │  Service     │   │  Engine       │   │  Connector │  │
│          │ (Go)        │   │  (Python/Go) │   │  (Python)     │   │  (Go)      │  │
│          └──────┬──────┘   └──────┬───────┘   └───────┬───────┘   └─────┬──────┘  │
│                 │                  │                   │                  │         │
│                 ▼                  ▼                   ▼                  ▼         │
│          TimescaleDB          PostgreSQL          PostgreSQL +       Redshift       │
│          (grid_readings)    (outage_events)       Redis cache       (analytics DW)  │
└────────────────────────────────────────────────────────────────────────────────────┘
```

**Peak throughput:** 380,000 events/second
**Daily volume:** ~2.8 TB raw telemetry ingested
**Storage (hot, TimescaleDB):** 47 TB (7-year retention)
**Storage (analytics, Redshift):** ~290 TB

---

## 2. Ingestion Layer (IoT → Kafka)

### AWS IoT Core → IoT Ingest Service

Smart meters and field devices connect to AWS IoT Core over MQTT (port 8883, TLS 1.2+). IoT Core handles connection management, authentication (X.509 certificates), and buffering.

IoT Core rule engine routes MQTT messages to an SQS queue, which the IoT Ingest Service (Go) polls and processes.

```go
// iot-ingest-service/internal/processor/meter_reading.go
func (p *MeterReadingProcessor) Process(ctx context.Context, msg *sqs.Message) error {
    var raw iotcore.MeterReading
    if err := json.Unmarshal([]byte(aws.StringValue(msg.Body)), &raw); err != nil {
        metrics.IncrCounter("ingest.parse_error", 1)
        return fmt.Errorf("parse error: %w", err)  // non-retryable — to DLQ
    }

    // Validate against schema
    if err := p.validator.Validate(raw); err != nil {
        metrics.IncrCounter("ingest.validation_error", 1)
        return ErrInvalidMessage{Cause: err}  // non-retryable — to DLQ
    }

    // Enrich with device registry lookup
    device, err := p.deviceRegistry.Get(ctx, raw.DeviceID)
    if err != nil {
        return fmt.Errorf("device lookup failed: %w", err)  // retryable
    }

    // Produce to Kafka
    kafkaMsg := &kafka.GridTelemetryRaw{
        DeviceID:   raw.DeviceID,
        CustomerID: device.CustomerID,
        Timestamp:  raw.Timestamp,
        Readings:   raw.Readings,
        Quality:    raw.Quality,
    }
    return p.producer.Produce(ctx, "grid.telemetry.raw", kafkaMsg)
}
```

### Throughput Management

At peak (weekday 17:30–19:30 UTC), smart meters send readings every 15 minutes, but with clock jitter, many arrive within a few-minute window. The ingest service handles this via:
- **SQS buffering:** IoT Core → SQS with 10-minute visibility timeout
- **Batch consumption:** The ingest service pulls 1,000 messages per batch from SQS
- **Auto-scaling:** HPA scales ingest pods from 4 (baseline) to 24 (peak) based on SQS queue depth

---

## 3. Stream Processing (Kafka → Consumers)

### Grid Event Processor (Primary Consumer)

The grid event processor is the main Kafka consumer. It runs as a Go service with 8–16 pods, each running multiple partition consumers.

**Input topic:** `grid.telemetry.raw`
**Responsibilities:**
- Deserialise and validate Avro messages
- Apply customer-specific data transformation rules
- Write to TimescaleDB (`grid_readings` hypertable)
- Detect and emit meter events (offline, reconnected, quality flag changes) to `grid.meter.events`
- Compute 5-minute rolling aggregates (in-memory, flush to TimescaleDB)

```go
// grid-event-processor/internal/consumer/telemetry_consumer.go
func (c *TelemetryConsumer) handleMessage(msg *kafka.Message) error {
    var reading schema.GridTelemetryRaw
    if err := c.deserializer.Deserialize(msg.Value, &reading); err != nil {
        return c.toDLQ(msg, err)
    }

    // Write to TimescaleDB in batch
    c.batcher.Add(&db.GridReading{
        MeterID:    reading.DeviceID,
        CustomerID: reading.CustomerID,
        Timestamp:  reading.Timestamp.UTC(),
        PowerKW:    reading.Readings.ActivePowerKW,
        EnergyKWh:  reading.Readings.EnergyKWh,
        QualityFlag: reading.Quality,
    })

    // Detect meter state changes
    if event := c.stateTracker.Update(reading); event != nil {
        return c.eventProducer.Produce("grid.meter.events", event)
    }

    return nil
}

// Batch write every 500ms or 5000 records, whichever comes first
func (c *TelemetryConsumer) flushBatcher(ctx context.Context) {
    ticker := time.NewTicker(500 * time.Millisecond)
    for {
        select {
        case <-ticker.C:
            c.batcher.Flush(ctx)
        case <-ctx.Done():
            return
        }
    }
}
```

### Outage Detection Consumer

Separate consumer group (`outage-detection-consumer`) reads from `grid.telemetry.raw` in parallel with the grid event processor. Maintains a sliding window of readings per meter and feeds the anomaly detection model. See [Outage Detection Service](/03-services/outage-detection-service.md).

### Forecasting Request Consumer

Reads from `grid.forecasting.requests` to trigger on-demand forecast refreshes. Standard demand: the scheduler triggers requests every 5 minutes. Exceptional demand: the API can trigger immediate requests for specific regions.

---

## 4. Storage Layer

### TimescaleDB (Operational Time Series)

The `grid_readings` hypertable stores all meter readings with 7-year retention.

```sql
-- Schema (simplified)
CREATE TABLE grid_readings (
    meter_id       UUID        NOT NULL,
    customer_id    UUID        NOT NULL,
    timestamp      TIMESTAMPTZ NOT NULL,
    power_kw       DECIMAL(12,4),
    energy_kwh     DECIMAL(12,4),
    voltage_v      DECIMAL(8,2),
    current_a      DECIMAL(8,2),
    quality_flag   SMALLINT    DEFAULT 0,  -- 0=good, 1=estimated, 2=suspect
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

SELECT create_hypertable('grid_readings', 'timestamp', chunk_time_interval => INTERVAL '1 week');

-- Compression policy: compress chunks older than 7 days
SELECT add_compression_policy('grid_readings', INTERVAL '7 days');

-- Retention policy: drop chunks older than 7 years (regulatory retention limit)
SELECT add_retention_policy('grid_readings', INTERVAL '7 years');

-- Continuous aggregates for common query patterns
CREATE MATERIALIZED VIEW grid_readings_hourly
WITH (timescaledb.continuous) AS
SELECT 
    meter_id,
    customer_id,
    time_bucket('1 hour', timestamp) AS bucket,
    AVG(power_kw) AS avg_power_kw,
    MAX(power_kw) AS max_power_kw,
    SUM(energy_kwh) AS total_energy_kwh,
    COUNT(*) AS reading_count,
    MIN(quality_flag) AS min_quality
FROM grid_readings
GROUP BY meter_id, customer_id, bucket;
```

**Current size:** 47 TB across ~3,800 weekly chunks
**Compressed data ratio:** ~8:1 average compression for chunks >7 days old
**Query performance:** Queries with a time range filter typically return in <200ms for single-meter queries; <2s for fleet aggregations.

See [Performance Bottleneck PB-001](/05-engineering/performance-bottlenecks.md) for the known issue with large analytical queries.

### PostgreSQL (Application Data)

Application data (customers, meters registry, outage records, dispatch jobs) lives in standard PostgreSQL tables alongside TimescaleDB. Different schemas for logical separation:
- `grid` schema: meter registry, topology
- `operations` schema: outage events, dispatch jobs
- `tenancy` schema: customer accounts, permissions
- `audit` schema: audit log records

---

## 5. ML Training Pipeline

### Architecture (Post Q3 2024 Redesign)

ML training now runs on a dedicated SageMaker training cluster, completely separate from the production EKS cluster. This was moved after training jobs were impacting production latency in early 2024 (see [Performance Bottleneck PB-004](/05-engineering/performance-bottlenecks.md)).

```
Training Trigger (cron or manual)
        │
        ▼
SageMaker Training Pipeline
  Step 1: Feature extraction (from Redshift analytics DW)
  Step 2: Data preprocessing & normalisation
  Step 3: Model training (TFT + XGBoost)
  Step 4: Model evaluation (hold-out set MAE)
  Step 5: Champion/challenger comparison
  Step 6: If new model beats champion: promote to staging
        │
        ▼
Model artifact stored in S3 (helios-ml-artifacts bucket)
        │
        ▼
Manual promotion review (Lin Chen) → Production deployment
        │
        ▼
Forecasting engine loads new model version
```

### Training Data Sources

```python
# forecasting-engine/training/data_preparation.py
def prepare_training_features(
    customer_id: str,
    start_date: datetime,
    end_date: datetime,
    redshift_conn
) -> pd.DataFrame:
    """
    Build feature matrix for demand forecasting model training.
    Uses anonymised aggregate data only - never individual meter readings.
    """
    query = """
        SELECT 
            time_bucket,
            customer_id,
            region_code,
            total_demand_mw,
            avg_temperature_c,
            is_weekday,
            is_holiday,
            hour_of_day,
            day_of_week,
            month,
            LAG(total_demand_mw, 96) OVER (ORDER BY time_bucket) AS demand_1d_ago,
            LAG(total_demand_mw, 672) OVER (ORDER BY time_bucket) AS demand_7d_ago
        FROM analytics.demand_aggregates
        WHERE customer_id = %s
        AND time_bucket BETWEEN %s AND %s
        ORDER BY time_bucket
    """
    df = pd.read_sql(query, redshift_conn, params=(customer_id, start_date, end_date))
    return df
```

---

## 6. Analytics Pipeline (Kafka → Redshift)

The analytics pipeline feeds a Redshift data warehouse used by the Analytics Platform for customer-facing reporting and internal business intelligence.

### Architecture

```
Kafka Topics
    │
    ▼
Kafka → Redshift Connector
(Go service + Kafka Connect)
    │
    ├── grid.telemetry.raw → S3 (raw landing zone)
    │                            │
    │                            ▼
    │                       AWS Glue ETL job
    │                       (runs every 30 min)
    │                            │
    │                            ▼
    │                       Redshift staging tables
    │                            │
    │                            ▼
    │                       dbt transformations
    │                       (run every hour)
    │                            │
    │                            ▼
    │                       Redshift mart tables
    │
    └── helios.audit.events → S3 (immutable WORM storage)
```

### dbt Models

Lin Chen and Ravi Krishnan maintain the dbt models. They live in `helios-analytics/dbt/models/`. Key models:

| Model | Layer | Description |
|-------|-------|-------------|
| `stg_grid_readings` | Staging | Raw readings with type casting, filtering |
| `stg_outage_events` | Staging | Outage records with duration calculation |
| `int_demand_aggregates` | Intermediate | 15-min aggregated demand by region |
| `mart_customer_consumption` | Mart | Customer-facing energy consumption metrics |
| `mart_grid_reliability` | Mart | Grid reliability KPIs (SAIDI, SAIFI, etc.) |
| `mart_outage_analysis` | Mart | Outage analytics by cause, duration, geography |

---

## 7. Data Quality & Validation

### Schema Validation

All Kafka messages are validated against registered Avro schemas. Invalid messages go to DLQ. Schema evolution follows backward-compatible rules — new optional fields only. See [Event-Driven Architecture](/02-architecture/event-driven-architecture.md#schema-evolution).

### Reading Quality Flags

| Flag | Meaning | Treatment |
|------|---------|-----------|
| 0 | Good | Use as-is |
| 1 | Estimated (meter provided an estimate, not a direct read) | Use but flag in aggregations |
| 2 | Suspect (out-of-range value, communication error) | Include but exclude from billing aggregations |
| 3 | Invalid (failed validation) | Sent to DLQ, not stored |

### Data Freshness Monitoring

```
Alert: grid_telemetry_freshness_seconds > 300 for any customer_id
  → SEV-2 if >1 customer affected
  → SEV-1 if >3 customers affected or >1 hour stale
```

---

## 8. Kafka Topic Design

### Current Topic Inventory

| Topic | Partitions | Retention | Consumers |
|-------|-----------|-----------|-----------|
| `grid.telemetry.raw` | 48 | 7 days | grid-event-processor, outage-detection |
| `grid.meter.events` | 24 | 30 days | grid-api, notification-service |
| `grid.device.status` | 12 | 30 days | iot-management, grid-api |
| `grid.alerts.outage` | 12 | 90 days | dispatch-service, notification-service, grid-api |
| `grid.forecasting.requests` | 6 | 1 day | forecasting-engine |
| `helios.dispatch.jobs` | 12 | 30 days | dispatch-service, notification-service |
| `helios.notifications.outbound` | 12 | 7 days | notification-service consumers |
| `helios.audit.events` | 12 | Infinite (S3 sink) | audit-sink-connector |
| `*.dlq` (per topic) | 6 | 30 days | Manual DLQ processor |

### Naming Convention Note

The `grid.*` vs `helios.*` prefix inconsistency is a historical artifact. Early topics were `grid.*` as we only had grid data. When we added business-layer topics (dispatch, notifications), we used `helios.*`. We should have standardised on `helios.*` from the start. This is tracked as TD-009 in the [Technical Debt Register](/05-engineering/technical-debt-register.md) — a migration is planned but not scheduled.

---

## 9. Monitoring & Alerting

Key pipeline health indicators:

| Metric | Normal Range | Alert Threshold |
|--------|-------------|-----------------|
| `kafka_consumer_lag{group=grid-processor-consumer}` | <1,000 | >500,000 (SEV-1) |
| `ingest_messages_per_second` | 200k–380k | <50k (possible ingestion failure) |
| `db_write_latency_p99` (TimescaleDB) | <20ms | >500ms |
| `dbt_run_duration_seconds` | <600s | >1800s |
| `data_freshness_age_seconds{customer}` | <60s | >300s |

---

## 10. Pipeline History & Decisions

- **2020:** Initial pipeline. IoT Core → Lambda → direct PostgreSQL write. No Kafka. No TimescaleDB. Supported <1M meters.
- **2021 (ADR-002):** Introduced Kafka for decoupling ingestion from processing. TimescaleDB added to handle growing telemetry volume. Direct Lambda write was a bottleneck.
- **2022:** Moved IoT ingest from Lambda to Go service for better throughput control. Added Schema Registry.
- **2023:** Added analytics pipeline (Redshift + dbt). Added MirrorMaker 2 for DR replication.
- **2024 Q1:** ML training moved off main EKS cluster to SageMaker (see Lin's note above).
- **2024 Q3:** DLQ monitoring improved after INC-2024-0622 where a malformed message silently blocked a partition for 4 hours before being noticed.

---

*For pipeline issues: `#platform-data-infra` Slack. David Okafor or Lin Chen are the first contacts. For DLQ issues specifically: check the [Kafka Troubleshooting guide](https://lumina-confluence.atlassian.net/wiki/spaces/ENG/pages/kafka-troubleshooting) in Confluence.*
