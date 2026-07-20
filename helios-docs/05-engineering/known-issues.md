# Known Issues — Helios

> **Location:** Confluence → Helios Engineering Space → Engineering → Known Issues  
> **Owner:** David Okafor (Principal Engineer) · @david.okafor  
> **Last Updated:** 2024-11-08  
> **Status:** Living document — updated weekly  
> **Related:** [Technical Debt Register](/05-engineering/technical-debt-register.md) · [Performance Bottlenecks](/05-engineering/performance-bottlenecks.md) · [Incident Response Runbook](/06-operations/incident-response-runbook.md)

---

> *This is the "things that are wrong but won't kill us today" document. It's the honest list. If you hit a bug in production and it's here, there's probably a workaround. If it's not here, either you've found something new (add it!) or it's more severe than "known issue" territory (open an incident).*

---

## Active Known Issues

---

### KI-001: Grid Monitor Rolling Deploy — Brief State Inconsistency
**ID:** KI-001  
**Severity:** Low  
**Service:** `helios-grid-monitor`  
**Affects:** Grid Operations Portal users during deployment  
**Status:** Accepted behavior — documented

**Description:**  
During a rolling deployment of the grid monitor (which takes ~3–5 minutes), there is a brief window where some API gateway requests are routed to new pods (which are rebuilding their in-memory state from Redis) and some to old pods (which have full state). This can cause the portal dashboard to show inconsistent alert counts or health scores for 30–60 seconds.

**User impact:**  
Grid operators may see alert counts jump briefly during deployments. The "Last updated" timestamp in the portal header helps indicate freshness.

**Workaround:**  
Schedule grid monitor deployments during low-traffic windows (early morning). The deployment window is announced in `#helios-releases` 30 minutes in advance.

**Why not fixed:**  
This is an inherent characteristic of distributed in-memory state. The correct long-term fix is shared state via Redis (already in place as the fallback) and improved cache warm-up on pod startup. The warm-up improvement is in the Q2 2025 roadmap.

---

### KI-002: Topology Staleness During New Asset Installation
**ID:** KI-002  
**Severity:** Medium  
**Service:** `helios-gis`, `helios-outage-detect`  
**Affects:** Outage detection localization for newly installed equipment  
**Status:** Documented workaround in place

**Description:**  
New grid assets (transformers, substations, meters) installed during the day are not visible to the outage detection topology traversal until the nightly GIS sync completes (~01:30 UTC). Outages involving new equipment produce `UNLOCALIZED` outage records.

**User impact:**  
Grid operators investigating `UNLOCALIZED` outages may be unable to find the fault location in the portal map. They must rely on field technician on-site investigation.

**Workaround:**  
Operators can manually set the fault location in the portal for unlocalized outages using the "Set Location" button in the outage detail panel. This is documented in the operator training materials.

