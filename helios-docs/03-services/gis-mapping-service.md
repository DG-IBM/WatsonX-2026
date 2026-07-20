# GIS Mapping Service — Helios

> **Location:** Confluence → Helios Engineering Space → Services → GIS Mapping  
> **Owner:** Alejandro Reyes (Senior Engineer, GIS) · @alejandro.reyes  
> **Frontend:** Hana Kobayashi · @hana.kobayashi  
> **Last Updated:** 2024-10-05  
> **Repo:** `lumina-energy/helios-gis`  
> **Status:** 🟡 Degraded ⚠️ (nightly batch sync — real-time sync not yet implemented)  
> **Related:** [System Overview](/02-architecture/system-overview.md) · [Outage Detection Service](/03-services/outage-detection-service.md) · [Technician Dispatch System](/03-services/technician-dispatch-system.md) · [High-Level Architecture](/02-architecture/high-level-architecture.md)

---

## What This Service Does

`helios-gis` is the geospatial backbone of the platform. It maintains the grid topology graph (which assets connect to which, and where they are physically located) and provides geospatial query capabilities used by:

- **Grid Operations Portal** — renders assets as layers on the MapLibre map
- **Outage Detection Service** — traverses topology to localize faults
- **Dispatch Service** — finds nearest available technicians to a fault location
- **Customer Portal** — shows outage impact areas on the outage map
- **Reporting** — spatial analytics on outage distribution, asset density, service territory coverage

The service is written in Go and runs PostGIS (PostgreSQL with geospatial extension) as its primary datastore.

---

## Data Model

### Asset Hierarchy in the GIS Context

Every grid asset has a position in two structures:
1. **Physical location** — lat/lng coordinates and geometry (point for a meter, line for a feeder, polygon for a service territory)
2. **Electrical topology** — which assets are electrically connected to which

Both are stored in PostGIS:

```sql
-- gis.assets (physical location)
-- Already shown in Database Architecture doc; recapped here for context
CREATE TABLE gis.assets (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    asset_id        UUID NOT NULL,          -- FK to public.grid_assets (main cluster, cross-DB ref)
    asset_type      VARCHAR(50) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    location        GEOGRAPHY(POINT, 4326),
    service_area    GEOGRAPHY(POLYGON, 4326),
    elevation_m     NUMERIC(7,1),
    address         TEXT,
    last_synced_at  TIMESTAMPTZ
);

-- gis.topology_edges (electrical connections)
CREATE TABLE gis.topology_edges (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    from_asset_id   UUID NOT NULL REFERENCES gis.assets(id),
    to_asset_id     UUID NOT NULL REFERENCES gis.assets(id),
    edge_type       VARCHAR(50) NOT NULL,   -- FEEDS | CONNECTED_TO | PARALLEL
    voltage_kv      NUMERIC(8,3),
    capacity_kw     NUMERIC(12,3),
    line_geometry   GEOGRAPHY(LINESTRING, 4326),  -- physical path of the cable/line
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_synced_at  TIMESTAMPTZ
);

-- gis.service_territories (customer territory boundaries)
CREATE TABLE gis.service_territories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    name            VARCHAR(255) NOT NULL,
    boundary        GEOGRAPHY(MULTIPOLYGON, 4326),
    substation_id   UUID REFERENCES gis.assets(id)
);

-- Spatial indexes
CREATE INDEX idx_gis_assets_loc     ON gis.assets      USING GIST(location);
CREATE INDEX idx_gis_edges_geom     ON gis.topology_edges USING GIST(line_geometry);
CREATE INDEX idx_gis_territories    ON gis.service_territories USING GIST(boundary);
```

---

## Topology Graph (In-Memory)

For the outage detection topology traversal (which must be < 500ms), querying PostGIS on every traversal would be too slow. The GIS service maintains an **in-memory topology graph** that is loaded at startup and refreshed every 15 minutes.

```go
// internal/topology/graph.go
type TopologyGraph struct {
    mu     sync.RWMutex
    nodes  map[string]*Node          // assetId → Node
    edges  map[string][]string       // assetId → []connected assetIds
    tenant string
}

type Node struct {
    AssetID     string
    AssetType   string
    ParentID    string
    ChildIDs    []string
    Coordinates types.Coordinates
    Capacity    float64
}

// Upstream traversal: find the fault point given a set of affected meters
func (g *TopologyGraph) FindFaultPoint(affectedMeterIDs []string) (*Node, float64) {
    g.mu.RLock()
    defer g.mu.RUnlock()

    // Walk up the tree from the affected meters
    // Find the highest node where ALL downstream paths lead to affected meters
    candidates := g.upwardTraversal(affectedMeterIDs)
    if len(candidates) == 0 {
        return nil, 0.0
    }

    // Score candidates by how completely they explain the affected set
    best, confidence := g.scoreCandidates(candidates, affectedMeterIDs)
    return best, confidence
}
```

