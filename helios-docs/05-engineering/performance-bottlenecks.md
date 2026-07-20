# Performance Bottlenecks — Helios

> **Location:** Confluence → Helios Engineering Space → Engineering → Performance Bottlenecks  
> **Owner:** David Okafor (Principal Engineer) · @david.okafor  
> **Last Updated:** 2024-11-05  
> **Status:** Living document — updated with every significant profiling finding  
> **Related:** [Technical Debt Register](/05-engineering/technical-debt-register.md) · [Database Architecture](/02-architecture/database-architecture.md) · [Monitoring & Observability](/04-platform/monitoring-observability.md)

---

> *"We do not optimize things we have not measured. Before you add a cache, a connection pool increase, or a query index, show me a profiler trace."*  
> — David Okafor, in code review, many times

---

## Active Bottlenecks

---

### PB-001: TimescaleDB Partition Count Growth
**ID:** PB-001  
**Service:** TimescaleDB `helios-ts` cluster  
**Severity:** Medium — degrading query planning, not yet impacting SLOs  
**Identified:** 2024-08-15  
**Owner:** @wei.liu, @lin.chen

**Observation:**  
The `meter_readings` hypertable currently has ~38,000 active chunks (daily partitions, post-compression). TimescaleDB query planner must evaluate all chunks to determine which are relevant to a query. As chunk count grows, query planning time increases — currently adding ~15–25ms to time-range queries that span > 30 days.

The customer portal's monthly usage chart query (28-day range) now has a P99 of 340ms, up from 180ms 6 months ago. The deterioration rate is ~8ms/month.

**Profiler evidence:**  
```sql
EXPLAIN ANALYZE
SELECT time_bucket('1 hour', reading_time) AS hour,
       SUM(active_energy_kwh) as total_kwh
FROM meter_readings
WHERE tenant_id = 'CUST-MWG'
  AND device_id = 'sm-42a9b7'
  AND reading_time > NOW() - INTERVAL '28 days';
```
Output shows `Append` node evaluating 31 chunks of 28 targeted (3 extra chunks from chunk boundary overlap), with planning time of 22ms.

**Mitigation in place:**  
- TimescaleDB `compress_orderby = 'reading_time DESC'` + 7-day compression policy reduces on-disk chunk size
- `meter_readings_hourly` continuous aggregate is the query target for customer portal (avoids raw hypertable)

