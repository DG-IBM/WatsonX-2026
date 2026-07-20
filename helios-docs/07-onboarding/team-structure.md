# Team Structure

**Owner:** Elena Vasquez (VP Engineering) + HR
**Last Updated:** 2024-11-01
**Headcount:** 71 engineers as of November 2024
**Related Docs:** [Engineering Directory](/01-company/engineering-directory.md) · [Ownership Matrix](/07-onboarding/ownership-matrix.md) · [On-Call Rotation Guide](/06-operations/on-call-rotation-guide.md) · [Product Vision](/01-company/product-vision.md)

---

> **Elena, 2024-11-01:** The team structure described here reflects our current org after the Q3 2024 reorganisation. We moved from a purely functional structure (Frontend, Backend, Infra) to a hybrid product/platform model in August 2024. The main change was creating the Grid Intelligence pod and the Customer Experience pod as vertical slices, while keeping a horizontal Platform Engineering team. Some engineers are still adjusting to the new model.
>
> We are hiring aggressively. We have 8 open headcount positions across Grid Intelligence (x3), Customer Experience (x2), and Platform Engineering (x3). If you're new and wondering why some teams seem understaffed for their scope — that's why.

---

## Org Chart Overview

```
                        Anjali Singh (CEO)
                              │
                        James Whitfield (CTO)
                              │
                      Elena Vasquez (VP Engineering)
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
   Tanvir Rahman         Kwame Asante         Marcus Webb
   (Eng Manager          (Eng Manager         (SRE Lead)
    Platform)             Grid Intelligence)
          │                   │
   ┌──────┴─────┐       ┌──────┴──────┐
   │            │       │             │
Platform    Customer   Grid        AI/Data
Engineering Experience Intelligence Engineering
  (~18)       (~14)     (~18)        (~12)
                                          
                    + Security (~2)
                    + Data Engineering (~4)
                    + QA (~3)
```

**Note on Meera Pillai (VP Product):** Meera leads the Product Management team which works closely with all engineering pods. Engineering Managers are peers to PMs, not reports. Meera and Elena collaborate closely on roadmap and prioritisation.

---

## Team Breakdown

### Platform Engineering (~18 engineers)
**Manager:** Tanvir Rahman
**Mission:** Build and maintain the infrastructure, shared services, and developer experience that all other teams depend on.

| Sub-team | Focus | Lead |
|----------|-------|------|
| Infrastructure & Cloud | AWS, Terraform, networking, EKS | Rosa Lindqvist |
| Messaging & Data Infra | Kafka, data pipelines, TimescaleDB | David Okafor |
| Developer Experience | CI/CD, tooling, build systems, internal libraries | Priya Nair |
| Security Engineering | AppSec, IAM, secret management | Yasmin Osei |

**Current team members:** Rosa Lindqvist, Priya Nair, David Okafor, Yasmin Osei, Deepak Mehta, Aysha Karimi, Samuel Osei-Bonsu, Fatima Al-Hassan, Leon Brandt, Nkechi Uzoma, and 8 others.

**Open headcount:** 3 positions (Senior Platform Engineer ×2, Staff SRE ×1)

---

### Grid Intelligence (~18 engineers)
**Manager:** Kwame Asante
**Mission:** Build and operate the real-time grid monitoring, outage detection, AI forecasting, and IoT device management capabilities.

| Sub-team | Focus | Lead |
|----------|-------|------|
| Grid Core | Grid monitoring service, telemetry processing, GIS | Chidi Eze |
| IoT Platform | Device management, firmware OTA, IoT auth | Lars Eriksson |
| AI/ML Engineering | Forecasting models, anomaly detection ML | Lin Chen |
| Outage & Dispatch | Outage detection, dispatch orchestration | Farah Okonkwo |

**Current team members:** Chidi Eze, Lars Eriksson, Lin Chen, Farah Okonkwo, Ami Tanaka, Mateus Costa, Yuki Nakamura, Sven Hoffmann, Blessing Adeyemi, Ifeoma Okafor, and 8 others.

**Open headcount:** 3 positions (Senior ML Engineer ×1, Senior Go Engineer ×2)

---

### Customer Experience (~14 engineers)
**Manager:** Tanvir Rahman (interim; dedicated CX manager being hired)
**Mission:** Build and operate the customer-facing portal, mobile experience, notification platform, and the operator tooling.

| Sub-team | Focus | Lead |
|----------|-------|------|
| Web Portal | Next.js customer portal, operator dashboard | — (currently lead-less; Tanvir covers) |
| Mobile | React Native field technician app | Ami Tanaka (shared with Grid Intelligence) |
| Notifications & Comms | Email, SMS, push notification service | — (currently embedded in Backend Platform) |

**Current team members:** Mateus Costa, Yuki Nakamura, Kezia Mwangi, Andrei Popescu, Saoirse O'Brien, Clara Dupont, and 8 others.

**Note:** This team was formed in August 2024 from engineers previously spread across Frontend and Backend. The formation is still bedding in. Some ownership questions are not yet resolved — see [Ownership Matrix](/07-onboarding/ownership-matrix.md).