The in-memory graph supports ~100 topology queries per second without hitting the database. This is more than sufficient for our current outage detection throughput.

---

## SCADA GIS Data Ingestion

The grid topology data doesn't originate in Helios. It comes from the utility company's existing GIS and SCADA systems. There are 11 different source formats we currently support:

| Format | Description | Customers Using It |
|---|---|---|
| ESRI File Geodatabase (.gdb) | ESRI ArcGIS native format | 6 customers |
| Shapefile (.shp) | Legacy ESRI format | 3 customers |
| GeoJSON | Modern open format | 2 customers |
| CIM/XML (IEC 61968-11) | Common Information Model | 1 customer (GON) |
| GML (OGC standard) | Geography Markup Language | 1 customer (Oresund Grid) |
| ADMS export (Schneider Electric) | Proprietary ADMS format | 2 customers |
| Custom CSV with WKT geometry | Utility-built export | 1 customer |

The sync pipeline:
```
SCADA/GIS system → SFTP drop (nightly, 00:00 UTC) → S3 bucket → 
Spark parsing job (EMR, 01:00 UTC) → PostGIS tables → topology graph refresh
```

The nightly batch means GIS data can be up to 24 hours stale for recently added or changed assets. This is the primary known limitation of the GIS service. See [Known Issues](/05-engineering/known-issues.md#topology-staleness).

---

## API Reference

The GIS service exposes both gRPC (for performance-critical internal calls) and REST (for the API gateway's portal serving).

### gRPC Methods

```protobuf
service GISService {
    rpc GetAssetTopology(TopologyRequest) returns (TopologyResponse);
    rpc GetNearestTechnicians(NearestTechRequest) returns (NearestTechResponse);
    rpc GetOutageAffectedAssets(OutageRequest) returns (AffectedAssetsResponse);
    rpc GetAssetsInBounds(BoundsRequest) returns (AssetListResponse);
    rpc IsPointInOutage(PointOutageRequest) returns (PointOutageResponse);
}

message TopologyRequest {
    string tenant_id  = 1;
    string asset_id   = 2;    // Root asset for traversal
    int32  depth      = 3;    // Downstream depth to traverse (0 = unlimited)
    bool   upstream   = 4;    // true = traverse upstream (toward substation)
}

message NearestTechRequest {
    string  tenant_id    = 1;
    double  lat          = 2;
    double  lng          = 3;
    int32   limit        = 4;   // max results, default 5
    float   max_dist_km  = 5;   // default 50km
    repeated string required_certs = 6;
}
```

### REST Endpoints (for Portal Tile Serving)

```
GET /api/gis/{tenantId}/assets?bbox={west,south,east,north}&zoom={z}
    → GeoJSON FeatureCollection of assets within bounding box

GET /api/gis/{tenantId}/assets/{assetId}
    → GeoJSON Feature for single asset

GET /api/gis/{tenantId}/topology/{assetId}?depth=2
    → GeoJSON FeatureCollection of topologically connected assets

GET /api/gis/{tenantId}/outages/active
    → GeoJSON of active outage polygons for customer-facing outage map

GET /api/gis/{tenantId}/territories
    → GeoJSON MultiPolygon of service territory boundaries

GET /api/gis/{tenantId}/tiles/{z}/{x}/{y}.mvt
    → Mapbox Vector Tile for the portal map layer (baked from PostGIS)
```

The vector tile endpoint (`/tiles/{z}/{x}/{y}.mvt`) is the high-traffic path serving the grid ops portal map. Tiles are cached in S3 with a 1-hour TTL at zoom levels ≤ 14. At zoom 15+ (street level), tiles are generated on-demand from PostGIS.

---

## Map Layers in the Grid Operations Portal

The portal renders the following GIS layers using MapLibre GL JS:

| Layer | Type | Source | Default Visibility | Update Frequency |
|---|---|---|---|---|
| Service territories | Polygon fill | `/tiles/{z}/{x}/{y}.mvt` | Hidden (toggle) | Daily |
| Transmission lines | Line | `/tiles/{z}/{x}/{y}.mvt` | Visible (zoom > 8) | Daily |
| Substations | Circle | `/api/gis/{t}/assets?type=SUBSTATION` | Visible | Daily |
| Distribution feeders | Line | `/tiles/{z}/{x}/{y}.mvt` | Visible (zoom > 11) | Daily |
| Transformers | Circle | `/api/gis/{t}/assets?type=TRANSFORMER` | Visible (zoom > 13) | Daily |
| Smart meters | Circle | `/api/gis/{t}/assets?type=METER` | Visible (zoom > 16) | Daily |
| Active outage areas | Polygon fill | `/api/gis/{t}/outages/active` | Visible | Real-time (30s poll) |
| Active alerts | Circle (colored by severity) | WebSocket (grid-monitor) | Visible | Real-time |
| Technician locations | Marker | REST poll (dispatch service) | Visible when dispatch panel open | 5-min |
| Weather overlay | Raster | Tomorrow.io tile API | Hidden (toggle) | 15-min |

---

## GIS Coordinate System

All internal GIS data uses **WGS84 (EPSG:4326)** — standard lat/lng. The PostGIS `GEOGRAPHY` type is used (not `GEOMETRY`) for all calculations, which means distance calculations use geodetic math (accurate for real-world distances) rather than planar math.

When working with GIS data:
- Coordinates are always `[longitude, latitude]` in GeoJSON (x, y order — this trips people up constantly)
- In our internal Go types, coordinates are `{Lat, Lng}` (lat first — this is different from GeoJSON)
- In SQL, `ST_MakePoint(lng, lat)` — longitude first
- In MapLibre, `[lng, lat]` — longitude first

This inconsistency exists because of different conventions in different ecosystems. It is a known footgun. See [Known Issues — Coordinate Order](/05-engineering/known-issues.md#coordinate-order).

---

## Known Limitations

### Asset Data Is Updated Nightly

The largest limitation. New meters installed today won't appear in the GIS topology until tomorrow's sync completes (~01:30 UTC). New transformers and substations take even longer because SCADA GIS exports are often generated weekly.

This means:
- Outage detection topology traversals may not include recently installed equipment
- The grid ops portal map won't show new assets immediately after installation
- Dispatch routing may not know about new work zones

**Workaround in use:** Grid operators can manually add a "topology note" to an outage record indicating that the fault is on a newly installed asset not yet in GIS. This is handled as a manual workflow.

**Remediation:** Real-time GIS sync (watch SCADA system → WebSocket or API → Helios) is planned for Q3 2025. The complexity is in handling the 11 different SCADA GIS formats in real-time rather than batch.

### Topology Completeness Varies by Customer

Some utility customers have incomplete GIS records — old infrastructure that was never fully digitized, or recently acquired territory not yet integrated. Topology traversal for these areas produces lower-confidence localization results (confidence < 0.5). Grid operators are aware of their "GIS gaps" and factor this into manual outage assessment.

---

## Things Every New Engineer Should Know

1. **Coordinate order varies by context.** GeoJSON is `[lng, lat]`. PostGIS `ST_MakePoint` is `(lng, lat)`. Our internal Go struct is `{Lat, Lng}`. Always double-check which convention you're working in. A lat/lng swap puts a substation in the middle of the ocean.

2. **GEOGRAPHY vs. GEOMETRY in PostGIS.** We use `GEOGRAPHY`, which uses meters as the distance unit and handles the Earth's curvature correctly. If you use `GEOMETRY` by mistake, distance calculations in meters become wildly inaccurate over large distances. Always use `GEOGRAPHY` columns and the `::GEOGRAPHY` cast.

3. **The in-memory topology graph is tenant-scoped.** Each tenant's topology is a separate `TopologyGraph` instance in memory. When the graph refreshes, it holds a read lock briefly. Do not call topology queries in tight loops — the lock contention is measurable.

4. **Vector tile generation is expensive.** Generating tiles from PostGIS at low zoom levels (< 12) for a large service territory can take > 500ms. These tiles must be pre-baked and cached in S3. Never add code that generates low-zoom tiles on demand in the request path.

5. **The outage polygon is an approximation.** Outage polygons are computed by computing the convex hull of the affected meters' locations. The actual outage boundary may differ from the displayed polygon. This is acceptable for customer-facing communication but should not be used for precise regulatory reporting.

---

*Document maintained by @alejandro.reyes*  
*Frontend map layers: @hana.kobayashi and @mei.zhang (Grid UI)*  
*Related: [Outage Detection Service](/03-services/outage-detection-service.md) · [Database Architecture](/02-architecture/database-architecture.md) · [Frontend Architecture](/02-architecture/frontend-architecture.md)*