**Remediation plan:**  
1. Enable TimescaleDB **chunk skipping** (experimental in TS 2.11, stable in TS 2.14 which we'll upgrade to in Q1 2025): this allows the planner to skip chunks based on column statistics
2. Evaluate increasing chunk interval from 1 day to 3 days for data older than 90 days (reduces chunk count by ~65%)
3. Implement aggressive tiering: data older than 1 year → S3 via `tiered_storage` (TS Enterprise feature; evaluating cost vs. performance trade-off)

**Tracking:** Jira epic DATA-891, target Q1 2025

---

### PB-002: API Gateway GraphQL Federation Overhead
**ID:** PB-002  
**Service:** `helios-api-gateway`  
**Severity:** Low — measurable overhead, not SLO-impacting  
**Identified:** 2024-07-03  
**Owner:** @rosa.lindqvist

**Observation:**  
Complex dashboard queries that federate data from 3+ sub-schemas (grid-monitor, forecasting, GIS) add 20–40ms overhead from Apollo Federation's sub-graph planning and fetch coordination. This is visible in traces as the federation overhead between the gateway resolving sub-graph queries.

**Profiler evidence:**  
Jaeger trace for `gridDashboard` query:
```
API Gateway (total): 127ms
  ├── Auth + authz: 8ms
  ├── Apollo Federation planning: 22ms   ← federation overhead
  ├── grid-monitor sub-graph: 45ms
  ├── forecasting sub-graph: 38ms
  └── Response assembly: 14ms
```

Without federation (direct sub-schema query): 67ms. Federation adds ~60ms.

**Mitigation in place:**  
- TanStack Query `staleTime: 30_000` caches dashboard query result for 30s in the portal
- Most dashboard loads are cache hits (< 1ms from TanStack Query)
- Only the first load per user per 30s interval hits the API

**Remediation options:**  
1. **Persisted queries:** Pre-compile the most frequent dashboard query as a persisted query hash to skip federation planning (estimated ~15ms saving on cold load)
2. **DataLoader batching improvement:** Some sub-graph resolvers are making N+1 DB queries; fixing these would reduce sub-graph latency more significantly than the planning overhead
3. **Accept current performance:** At P99 127ms (well under our 150ms SLO), this is not a priority fix

**Decision:** Accept current performance for now. Revisit if P99 approaches 200ms.

---

### PB-003: IoT Bridge Redis Device Registry Lookup on Cache Miss
**ID:** PB-003  
**Service:** `helios-iot-bridge`  
**Severity:** Low — only affects new/recently-changed devices  
**Identified:** 2024-06-10  
**Owner:** @lars.eriksson

**Observation:**  
On a cache miss (new device, or device cache expired), the IoT bridge falls through to PostgreSQL. The PostgreSQL `devices` table query takes 8–15ms at P99 (well-indexed, but still slower than Redis's 0.5ms P99).

During bulk provisioning events (a customer onboarding 500K meters), the cache miss rate temporarily spikes and PostgreSQL connection pool pressure increases. During the Q3 2024 TasNetworks onboarding, peak cache miss rate was 12% for 20 minutes, causing P99 device lookup to hit 45ms.

**Root cause:**  
Redis cache is populated on first lookup. When 500K new devices are provisioned simultaneously, none are in the Redis cache initially. The warm-up period creates a thundering herd against PostgreSQL.

**Remediation:**  
- Add a **provisioning webhook**: when a bulk provisioning job completes, pre-warm the Redis cache for all newly provisioned devices
- Pre-warm script: `helios-iot-bridge/scripts/warm-device-cache.py --tenant CUST-APAC --batch-size 1000`
- This is now a documented step in the customer onboarding runbook: `helios-docs/supplemental/deployment-guide.md#device-cache-warmup`

---

### PB-004: Dispatch Service Work Order List Query
**ID:** PB-004  
**Service:** `helios-dispatch` (Node.js 16)  
**Severity:** Low — SLO not breached, but trending  
**Identified:** 2024-09-22  
**Owner:** @james.osei

**Observation:**  
The work order list query (the main dispatch dashboard view) has degraded from P99 ~85ms (Q1 2024) to P99 ~190ms (Q3 2024). The query fetches all active work orders for a tenant sorted by `sla_due_at`:

```sql
SELECT wo.*, t.name as technician_name, t.current_lat, t.current_lng
FROM dispatch.work_orders wo
LEFT JOIN dispatch.technicians t ON wo.assigned_tech_id = t.id
WHERE wo.tenant_id = $1
  AND wo.status NOT IN ('RESOLVED', 'CLOSED', 'CANCELLED')
ORDER BY wo.sla_due_at ASC
LIMIT 100;
```

**Root cause:**  
The `idx_wo_sla` index covers `(tenant_id, sla_due_at)` with a partial filter on active statuses. The query plan was correct in Q1 but started doing index scans + sort when the active work order count for CUST-MWG exceeded 5,000. At 10,000+ active work orders (during a storm event), the query degrades to ~200ms.

**Fix applied (partial):**  
Added a covering index in migration V132:
```sql
CREATE INDEX CONCURRENTLY idx_wo_sla_covering
ON dispatch.work_orders(tenant_id, sla_due_at, status)
INCLUDE (assigned_tech_id, work_type, priority, location_lat, location_lng)
WHERE status NOT IN ('RESOLVED', 'CLOSED', 'CANCELLED');
```
P99 improved from 190ms to 140ms post-migration. Further improvement requires application-level changes (pagination enforcement, pre-computed SLA urgency bucket).

---

### PB-005: Outage Detection Topology Traversal Under Large Outages
**ID:** PB-005  
**Service:** `helios-outage-detect`  
**Severity:** Medium — can delay outage localization during large events  
**Identified:** 2024-04-18  
**Owner:** @chidi.eze

**Observation:**  
During a large outage (>5,000 affected meters), the depth-first topology traversal can take 800ms–1.2 seconds. The traversal is O(n) where n is the number of affected meters, and the in-memory topology graph is read-locked during traversal. This is acceptable for individual outages but during cascading failure events (multiple simultaneous large outages), traversals queue behind each other and total localization latency can exceed 5 seconds.

**Example:** Midwest Grid Co. winter storm event (2024-01-15):
- 7 simultaneous outage clusters detected over 40 seconds
- Traversal queue depth peaked at 4
- Localization latency for the 7th cluster: 4.8 seconds
- Operator saw 7 unlocalized outage records for ~25 seconds before localization completed

**Root cause:**  
Single read-write lock on the topology graph. Traversals from concurrent threads queue.

**Remediation options:**  
1. **Segment the topology by region.** Instead of one global graph per tenant, maintain a separate graph per region. Large utilities have 5–15 regions. Concurrent traversals in different regions would no longer block each other.
2. **Copy-on-read.** At traversal start, copy the relevant subgraph (downstream portion) into a per-traversal structure. This costs ~5ms for the copy but allows concurrent traversals without locking.

**Status:** Option 2 is being implemented by @chidi.eze in feat/GRID-512-topology-concurrent-traversal. Target: Sprint 91.

---

## Historical Bottlenecks (Resolved)

| ID | Description | Resolution | Version Fixed |
|---|---|---|---|
| PB-H001 | Node.js grid monitor CPU saturation at 3+ customers | Rewrote in Go (ADR-001) | v3.0 |
| PB-H002 | PostgreSQL I/O saturation from IoT read polling | Kafka event backbone (ADR-003) | v2.0 |
| PB-H003 | Redis connection pool exhaustion in api-gateway | Increased pool size + added connection timeout | v3.4 |
| PB-H004 | Kafka consumer group rebalancing causing 30s lag spikes | Upgraded to Kafka 3.5 cooperative rebalancing | v4.2 |
| PB-H005 | GIS tile generation blocking the GIS service HTTP thread | Moved to async tile generation + S3 cache | v3.6 |

---

## Profiling Tooling

### Go Services (pprof)

```bash
# CPU profile: 30 seconds
curl http://localhost:9090/debug/pprof/profile?seconds=30 -o cpu.prof
go tool pprof -http=:8888 cpu.prof

# Goroutine leak detection
curl http://localhost:9090/debug/pprof/goroutine > goroutine.prof
go tool pprof -text goroutine.prof | head -20

# Memory profile
curl http://localhost:9090/debug/pprof/heap -o heap.prof
go tool pprof -http=:8888 heap.prof
```

All Go services expose the pprof handler on port 9090 admin endpoint. In production, this port is not externally accessible — use `kubectl port-forward` first.

### PostgreSQL Slow Query Analysis

```sql
-- Find slow queries from the past hour
SELECT query, mean_exec_time, calls, total_exec_time, rows
FROM pg_stat_statements
WHERE mean_exec_time > 50  -- queries averaging > 50ms
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Analyze a specific query
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT ...;
```

### Grafana Dashboards for Performance

- [API Gateway Latency](https://grafana.internal.luminaenergy.com/d/api-gateway) — P50/P95/P99 by operation
- [Database Performance](https://grafana.internal.luminaenergy.com/d/database) — slow query rate, connection pool
- [TimescaleDB Chunks](https://grafana.internal.luminaenergy.com/d/timescaledb) — chunk count, compression ratio
- [Kafka Consumer Lag](https://grafana.internal.luminaenergy.com/d/kafka-consumer-lag) — per consumer group

---

*Document maintained by @david.okafor*  
*New bottleneck investigations → open a `PLAT` or service-specific Jira ticket, then add findings here*  
*Related: [Technical Debt Register](/05-engineering/technical-debt-register.md) · [Database Architecture](/02-architecture/database-architecture.md) · [Monitoring & Observability](/04-platform/monitoring-observability.md)*
