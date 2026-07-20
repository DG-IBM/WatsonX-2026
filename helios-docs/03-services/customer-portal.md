# Customer Portal — Helios

> **Location:** Confluence → Helios Engineering Space → Services → Customer Portal  
> **Owner:** Sofia Marchetti (Eng Manager, Customer Experience) · @sofia.marchetti  
> **Tech Lead:** Oliver Banks · @oliver.banks  
> **Last Updated:** 2024-10-28  
> **Repo:** `lumina-energy/helios-customer-portal`  
> **Status:** 🟢 Healthy  
> **Related:** [Frontend Architecture](/02-architecture/frontend-architecture.md) · [Notification Platform](/03-services/notification-platform.md) · [IoT Device Management](/03-services/iot-device-management.md) · [Compliance & Regulatory](/06-operations/compliance-regulatory.md)

---

## What This Is

The Customer Portal is a white-labeled React SPA (Vite) deployed by utility companies for their residential and commercial customers. It is **not** the Grid Operations Portal (that's `helios-portal`). These are completely separate applications.

Customers access the portal at their utility's branded domain — e.g., `myaccount.midwestgridco.com`. The portal is white-labeled by injecting a tenant brand configuration at runtime (see [Frontend Architecture — White-Labeling](/02-architecture/frontend-architecture.md#white-labeling-system)).

**What customers can do:**
- View near-real-time and historical energy usage (kWh, cost)
- View and download bills (from the utility's billing system, surfaced by Helios)
- See outages affecting their address
- Enroll in and manage demand-response programs
- Set energy usage alerts ("notify me if my usage exceeds $X this month")
- Manage notification preferences (email, SMS, push)
- View energy efficiency insights and tips (AI-generated, based on their usage)

**What customers cannot do:**
- Control their smart meter remotely (we do not expose that capability)
- See other customers' usage
- Access grid-level operational data

---

## Feature Breakdown

### Energy Usage Dashboard

The usage dashboard is the most-visited page. It shows usage in three modes:

- **Real-time:** Last meter reading (15-min resolution), updated when the portal loads and on manual refresh. Sourced from the `meter.readings.aggregated.v1` Kafka topic → stored in TimescaleDB → served via the Customer Portal BFF API.
- **Daily:** Bar chart, last 30 days, kWh per day and estimated cost.
- **Monthly:** Bar chart, last 12 months, with year-over-year comparison.

Usage data is fetched from the Customer Portal BFF endpoint, which queries TimescaleDB continuous aggregates (hourly and daily rollups). Raw 15-minute readings are not served to the Customer Portal — the aggregates are sufficient and are orders of magnitude cheaper to query.

```typescript
// src/pages/Usage/UsageDashboard.tsx
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { UsagePeriod, UsageSummary } from '@/types/usage';

function UsageDashboard() {
  const { data: usageSummary, isLoading } = useQuery<UsageSummary>({
    queryKey: ['usage', 'summary'],
    queryFn: () => apiClient.get('/usage/summary'),
    staleTime: 60_000,    // fresh for 1 minute
    refetchInterval: 300_000,  // background refresh every 5 min
  });

  const { data: dailyUsage } = useQuery({
    queryKey: ['usage', 'daily', '30d'],
    queryFn: () => apiClient.get('/usage/daily?days=30'),
    staleTime: 3_600_000,  // hourly data doesn't change more than once an hour
  });

  if (isLoading) return <UsageSkeleton />;

  return (
    <div className="space-y-6">
      <UsageCurrentBand summary={usageSummary} />
      <UsageDailyChart data={dailyUsage} />
      <BillProjection summary={usageSummary} />
    </div>
  );
}
```

### Billing Integration

The Customer Portal does not own billing data. Billing (account balances, invoices, payment methods) lives in the utility company's billing system (Oracle CC&B or SAP IS-U for most of our customers). Helios surfaces this data via a **billing adapter** that wraps each supported billing system's API.

```
Customer Portal → BFF API → Billing Adapter → Oracle CC&B API (or SAP IS-U API)
```

The billing adapter is configured per-tenant in `tenants.config.billingIntegration`. Currently supported adapters:

| Adapter | Supported Systems | Status |
|---|---|---|
| `oracle-ccb` | Oracle Customer Care & Billing v2.x, v3.x | ✅ Production |
| `sap-is-u` | SAP Industry Solution Utilities | ✅ Production |
| `mock` | Local dev and test environments | ✅ Dev/Test only |
| `custom-rest` | Utility-provided REST API (CUST-BRE, CUST-GON) | ✅ Per-customer |

**Billing data is not stored by Helios.** It is fetched on-demand from the billing system and cached for 1 hour in Redis. Helios never stores payment card data, account numbers, or sensitive billing information. We are PCI-DSS out-of-scope.

```typescript
// src/adapters/billing/oracle-ccb.adapter.ts
import { BillingAdapter, Invoice, AccountBalance } from '../types';

export class OracleCCBAdapter implements BillingAdapter {
  private baseUrl: string;
  private credentials: OracleCCBCredentials;

  async getAccountBalance(externalAccountId: string): Promise<AccountBalance> {
    const response = await this.client.get(
      `/ccb/rest/apis/v1/accounts/${externalAccountId}/balance`
    );
    return {
      currentBalance: response.data.currentBalance,
      dueDate: response.data.dueDate,
      currency: response.data.currency,
      lastPaymentAmount: response.data.lastPaymentAmount,
      lastPaymentDate: response.data.lastPaymentDate,
    };
  }

  async getInvoices(externalAccountId: string, limit = 12): Promise<Invoice[]> {
    const response = await this.client.get(
      `/ccb/rest/apis/v1/accounts/${externalAccountId}/bills?limit=${limit}`
    );
    return response.data.bills.map(this.mapBill);
  }
}
```

### Demand Response Program Management

Demand response (DR) is the product feature where utility companies ask enrolled customers to reduce electricity usage during peak demand periods, in exchange for bill credits. Helios manages the DR program lifecycle:

1. **Enrollment:** Customer sees program offer in portal, taps enroll, eligibility is checked (meter type, tariff, geographic zone), enrollment stored in Helios + passed to billing system for credit setup.
2. **Event notification:** When the forecasting engine predicts a demand peak, the operator can trigger a DR event. Enrolled customers in the affected zone are notified via the Notification Platform.
3. **Monitoring:** During the event, the portal shows real-time usage vs. the baseline for enrolled customers. Operators see aggregate demand reduction.
4. **Settlement:** After the event, the data pipeline computes each customer's demand reduction (actual usage vs. historical baseline), calculates the bill credit, and submits the credit to the billing system.

```typescript
// src/pages/DemandResponse/EnrollmentFlow.tsx
export function DemandResponseEnrollmentFlow() {
  const { tenant } = useTenant();
  const [step, setStep] = useState<'INTRO' | 'ELIGIBILITY' | 'TERMS' | 'CONFIRM'>('INTRO');

  const eligibilityCheck = useMutation({
    mutationFn: () => apiClient.post('/demand-response/check-eligibility'),
    onSuccess: (data) => {
      if (data.eligible) setStep('TERMS');
      else setStep('INTRO'); // show ineligibility message
    },
  });

  const enroll = useMutation({
    mutationFn: () => apiClient.post('/demand-response/enroll', {
      programId: tenant.config.demandResponseProgramId,
      termsAcceptedAt: new Date().toISOString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-profile'] });
      toast.success('You\'re enrolled! Credits will appear on your next bill.');
    },
  });

  // ... render steps
}
```

**Current enrollment statistics (Q4 2024):** ~2.3M enrolled customers across all tenants. Average bill credit per enrolled customer per year: $280. These numbers are used in customer marketing by the utility companies.

### Outage Map

The Customer Portal shows an outage map for the customer's service territory. This is a simplified read-only version of the GIS map — it shows confirmed outages as colored polygons over the affected area, with an estimated restoration time if available.

Customers can see if their address is inside an outage polygon. The address-to-outage association is computed by the GIS service using a point-in-polygon query:

```sql
-- GIS service query: is this customer's meter inside an active outage?
SELECT o.id, o.estimated_restoration_at, o.affected_customers
FROM public.outages o
JOIN gis.outage_polygons op ON op.outage_id = o.id
WHERE o.tenant_id = $1
  AND o.status = 'ACTIVE'
  AND ST_Contains(op.affected_area, ST_MakePoint($2, $3)::GEOGRAPHY::GEOMETRY);
-- $2 = customer_lng, $3 = customer_lat
```

### Energy Insights (AI-Generated)

The Customer Portal includes a weekly "Energy Insights" section — plain-language explanations of the customer's usage patterns, generated by a small language model fine-tuned on energy usage explanation templates.

**How it works:**
1. Data pipeline computes usage features (vs. last week, vs. neighbors, vs. weather)
2. Feature vector is passed to the `helios-insights` Lambda function (Python, runs weekly per customer)
3. LLM generates 2–3 insight sentences
4. Insights are stored in PostgreSQL with a 7-day TTL
5. Customer portal fetches the stored insight on page load

This feature was launched in v4.4 as a beta. Reception has been positive (NPS +8 for customers who see insights vs. those who don't in A/B test). It is not AI-safety-critical — the worst outcome of a bad insight is a slightly confusing recommendation, not a grid fault.

**Important:** The LLM is not GPT-4 or Claude. It is a fine-tuned `llama-3.1-8b` running on a dedicated inference endpoint (AWS Bedrock) to keep cost reasonable at 14 million customers. The prompt template is in `helios-model-ops/prompts/energy_insight_v2.txt`.

---

## Authentication in the Customer Portal

The Customer Portal uses a **separate Cognito User Pool** from the Grid Operations Portal. Customer accounts are created by the utility company's onboarding process (either imported from their CRM or self-registered via the portal sign-up flow).

Key differences from grid operator auth:
- Customer JWTs have `role: CUSTOMER` (not `GRID_OPERATOR` or `ADMIN`)
- Customer tokens contain `externalAccountId` — the billing system account ID
- Customer sessions are longer-lived (7-day refresh token, vs. 1-day for operators)
- MFA is optional for customers (required for operators)

See [Authentication — Customer Auth](/05-engineering/authentication.md#customer-portal-auth).

---

## White-Labeling Configuration

Each tenant white-labels the Customer Portal. Configuration is served from:

```
GET /api/portal/tenant-config
Authorization: uses subdomain to identify tenant (e.g., myaccount.midwestgridco.com → CUST-MWG)
```

Response:
```json
{
  "tenantId": "CUST-MWG",
  "brandName": "Midwest Grid Co",
  "primaryColor": "#003087",
  "logoUrl": "https://cdn.midwestgridco.com/assets/logo-portal.svg",
  "supportPhone": "1-800-555-0147",
  "supportEmail": "support@midwestgridco.com",
  "locale": "en-US",
  "features": {
    "showUsageHistory": true,
    "showBillPrediction": true,
    "showDemandResponse": true,
    "showOutageMap": true,
    "showEnergyInsights": true
  },
  "billingIntegration": "oracle-ccb",
  "demandResponseProgramId": "dr-mwg-residential-2024"
}
```

> **Note:** The portal is deployed once as a single build. The white-labeling is runtime configuration, not build-time. A single Cloudfront distribution serves all tenants' customers. The tenant is identified by the domain name (`Host` header), which the BFF API resolves to a `tenant_id`.

---

## API Reference (BFF Layer)

The Customer Portal uses a Backend-for-Frontend (BFF) pattern. The BFF is a set of REST endpoints in the API gateway, namespaced under `/api/portal/`:

```
GET  /api/portal/tenant-config                   Tenant branding + features
GET  /api/portal/profile                         Customer account profile
GET  /api/portal/usage/summary                   Current month summary
GET  /api/portal/usage/daily?days=N              Daily usage, last N days
GET  /api/portal/usage/monthly?months=N          Monthly usage, last N months
GET  /api/portal/billing/balance                 Current account balance
GET  /api/portal/billing/invoices                Invoice list
GET  /api/portal/billing/invoices/:id/download   Invoice PDF download
GET  /api/portal/outages/active                  Active outages near customer address
GET  /api/portal/demand-response/status          Customer DR enrollment status
POST /api/portal/demand-response/enroll          Enroll in DR program
GET  /api/portal/insights/latest                 Latest AI energy insights
GET  /api/portal/notifications/preferences       Notification settings
PUT  /api/portal/notifications/preferences       Update notification settings
```

---

## Accessibility

The Customer Portal is built to **WCAG 2.1 AA** standard. This is a contractual requirement in several of our MSAs (particularly for municipal utility customers like City of Boulder Energy). Key implementation notes:

- All interactive elements have accessible labels (`aria-label` or visible text)
- Color is never the sole indicator of state (alert colors always accompanied by text/icon)
- Keyboard navigation tested for all flows
- Screen reader tested with NVDA (Windows) and VoiceOver (iOS)
- Color contrast ratios meet AA minimum (4.5:1 for normal text)

Accessibility testing is part of the CI pipeline (`npm run a11y`). Axe-core automated checks run on every PR. Manual screen reader testing is done before major releases by @chloe.dubois.

---

## Performance Targets

| Metric | Target | Current |
|---|---|---|
| First Contentful Paint | < 1.5s (3G) | 1.1s |
| Time to Interactive | < 3.5s (3G) | 2.8s |
| Largest Contentful Paint | < 2.5s | 1.9s |
| Bundle size (initial, gzip) | < 200KB | 147KB |
| API response (usage summary) | < 500ms P99 | 310ms |

Lighthouse scores are tracked in the CI pipeline. A regression in any Core Web Vital fails the PR.

---

## Common Mistakes

1. **Calling billing APIs on every render.** The billing API (Oracle CC&B) is slow (~800ms P99). It is cached for 1 hour in Redis. Do not add any code that bypasses this cache or calls billing endpoints on component mount — always use the BFF endpoints which have the cache built in.

2. **Using tenant-specific strings in component code.** Use `useTenant().config.brandName` not `"Midwest Grid Co"`. Use `useTenant().config.supportPhone` not `"1-800-555-0147"`.

3. **Assuming all features are enabled.** Before rendering any feature section, check `tenant.config.features.show{FeatureName}`. Two of our tenants have demand response disabled.

4. **Forgetting i18n.** The portal supports 8 languages. All user-facing strings must use `t('key')` from `react-i18next`, not hardcoded English text. Run `npm run i18n:check` before committing.

---

*Document maintained by @sofia.marchetti and @oliver.banks*  
*Billing integration questions → @amara.diallo*  
*Demand response → @nina.kowalski*  
*Related: [Frontend Architecture](/02-architecture/frontend-architecture.md) · [Notification Platform](/03-services/notification-platform.md) · [Analytics Platform](/supplemental/analytics-platform.md)*
