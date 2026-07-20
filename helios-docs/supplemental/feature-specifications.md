# Feature Specifications

**Owner:** Meera Pillai (VP Product) — maintained collaboratively with Engineering leads
**Format:** Each spec is a self-contained mini-document. Larger features have standalone Jira Epics; this document captures completed feature specs for reference.
**Last Updated:** 2024-11-08
**Related Docs:** [Product Roadmap](/supplemental/product-roadmap.md) · [Current Sprint Goals](/supplemental/current-sprint-goals.md) · [AI Forecasting Engine](/03-services/ai-forecasting-engine.md) · [Outage Detection Service](/03-services/outage-detection-service.md)

---

> **Meera, 2024-11-08:** This document collects finalized feature specs for the last 4 major feature areas. Specs are written in the "story + acceptance criteria + technical notes" format we adopted in 2023. Earlier features (pre-2023) have thinner specs in Jira; if you're looking for context on older features, check the Epic in Jira or the ADR if applicable.
>
> The format below is what we aim for. Not all specs are this detailed in practice — the ones here represent our best work. New engineers: reading these will give you a sense of how product and engineering collaborate at Lumina.

---

## Feature Specs Index

1. [Demand Forecast Accuracy Dashboard (v4.5)](#1-demand-forecast-accuracy-dashboard-v45)
2. [Automated Outage Severity Escalation (v4.4)](#2-automated-outage-severity-escalation-v44)
3. [Multi-Tenant GIS Topology View (v4.3)](#3-multi-tenant-gis-topology-view-v43)
4. [Technician Mobile Offline Mode (v4.6)](#4-technician-mobile-offline-mode-v46)

---

## 1. Demand Forecast Accuracy Dashboard

**Jira Epic:** HELIOS-1820
**Status:** Shipped in v4.5 (August 2024)
**PM:** Meera Pillai
**Engineering Lead:** Lin Chen
**Design:** Clara Dupont

### Problem Statement

Utility operators had no way to see how accurately our demand forecasts were performing over time. Several customers (particularly ENGIE and NW Grid UK) were using Helios forecasts to inform generation dispatch decisions but had no confidence metrics to work from. Customer success reported that two customers had independently built their own accuracy tracking spreadsheets — which was a sign we were missing something obvious.

Additionally, Lin Chen's team wanted a customer-facing interface to transparency proactively show when the model was underperforming (e.g., during seasonal transitions), reducing support escalations.

### Success Criteria

- [ ] Customers can view 7-day, 30-day, and 90-day rolling forecast accuracy (MAE, MAPE)
- [ ] Accuracy broken down by time horizon (day-ahead vs. same-day vs. intra-day)
- [ ] Visual chart showing forecast vs. actual demand for any selected period
- [ ] Customers can see when accuracy was outside their contracted SLA
- [ ] Page loads in <2 seconds with 90-day data
- [ ] Mobile-responsive layout

### User Story

> As a grid control room operator at a utility company,
> I want to see how accurate Helios's demand forecasts have been over the past month,
> So that I can decide how much weight to give the forecast when making dispatch decisions,
> And so that I can flag to my account manager if accuracy falls below our contracted threshold.

### Technical Design Notes (Lin Chen)

The accuracy data is pre-computed in the analytics warehouse (see `mart_forecasting_accuracy` dbt model in [Analytics Platform](/supplemental/analytics-platform.md)). The API endpoint `GET /v3/analytics/forecasting-accuracy` was built specifically for this feature.

The "forecast vs. actual" chart required careful handling of time zones — operators view their local time, but all our data is stored in UTC. The portal handles this client-side using the operator's configured timezone (stored in customer preferences).

**Performance concern:** The 90-day view with 15-minute resolution generates ~8,640 data points. We implemented two optimisations: (1) server-side aggregation to 1-hour resolution for the default view, with drill-down to 15-minute on user interaction; (2) virtualized charting (react-virtualized) to avoid rendering all data points at once.

### Acceptance Criteria (Engineering Sign-off Checklist)

```
[ ] API endpoint returns data within 1.5s p95 for 90-day range (verified in load test)
[ ] UI renders chart without layout shift or loading flash on 90-day range
[ ] Accuracy values match the Redshift mart calculations (verified by Lin Chen)
[ ] Timezone handling correct for EU/AU timezones (verified by QA with ENGIE's London TZ + Ausgrid's AEST)
[ ] Feature flag 'forecasting-accuracy-dashboard' added; disabled by default in production
[ ] Released behind flag to 2 pilot customers (ENGIE + NW Grid UK) for 2-week validation
[ ] Accuracy SLA breach indicator correctly highlights values outside contracted range
```

### Post-Ship Notes (Lin Chen, September 2024)

The feature shipped on time. Pilot feedback was very positive — NW Grid UK's control room lead said it was "the feature we've been waiting for." Two issues found post-launch:

1. The MAPE calculation had a divide-by-zero for periods with zero actual demand (edge case: grid segments fully offline during overnight maintenance windows). Fixed in patch release v4.5.1.
2. The SLA breach threshold was hardcoded in the frontend rather than pulled from customer configuration. This became a problem when NW Grid UK had a different threshold than ENGIE. Fixed in v4.5.2 — threshold is now read from customer settings.

---

## 2. Automated Outage Severity Escalation

**Jira Epic:** HELIOS-1654
**Status:** Shipped in v4.4 (May 2024)
**PM:** Meera Pillai
**Engineering Lead:** Farah Okonkwo
**Stakeholder:** Chidi Eze (Grid Intelligence), Marcus Webb (SRE)

### Problem Statement

When outages occurred, the initial severity classification (Minor, Major, Critical) was set at detection time based on estimated affected meter count. However, outages often escalated — what started as 200 meters affected might grow to 5,000 as the fault propagated through the distribution network. Operators and technicians were working with stale severity classifications, which affected dispatch priority and resource allocation.

Additionally, customer SLAs required notification within 30 minutes of an outage reaching "Major" status. We had no automated way to detect when this threshold was crossed.

### Success Criteria

- [ ] Outage severity is re-evaluated every 5 minutes while outage is active
- [ ] Severity escalation triggers immediate notification to relevant stakeholders
- [ ] Dispatch priority is automatically upgraded when severity escalates
- [ ] Operators can see escalation history in the outage detail view
- [ ] Notification is sent within 5 minutes of an outage crossing the Major threshold (≥1,000 meters)

### Technical Design Notes (Farah Okonkwo)

The outage detection service already tracked active outages in PostgreSQL. We added a background job (runs every 5 minutes) that:

1. Queries all active outages
2. Re-counts affected meters from the latest telemetry data
3. Recalculates severity using the current affected count
4. If severity changed upward, updates the outage record, dispatches a Kafka event to `grid.alerts.outage` with event type `SEVERITY_ESCALATED`, and triggers the notification pipeline

The tricky part was avoiding duplicate escalation notifications. We added a `last_escalated_at` field and a `min_escalation_interval_minutes` config (default: 15) to prevent notification spam if the count oscillates around a threshold.

```go
// outage-detection-svc/internal/severity/escalator.go
func (e *Escalator) EvaluateActive(ctx context.Context) error {
    outages, err := e.repo.ListActiveOutages(ctx)
    if err != nil {
        return err
    }
    
    for _, outage := range outages {
        currentCount, err := e.meterRepo.CountAffectedMeters(ctx, outage.AffectedArea, outage.StartedAt)
        if err != nil {
            log.Errorf("meter count failed for outage %s: %v", outage.ID, err)
            continue
        }
        
        newSeverity := e.calculateSeverity(currentCount)
        if newSeverity <= outage.Severity {
            continue  // Severity not escalated — no action
        }
        
        // Check minimum escalation interval
        if time.Since(outage.LastEscalatedAt) < e.minEscalationInterval {
            continue
        }
        
        if err := e.escalate(ctx, outage, newSeverity, currentCount); err != nil {
            return err
        }
    }
    return nil
}
```

### Acceptance Criteria (Engineering Sign-off Checklist)

```
[ ] Unit tests cover: no escalation, minor→major escalation, major→critical escalation
[ ] Integration test: outage starts at 200 meters, grows to 1200 meters across 3 evaluations
[ ] Notification delivery within 5 min verified in staging (end-to-end test)
[ ] Dispatch service receives priority upgrade event and acts on it
[ ] No notification storm during normal oscillation (test: count oscillates between 900–1100)
[ ] Escalation history visible in outage detail view
[ ] Database migration backward-compatible (new columns nullable with defaults)
```

---

## 3. Multi-Tenant GIS Topology View

**Jira Epic:** HELIOS-1512
**Status:** Shipped in v4.3 (February 2024)
**PM:** Meera Pillai
**Engineering Lead:** Chidi Eze
**Design:** Clara Dupont
**Stakeholder:** Lars Eriksson (IoT device placement)

### Problem Statement

The GIS map in the customer portal showed all grid assets with the same visual treatment — no differentiation between asset types, health states, or operational states. Operators at large utilities (NW Grid UK has 14,000 substations) found it difficult to quickly identify problem areas. Zooming to a metropolitan area with many assets caused severe performance degradation (the map would render 10,000+ markers simultaneously).

Additionally, different customers had different asset types — one customer's wind farm clusters looked the same as another customer's battery storage units. Operators needed visual differentiation.

### Success Criteria

- [ ] Assets colour-coded by health status (healthy, degraded, offline, unknown)
- [ ] Asset type icons distinguish meters, substations, renewables, batteries
- [ ] Map performance acceptable at full zoom-out with 14,000 substations visible
- [ ] Cluster overlapping assets at low zoom levels; expand at higher zoom
- [ ] Real-time health status updates without full map reload (WebSocket)
- [ ] Filtering by asset type, health status, and region

### Technical Design Notes (Chidi Eze)

The performance problem was the most challenging part. We tried three approaches:

1. **Client-side rendering of all assets:** Too slow. 14,000 Mapbox GL markers caused frame drops.
2. **Mapbox tileset (vector tiles):** Fast, but doesn't support real-time updates well.
3. **Supercluster + Mapbox GL source layers (final approach):** Supercluster handles the clustering math on the frontend; we push asset data as GeoJSON to a Mapbox GL source layer. WebSocket updates only send diffs (changed features), not the full dataset.

The WebSocket diff protocol was key. Instead of pushing the full GeoJSON on every update, the GIS service computes a diff and pushes only changed features:

```json
{
  "type": "topology_update",
  "timestamp": "2024-02-15T14:32:11Z",
  "changed": [
    {
      "featureId": "substation-4821",
      "properties": {
        "healthStatus": "degraded",
        "lastReading": "2024-02-15T14:31:55Z"
      }
    }
  ],
  "removed": []
}
```

The full asset load on initial page load is ~4MB (14K substations for NW Grid UK), which is acceptable. Subsequent updates are typically <5KB.

### Post-Ship Notes (Chidi Eze, March 2024)

The clustering worked well. NW Grid UK's control room lead demoed it at their team meeting and the feedback was "finally usable at full zoom-out."

One pain point: the real-time WebSocket connection occasionally dropped during long operator sessions (8+ hour shifts) and the reconnection logic would reload the full asset set. This caused brief delays. Fixed in v4.3.2 with a smarter reconnection that falls back to a diff request from the last received timestamp rather than a full reload.

---

## 4. Technician Mobile Offline Mode

**Jira Epic:** HELIOS-1891
**Status:** Shipped in v4.6 (October 2024)
**PM:** Meera Pillai
**Engineering Lead:** Ami Tanaka
**Stakeholder:** Farah Okonkwo (Dispatch), several utility customer field operations managers

### Problem Statement

Field technicians often work in underground vaults, rural areas, or inside substations with poor or no mobile connectivity. When connectivity dropped, the dispatch mobile app became useless — technicians couldn't see their job details, update job status, or record their findings. Several customer field managers had raised this as a significant operational problem — technicians were reverting to paper for logging when underground.

### Success Criteria

- [ ] Technicians can view their current assigned jobs without connectivity
- [ ] Technicians can update job status (in-progress, completed, blocked) without connectivity
- [ ] Technicians can attach photos to jobs without connectivity
- [ ] All offline updates sync automatically when connectivity resumes
- [ ] Conflict resolution: if the same job was modified both offline and by dispatch while technician was offline, a clear merge interface is presented
- [ ] Works on Android (Samsung A series — most common technician device) and iOS

### Technical Design Notes (Ami Tanaka)

We used React Native with [WatermelonDB](https://watermelondb.dev/) for local storage (SQLite-backed on device). The sync model is:

1. **Initial sync:** On login or app open with connectivity, full sync of assigned jobs + relevant asset data.
2. **Background sync:** While online, changes sync every 30 seconds.
3. **Offline queue:** All local mutations are queued as operations with timestamps.
4. **Reconnect sync:** On network restore, queued operations are sent to the API and applied. Server sends back any changes that occurred while offline.

The conflict resolution was the hardest part. We defined a simple conflict policy: technician status updates always win over dispatch updates, except for job cancellations (if dispatch cancels a job while technician is offline, the cancellation wins and technician is notified). This was agreed with the customer field operations managers.

```typescript
// mobile/src/sync/conflictResolver.ts
export function resolveJobConflict(
  localChange: JobMutation,
  serverChange: JobMutation
): JobMutation {
  // Job cancellations from dispatch always take precedence
  if (serverChange.status === 'cancelled') {
    return serverChange;
  }
  
  // Technician's status updates win (they have ground truth)
  if (localChange.type === 'status_update') {
    return localChange;
  }
  
  // For other fields (job description, address): server wins
  // (dispatch has better information about job changes)
  return {
    ...serverChange,
    // But preserve technician's notes and photos
    technician_notes: localChange.technician_notes ?? serverChange.technician_notes,
    photos: [...(localChange.photos ?? []), ...(serverChange.photos ?? [])],
  };
}
```

**Photo handling:** Photos are stored locally in the device file system and synced to S3 when connectivity resumes. Photos are referenced in WatermelonDB by local URI until synced, then updated to the S3 URI. The sync handles the URI update transparently.

### Post-Ship Notes (Ami Tanaka, November 2024)

Shipped to pilot customer (NW Grid UK field operations team of 40 technicians) in October. Feedback after 3 weeks:
- 38/40 technicians rated offline mode as "useful" or "very useful"
- 2 technicians reported the merge notification was confusing (they didn't understand why dispatch had changed a job while they were offline). UX improvement added to v4.7 backlog.
- One crash on Samsung A34 related to SQLite storage limits when syncing >100 photos at once. Fix shipped in v4.6.1 (photo sync batching).

---

*Specs for upcoming features are in Jira Epics (in HELIOS project, filter by Epic status = "In Progress"). See [Product Roadmap](/supplemental/product-roadmap.md) for what's coming next.*
