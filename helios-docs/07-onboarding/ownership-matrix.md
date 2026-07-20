# Ownership Matrix

**Owner:** Elena Vasquez (VP Engineering)
**Maintained by:** Engineering Managers
**Last Updated:** 2024-11-01
**Last Full Review:** 2024-08-15 (post-Q3 reorg)
**Related Docs:** [Team Structure](/07-onboarding/team-structure.md) · [Engineering Directory](/01-company/engineering-directory.md) · [On-Call Rotation Guide](/06-operations/on-call-rotation-guide.md) · [Microservices Overview](/02-architecture/microservices-overview.md)

---

> **Elena, 2024-11-01:** The Q3 2024 reorganisation created some genuine ownership ambiguity that we're still working through. I've marked ambiguous areas with ⚠️. If you're joining a new team and you see an ⚠️ in your area, please work with your manager to resolve it and update this doc. Ambiguous ownership is a primary cause of incidents falling through cracks.
>
> **Tanvir, 2024-10-12:** The Customer Experience team formation has left some services without clear ownership. I'm temporarily carrying several of them as "CX team" until we hire the Engineering Manager for that team. If you have questions about portal, notifications, or mobile — come to me.

---

## Service Ownership

| Service | Primary Owner | Secondary Owner | Team | On-Call Track |
|---------|---------------|-----------------|------|---------------|
| Grid API (`helios-api`) | David Okafor | Chidi Eze | Grid Intelligence | Application |
| Grid Event Processor | Chidi Eze | David Okafor | Grid Intelligence | Application |
| IoT Ingest Service | Lars Eriksson | Chidi Eze | Grid Intelligence | Platform |
| IoT Device Management API | Lars Eriksson | Ami Tanaka | Grid Intelligence | Application |
| Outage Detection Service | Farah Okonkwo | Chidi Eze | Grid Intelligence | Application |
| AI Forecasting Engine | Lin Chen | Chidi Eze | AI/Data Engineering | Application |
| Grid Monitoring Service | Chidi Eze | Farah Okonkwo | Grid Intelligence | Application |
| Customer Portal (Next.js) | ⚠️ Tanvir Rahman (interim) | Mateus Costa | Customer Experience | Application |
| Customer Portal API (BFF) | ⚠️ Tanvir Rahman (interim) | Mateus Costa | Customer Experience | Application |
| Notification Service | ⚠️ Tanvir Rahman (interim) | Yuki Nakamura | Customer Experience | Application |
| GIS Mapping Service | Chidi Eze | Rosa Lindqvist | Grid Intelligence | Application |
| Technician Dispatch Service | Farah Okonkwo | Mateus Costa | Grid Intelligence | Application |
| Auth Service | Yasmin Osei | Priya Nair | Platform Security | Platform |
| Admin Portal | ⚠️ Tanvir Rahman (interim) | — | Customer Experience | Application |
| Analytics Platform | Lin Chen | Ravi Krishnan | AI/Data Engineering | Application |
| Data Pipeline (Kafka → Redshift) | David Okafor | Lin Chen | Platform / AI | Platform |
| Reporting Service | Lin Chen | — | AI/Data Engineering | Application |

---

## Infrastructure Ownership

| Component | Primary Owner | Secondary Owner | Team |
|-----------|---------------|-----------------|------|
| AWS Account Management | Rosa Lindqvist | Marcus Webb | Platform Engineering |
| Terraform (all IaC) | Rosa Lindqvist | Deepak Mehta | Platform Engineering |
| EKS Clusters (prod, staging) | Rosa Lindqvist | Marcus Webb | Platform Engineering |
| Aurora PostgreSQL / TimescaleDB | Rosa Lindqvist | David Okafor | Platform Engineering |
| Elasticache Redis | Rosa Lindqvist | Priya Nair | Platform Engineering |
| MSK Kafka Clusters | David Okafor | Rosa Lindqvist | Platform Engineering |
| AWS IoT Core | Lars Eriksson | Rosa Lindqvist | Grid Intelligence / Platform |
| Route 53 / DNS | Rosa Lindqvist | Marcus Webb | Platform Engineering |
| AWS WAF + Shield | Yasmin Osei | Rosa Lindqvist | Platform Security |
| CloudFront CDN | Rosa Lindqvist | Priya Nair | Platform Engineering |
| S3 Buckets (data) | Rosa Lindqvist | David Okafor | Platform Engineering |
| AWS Secrets Manager | Yasmin Osei | Rosa Lindqvist | Platform Security |
| AWS KMS (keys) | Yasmin Osei | Rosa Lindqvist | Platform Security |
| VPC / Networking | Rosa Lindqvist | Marcus Webb | Platform Engineering |
| AWS IAM / IRSA | Yasmin Osei | Rosa Lindqvist | Platform Security |

---

## CI/CD & Developer Tooling Ownership

