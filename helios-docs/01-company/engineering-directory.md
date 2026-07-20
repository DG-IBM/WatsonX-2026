# Engineering Directory — Helios

> **Location:** Confluence → Helios Engineering Space → Company → Engineering Directory  
> **Owner:** Tanvir Rahman (Engineering Manager, Platform) · @tanvir.rahman  
> **Last Updated:** 2024-11-01  
> **Status:** Active — updated as people join/leave  
> **Related:** [Team Structure](/07-onboarding/team-structure.md) · [Ownership Matrix](/07-onboarding/ownership-matrix.md) · [On-call Rotation Guide](/06-operations/on-call-rotation-guide.md)

---

> *This directory is deliberately personal. Names, roles, domains of expertise, and the informal network matter. On a team of 70 engineers, you cannot know everyone deeply — but you should know who to ping for what, and you should know enough about people to have a real conversation.*

---

## How to Use This Directory

- **Finding the right person for a technical question:** Use the expertise tags in each entry, or check the [Ownership Matrix](/07-onboarding/ownership-matrix.md) for service ownership.
- **Finding who's on-call:** See [On-call Rotation Guide](/06-operations/on-call-rotation-guide.md) — current rotation is PagerDuty-managed.
- **Finding who to invite to an architecture review:** Check the [Team Structure](/07-onboarding/team-structure.md) for team leads and ARB members.
- **Slack handles:** All handles are `@firstname.lastname` unless noted.
- **Time zones:** Listed because we are distributed across 5 time zones. Respect working hours.

---

## Leadership

| Name | Title | Slack | Location | Time Zone |
|---|---|---|---|---|
| Anjali Singh | CEO | @anjali.singh | Austin, TX | CT |
| James Whitfield | CTO | @james.whitfield | Austin, TX | CT |
| Meera Pillai | VP Product | @meera.pillai | San Francisco, CA | PT |
| Elena Vasquez | VP Engineering | @elena.vasquez | Austin, TX | CT |
| Rachel Odum | VP Sales Engineering | @rachel.odum | New York, NY | ET |
| Tanvir Rahman | Eng Manager, Platform | @tanvir.rahman | Austin, TX | CT |
| Kwame Asante | Eng Manager, Grid Intelligence | @kwame.asante | Atlanta, GA | ET |
| Sofia Marchetti | Eng Manager, Customer Experience | @sofia.marchetti | Remote (London) | GMT |
| Daniel Park | Eng Manager, Data & AI | @daniel.park | Seattle, WA | PT |
| Raj Patel | Eng Manager, Field Ops | @raj.patel | Austin, TX | CT |
| Ngozi Williams | Eng Manager, IoT & Devices | @ngozi.williams | Houston, TX | CT |

---

## Architecture Review Board (ARB)

The ARB reviews significant architectural changes, approves ADRs, and maintains the technical direction of the platform. Meeting: bi-weekly Thursdays 10am CT.

| Name | Role | Area of Focus |
|---|---|---|
| David Okafor | Principal Engineer | Distributed systems, event architecture |
| Priya Nair | Staff Engineer, Platform | API design, multi-tenancy, infrastructure |
| Lin Chen | Staff Engineer, Data & AI | Data pipelines, ML systems, storage |
| Marcus Webb | SRE Lead | Reliability, observability, capacity |
| Yasmin Osei | Security Engineer | Security architecture, compliance |
| Rosa Lindqvist | Senior Engineer, Grid Intelligence | Grid algorithms, real-time systems |

---

## Platform Team

> **Mission:** Own the core infrastructure, API gateway, authentication/authorization, deployment pipeline, and shared services that all other teams depend on.  
> **Jira Project:** `PLAT`  
> **Slack:** `#team-platform`  
> **On-call:** `helios-platform-oncall`

| Name | Level | Role / Expertise | Slack | Location | TZ |
|---|---|---|---|---|---|
| Priya Nair | Staff Engineer | API architecture, GraphQL, multi-tenancy, performance | @priya.nair | Austin, TX | CT |
| Rosa Lindqvist | Senior Engineer | Node.js API gateway, authentication flows, OAuth | @rosa.lindqvist | Remote (Stockholm) | CET |
| Kenji Watanabe | Senior Engineer | Kubernetes, Helm, GitOps/Flux, CI/CD | @kenji.watanabe | San Francisco, CA | PT |
| Tom Reeves | Senior Engineer (Infra) | Terraform, AWS, EKS, networking | @tom.reeves | Austin, TX | CT |
| Aisha Kamara | Engineer | Notification service, messaging, Redis | @aisha.kamara | Remote (Lagos) | WAT |
| Dev Sharma | Engineer | API gateway, rate limiting, auth middleware | @dev.sharma | Austin, TX | CT |
| Fatima Al-Rashid | Engineer | Deployment tooling, release automation | @fatima.alrashid | Remote (Dubai) | GST |