**Open headcount:** 2 positions (Senior Frontend Engineer ×1, Engineering Manager ×1)

---

### AI & Data Engineering (~12 engineers)
**Manager:** Lin Chen (Staff Engineer, also technical lead)
**Mission:** Build the data pipelines, analytics platform, ML infrastructure, and reporting systems.

**Note:** This team functions without a dedicated engineering manager. Lin Chen holds both the Staff Engineer and team lead role. There is active discussion about whether this model scales. Kwame Asante provides management support.

| Sub-team | Focus | Lead |
|----------|-------|------|
| ML Engineering | Model training, serving infrastructure, model monitoring | Lin Chen |
| Data Engineering | Kafka → warehouse pipelines, dbt, Redshift | — |
| Analytics Engineering | Metabase, customer-facing analytics, reporting | — |

**Current team members:** Lin Chen, Ravi Krishnan, Ngozi Abara, Tomás García, Isabel Ferreira, and 7 others.

---

### Site Reliability Engineering (~4 engineers)
**Lead:** Marcus Webb
**Note:** SRE is embedded in Platform Engineering but operates with significant autonomy. Marcus reports to Elena directly.

**Members:** Marcus Webb, Rosa Lindqvist (shared with Platform), and 2 dedicated SRE engineers.

**Scope:** Reliability, capacity planning, on-call management, DR, monitoring, incident response.

---

### QA Engineering (~3 engineers)
**Lead:** David Okafor (interim)
**Status:** We have historically underinvested in QA. The three QA engineers focus on integration testing and performance testing. Unit testing is owned by each team.

---

### Security (~2 engineers)
**Lead:** Yasmin Osei
**Members:** Yasmin Osei, one additional security engineer (name withheld from wiki per their request).

**Scope:** AppSec, security architecture, pen test management, compliance engineering, incident response.

---

## Communication & Coordination Structure

### Rituals

| Meeting | Cadence | Attendees | Purpose |
|---------|---------|-----------|---------|
| All-Engineering All-Hands | Monthly | All engineers | Company updates, demos, announcements |
| Platform Sync | Weekly (Wed) | Platform Engineering | Infra, CI/CD, cross-cutting concerns |
| Grid Intelligence Sync | Weekly (Tue) | Grid Intelligence team | Grid features, IoT, AI |
| Customer Experience Sync | Weekly (Thu) | CX team | Portal, notifications, mobile |
| Engineering Leadership Sync | Weekly (Mon) | Elena, Tanvir, Kwame, Marcus, Lin | Cross-team coordination |
| Tech Debt Review | Bi-weekly | All leads + Marcus | Prioritise tech debt work |
| Architecture Review Board | Monthly | Principal + Staff Engineers | Major design decisions, ADRs |
| Incident Review (Retro) | Post-incident + Monthly summary | SRE + affected team | Incident learning |

### Decision Making

**Individual engineer:** Can make reversible, low-risk technical decisions within their domain without approval.

**Team lead / Principal Engineer:** Required for: new libraries, API contract changes, data schema changes, cross-service changes.

**Architecture Review Board:** Required for: new services, major framework changes, new external dependencies, infrastructure architecture changes.

**Engineering Leadership + Product:** Required for: major feature architectural decisions, changes affecting customer-facing contracts/SLAs, security-adjacent decisions.

---

## Hiring and Team Growth Context

Helios was a team of 12 in 2020. We've grown roughly as follows:

| Year | Engineers | Key Hires |
|------|-----------|-----------|
| 2020 | 12 | Founding team |
| 2021 | 24 | First Go engineers, IoT team formed |
| 2022 | 38 | ML team, full-time SRE |
| 2023 | 55 | Grid Intelligence pod, Platform scale-up |
| 2024 | 71 | Customer Experience pod, Data Engineering |
| 2025 (target) | 85 | Grid Intelligence ×3, Platform ×3, CX ×2, QA ×4 |

The rapid growth has created some challenges:
- Onboarding bandwidth is stretched (see [New Engineer First Week Guide](/07-onboarding/new-engineer-first-week.md))
- Some older documentation reflects the smaller team structure and hasn't been updated
- Ownership of some services is ambiguous after the Q3 2024 reorg (see [Ownership Matrix](/07-onboarding/ownership-matrix.md))
- Engineering norms and standards take time to permeate a larger team

---

## Things Every New Engineer Should Know About the Team

1. **The reorg in August 2024 is still fresh.** Some people are still adjusting to their new team assignments. Be patient with ownership ambiguity and raise it constructively.
2. **Lin Chen effectively leads the AI/Data team without a manager title.** Treat them as the decision-maker for anything ML or data pipeline.
3. **The Customer Experience team is the newest and most in-flux.** If you're joining CX, expect some rough edges and be ready to help define processes.
4. **David Okafor is the go-to person for Kafka and messaging infrastructure**, regardless of what their job title says. They've built most of it.
5. **Marcus Webb's on-call health improvements are a big deal to the team.** Don't undermine them by adding noisy alerts without tuning.
6. **Priya Nair owns the developer experience.** If the CI/CD pipeline, build tooling, or local dev setup is causing you pain, raise it with Priya — they actively want this feedback.
