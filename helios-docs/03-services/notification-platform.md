# Notification Platform — Helios

> **Location:** Confluence → Helios Engineering Space → Services → Notification Platform  
> **Owner:** Aisha Kamara (Engineer, Platform) · @aisha.kamara  
> **Last Updated:** 2024-10-09  
> **Repo:** `lumina-energy/helios-notify`  
> **Status:** 🟢 Healthy  
> **Related:** [Grid Monitoring Service](/03-services/grid-monitoring-service.md) · [Outage Detection Service](/03-services/outage-detection-service.md) · [Customer Portal](/03-services/customer-portal.md) · [Event-Driven Architecture](/02-architecture/event-driven-architecture.md)

---

## What This Service Does

`helios-notify` is the centralized multi-channel notification service. It consumes events from Kafka (alerts, outages, dispatch, demand response) and routes notifications to the appropriate recipients via the appropriate channel.

The key design principle: **notification logic lives here, not in the producing services.** The grid monitor, outage detector, and dispatch service do not know or care who gets notified about their events or via which channel. They publish events to Kafka. This service decides the rest.

**Channels supported:**
| Channel | Provider | Use Cases |
|---|---|---|
| Email | SendGrid | Operator alerts (digest), customer outage notices, demand response notices, billing summaries |
| SMS | Twilio | Critical/HIGH operator alerts, customer outage SMS, DR event activation |
| Push (Mobile) | Firebase (Android) + APNS (iOS) | Technician work order assignments, operator mobile app alerts |
| In-App | Redis pub/sub → WebSocket | Real-time portal alerts (Grid Ops Portal), customer portal banners |

---

## Architecture

```mermaid
graph TD
    K1[grid.alerts.v2] --> C[Notify Kafka Consumers]
    K2[outage.events.v1] --> C
    K3[dispatch.events.v1] --> C
    K4[demand.response.events.v1] --> C

    C --> RR[Recipient Resolver\n— Who should receive this?]
    RR --> PG[(Notification Rules\nPostgreSQL)]
    RR --> DEDUP[Deduplication Check\nRedis]

    DEDUP -->|not duplicate| ROUTER[Channel Router\n— Which channel(s)?]
    DEDUP -->|duplicate| DROP[Drop / Suppress]

    ROUTER --> EMAIL[Email Worker\nSendGrid]
    ROUTER --> SMS[SMS Worker\nTwilio]
    ROUTER --> PUSH[Push Worker\nFCM + APNS]
    ROUTER --> INAPP[In-App Worker\nRedis pub/sub]

    EMAIL --> DLVLOG[(Delivery Log\nPostgreSQL)]
    SMS --> DLVLOG
    PUSH --> DLVLOG
    INAPP --> DLVLOG
```

---

## Notification Rules

Notification rules define who gets notified about what event, via which channel, under what conditions. Rules are stored in PostgreSQL and configured per-tenant via the portal (Admin → Notification Rules).

```sql
-- notify.notification_rules
CREATE TABLE notify.notification_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID         NOT NULL REFERENCES public.tenants(id),
    name            VARCHAR(255) NOT NULL,
    enabled         BOOLEAN      NOT NULL DEFAULT TRUE,
    event_type      VARCHAR(100) NOT NULL,   -- 'grid.alert', 'outage.detected', 'dispatch.assigned', etc.
    conditions      JSONB        NOT NULL DEFAULT '{}',
    recipients      JSONB        NOT NULL,   -- [{type: 'role', value: 'GRID_OPERATOR'}, {type: 'email', value: '...'}]
    channels        VARCHAR[]    NOT NULL,   -- ['email', 'sms', 'push', 'in-app']
    template_id     VARCHAR(100) NOT NULL,
    cooldown_ms     INTEGER      NOT NULL DEFAULT 0,
    priority        VARCHAR(20)  NOT NULL DEFAULT 'NORMAL',  -- CRITICAL | HIGH | NORMAL | LOW
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

**Example rule configurations:**

```json
// Rule: SMS for CRITICAL grid alerts during business hours
{
  "event_type": "grid.alert",
  "conditions": {
    "severity": ["CRITICAL"],
    "timeRange": { "start": "06:00", "end": "22:00", "timezone": "America/Chicago" }
  },
  "recipients": [
    { "type": "role", "value": "GRID_OPERATOR" },
    { "type": "role", "value": "GRID_SUPERVISOR" }
  ],
  "channels": ["sms", "in-app"],
  "template_id": "alert-critical-sms-v2",
  "cooldown_ms": 300000
}

