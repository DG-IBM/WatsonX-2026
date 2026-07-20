# IoT Device Management — Helios

> **Location:** Confluence → Helios Engineering Space → Services → IoT Device Management  
> **Owner:** Ngozi Williams (Eng Manager, IoT & Devices) · @ngozi.williams  
> **Tech Lead:** Lars Eriksson · @lars.eriksson  
> **Last Updated:** 2024-10-20  
> **Repo:** `lumina-energy/helios-iot-bridge`  
> **Status:** 🟡 Degraded ⚠️ (single-region — see [ADR-009](/05-engineering/adrs.md#adr-009))  
> **Related:** [Event-Driven Architecture](/02-architecture/event-driven-architecture.md) · [Backend Architecture](/02-architecture/backend-architecture.md) · [Grid Monitoring Service](/03-services/grid-monitoring-service.md) · [GIS Mapping Service](/03-services/gis-mapping-service.md)

---

## What This Service Does

The IoT Device Management system encompasses everything between a physical smart meter and a validated Kafka event. It includes:

1. **EMQX MQTT broker cluster** — accepts MQTT connections from 42M+ devices
2. **helios-iot-bridge** — receives forwarded MQTT messages, authenticates devices, decodes payloads, validates schemas, produces to Kafka
3. **Device registry** — the authoritative database of all provisioned devices (meter IDs, vendor info, tenant association, geographic assignment, firmware version)
4. **SCADA adapters** — pull-based adapters for substation and SCADA telemetry over IEC 61968, DNP3, and Modbus
5. **Firmware OTA** — over-the-air firmware update delivery to smart meters
6. **Device provisioning** — onboarding new meters (bulk import and individual registration)

---

## Device Registry

The device registry is the single source of truth for all IoT devices. It answers questions like: "Which tenant owns device `sm-42a9b7`?", "What vendor protocol does it use?", "Which substation is it associated with?", "What firmware version is it running?"

### Schema

```sql
-- public.devices (main device registry table)
CREATE TABLE public.devices (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID         NOT NULL REFERENCES public.tenants(id),
    device_id           VARCHAR(255) NOT NULL UNIQUE,  -- helios internal ID (canonical)
    external_device_id  VARCHAR(255) NOT NULL,          -- vendor/utility ID (e.g., meter serial)
    device_type         VARCHAR(50)  NOT NULL,          -- SMART_METER | SUBSTATION_SENSOR | BATTERY_MONITOR | INVERTER
    vendor_id           VARCHAR(100) NOT NULL,          -- e.g., 'itron-centron', 'landis-gyr-e360'
    firmware_version    VARCHAR(50),
    protocol            VARCHAR(50)  NOT NULL,          -- MQTT | SCADA_IEC61968 | DNP3 | MODBUS
    status              VARCHAR(30)  NOT NULL DEFAULT 'ACTIVE',
    region_id           UUID         REFERENCES public.grid_regions(id),
    substation_id       UUID         REFERENCES public.grid_assets(id),
    feeder_id           UUID         REFERENCES public.grid_assets(id),
    service_address     TEXT,
    location_lat        NUMERIC(10,7),
    location_lng        NUMERIC(10,7),
    installation_date   DATE,
    last_seen_at        TIMESTAMPTZ,
    last_reading_at     TIMESTAMPTZ,
    cert_thumbprint     VARCHAR(255),  -- device certificate SHA-256 thumbprint for mTLS auth
    provisioned_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    metadata            JSONB         NOT NULL DEFAULT '{}',
    UNIQUE(tenant_id, external_device_id)
);

CREATE INDEX idx_devices_tenant     ON public.devices(tenant_id, status);
CREATE INDEX idx_devices_last_seen  ON public.devices(tenant_id, last_seen_at) WHERE status = 'ACTIVE';
CREATE INDEX idx_devices_cert       ON public.devices(cert_thumbprint) WHERE cert_thumbprint IS NOT NULL;
```

### Registry Access Pattern

The device registry is hot-path data. Every MQTT message received by the IoT bridge requires a device lookup to:
1. Verify the device is provisioned and active
2. Determine its tenant (for Kafka partitioning)
3. Get its vendor ID (for payload decoding)
4. Get its grid assignment (region, substation, feeder) for enrichment

At 380,000 events/sec, hitting PostgreSQL for every lookup would be catastrophic. The bridge maintains a **Redis cache** of device records with a 1-hour TTL:

```go
// internal/registry/cache.go
type DeviceRegistryCache struct {
    redis  *redis.ClusterClient
    pg     *pgxpool.Pool
    ttl    time.Duration
}

func (c *DeviceRegistryCache) Get(ctx context.Context, deviceID string) (*Device, error) {
    cacheKey := fmt.Sprintf("device:registry:%s", deviceID)
    
    // Try Redis first (< 1ms)
    cached, err := c.redis.Get(ctx, cacheKey).Bytes()
    if err == nil {
        var device Device
        if err := proto.Unmarshal(cached, &device); err == nil {
            return &device, nil
        }
    }
    
    // Cache miss — query PostgreSQL
    device, err := c.fetchFromDB(ctx, deviceID)
    if err != nil {
        if errors.Is(err, pgx.ErrNoRows) {
            return nil, ErrDeviceNotFound
        }
        return nil, fmt.Errorf("registry lookup failed: %w", err)
    }
    
    // Populate cache
    data, _ := proto.Marshal(device)
    c.redis.Set(ctx, cacheKey, data, c.ttl)
    
    return device, nil
}
```

**Cache miss rate:** Currently ~0.2% of lookups are cache misses (new or recently updated devices). This rate is acceptable. If it rises above 1%, investigate whether cache TTL is too short or whether a bulk provisioning event is happening.

---

## MQTT Infrastructure (EMQX)

### Broker Configuration

The EMQX cluster runs on 3 EC2 `c6i.4xlarge` instances (one per AZ in us-east-1). EMQX is not containerized — it runs directly on EC2 to maintain stable, predictable TCP endpoint addresses for MQTT clients. See [Microservices Overview — EMQX](/02-architecture/microservices-overview.md#emqx-broker-cluster) for the rationale.

**Connection specs:**
- Protocol: MQTT 3.1.1 and MQTT 5.0
- Port: 8883 (MQTT over TLS 1.3)
- Auth: Device certificate (mTLS) — every device has a unique X.509 cert
- Max connections: 20M per node (60M cluster total — headroom for growth)
- Current connections: ~42M active at peak

**TLS certificate management:**

Device certificates are issued by an internal CA (private key managed in AWS ACM Private CA). Each device gets a unique leaf certificate signed by the tenant sub-CA. Certificate provisioning happens during the device onboarding workflow.

```
Root CA (Lumina Energy Root)
└── Tenant Sub-CA (e.g., CUST-MWG Sub-CA)
    └── Device Leaf Certs (one per meter)
        e.g., sm-42a9b7.cust-mwg.devices.luminaenergy.com
```

**Why per-device certs?** If a meter is compromised (e.g., physically tampered with), we can revoke only that meter's certificate without affecting any other devices. CRL (Certificate Revocation List) updates propagate to EMQX within 5 minutes.

### EMQX ExHook — Bridge Integration

Rather than having the IoT bridge run as an MQTT client subscribing to all topics, we use EMQX's **ExHook** mechanism. ExHook allows EMQX to call an external gRPC server on specific events:

```
Device connects → EMQX → ExHook: client_connected → IoT Bridge → registry lookup
Device publishes → EMQX → ExHook: message_publish → IoT Bridge → decode + produce to Kafka
```

This is more efficient than subscribing to all topics (no double fan-out, no MQTT overhead for the bridge-EMQX communication) and gives the bridge more control over message handling.

```go
// internal/hook/server.go — ExHook gRPC server
func (h *HookServer) OnMessagePublish(
    ctx context.Context, 
    req *exhook.MessagePublishRequest,
) (*exhook.ValuedResponse, error) {
    msg := req.Message
    
    // Extract device ID from MQTT topic: /readings/{deviceId}
    deviceID, err := extractDeviceID(msg.Topic)
    if err != nil {
        h.metrics.InvalidTopics.Inc()
        return dropMessage(), nil  // drop silently
    }
    
    // Look up device in registry
    device, err := h.registry.Get(ctx, deviceID)
    if err != nil {
        if errors.Is(err, ErrDeviceNotFound) {
            h.metrics.UnknownDevices.Inc()
            return dropMessage(), nil  // unknown device — drop
        }
        return nil, err
    }
    
    // Decode vendor-specific payload
    reading, err := h.codec.Decode(device.VendorID, msg.Payload)
    if err != nil {
        h.metrics.DecodeErrors.With("vendor", device.VendorID).Inc()
        h.produceDLQ(ctx, msg, err)
        return dropMessage(), nil
    }
    
    // Produce to Kafka
    reading.DeviceID = deviceID
    reading.TenantID = device.TenantID
    if err := h.producer.Produce(ctx, reading); err != nil {
        return nil, fmt.Errorf("kafka produce failed: %w", err)
    }
    
    return acceptMessage(), nil
}
```

---

## Device Provisioning

### Bulk Provisioning (New Customer Onboarding)

When a utility company deploys Helios, they typically have hundreds of thousands or millions of existing smart meters. These must be imported into the device registry in bulk.

**Bulk import process:**
1. Customer exports their meter inventory as CSV (required columns: `meter_serial`, `vendor_model`, `install_address`, `lat`, `lng`, `substation_id`, `feeder_id`)
2. CSV is uploaded to S3 (`s3://helios-data-lake/{tenantId}/provisioning/bulk/`)
3. The `helios-iot-bridge` provisioning Lambda is triggered on S3 upload
4. Lambda validates the CSV, resolves grid assignments, generates device IDs, issues device certs, and batch-inserts to the device registry
5. A summary report is emailed to the customer success team and tenant admin

```python
# Lambda: helios-provisioning/bulk_provision.py (simplified)
import boto3
import csv
from helios_sdk import DeviceRegistryClient, CertificateAuthority

def handler(event, context):
    s3_key = event['Records'][0]['s3']['object']['key']
    tenant_id = extract_tenant_id(s3_key)
    
    registry = DeviceRegistryClient()
    ca = CertificateAuthority(tenant_id=tenant_id)
    
    errors = []
    provisioned = 0
    
    for row in parse_csv_from_s3(s3_key):
        try:
            # Generate internal device ID
            device_id = f"sm-{generate_device_id(row['meter_serial'], tenant_id)}"
            
            # Issue device certificate
            cert = ca.issue_device_cert(device_id)
            
            # Register in device registry
            registry.provision({
                'device_id': device_id,
                'tenant_id': tenant_id,
                'external_device_id': row['meter_serial'],
                'vendor_id': detect_vendor(row['vendor_model']),
                'protocol': 'MQTT',
                'location_lat': float(row['lat']),
                'location_lng': float(row['lng']),
                'cert_thumbprint': cert.thumbprint,
            })
            provisioned += 1
        except Exception as e:
            errors.append({'row': row, 'error': str(e)})
    
    return {'provisioned': provisioned, 'errors': len(errors)}
```

**Bulk provisioning performance:** The Lambda can process ~5,000 devices/minute. A 500,000-device import takes ~100 minutes. Larger imports (1M+) are run in parallel Lambda invocations with partitioned CSV files.

### Individual Provisioning (New Meter Installation)

When a technician installs a new meter, they scan the meter's QR code in the mobile app. The app calls the device provisioning API which registers the device, issues the cert, and sends the cert to the meter via the technician's local NFC or Bluetooth connection.

---

## SCADA Adapters

Not all grid assets communicate via MQTT. Substations, transformers, and some battery systems use industrial protocols. The IoT bridge includes adapter modules for:

| Protocol | Standard | Assets | Implementation |
|---|---|---|---|
| IEC 61968/61970 | CIM (Common Information Model) | Utility SCADA systems | REST/SOAP client adapter |
| DNP3 | IEEE 1815 | Substations, RTUs | Go `go-dnp3` library, pull-based |
| Modbus TCP | Modbus | Small substations, older RTUs | Go Modbus library, poll-based |
| IEC 61850 | GOOSE + MMS | Modern substation protection | Under development (Q2 2025) |

SCADA adapters are pull-based (unlike smart meters which are push-based). They poll the SCADA system on a configured interval (typically 30 seconds for substations) and publish readings to the same Kafka topics as MQTT devices.

```go
// internal/scada/dnp3_adapter.go (simplified)
type DNP3Adapter struct {
    client     *dnp3.Client
    tenantID   string
    stationID  string
    pollInterval time.Duration
    producer   kafka.Producer
}

func (a *DNP3Adapter) Run(ctx context.Context) {
    ticker := time.NewTicker(a.pollInterval)
    defer ticker.Stop()
    
    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            readings, err := a.client.ReadAllPoints()
            if err != nil {
                log.Error().Err(err).Str("station", a.stationID).Msg("DNP3 poll failed")
                continue
            }
            for _, r := range readings {
                a.producer.Produce(ctx, a.normalize(r))
            }
        }
    }
}
```

---

## Firmware Over-the-Air (OTA) Updates

Smart meter firmware is updated via the AMI (Advanced Metering Infrastructure) head-end system owned by the utility company. Helios does not push firmware directly to meters. Instead, Helios integrates with the utility's AMI head-end to:

1. **Track firmware versions** — each device record includes `firmware_version` updated on each reading (some meters report FW version in their telemetry)
2. **Trigger firmware rollout** — grid operators can initiate a firmware rollout via the portal, which calls the utility's AMI head-end API
3. **Monitor rollout progress** — firmware update status is polled from the AMI head-end and displayed in the Asset Management UI

Not all tenants have AMI head-end integration. For tenants without it (typically smaller co-ops), firmware management is handled entirely by the utility company outside of Helios.

---

## Monitoring and Alerting

Grafana: `https://grafana.internal.luminaenergy.com/d/iot-bridge`

Key metrics:
- MQTT connections active (per tenant, per AZ)
- Messages per second (ingested, decoded, DLQ'd)
- Decode error rate (per vendor)
- Device registry cache hit rate
- Unknown device rejection rate
- SCADA adapter poll success rate

**PagerDuty alerts:**
- `IoTBridgeKafkaBackpressure` — Kafka producer queue depth > 50,000
- `IoTBridgeDecodeErrorRate` — DLQ rate > 0.1% of total messages
- `EMQXBrokerDown` — any EMQX node health check fails
- `ScadaAdapterPollFailure` — SCADA adapter not polling successfully for > 5 minutes

---

## Known Issues

### Single-Region IoT Bridge

The EMQX cluster and IoT bridge run only in `us-east-1`. A regional AWS failure would stop all IoT telemetry ingestion. This is the most significant availability risk in the platform architecture.

**Current mitigation:** The grid monitor and outage detection services are designed to handle gaps in telemetry (meters that "go silent" trigger a LOW/MEDIUM alert after 30 minutes, not an immediate CRITICAL). An operator who sees the alert feed go quiet during a known AWS issue can recognize the pattern.

**Remediation plan:** Multi-region EMQX (active-active, with MQTT session migration) is planned for Q2 2025. See [ADR-009](/05-engineering/adrs.md#adr-009) and [Technical Debt Register](/05-engineering/technical-debt-register.md#iot-single-region).

---

## Things Every New Engineer Should Know

1. **Device IDs are Helios-internal.** The `device_id` in our system (e.g., `sm-42a9b7`) is generated by Helios. The meter's actual serial number is stored as `external_device_id`. All Kafka events, database rows, and API responses use the Helios `device_id`. Never expose `external_device_id` in API responses (it may contain PII for residential meters).

2. **The device registry cache is 1 hour.** When a device is provisioned or its configuration changes, the Redis cache still holds the old record for up to 1 hour. In dev/staging you can flush the cache manually: `redis-cli -c DEL device:registry:{deviceId}`. In production, coordinate with @lars.eriksson.

3. **SCADA adapters have different latency characteristics than MQTT.** MQTT meters report at 15-minute intervals (or more frequently). SCADA substations are polled every 30 seconds. This means substation telemetry in the grid monitor is fresher than meter telemetry — a useful thing to know when interpreting grid state.

4. **Do not add a new SCADA protocol adapter without a security review.** SCADA protocols like DNP3 and Modbus were designed for isolated industrial networks and have minimal security controls. Every new protocol adapter increases the attack surface. All SCADA adapter changes require review by @yasmin.osei.

5. **The DLQ is a diagnostic goldmine.** When a new meter vendor is deployed and their readings look wrong, check the DLQ topic first. Decode errors from unknown vendor IDs, malformed payloads, and unsupported protocol versions all land there.

---

*Document maintained by @ngozi.williams and @lars.eriksson*  
*SCADA protocol questions → @ahmed.hassan*  
*Device provisioning / OTA → @beatrice.anyanwu and @sunita.rao*  
*Related: [Event-Driven Architecture](/02-architecture/event-driven-architecture.md) · [Grid Monitoring Service](/03-services/grid-monitoring-service.md) · [Database Architecture](/02-architecture/database-architecture.md)*
