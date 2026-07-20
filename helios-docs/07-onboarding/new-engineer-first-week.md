# New Engineer First Week Guide

**Owner:** Elena Vasquez (VP Engineering) + Priya Nair (Developer Experience)
**Last Updated:** 2024-10-15
**Version:** v4.2
**Related Docs:** [Team Structure](/07-onboarding/team-structure.md) · [FAQ](/07-onboarding/faq.md) · [Engineering Directory](/01-company/engineering-directory.md) · [Coding Standards](/05-engineering/coding-standards.md) · [Git Workflow](/05-engineering/git-workflow.md)

---

> **Priya, 2024-10-15:** Updated this guide after our Q3 onboarding retrospective. We onboarded 11 engineers in Q3 and gathered feedback via a survey at the 30-day mark. Key themes: (1) too much documentation to absorb in week one, (2) local dev setup took 2+ days for some people, (3) engineers weren't sure who to ask for what. This version tries to address all three. If you're onboarding and this guide is still confusing or outdated, please fix it (seriously — raise a PR or ping me directly).
>
> **For your manager:** Please ensure your new engineer has their Jira/GitHub/Okta access provisioned before Day 1. IT needs at least 3 business days notice. Access provisioned on Day 1 is the single most common onboarding failure mode.

---

## Before Day 1 (Manager's Checklist)

Your manager should confirm the following are ready before you arrive:

```
[ ] Okta account created and welcome email sent
[ ] MacBook provisioned and ready (standard: 14" M3 MacBook Pro, 36GB RAM)
[ ] GitHub access (lumina-energy organisation)
[ ] Jira access (projects: HELIOS, INFRA, depending on team)
[ ] Confluence access
[ ] Slack workspace invitation sent
[ ] PagerDuty account (if you'll be on-call eventually)
[ ] Google Workspace account
[ ] 1Password invitation (team vault)
[ ] Initial calendar invites sent (team standups, sync meetings)
[ ] Buddy engineer assigned
[ ] Desk/seat confirmed (London or remote onboarding)
```

If anything is missing, your buddy engineer is your first contact on Day 1. Don't spin for hours trying to sort out access — just ask.

---

## Day 1: Orientation

### Morning

**Don't try to understand everything today.** The goal of Day 1 is to meet people, get your tools working, and understand what you'll be working on.