// Rule: Customer email for confirmed outage
{
  "event_type": "outage.detected",
  "conditions": {
    "severity": ["CRITICAL", "HIGH"],
    "affectedCustomers": { "min": 1 }
  },
  "recipients": [
    { "type": "affected-customers" }
  ],
  "channels": ["email", "sms"],
  "template_id": "customer-outage-notice-v3",
  "cooldown_ms": 3600000
}
```

---

## Recipient Resolution

The most complex part of the notification service is resolving who receives a notification. Different event types use different resolution strategies:

| Recipient Type | Resolution | Example |
|---|---|---|
| `role` | All users in the tenant with the given role | All `GRID_OPERATOR` users in tenant CUST-MWG |
| `email` | Static email address | On-call supervisor's email |
| `on-call` | Current on-call engineer from PagerDuty schedule | Via PagerDuty API |
| `affected-customers` | All customers in the outage polygon | GIS point-in-polygon query |
| `technician` | Specific technician (for dispatch notifications) | Work order assigned technician |
| `user` | Specific user by ID | For targeted system notifications |

**Affected-customers resolution** is by far the most expensive operation. For a large outage (>10,000 affected meters), we must:
1. Look up the outage polygon from the GIS service
2. Query PostGIS for all meters within the polygon
3. Resolve those meter IDs to customer account IDs
4. Look up notification preferences for each customer
5. Batch-create notification jobs

This is done asynchronously — the Kafka consumer processes the outage event, enqueues the recipient resolution as a background job, and the actual notifications are sent in batches of 500 over the following 2–10 minutes. Customers should not be surprised if the outage SMS arrives 5 minutes after the outage is confirmed.

---

## Deduplication

The notification service uses Redis-based deduplication to prevent notification storms. The deduplication key is `{tenantId}:{eventId}:{recipientId}:{channel}:{templateId}`. If this key exists in Redis, the notification is suppressed.

```typescript
// src/deduplication/dedup.ts
const DEDUP_TTL_MS = 300_000;  // 5 minutes default