---

## Grid Intelligence Team

> **Mission:** Real-time grid state management, outage detection, fault prediction, and grid topology modeling.  
> **Jira Project:** `GRID`  
> **Slack:** `#team-grid-intelligence`  
> **On-call:** `helios-grid-oncall`

| Name | Level | Role / Expertise | Slack | Location | TZ |
|---|---|---|---|---|---|
| David Okafor | Principal Engineer | Distributed event processing, topology algorithms, Go | @david.okafor | Atlanta, GA | ET |
| Rosa Lindqvist | Senior Engineer | Grid monitoring service, real-time alerts, state machines | @rosa.lindqvist | Remote (Stockholm) | CET |
| Chidi Eze | Senior Engineer | Outage detection, fault propagation modeling | @chidi.eze | Atlanta, GA | ET |
| Ingrid Sorensen | Senior Engineer | Grid state management, Redis architecture | @ingrid.sorensen | Remote (Oslo) | CET |
| Marcus Chen | Engineer | Go services, telemetry processing | @marcus.chen | Austin, TX | CT |
| Yuna Kim | Engineer | Alert pipeline, threshold management | @yuna.kim | Remote (Seoul) | KST |
| Babatunde Adeyemi | Engineer | Grid topology service, GIS integration | @babatunde.adeyemi | Remote (Lagos) | WAT |

> **Note:** Rosa Lindqvist is shared between Platform and Grid Intelligence — she sits with Grid Intelligence day-to-day but is the Platform tech lead for the authentication work. This is a known organizational awkwardness that came from a reorg in Q2 2023 and has not been fully resolved.

---

## Data & AI Team

> **Mission:** AI demand forecasting, predictive analytics, data pipelines, model training and serving infrastructure.  
> **Jira Project:** `DATA`  
> **Slack:** `#team-data-ai`  
> **On-call:** `helios-data-oncall` (business hours only; after-hours model failures escalate to Platform)

| Name | Level | Role / Expertise | Slack | Location | TZ |
|---|---|---|---|---|---|
| Lin Chen | Staff Engineer | ML systems, feature stores, model architecture, Python | @lin.chen | Seattle, WA | PT |
| Soren Andersen | Senior ML Engineer | Demand forecasting models, time series analysis | @soren.andersen | Remote (Copenhagen) | CET |
| Preethi Subramaniam | Senior Data Engineer | Spark pipelines, dbt, Redshift | @preethi.subramaniam | San Francisco, CA | PT |
| Emmanuel Obi | Senior ML Engineer | Predictive fault modeling, anomaly detection | @emmanuel.obi | Remote (Abuja) | WAT |
| Zara Ahmed | Data Engineer | Data pipeline reliability, schema management | @zara.ahmed | Austin, TX | CT |
| Jake Thornton | ML Engineer | Model monitoring, drift detection, MLflow | @jake.thornton | Seattle, WA | PT |
| Wei Liu | Data Engineer | TimescaleDB, meter data processing | @wei.liu | San Francisco, CA | PT |

---

## Customer Experience Team

> **Mission:** Customer Portal (consumer-facing), demand response enrollment, billing data presentation, notification preferences.  
> **Jira Project:** `CX`  
> **Slack:** `#team-customer-experience`  
> **On-call:** Incidents escalate to Platform on-call; no separate CX on-call rotation

| Name | Level | Role / Expertise | Slack | Location | TZ |
|---|---|---|---|---|---|
| Sofia Marchetti | Eng Manager | Team management, product alignment, React | @sofia.marchetti | Remote (London) | GMT |
| Oliver Banks | Senior Engineer | React SPA, customer portal features | @oliver.banks | Remote (Bristol) | GMT |
| Amara Diallo | Senior Engineer | Billing integration, Oracle CC&B adapter | @amara.diallo | Remote (Paris) | CET |
| Nina Kowalski | Engineer | Demand response UI, real-time usage display | @nina.kowalski | Remote (Warsaw) | CET |
| Ravi Menon | Engineer | Customer portal API consumption, BFF layer | @ravi.menon | Austin, TX | CT |
| Chloe Dubois | Engineer | Notification preferences UI, onboarding flows | @chloe.dubois | Remote (Montreal) | ET |