**Remediation plan:**  
Real-time GIS sync (TD-004) is planned for Q3 2025. See [Technical Debt Register — TD-004](/05-engineering/technical-debt-register.md#td-004).

---

### KI-003: Coordinate Order Inconsistency
**ID:** KI-003  
**Severity:** Low (confusing but doesn't cause customer impact)  
**Service:** `helios-gis`, GIS frontend  
**Affects:** Engineers working with GIS data  
**Status:** Documented — convention inconsistency is hard to fix without breaking changes

**Description:**  
There is an inconsistency in coordinate ordering across the codebase:
- **GeoJSON spec:** `[longitude, latitude]` (X, Y order)
- **Our Go types:** `{Lat float64, Lng float64}` (latitude first)
- **MapLibre GL JS:** `[longitude, latitude]` (X, Y order — GeoJSON spec)
- **PostGIS `ST_MakePoint`:** `(longitude, latitude)` (X, Y order)
- **Our internal protobuf:** `{lat double, lng double}` (latitude first)

This is a historical inconsistency. The Go types were written by Alejandro with lat-first convention (natural human expression). The GeoJSON and PostGIS convention is lng-first. Both are used in the codebase.

**Consequence:**  
Engineers occasionally swap lat/lng when writing new GIS code. When this happens, assets appear in the wrong location (often in the ocean). There have been 4 incidents of swapped coordinates making it to staging (caught before production in all cases).

**Mitigation:**  
A linting rule has been added: any function accepting both lat and lng parameters must have named parameters, not positional. The Go type enforces field names. The most common mistake site (PostGIS `ST_MakePoint`) has a comment at every call site.

**Do NOT fix by renaming:**  
Renaming `Lat` → `Longitude` in Go types or restructuring the protobuf would be a breaking change requiring coordinated migration across 8 services. This is accepted tech debt until a major version boundary.

---

### KI-004: Single-Meter Outages Not Auto-Detected
**ID:** KI-004  
**Severity:** Medium (product gap, not a bug)  
**Service:** `helios-outage-detect`  
**Affects:** Individual customers with single-meter outages  
**Status:** Known product limitation — workaround documented

**Description:**  
The outage detection algorithm requires ≥ 3 meters in the same feeder segment to confirm an outage cluster. Single-meter outages (which could be a single customer without power) are not automatically detected as outages. They appear as `MEDIUM` severity "meter offline" alerts from the grid monitor after 30 minutes of no reading.

This means a residential customer who has lost power may not have a dispatch work order created automatically.

**Current behavior:**  
- Single meter goes offline → Alert: `METER_OFFLINE_30MIN` (MEDIUM severity)
- Grid operator must manually investigate and create a work order if a real outage is suspected
- Customer can call the utility's customer service number

**Planned fix:**  
Customer self-reporting integration (Q2 2025 roadmap). When a customer reports a power outage via the Customer Portal or calls the utility, a `CUSTOMER_REPORTED` outage record is created and a work order is dispatched. This bridges the gap for single-meter scenarios.

---

### KI-005: Demand Response Settlement Calculation Delay
**ID:** KI-005  
**Severity:** Low  
**Service:** `helios-data-pipeline`  
**Affects:** Customers enrolled in demand response programs  
**Status:** Accepted behavior

**Description:**  
Demand response bill credits are calculated by the data pipeline 48–72 hours after the DR event closes (to ensure all meter readings are available and validated). Some customers expect to see their credits immediately after the event and contact utility customer service when they don't appear in the portal.

**Cause:**  
The settlement calculation requires:
1. All meter readings for the event period to be received and validated (can take up to 24 hours for meters with connectivity issues)
2. A baseline calculation (what the customer would have used without the DR event — requires historical data processing)
3. The billing adapter to accept the credit (some billing systems batch-process credits overnight)

**Workaround:**  
The Customer Portal shows a "Credit pending" banner for enrolled customers after a DR event, with an estimated credit and a note that final credits appear within 72 hours. This reduces customer service contacts but does not eliminate them.

---

### KI-006: Google Maps API Key Reference in helios-compliance
**ID:** KI-006  
**Severity:** Low (unused — security only)  
**Service:** `helios-compliance`  
**Affects:** Security posture  
**Status:** Will fix in next compliance sprint

**Description:**  
During the MapLibre migration (v2.4, [ADR-004](/05-engineering/adrs.md#adr-004)), the `helios-compliance` module was not fully updated. Two React components in the compliance report preview UI still reference the Google Maps JavaScript API key via a `<script>` tag in the HTML template. The components themselves don't render a Google Map (they were refactored to use MapLibre), but the API key is still being loaded (and billed by Google ~$2/month).

**Impact:**  
Minimal — $2/month cost and a slightly larger initial page load. The API key has very restricted permissions (display only, no billing APIs). Not a security incident.

**Fix:** Remove the `<script>` tag from the two affected templates in `helios-compliance/src/templates/`. Estimated 30 minutes. Tracked in Jira COMP-44.

---

### KI-007: Photo Upload Timeout on Poor Mobile Connectivity
**ID:** KI-007  
**Severity:** Medium  
**Service:** `helios-dispatch` (mobile app: `helios-tech-mobile`)  
**Affects:** Field technicians in poor connectivity areas  
**Status:** Workaround documented — fix in progress

**Description:**  
Work order resolution requires at least one photo (for OUTAGE_RESTORE type). Photos are uploaded at full camera resolution (up to 12MB each). On poor cellular connections (< 2 Mbps), uploads frequently time out. The mobile app retries 3 times but the retry logic doesn't resume partial uploads — each retry restarts the full upload.

**User impact:**  
Field technicians report (Darnell Cooper reported this in a UX feedback session, October 2024): "Sometimes I'm standing there for 10 minutes trying to submit a job because the photo won't go through."

**Workaround:**  
Connect to the nearest available WiFi (often available at substations that have office buildings nearby). If no WiFi: mark the job as `RESOLVED` without photo (supervisor can accept this under "field conditions waiver") and upload the photos separately later from the mobile app's pending upload queue when connectivity is restored.

**Fix in progress:**  
@connor.walsh is implementing client-side image compression (resize to max 1200px, JPEG quality 75%) which reduces photo size to ~200KB average. This plus chunked multipart upload (resumable) will resolve the timeout issue. Target: Sprint 90 (current sprint). See `feat/FIELD-234-photo-compression` branch.

---

## Do Not Touch List

These are areas of the codebase that have **known fragility** and should not be modified without consulting the listed owner:

| File/Area | Why Fragile | Who to Consult |
|---|---|---|
| `helios-grid-monitor/internal/state/topology_lock.go` | Distributed lock timing is highly sensitive. Changing lock timeout broke outage detection in 2023. | @chidi.eze |
| `helios-iot-bridge/internal/codec/` | Every vendor codec has subtle quirks. Changes here have caused misread voltages in production twice. | @lars.eriksson |
| `helios-data-pipeline/jobs/demand_response_settlement/` | DR settlement math has been reviewed by legal. Any change needs legal sign-off before merging. | @lin.chen + @helena.muller |
| `helios-api-gateway/src/auth/jwtMiddleware.ts` | Core security code. Bugs here affect every request. Changes require two approvals including @yasmin.osei. | @rosa.lindqvist + @yasmin.osei |
| Any migration in `helios-dispatch/db/migrations/V1*.sql` | The early dispatch migrations have circular dependencies that newer migrations depend on. Test carefully. | @james.osei |

---

## Reporting a New Known Issue

If you find a bug that is:
- **Reproducible** (you can reliably trigger it)
- **Non-critical** (doesn't require immediate incident response)
- **Not already tracked** (check this document first)

Then:
1. Open a Jira ticket with label `known-issue`
2. Add an entry to this document via PR
3. Include: description, severity, affected services, user impact, workaround if any
4. Tag the relevant service owner

If the bug **is** critical, do not wait to document it here — open an incident.

---

*Document maintained by @david.okafor*  
*Updates welcome via PR — no approval needed for adding documented issues*  
*Related: [Technical Debt Register](/05-engineering/technical-debt-register.md) · [Incident Response Runbook](/06-operations/incident-response-runbook.md)*