async function shouldSend(
  tenantId: string,
  eventId: string,
  recipientId: string,
  channel: string,
  templateId: string
): Promise<boolean> {
  const key = `notify:dedup:${tenantId}:${eventId}:${recipientId}:${channel}:${templateId}`;
  // SET NX: only set if key doesn't exist; returns true if set (first time), false if exists
  const isNew = await redis.set(key, '1', 'PX', DEDUP_TTL_MS, 'NX');
  return isNew !== null;
}
```

The deduplication TTL is configurable per rule via `cooldown_ms`. A rule with `cooldown_ms: 3600000` means the same notification to the same recipient won't be sent more than once per hour for the same triggering event.

---

## Message Templates

Notification templates are stored in the database (not in code files) to allow tenant-specific customization without code deployments. Templates use Handlebars syntax.

```sql
-- notify.templates
CREATE TABLE notify.templates (
    id              VARCHAR(100) PRIMARY KEY,
    tenant_id       UUID         REFERENCES public.tenants(id),  -- NULL = global default
    channel         VARCHAR(20)  NOT NULL,
    language        VARCHAR(10)  NOT NULL DEFAULT 'en',
    subject         TEXT,  -- email only
    body            TEXT         NOT NULL,  -- Handlebars template
    version         INTEGER      NOT NULL DEFAULT 1,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

**Example template:**

```
-- Template ID: customer-outage-notice-v3 (email, en)
Subject: Power outage in your area — {{outage.affectedArea}}

Dear {{customer.name}},

We are aware of a power outage affecting your service area in {{outage.affectedArea}}.

📍 Affected area: {{outage.affectedArea}}
🕐 Reported at: {{outage.detectedAt | formatTime}}
🔧 Estimated restoration: {{outage.estimatedRestorationAt | formatTime | default "Being assessed"}}
👷 Crew status: {{outage.crewStatus | default "Crew being dispatched"}}

You do not need to call us — our crews are already working on this. 
We will send you another notification when power is restored.

To check real-time outage status: {{tenant.portalUrl}}/outages

— {{tenant.brandName}} Customer Service
{{tenant.supportPhone}}
```

**Template variables** are resolved at send time by merging the event data, recipient data, and tenant config.

---

## Delivery Log

Every notification attempt (success or failure) is logged:

```sql
-- notify.delivery_log
CREATE TABLE notify.delivery_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID         NOT NULL,
    rule_id         UUID         REFERENCES notify.notification_rules(id),
    template_id     VARCHAR(100) NOT NULL,
    channel         VARCHAR(20)  NOT NULL,
    recipient_id    VARCHAR(255) NOT NULL,  -- user ID, phone number, or email (hashed for PII)
    event_type      VARCHAR(100) NOT NULL,
    event_id        VARCHAR(255),
    status          VARCHAR(20)  NOT NULL,  -- SENT | DELIVERED | FAILED | SUPPRESSED
    provider_message_id VARCHAR(255),       -- SendGrid ID, Twilio SID, etc.
    error_code      VARCHAR(100),
    error_message   TEXT,
    sent_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    delivered_at    TIMESTAMPTZ
);
```

> **PII note:** Phone numbers and email addresses in the delivery log are SHA-256 hashed. The raw PII is never stored in the log table. If you need to investigate a delivery issue for a specific recipient, hash their contact info and search for the hash. See [Security Architecture — PII Handling](/06-operations/security-architecture.md#pii-handling).

---

## Provider Configuration

### SendGrid (Email)

```typescript
// src/providers/email/sendgrid.provider.ts
import sgMail from '@sendgrid/mail';

export class SendGridProvider implements EmailProvider {
  constructor(private apiKey: string) {
    sgMail.setApiKey(apiKey);
  }

  async send(notification: EmailNotification): Promise<DeliveryResult> {
    try {
      const [response] = await sgMail.send({
        to: notification.to,
        from: { email: notification.fromEmail, name: notification.fromName },
        subject: notification.subject,
        html: notification.htmlBody,
        text: notification.textBody,
        customArgs: {
          tenantId: notification.tenantId,
          notificationId: notification.id,
        },
        trackingSettings: {
          clickTracking: { enable: false },  // GDPR-conscious default
          openTracking: { enable: true },
        },
      });
      return { status: 'SENT', providerId: response[0].headers['x-message-id'] };
    } catch (err) {
      return { status: 'FAILED', error: err.message };
    }
  }
}
```

### Twilio (SMS)

- SMS is limited to 160 characters for standard SMS. The notify service automatically truncates and appends a portal link for longer messages.
- Twilio sending rate: 1 SMS/second per long-code number. For mass outage notifications (>1000 customers), the service uses Twilio Messaging Services (which pools multiple numbers) to achieve ~100 SMS/second throughput.
- International numbers: Some EU customers require different country codes and regulatory compliance (e.g., sender ID registration in Germany). Configuration is in `tenants.config.sms`.

---

## Monitoring

Grafana dashboard: `https://grafana.internal.luminaenergy.com/d/notify`

Key metrics:
- Notifications sent per hour (by channel, by tenant)
- Delivery failure rate (per channel)
- Deduplication suppression rate (useful for tuning cooldown values)
- Kafka consumer lag (notify consumers)
- Queue depth (for mass-notification jobs)

**PagerDuty alerts:**
- `NotifyEmailFailureRate` — SendGrid error rate > 2%
- `NotifySMSFailureRate` — Twilio error rate > 2%
- `NotifyKafkaLag` — consumer lag > 30s
- `NotifyMassJobStuck` — mass notification job not progressing for > 10 minutes

---

## Rate Limits and Cost Management

Notifications have direct cost implications (Twilio SMS: ~$0.0075/message; SendGrid email: ~$0.0001/email). At scale, a misconfigured rule can generate thousands of spurious notifications.

**Hard limits (enforced in code):**
- Maximum 1 SMS per recipient per hour per tenant (across all rules combined)
- Maximum 10 emails per recipient per day per tenant
- Maximum 3 push notifications per recipient per hour

These limits exist regardless of rule configuration. They can be raised for specific tenants by updating `tenants.config.notify.limits` (requires approval from @aisha.kamara and @priya.nair).

**Cost incident:** In March 2023, a misconfigured alert rule at a customer with aggressive thresholds generated 47,000 SMS messages in 2 hours before the rate limit was detected. Total cost: ~$352. The hard rate limits were added the following sprint. See [Project Timeline](/supplemental/project-timeline-history.md#2023-sms-cost-incident).

---

## Things Every New Engineer Should Know

1. **Notification rules are tenant configuration, not code.** If a tenant reports missing or incorrect notifications, check their notification rules in the portal admin first before looking at code. 90% of notification issues are misconfigured rules.

2. **Mass notifications are asynchronous and delayed.** Customer outage SMS does not go out the instant the outage is detected. There is a 2–10 minute delay for affected-customer resolution and batch sending. This is by design. Do not try to make it synchronous — it would block the Kafka consumer.

3. **Never log raw phone numbers or email addresses.** Notification PII must be hashed. The `@helios/logger` library's notification context formatter handles this automatically, but if you write custom logging in the notify service, hash before logging.

4. **Template changes require a database migration or admin update, not a code deploy.** Templates are in the database. To update a template, update the `notify.templates` table. A new template version should increment the `version` column and create a new row (don't overwrite active templates in-place).

5. **Test with the `mock` channel in dev environments.** The notify service supports a `mock` channel that logs notifications to stdout without calling external providers. Set `NOTIFY_MOCK_CHANNELS=email,sms,push` in your `.env.local` to enable it. Never run against real Twilio/SendGrid in dev.

---

*Document maintained by @aisha.kamara*  
*Template management: self-serve via portal admin or @chloe.dubois for complex templates*  
*Related: [Grid Monitoring Service](/03-services/grid-monitoring-service.md) · [Customer Portal](/03-services/customer-portal.md) · [Alerting Strategy](/04-platform/alerting-strategy.md)*