1. **Complete HR onboarding** — Workday, benefits enrolment, contract paperwork. HR will send you a separate checklist.
2. **Set up your laptop** — see the [macOS Dev Setup Guide](https://lumina-confluence.atlassian.net/wiki/spaces/ENG/pages/dev-setup-macos) in Confluence. This installs our standard toolchain: Homebrew, kubectl, AWS CLI, nvm, Go, Docker Desktop, and a few internal tools.

```bash
# After following the Confluence setup guide, verify these work:
aws sts get-caller-identity          # Should show your dev/sandbox account
kubectl config get-contexts          # Should show helios-staging context
docker ps                            # Should return (no containers running)
node --version                       # Should be 20.x (via nvm)
go version                           # Should be 1.22.x
```

3. **Join the essential Slack channels:**

| Channel | Purpose |
|---------|---------|
| `#general` | Company-wide announcements |
| `#engineering` | All-engineering discussion |
| `#helios-team` | Your product team |
| `#incidents` | Production incident alerts (read-only for new engineers) |
| `#alerts` | Grafana alert webhooks (FYI only for now) |
| `#on-call-handoff` | On-call shift notes |
| `#pr-reviews` | Pull request notifications |
| `#deployments` | Deployment notifications |
| `#random` | The important stuff |

Your team lead will add you to team-specific channels.

### Afternoon

4. **Meet your buddy engineer.** Your buddy is your primary human guide for the first 4 weeks. They're there to answer questions, help you navigate, and tell you the things that aren't in the docs. Block 1 hour with them on Day 1.
5. **1:1 with your manager.** They'll walk you through your team's current work, your initial role, and expectations for your first 90 days.
6. **Read [README.md](/README.md) and [Product Vision](/01-company/product-vision.md).** Just those two. Save everything else for later.

---

## Day 2: Architecture & Codebase

### Morning: Understand the System

Start with the architecture docs — read them in order, don't skip ahead:

1. [System Overview](/02-architecture/system-overview.md) — 30 minutes
2. [High-Level Architecture](/02-architecture/high-level-architecture.md) — 30 minutes
3. The service docs for your team's area — 1 hour

Don't try to understand everything in depth. The goal is a mental map. You'll go deep on your specific area over the coming weeks.

### Afternoon: Clone the Repos

```bash
# All repos are in the lumina-energy GitHub organisation
# Request access to the repos relevant to your team — your buddy will advise

# Core repos you'll almost certainly need:
git clone git@github.com:lumina-energy/helios-portal.git
git clone git@github.com:lumina-energy/helios-api.git
git clone git@github.com:lumina-energy/helios-grid-services.git

# To run the full local dev environment (Docker Compose):
cd helios-api
cp .env.example .env.local
# Fill in any required secrets (your buddy will share the dev secrets from 1Password)
docker-compose -f docker-compose.dev.yml up
```

> **Known issue:** The first `docker-compose up` takes 8–12 minutes on a new machine because it pulls large images. This is known and tracked as [DEV-234] — "Optimise dev container image sizes". While it runs, read the architecture docs.

### Running the Frontend Locally

```bash
cd helios-portal
nvm use   # Switches to the .nvmrc-specified version
npm ci
cp .env.local.example .env.local
# The example file has safe defaults — no secrets needed for basic dev
npm run dev
# Portal runs at http://localhost:3000
```

---

## Day 3: Your First Ticket

By Day 3 you should have a starter ticket assigned by your manager. Starter tickets are labelled `good-first-issue` and are chosen to be:
- Self-contained (not blocking other work)
- Small (ideally <1 day of work)
- Well-documented
- Genuinely useful (not dummy tasks)

### Working on Your First Ticket

1. Create a branch following the [Git Workflow](/05-engineering/git-workflow.md):
```bash
git checkout -b feat/HELIOS-XXXX-brief-description
```

2. Make your change. Write tests.

3. Run the test suite locally before pushing:
```bash
# For TypeScript/Node services
npm run test
npm run lint
npm run type-check

# For Go services
go test ./...
go vet ./...

# For the frontend
npm run test
npm run build  # Catch any build-time type errors
```

4. Open a pull request — the PR template will prompt you for the right information.

5. Tag your buddy engineer as a reviewer. For your first few PRs, we strongly recommend explicitly requesting a review from someone who knows the area well.

Don't worry about perfecting your first ticket. The point is to go through the process: branch, develop, test, PR, review, merge. You'll learn more from your first code review than from any document.

---

## Day 4: Platform & Operations

### Morning: Monitoring & Observability

Understanding how Helios is observed in production is important even if you're not in SRE.

1. Access Grafana: [grafana.lumina-internal.com](https://grafana.lumina-internal.com) (Okta SSO)
2. Open the [Helios Operations Dashboard](https://grafana.lumina-internal.com/d/helios-ops) — spend 20 minutes just looking at it
3. Read [Monitoring & Observability](/04-platform/monitoring-observability.md)
4. Access Kibana: [kibana.lumina-internal.com](https://kibana.lumina-internal.com) — try searching for logs from a service you've been reading about

### Afternoon: Staging Environment

You'll do most of your testing against the staging environment. It's a near-complete replica of production with anonymised data.

```bash
# Update your kubeconfig for staging
aws eks update-kubeconfig --name helios-staging-eu-west-1 --region eu-west-1

# Check the health of staging
kubectl get pods -n helios-staging

# Tail logs from a service
kubectl logs -n helios-staging -l app=grid-api -f --tail=50

# Staging API base URL
https://api.staging.helios.lumina.energy
# Staging portal
https://app.staging.helios.lumina.energy
```

> **Staging rules:**
> - You can deploy to staging at any time via the CI/CD pipeline
> - Do NOT put real customer data in staging
> - Staging can be broken — that's what it's for
> - If you break staging and can't fix it, ask in `#helios-team` — don't silently leave it broken

---

## Day 5: Team Norms & Wrap-Up

### Morning: Coding Standards and Workflow

Read these documents end-to-end today:

- [Coding Standards](/05-engineering/coding-standards.md)
- [Git Workflow](/05-engineering/git-workflow.md)
- [API Standards](/05-engineering/api-standards.md)

These aren't optional reading. They're how we make 70 engineers feel like one team. Your code reviews will reference these docs.

### Afternoon: First Week Retrospective

At the end of week 1, your manager will run a brief check-in:
- What went well?
- What was confusing?
- Do you have any blockers?
- Do you know what you're working on next week?

Please give honest feedback. If the setup guide was wrong, say so. If you're still confused about the architecture, say so. The first week is not a test — it's an onboarding.

---

## Week 2–4 Guide

### Week 2: Go Deep

- Read the service documentation for your team in detail
- Pair with a more senior engineer on a real ticket
- Attend all team ceremonies (standup, sprint planning if it falls this week)
- Complete your first "real" PR (not a starter ticket)

### Week 3: Contributing Fully

- Take on a ticket of normal complexity for your team
- Start attending architecture discussions (observe first, contribute when ready)
- Read [Architecture Decision Records](/05-engineering/adrs.md) — all 10 ADRs are worth reading

### Week 4: 30-Day Checkpoint

Your manager will have a structured 30-day 1:1 covering:
- Are you delivering at the expected pace?
- Are there any skill gaps to address?
- What are your goals for the next 60 days?
- Is there anything the team or company can do better?

---

## People to Know in Your First Month

These are the people you'll likely want to find in Slack early on. Full details in [Engineering Directory](/01-company/engineering-directory.md).

| Person | Role | Why You'll Contact Them |
|--------|------|------------------------|
| Your manager | Your team | Questions about team, priorities, career |
| Your buddy | Your team | Daily questions, navigation |
| Priya Nair | Developer Experience | CI/CD issues, local dev problems, build tooling |
| David Okafor | Kafka/Messaging | Any question about Kafka, events, topic design |
| Marcus Webb | SRE Lead | On-call process, alerts, incident questions |
| Yasmin Osei | Security | Security questions, secret management, compliance |
| Lin Chen | AI/Data | ML model, data pipeline, forecasting questions |
| Chidi Eze | Grid Intelligence | Grid service architecture, GIS, telemetry |
| Lars Eriksson | IoT | Device management, IoT protocols, MQTT |
| Rosa Lindqvist | Platform | AWS, Terraform, Kubernetes infrastructure |

---

## Common First-Week Gotchas

These are issues that come up repeatedly in new engineer onboarding. Learn from others' experiences:

1. **Docker Desktop on Apple Silicon** — our containers were originally built for x86. Some images may behave differently or fail on ARM. If you see `exec format error`, check if there's an `--platform linux/amd64` flag needed.

2. **AWS SSO login expiry** — the `aws sso login` token expires every 8 hours. If your AWS commands suddenly fail, re-run `aws sso login --profile helios-dev`.

3. **The `helios-api` and `helios-grid-services` repos are separate.** It's not a monorepo. The portal (`helios-portal`) is its own repo too. Each has its own CI/CD pipeline and can be deployed independently.

4. **You won't have production access in Week 1.** This is by design. You get staging access on Day 1. Production access (read-only) is granted after your 30-day checkpoint. Full production access for your role takes ~90 days.

5. **`npm install` vs `npm ci`** — use `npm ci` for local dev, not `npm install`. We pin exact versions in package-lock.json and `npm install` can silently update them.

6. **Staging certificates are self-signed for internal services** — if you hit SSL errors on internal staging endpoints, this is normal. Use the `--insecure` / `-k` flag for curl, or add the internal CA cert (see Confluence: Internal CA Setup).

7. **The dispatch service (Node 16) runs differently locally vs. staging** — it's listed as legacy in our tech debt register. If it behaves strangely locally, check the known issues first before going deep.

---

## Resources and Links Cheatsheet

| Resource | Link |
|----------|------|
| Confluence (internal wiki) | [lumina-confluence.atlassian.net](https://lumina-confluence.atlassian.net) |
| Jira | [lumina-jira.atlassian.net](https://lumina-jira.atlassian.net) |
| GitHub | [github.com/lumina-energy](https://github.com/lumina-energy) |
| Grafana | [grafana.lumina-internal.com](https://grafana.lumina-internal.com) |
| Kibana | [kibana.lumina-internal.com](https://kibana.lumina-internal.com) |
| Staging Portal | [app.staging.helios.lumina.energy](https://app.staging.helios.lumina.energy) |
| Staging API | [api.staging.helios.lumina.energy](https://api.staging.helios.lumina.energy) |
| Status Page | [status.helios.lumina.energy](https://status.helios.lumina.energy) |
| PagerDuty | [lumina.pagerduty.com](https://lumina.pagerduty.com) |
| 1Password | [lumina.1password.com](https://lumina.1password.com) |
| macOS Dev Setup | Confluence: Dev Setup → macOS |
| Internal CA Setup | Confluence: Dev Setup → Internal CA |
| HR/Workday | [lumina.workday.com](https://lumina.workday.com) |

---

*Welcome to Helios. We're glad you're here. Ask questions freely — there are no stupid questions in the first month. The only mistake is suffering in silence.*

*Questions about this guide: `#developer-experience` Slack or Priya Nair directly.*
