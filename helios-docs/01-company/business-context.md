# Business Context — Helios

> **Location:** Confluence → Helios Engineering Space → Company → Business Context  
> **Owner:** James Whitfield (CTO) · @james.whitfield · Co-authored: Rachel Odum (VP Sales Engineering) · @rachel.odum  
> **Last Updated:** 2024-09-18  
> **Status:** Active  
> **Related:** [Product Vision](/01-company/product-vision.md) · [Compliance & Regulatory](/06-operations/compliance-regulatory.md) · [Engineering Directory](/01-company/engineering-directory.md) · [Team Structure](/07-onboarding/team-structure.md)

---

> *This document exists because too many engineers have shipped features without understanding why a customer needs them, or made architectural choices without understanding the regulatory or contractual context those choices operate in. You cannot make good engineering decisions about a safety-critical enterprise product without understanding the business it operates in.*
>
> — James Whitfield, written after the v2.3 API versioning incident (see [Project Timeline](/supplemental/project-timeline-history.md#2022-q2-the-api-versioning-incident))

---

## Lumina Energy — Company Overview

Lumina Energy was founded in 2019 in Austin, Texas by James Whitfield (CTO, previously at Palantir and GE Power Digital) and Anjali Singh (CEO, previously at Oracle Utilities and Deloitte Energy practice). The company raised a $12M Series A in early 2021, a $48M Series B in late 2022, and a $110M Series C in Q2 2024. Total funding to date: $175M.

Lumina operates as a pure-play B2B SaaS company. We do not own or operate grid infrastructure. We sell software licenses and professional services to utility companies that do. Our go-to-market is direct enterprise sales with long contract cycles (9–18 month average sales cycle, 3–5 year contract terms with annual true-up clauses).

Headcount (as of Q4 2024): approximately 280 people total, of whom ~70 are engineers on Helios. The remainder are sales, customer success, professional services, legal, finance, and operations.

---

## The Market

### Addressable Market

The global SCADA and energy management software market is estimated at approximately $8.5B as of 2024, growing at ~12% CAGR. This number understates the actual opportunity because most of the market is served by on-premise software that is not being refreshed. The addressable cloud-native smart grid software market is closer to $2.5B and growing faster.

Our target segment is **Tier 1 and Tier 2 utility companies** — those serving 100,000+ customers. Utilities serving fewer customers typically lack the budget, technical staff, and regulatory complexity to justify an enterprise platform. They are not our market and the product is not designed for them.

### Customer Segments

| Segment | Profile | Example Customers | Helios Value Prop |
|---|---|---|---|
| Large IOUs | Investor-owned utilities, 1M+ customers, high regulatory complexity | Midwest Grid Co., Southwest Energy Cooperative | Full platform: monitoring, forecasting, dispatch, compliance |
| Regional Co-ops | Member-owned, 100K–500K customers, budget-conscious, lean IT | Blue Ridge Electric Cooperative | Monitoring + dispatch; phased analytics adoption |
| Transmission Operators | Manage high-voltage transmission networks, not distribution | Grid Operators of the Northeast (GON) | Transmission-level monitoring and forecasting only |
| Municipal Utilities | City-owned, politically accountable, strong customer communication needs | City of Boulder Energy (CoBE) | Customer portal + demand response emphasis |
| International | Non-US markets with different regulatory frameworks | TasNetworks (Australia), Oresund Grid (Denmark) | Core platform + custom regulatory reporting adapters |

### Current Customer Roster

We have **14 production customers** as of Q4 2024. Two customers (Midwest Grid Co. and Southwest Energy Cooperative) have been with us since the v1.0 launch and are our most mature deployments. Their feedback has driven the majority of our product evolution.

> **Note to engineers:** Customer names in the codebase and test data use anonymized codes: `CUST-MWG`, `CUST-SEC`, `CUST-BRE`, etc. You will encounter these frequently. The mapping to real names is in Vault at `secret/helios/customer-mapping` (read access for all engineers, write access restricted to sales ops).

---

## Revenue Model

### How We Price

Helios is priced on a combination of:

1. **Base Platform License** — flat annual fee for core platform access (monitoring portal, API, user management). Tiered by number of grid assets under management.
2. **Meter Data Volume** — per-million-smart-meters/month fee for IoT telemetry ingestion and storage. This is the primary revenue driver at scale.
3. **Module Add-ons** — AI Forecasting, Demand Response Management, Predictive Asset Analytics, and Compliance Reporting are separately licensed modules. Most customers buy multiple modules.
4. **Professional Services** — implementation, custom integration, training. Recognized as one-time revenue. Ranges from $250K for a simple deployment to $2M+ for complex international deployments.

### Why This Matters for Engineering

The meter volume pricing means that **every meter we onboard is a revenue event**. When a customer says "we're adding 500,000 new smart meters next quarter," that is a significant revenue increase and it is also a significant engineering event — the IoT ingestion pipeline must be provisioned to handle the additional load. The sales team is required to give engineering 60 days notice before a meter deployment. This requirement exists because of a near-miss in Q3 2022 when a customer onboarded 800,000 meters with 2 weeks notice and we came within hours of a capacity failure. See [Project Timeline — 2022 Q3 Capacity Incident](/supplemental/project-timeline-history.md#2022-q3-capacity-incident).

The module pricing means that **not all customers have all features enabled**. Feature flags in the codebase follow the pattern `TENANT_{TENANT_ID}_MODULE_{MODULE_NAME}`. Always check what modules a tenant has licensed before assuming a feature is available to them. See [Authorization](/05-engineering/authorization.md#tenant-module-flags).

---

## Contract Structure and SLAs

### Standard Contract Terms

Our MSA (Master Software Agreement) includes:

- **Uptime SLA:** 99.9% monthly uptime for the platform overall. Grid monitoring specifically is contracted at 99.95% (for most customers; Midwest Grid Co. is contracted at 99.99% following a renewal negotiation in 2023).
- **Latency SLA:** ≤ 10 seconds end-to-end from meter event to operator alert. This is the contractual floor — our internal target is 4 seconds, giving us headroom.
- **Data Retention:** 7 years minimum for all metering and grid event data (driven by NERC CIP and FERC requirements). Some international contracts specify 10 years.
- **Incident Notification:** Critical incidents (Sev-1) must be communicated to customer within 15 minutes. This is a contractual obligation, not just a best practice. See [Incident Response Runbook](/06-operations/incident-response-runbook.md#customer-notification).
- **Planned Maintenance Windows:** Customers must receive 72 hours notice for planned maintenance that affects the primary portal. Emergency maintenance requires 2 hours notice.
- **Data Portability:** Customers have the right to export all their data in standard formats (CSV, Parquet, JSON) at any time and upon contract termination. This is contractually guaranteed in all MSAs signed after 2022.

### SLA Credits

When we miss SLAs, we owe credits against the customer's next invoice. The credit schedule is:

| Uptime (monthly) | Credit |
|---|---|
| 99.0% – 99.9% | 10% of monthly fee |
| 95.0% – 99.0% | 25% of monthly fee |
| < 95.0% | 50% of monthly fee + escalation to CEO level |

We have paid SLA credits twice in four years of operation (see [Project Timeline](/supplemental/project-timeline-history.md)). Both incidents are in the incident archive. The total credits paid were approximately $340K. This is a number the executive team tracks closely.

---

## Regulatory Environment

Helios operates in one of the most heavily regulated industries in existence. As a software vendor, we are not directly subject to grid regulations — our customers are. But because we process, store, and operate on data that is subject to those regulations, we are deeply involved in helping customers meet their obligations. Getting this wrong has direct consequences for customer relationships and potentially for grid safety.

### Key Regulatory Frameworks

**NERC CIP (North America)**  
The North American Electric Reliability Corporation Critical Infrastructure Protection standards. NERC CIP defines cybersecurity requirements for bulk electric system assets. Our customers who operate bulk electric systems must demonstrate CIP compliance. Helios is involved in CIP-002 (asset categorization), CIP-006 (physical security of cyber assets), CIP-007 (systems security), and CIP-013 (supply chain risk management) through our status as a vendor with access to BES cyber systems. We maintain a CIP Vendor Compliance package updated annually. See [Compliance & Regulatory](/06-operations/compliance-regulatory.md#nerc-cip).

**FERC (North America)**  
The Federal Energy Regulatory Commission regulates wholesale electricity markets and interstate transmission. Some of our customers report to FERC. We generate FERC Form 714 compatible reports for customers who require them.

**GDPR (European Union)**  
Smart meter data is personal data under GDPR when it relates to identifiable residential customers. Our EU deployments are subject to GDPR. Key requirements: data residency (EU customer data must not leave the EU), right to erasure (customer meter data must be deletable upon request), and data processing agreements (DPAs) with all EU customers. Our EU data residency architecture is not fully compliant as of Q4 2024 — we are storing some EU customer data in `us-east-1` due to the analytics pipeline architecture. This is tracked as a P1 compliance gap in [Technical Debt Register — GDPR Data Residency](/05-engineering/technical-debt-register.md#gdpr-data-residency) and is the highest-priority engineering item for Q1 2025.

**NEM / AEMO (Australia)**  
The National Electricity Market rules in Australia and the Australian Energy Market Operator impose specific requirements on data formats, reporting intervals, and market interaction for our Australian customer TasNetworks. We built a custom AEMO adapter in v4.3. See [Compliance & Regulatory — Australia](/06-operations/compliance-regulatory.md#aemo).

**ENTSO-E (European Union)**  
The European Network of Transmission System Operators for Electricity. Our Danish customer Oresund Grid reports to ENTSO-E. We have partial reporting automation for ENTSO-E formats. Full automation is planned for Q2 2025.

---

## Customer Success and Professional Services

### Implementation Lifecycle

Deploying Helios at a new customer is a complex, multi-month process. The standard implementation follows these phases:

| Phase | Duration | Description | Helios Team Involved |
|---|---|---|---|
| Discovery | 4–6 weeks | Map existing SCADA topology, meter data systems, IT environment | Solutions Architecture |
| Integration | 6–10 weeks | Configure SCADA adapters, IoT bridge, meter data management integration | Pro Services + Engineering |
| Data Validation | 4–6 weeks | Validate telemetry ingestion quality, fix data mapping issues | Pro Services + Data |
| Parallel Operation | 4–8 weeks | Customer runs Helios alongside existing systems | Customer Success + On-call |
| Cutover | 1 week | Customer decommissions legacy monitoring system | All hands |
| Stabilization | 4–8 weeks | Post-cutover tuning, alert threshold adjustment, operator training | Customer Success |

Total time from contract signature to full production: typically 6–9 months. We have a "rapid deployment" track (3–4 months) for smaller customers using standard configurations.

### Professional Services Revenue

Professional services is a significant revenue line but a strategic cost center for engineering. Pro Services teams (separate from product engineering) run implementations, but product engineers are often pulled in for escalations, custom integrations, and technical advisory during complex deployments. This creates friction — see the [Team Structure](/07-onboarding/team-structure.md) document for how we manage the boundary between product engineering and pro services.

The rule: product engineers should not be doing custom integration work for individual customers unless it is also going to become a product feature. If you are being asked to write customer-specific code that will not ship to all customers, push back with your engineering manager and escalate if needed.

---

## Competitive Dynamics

### Why Customers Choose Helios

Based on win/loss analysis maintained by the sales team (internal Notion page: *Helios Win/Loss Analysis 2024*):

1. **Speed of deployment** — our 6–9 month implementation vs. 12–24 months for Oracle/Siemens
2. **AI forecasting quality** — in head-to-head bake-offs, our demand forecasting is consistently more accurate at feeder level
3. **Modern UX** — grid operators who have used SCADA for 20 years appreciate that the Helios portal actually looks like 2024 software
4. **API-first architecture** — large utilities want to build integrations; our GraphQL + REST API ecosystem makes this possible
5. **Customer success responsiveness** — we are genuinely faster to respond and fix problems than enterprise incumbents

### Why Customers Don't Choose Helios

1. **We are not SCADA-certified** — utilities that need a single certified system for both control and monitoring cannot use us alone
2. **Brand risk** — some utilities are risk-averse about buying from a 5-year-old Series C company vs. a Siemens or GE
3. **International regulatory coverage** — we are not yet fully compliant with all international frameworks; this is a blocker in some markets
4. **Price** — we are not cheap. Some regional co-ops look at the meter-volume pricing and cannot make the ROI case

### Key Competitors to Know

| Competitor | Strengths | How We Win |
|---|---|---|
| Oracle Utilities | Massive installed base, billing platform ownership, long-term relationships | Speed, AI quality, modern UX |
| Siemens Spectrum Power | SCADA-certified, strong in Germany/EU | AI features, API openness, deployment speed |
| GE Grid Solutions | Trusted brand, strong transmission focus | Distribution intelligence, customer portal, price in some segments |
| AutoGrid | Strong demand response, good forecasting | Full platform coverage, dispatch, compliance |
| Palantir AIP for Energy | AIP brand momentum, strong analytics story | Operational workflow depth, implementation time |

---

## Technology Choices and Business Rationale

Some engineering decisions at Helios are driven not just by technical merit but by business context. These are the most important ones:

### Why Multi-Tenancy Is Sacred
Every customer runs on shared infrastructure but their data is strictly isolated. We do not offer single-tenant dedicated deployments (we were asked to by two customers; we declined). This keeps our infrastructure costs manageable and our operational complexity bounded. See [Security Architecture — Tenant Isolation](/06-operations/security-architecture.md#tenant-isolation) and [Authorization](/05-engineering/authorization.md). The risk of a tenant data leak is existential — it would trigger simultaneous breach of contract with all affected customers plus potential regulatory violations.

### Why We Support Both REST and GraphQL
Historically, the Grid Operations Portal was built on GraphQL (Apollo). The REST API was added in v2.0 because a major utility customer (Midwest Grid Co.) had an existing integration layer that could not easily consume GraphQL. We now maintain both because different customer segments prefer different integration styles. This is documented in [ADR-002](/05-engineering/adrs.md#adr-002) and [API Standards](/05-engineering/api-standards.md#rest-vs-graphql).

### Why Data Retention Is 7 Years
This is not an engineering preference. It is a contractual and regulatory requirement. NERC CIP-012 and FERC regulations require retention of certain operational data for 5–7 years. Some international regulations require longer. We set the platform default at 7 years as a safe baseline. Data engineers should not tune retention policies without confirming with the compliance team first. See [Compliance & Regulatory](/06-operations/compliance-regulatory.md#data-retention).

### Why We Have Three Separate Frontend Applications
The Grid Operations Portal, Customer Portal, and Mobile App are separate applications because their user requirements, deployment cadences, and security contexts are entirely different. Grid operators need desktop-class UX with dense data tables and complex GIS. Residential customers need mobile-first simplicity. Technicians need offline-first reliability. Building them as one application would result in a compromise that serves nobody well. The shared `@helios/ui` component library ensures visual consistency without forcing architectural compromise. See [Frontend Architecture](/02-architecture/frontend-architecture.md).

---

## The Stakes of Getting This Wrong

This section may sound dramatic. It is not.

Grid management software that fails, shows incorrect data, misses an outage, or provides a wrong forecast does not just frustrate a user. It:

- **Can cause or prolong power outages** affecting hospitals, water treatment plants, and vulnerable populations
- **Can result in regulatory fines** to our customers, who will immediately seek damages from us under the MSA
- **Can damage energy infrastructure** through incorrect control recommendations (reason we explicitly do not do direct grid control — see [ADR-010](/05-engineering/adrs.md#adr-010))
- **Will result in immediate SLA credits and likely contract termination** for severe incidents
- **Will trigger NERC CIP incident notification requirements** with regulatory consequences

This is not hypothetical. The Cedar Rapids incident in 2021 (see [Project Timeline](/supplemental/project-timeline-history.md#2021-q3-the-cedar-rapids-incident)) came close to a real outage. The MSK replication incident in 2024 (see [INC-2024-047](/06-operations/incident-response-runbook.md#inc-2024-047)) caused 14 minutes of degraded monitoring for three customers and resulted in a contractual review with Midwest Grid Co.

Every engineer who joins this team should internalize this. It shapes code review standards, deployment processes, testing requirements, and on-call culture. It is the reason we are sometimes slower than a typical SaaS company and the reason that slowness is justified.

---

## Things Every New Engineer Should Know About the Business

1. **We have 14 customers and every one matters.** We are not a consumer product where individual users are anonymous. Every customer represents millions of dollars in ARR and a multi-year relationship. Customer-impacting bugs get CEO-level attention.

2. **Grid operators are the most demanding users in enterprise software.** They have zero tolerance for slowness, inaccuracy, or downtime. When you design a feature, think about someone in a control room at 3 AM during a winter storm who needs the answer in 2 seconds.

3. **Compliance is not optional and not someone else's job.** If you are writing code that handles customer data, meter data, or grid event data, you are handling regulated data. Read [Compliance & Regulatory](/06-operations/compliance-regulatory.md) before you handle it.

4. **The sales team gives engineering commitments.** Sometimes the sales team will commit to a feature or capability before engineering has agreed to build it. When this happens, the escalation path is your engineering manager → VP Engineering → CTO. Never let a sales commitment become an engineering surprise without flagging it.

5. **Customer success is engineering's partner.** The CS team knows what customers are struggling with and what features they want. The best product ideas come from CS escalations. Read the CS escalation Jira board (`CS-ESCALATIONS`) weekly.

---

*Authored by @james.whitfield and @rachel.odum*  
*Technical sections reviewed by @priya.nair and @david.okafor*  
*Next review: Q1 2025 post board meeting*  
*Related: [Product Vision](/01-company/product-vision.md) · [Engineering Directory](/01-company/engineering-directory.md) · [Compliance & Regulatory](/06-operations/compliance-regulatory.md)*