---

## Field Operations Team

> **Mission:** Technician dispatch system, work order management, mobile app API, field workflow tooling.  
> **Jira Project:** `FIELD`  
> **Slack:** `#team-field-ops`  
> **On-call:** `helios-dispatch-oncall`

| Name | Level | Role / Expertise | Slack | Location | TZ |
|---|---|---|---|---|---|
| Raj Patel | Eng Manager | Team management, Node.js, dispatch system architecture | @raj.patel | Austin, TX | CT |
| James Osei | Senior Engineer | Work order service, scheduling algorithms | @james.osei | Austin, TX | CT |
| Lena Fischer | Senior Engineer | Mobile app API, offline sync protocol | @lena.fischer | Remote (Berlin) | CET |
| Tomás Ortega | Engineer | Technician routing, mapping integration | @tomas.ortega | Austin, TX | CT |
| Naomi Adesanya | Engineer | Dispatch notifications, escalation workflows | @naomi.adesanya | Remote (Lagos) | WAT |
| Connor Walsh | Engineer | Mobile app (React Native), `helios-tech-mobile` | @connor.walsh | Remote (Dublin) | GMT |

> **Note:** Connor Walsh owns `helios-tech-mobile` — the React Native app. He works closely with the Field Ops team but the mobile app has its own deployment process and release cadence. See [Deployment Guide — Mobile](/supplemental/deployment-guide.md#mobile-app).

---

## IoT & Devices Team

> **Mission:** Smart meter integration, IoT device registry, MQTT bridge, firmware OTA, SCADA adapter framework.  
> **Jira Project:** `IOT`  
> **Slack:** `#team-iot-devices`  
> **On-call:** `helios-iot-oncall`

| Name | Level | Role / Expertise | Slack | Location | TZ |
|---|---|---|---|---|---|
| Ngozi Williams | Eng Manager | Team management, IoT architecture, embedded systems background | @ngozi.williams | Houston, TX | CT |
| Lars Eriksson | Senior Engineer | MQTT broker (EMQX), Go IoT bridge service | @lars.eriksson | Remote (Gothenburg) | CET |
| Beatrice Anyanwu | Senior Engineer | Device registry, provisioning workflows | @beatrice.anyanwu | Houston, TX | CT |
| Ahmed Hassan | Engineer | SCADA adapters (IEC 61968/61970), DNP3 | @ahmed.hassan | Remote (Cairo) | EET |
| Sunita Rao | Engineer | Firmware OTA, device lifecycle management | @sunita.rao | Austin, TX | CT |
| Patrick Leung | Engineer | Meter data validation, anomaly detection at ingest | @patrick.leung | San Francisco, CA | PT |

---

## GIS & Mapping Team

> **Mission:** Geospatial asset management, GIS data ingestion from utility SCADA systems, MapLibre integration layer.  
> **Jira Project:** `GIS`  
> **Slack:** `#team-gis`  
> **On-call:** Incidents escalate to Grid Intelligence on-call

| Name | Level | Role / Expertise | Slack | Location | TZ |
|---|---|---|---|---|---|
| Alejandro Reyes | Senior Engineer (Tech Lead) | PostGIS, Go GIS service, geospatial algorithms | @alejandro.reyes | Austin, TX | CT |
| Hana Kobayashi | Senior Engineer | MapLibre GL JS, frontend GIS layers | @hana.kobayashi | San Francisco, CA | PT |
| Chisom Okonkwo | Engineer | GIS data pipelines, ESRI integration | @chisom.okonkwo | Remote (Enugu) | WAT |

> The GIS team is small but disproportionately impactful — the GIS layer underpins the Grid Operations Portal, the mobile technician app, the outage visualization, and customer outage maps. Alejandro has deep knowledge of the utility company SCADA GIS export formats (there are 11 different ones). If you are touching any GIS integration work, talk to him first.

---

## SRE & Platform Infra

> **Mission:** Reliability engineering, incident management, infrastructure automation, observability platform.  
> **Jira Project:** `SRE`  
> **Slack:** `#team-sre` · `#helios-incidents` (incidents)  
> **On-call:** `helios-platform-oncall` (primary on-call rotation)

| Name | Level | Role / Expertise | Slack | Location | TZ |
|---|---|---|---|---|---|
| Marcus Webb | SRE Lead | Incident management, reliability, Prometheus, Kafka operations | @marcus.webb | Austin, TX | CT |
| Tom Reeves | Senior Engineer (shared with Platform) | Terraform, AWS, EKS | @tom.reeves | Austin, TX | CT |
| Kenji Watanabe | Senior Engineer (shared with Platform) | Kubernetes, Helm, Flux | @kenji.watanabe | San Francisco, CA | PT |
| Aisha Kamara | Engineer (shared with Platform) | Monitoring, alerting, Grafana | @aisha.kamara | Remote (Lagos) | WAT |

---

## Security Engineering

> **Mission:** Security architecture, NERC CIP compliance, vulnerability management, secrets management, penetration testing coordination.  
> **Jira Project:** `SEC`  
> **Slack:** `#security-private` (private) · `#helios-security` (public questions)

| Name | Level | Role / Expertise | Slack | Location | TZ |
|---|---|---|---|---|---|
| Yasmin Osei | Senior Security Engineer | Threat modeling, IAM, NERC CIP, SOC 2, OPA policies | @yasmin.osei | Austin, TX | CT |
| Diego Herrera | Security Engineer | Vulnerability scanning, pen test coordination, SAST/DAST | @diego.herrera | Remote (Mexico City) | CT |

> **Security escalation:** For urgent security concerns, DM @yasmin.osei directly. For critical vulnerabilities in production, also email security@luminaenergy.com.

---

## Grid UI Team

> **Mission:** Grid Operations Portal (Next.js), operator-facing dashboards, real-time visualization, alert UI, GIS map rendering.  
> **Jira Project:** `UI`  
> **Slack:** `#team-grid-ui`  
> **On-call:** UI incidents escalate to Platform on-call

| Name | Level | Role / Expertise | Slack | Location | TZ |
|---|---|---|---|---|---|
| Ana Lima | Senior Engineer (Tech Lead) | Next.js 14, React architecture, shared component library | @ana.lima | Remote (São Paulo) | BRT |
| Ben Ostrowski | Senior Engineer | Real-time dashboard, WebSocket integration, Recharts | @ben.ostrowski | Chicago, IL | CT |
| Mei Zhang | Senior Engineer | GIS map UI, MapLibre integration, operator UX | @mei.zhang | San Francisco, CA | PT |
| Carlos Santos | Engineer | Alert management UI, dispatch portal integration | @carlos.santos | Remote (Lisbon) | WET |
| Priya Chandrasekaran | Engineer | `@helios/ui` component library, design system | @priya.chandrasekaran | Austin, TX | CT |
| Tunde Bakare | Engineer | Grid topology visualization, outage overlays | @tunde.bakare | Remote (London) | GMT |

---

## Compliance & Regulatory Engineering

> **Mission:** Automated regulatory reporting (NERC CIP, FERC, GDPR, AEMO), audit trail infrastructure, data governance.  
> **Jira Project:** `COMP`  
> **Slack:** `#team-compliance`

| Name | Level | Role / Expertise | Slack | Location | TZ |
|---|---|---|---|---|---|
| Helena Müller | Senior Engineer (Tech Lead) | NERC CIP reporting, GDPR data architecture, audit logging | @helena.muller | Remote (Berlin) | CET |
| James Osei | Engineer (shared with Field Ops) | Automated report generation | @james.osei | Austin, TX | CT |

> The Compliance team is intentionally small — most compliance-adjacent work is distributed across teams, with Helena serving as the expert and reviewer. She has a background in both software engineering and regulatory affairs (she worked at a utility company before Lumina). Her sign-off is required on any feature that touches audit logging, data retention, or regulatory reporting.

---

## Alumni / Former Key Contributors

These people shaped Helios significantly. They have left the company but their decisions are in the codebase.

| Name | Tenure | Contribution | Notes |
|---|---|---|---|
| Sam Rodriguez | 2021–2023 | Built the original IoT bridge architecture | Left for Series A startup; architecture survives in `helios-iot-bridge` |
| Nina Patel | 2021–2022 | Designed the original GraphQL schema | Left for Google; schema is largely unchanged (see [ADR-002](/05-engineering/adrs.md#adr-002)) |
| Chris Lee | 2020–2023 | Original Kubernetes setup, Helm chart architecture | Left for Netflix; infra dramatically evolved but his patterns remain |
| Fatou Diallo | 2021–2024 | TimescaleDB implementation, meter data schema | Left for Snowflake; her schema decisions are documented in [Database Architecture](/02-architecture/database-architecture.md) |

---

## How Teams Work Together

Helios uses a **modified two-pizza team model**. Most teams are 5–8 engineers with a clear service ownership boundary. However, some work naturally crosses team boundaries:

### Known Cross-Team Dependencies

| Interaction | Teams Involved | Coordination Mechanism |
|---|---|---|
| Alert pipeline | Grid Intelligence → Platform (Notify) | Kafka topic: `grid.alerts.v2`; SLA in service contract |
| Dispatch from outage | Grid Intelligence → Field Ops | REST API; documented in [Outage Detection Service](/03-services/outage-detection-service.md#dispatch-integration) |
| Customer usage data | IoT & Devices → Customer Experience | Kafka topic: `meter.readings.aggregated.v1` |
| Model inference | Data & AI → Grid Intelligence | gRPC service; documented in [AI Forecasting Engine](/03-services/ai-forecasting-engine.md#serving-api) |
| GIS asset data | GIS → Grid Intelligence, Field Ops | Kafka topic: `gis.asset.updates.v1`; read-only REST API |
| Auth tokens | Platform → All teams | JWT validation library `@helios/auth`; see [Authentication](/05-engineering/authentication.md) |

### When to Escalate Cross-Team Issues

1. Try to resolve in the relevant Slack channel (e.g., `#team-grid-intelligence` + `#team-platform`) first.
2. If unresolved in 2 days, escalate to the affected eng managers.
3. If it's a production-impacting dependency, treat it as an incident — use `#helios-incidents`.
4. Architectural disagreements go to the ARB. Ping @priya.nair or @david.okafor to add to the agenda.

---

## Timezone Coverage Summary

The team spans 5 time zones. This table shows approximate overlap windows:

| Region | Time Zone | Approx. Team Members | Business Hours (UTC) |
|---|---|---|---|
| US Central (Austin) | CT (UTC-6/-5) | ~20 | 14:00–23:00 UTC |
| US East (Atlanta, NY) | ET (UTC-5/-4) | ~8 | 13:00–22:00 UTC |
| US Pacific (SF, Seattle) | PT (UTC-8/-7) | ~10 | 16:00–01:00 UTC |
| Europe (London, Berlin, Stockholm, Oslo, Lisbon, Warsaw, Dublin, Paris, Copenhagen) | GMT/CET (UTC+0/+1) | ~18 | 08:00–18:00 UTC |
| Africa / Middle East (Lagos, Cairo, Abuja, Dubai) | WAT/EET/GST | ~8 | 07:00–16:00 UTC |
| APAC (Seoul) | KST (UTC+9) | ~1 | 00:00–09:00 UTC |

**Overlap window** where most of the team is available: **14:00–18:00 UTC** (9am–1pm CT; 3pm–7pm CET; 10pm–2am KST). This is the preferred window for cross-team architecture discussions and all-hands meetings.

---

## Communication Norms

### Slack

- **`#helios-engineering`** — general engineering announcements, cross-cutting discussions
- **`#helios-architecture`** — architecture proposals, ADR discussions
- **`#helios-incidents`** — active incidents, post-mortem announcements
- **`#helios-releases`** — release announcements, deployment status
- **`#helios-onboarding`** — new engineer questions (welcoming, no question is too basic)
- **`#random`** — memes, off-topic, the "what is this circuit breaker doing" photos from field technicians that Darnell occasionally sends in
- Team-specific channels: `#team-{teamname}` pattern

### Response Time Expectations

| Channel Type | Expected Response |
|---|---|
| Production incident channel | Immediate during business hours; via PagerDuty after hours |
| Direct message, urgent | Within 2 hours during business hours |
| Direct message, non-urgent | Within 24 hours |
| Public Slack channel (non-incident) | Best effort; don't expect immediate responses |
| Code review request | Within 1 business day for first review |
| RFC posted for comment | 5 business days before ARB decision |

### Meetings

- **All-Hands Engineering** — monthly, first Thursday at 10am CT (recorded)
- **ARB** — bi-weekly Thursdays 10am CT (invite-only; any engineer can request an agenda item)
- **Team Stand-ups** — daily within each team (async-first teams use Slack threads)
- **Sprint Planning** — bi-weekly per team
- **Cross-team dependencies sync** — weekly Fridays, 9am CT (optional but useful for new engineers)
- **Post-mortems** — within 5 business days of any Sev-1 or Sev-2 incident

---

*Maintained by @tanvir.rahman · Updates submitted via PR to `helios-docs`*  
*For org chart changes (new hires, departures, role changes), notify @tanvir.rahman and HR*  
*Related: [Team Structure](/07-onboarding/team-structure.md) · [Ownership Matrix](/07-onboarding/ownership-matrix.md) · [On-call Rotation](/06-operations/on-call-rotation-guide.md)*