| Component | Primary Owner | Team |
|-----------|---------------|------|
| GitHub Actions workflows | Priya Nair | Platform Engineering |
| ArgoCD (GitOps) | Priya Nair | Platform Engineering |
| Container image registry (ECR) | Priya Nair | Platform Engineering |
| Helm charts (all services) | Priya Nair | Platform Engineering |
| Semgrep (SAST) | Yasmin Osei | Platform Security |
| Snyk (dependency scanning) | Yasmin Osei | Platform Security |
| Trivy (container scanning) | Yasmin Osei | Platform Security |
| LaunchDarkly (feature flags) | Priya Nair | Platform Engineering |
| npm shared packages (`@lumina/*`) | Priya Nair | Platform Engineering |
| Internal Go modules (`github.com/lumina-energy/*`) | David Okafor | Platform Engineering |

---

## Monitoring & Alerting Ownership

| Component | Primary Owner | Team |
|-----------|---------------|------|
| Grafana dashboards (all) | Marcus Webb | SRE |
| Prometheus scrape configs | Marcus Webb | SRE |
| PagerDuty routing rules | Marcus Webb | SRE |
| Kibana dashboards | Marcus Webb | SRE |
| Elasticsearch cluster | Rosa Lindqvist | Platform Engineering |
| CloudWatch dashboards | Marcus Webb | SRE |
| Statuspage | Marcus Webb | SRE |
| SLO definitions and burn alerts | Marcus Webb | SRE |

---

## Data Domain Ownership

| Domain | Owner | Description |
|--------|-------|-------------|
| Grid topology | Chidi Eze | Network of substations, lines, transformers |
| Meter telemetry | Chidi Eze | Raw and aggregated meter readings |
| Device registry | Lars Eriksson | Device identities, certificates, status |
| Customer & accounts | ⚠️ Tanvir Rahman (interim) | Utility company customer data |
| End-consumer profiles | ⚠️ Tanvir Rahman (interim) | Energy consumer data (PII) |
| Outage events | Farah Okonkwo | Detected and confirmed outages |
| Dispatch jobs | Farah Okonkwo | Technician job records |
| Forecasting outputs | Lin Chen | Demand forecasts, accuracy metrics |
| ML model artifacts | Lin Chen | Trained models, training history |
| Analytics aggregates | Lin Chen | Redshift warehouse tables |
| Audit logs | Yasmin Osei | Regulatory-grade audit records |
| GIS / geospatial | Chidi Eze | Grid geography, technician locations |

---

## External Dependency Ownership

Who is responsible for managing relationships and SLAs with external services:

| External Service | Lumina Owner | Purpose |
|-----------------|-------------|---------|
| AWS (enterprise account) | Rosa Lindqvist | All cloud infrastructure |
| AWS TAM relationship | Rosa Lindqvist | Enterprise support |
| Okta (identity) | Yasmin Osei | SSO, MFA |
| PagerDuty | Marcus Webb | Alerting |
| LaunchDarkly | Priya Nair | Feature flags |
| Mapbox | Chidi Eze | GIS tile rendering |
| Twilio (SMS notifications) | ⚠️ Tanvir Rahman (interim) | SMS delivery |
| SendGrid (email) | ⚠️ Tanvir Rahman (interim) | Email delivery |
| Firebase Cloud Messaging | ⚠️ Tanvir Rahman (interim) | Push notifications |
| Snyk | Yasmin Osei | Vulnerability scanning |
| NCC Group (pen test) | Yasmin Osei | Annual penetration testing |
| Datadog (not used — contract expired) | — | — |

---

## Ownership RACI for Key Processes

| Process | Responsible | Accountable | Consulted | Informed |
|---------|-------------|-------------|-----------|---------|
| Production deployment | Release engineer | Eng Manager | SRE | All engineers |
| Incident response (SEV-1) | On-call SRE | Marcus Webb | Service owners | Elena Vasquez |
| Security incident | Yasmin Osei | Elena Vasquez | Legal (Emma Hartley) | CTO/CEO |
| Database schema change | Service owner | Team lead | Rosa Lindqvist | SRE |
| New service introduction | Service team | Eng Manager | Platform, Security, SRE | Architecture Review Board |
| Customer data erasure | Rosa Lindqvist | Yasmin Osei | Emma Hartley | Eng Manager |
| Regulatory notification | Emma Hartley | Yasmin Osei | Elena Vasquez | CTO |
| DR activation | Marcus Webb | Elena Vasquez | All service owners | CTO/CEO |

---

## Ambiguous Ownership — Items to Resolve

The following ownership questions are unresolved and should be addressed in Q4 2024 / Q1 2025:

| Item | Question | Assignee to Resolve | Deadline |
|------|----------|--------------------|---------| 
| Customer Portal | After CX Engineering Manager is hired, they should take ownership from Tanvir | New CX EM | Q1 2025 |
| Notification Service | Unclear if this is Platform or CX; currently nobody owns it fully | Tanvir Rahman | Q4 2024 |
| Admin Portal | Currently unmaintained beyond basic fixes | Elena Vasquez | Q1 2025 |
| Mobile (Technician App) | Ami Tanaka is split across Grid Intelligence and CX | Tanvir + Kwame | Q4 2024 |
| Twilio/SendGrid/FCM contracts | Notification infra contracts without clear service owner | Tanvir Rahman | Q4 2024 |

---

*Ownership ambiguity is a production risk. If you're unsure who owns something, ask in `#engineering` or consult Elena Vasquez. Don't leave ownership questions unresolved — they always surface at the worst possible time during an incident.*
