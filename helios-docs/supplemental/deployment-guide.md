# Deployment Guide

**Owner:** Priya Nair (Developer Experience) + Rosa Lindqvist (Platform Engineering)
**Team:** Platform Engineering
**Last Updated:** 2024-10-31
**Applies to:** All Helios services
**Related Docs:** [CI/CD Pipeline](/04-platform/ci-cd-pipeline.md) · [Kubernetes Guide](/04-platform/kubernetes-guide.md) · [Git Workflow](/05-engineering/git-workflow.md) · [Monitoring & Observability](/04-platform/monitoring-observability.md) · [Incident Response Runbook](/06-operations/incident-response-runbook.md)

---

> **Priya, 2024-10-31:** Updated the production deployment checklist following the INC-2024-0924 incident where a deploy without database migration pre-check caused ~12 minutes of portal downtime. The incident highlighted a gap in our pre-deploy checklist. The new §4 (Pre-Deploy Checklist) is now mandatory for all production deploys.
>
> **Rosa, 2024-07-15:** Added the rollback procedure for Terraform infrastructure changes — previously this wasn't documented and engineers were improvising during incidents. Terraform rollbacks are NOT the same as service rollbacks.

---

## Table of Contents

1. [Deployment Philosophy](#deployment-philosophy)
2. [Environments](#environments)
3. [Standard Deployment Flow](#standard-deployment-flow)
4. [Pre-Deploy Checklist](#pre-deploy-checklist)
5. [Service-Specific Deployment Notes](#service-specific-deployment-notes)
6. [Database Migrations](#database-migrations)
7. [Feature Flag Rollout](#feature-flag-rollout)
8. [Rollback Procedures](#rollback-procedures)
9. [Post-Deploy Verification](#post-deploy-verification)
10. [Emergency Hotfix Process](#emergency-hotfix-process)
11. [Infrastructure Deployments (Terraform)](#infrastructure-deployments-terraform)

---

## 1. Deployment Philosophy

Helios manages critical national infrastructure. Our deployment practices reflect that:

- **Zero-downtime deployments are mandatory.** We use rolling updates, blue-green for major changes. No scheduled maintenance windows.
- **Backward compatibility is required.** During a rolling deploy, old and new code run simultaneously. Database schemas, API contracts, and Kafka message schemas must be backward-compatible across at least one version boundary.
- **Deployments should be reversible.** Every deploy must have a tested rollback path. If you can't describe how to roll it back, it's not ready to deploy.
- **Small, frequent deploys are preferred over large batches.** Easier to debug, easier to roll back, lower blast radius.
- **Production deploys require SRE awareness.** Not approval for every deploy, but SRE should know a significant deploy is happening.

---

## 2. Environments

| Environment | Purpose | Access | Deploy trigger | Data |
|-------------|---------|--------|----------------|------|
| **local** | Individual dev | Developer only | Manual `docker-compose` | Synthetic/seed data |
| **dev** | Integration testing, rapid iteration | Engineering (all) | Merge to any feature branch | Anonymised staging data subset |
| **staging** | Pre-production verification, QA | Engineering (all) | Merge to `develop` | Anonymised replica of production |
| **production** | Live customer traffic | SRE + release managers | Merge to `main` + manual promote | Real customer data |

### Environment URLs

| Environment | Portal | API | GraphQL |
|-------------|--------|-----|---------|
| Dev | `app.dev.helios.lumina.energy` | `api.dev.helios.lumina.energy` | `api.dev.helios.lumina.energy/graphql` |
| Staging | `app.staging.helios.lumina.energy` | `api.staging.helios.lumina.energy` | `api.staging.helios.lumina.energy/graphql` |
| Production | `app.helios.lumina.energy` | `api.helios.lumina.energy` | `api.helios.lumina.energy/graphql` |

---

## 3. Standard Deployment Flow

### Automated Path (Most Deploys)

```
Developer merges PR to `develop`
        │
        ▼
GitHub Actions: build + test + security scan
        │ (passes)
        ▼
Docker image built + tagged (git SHA)
Image pushed to ECR
        │
        ▼
ArgoCD detects new image tag in Helm chart values
        │
        ▼
ArgoCD applies rolling update to staging EKS cluster
        │
        ▼
Staging smoke tests run (automated)
        │
        ▼
Slack notification: ✅ Staging deploy successful: helios-api@abc1234
        │
        ▼ (manual step: release manager)
Release manager reviews staging
Creates release tag: git tag v4.7.2
Pushes tag: git push origin v4.7.2
        │
        ▼
GitHub Actions: release pipeline triggers
        │
        ▼
ArgoCD applies rolling update to production EKS cluster
        │
        ▼
Production smoke tests run (automated)
        │
        ▼
Slack notification: ✅ Production deploy successful: helios-api@v4.7.2
```

### Deployment Commands (Manual Override)

In emergencies or for specific overrides:

```bash
# Force deploy a specific image to staging
kubectl set image deployment/helios-api \
  helios-api=ACCOUNT_ID.dkr.ecr.eu-west-1.amazonaws.com/helios-api:abc1234 \
  -n helios-staging

# Check rollout status
kubectl rollout status deployment/helios-api -n helios-staging

# Trigger ArgoCD sync manually
argocd app sync helios-api-staging --force
```

---

## 4. Pre-Deploy Checklist

**Required for all production deploys. This is a gate — not a suggestion.**

```
PRE-DEPLOY CHECKLIST
Service: ________________
Version: ________________
Release Manager: ________________
Date/Time: ________________

MANDATORY CHECKS
[ ] All automated CI checks passing (GitHub Actions: green)
[ ] Staging deploy verified by release manager or QA (not just automated tests)
[ ] If database migrations: migration tested on staging DB; confirm backward-compat (see §6)
[ ] If Kafka schema changes: schema registered in Schema Registry; backward-compat verified
[ ] If API contract changes: consumer teams notified ≥48h in advance; all consumers tested
[ ] If new feature flags: flags are defaulted to OFF in production
[ ] Rollback procedure identified and documented in deploy ticket
[ ] SRE notified via #deployments Slack (tag @marcus.webb for major changes)

CONDITIONAL CHECKS
[ ] If touching grid event processor: Kafka consumer lag at normal baseline (<1k)
[ ] If touching IoT ingest service: no device cert rotation scheduled this week
[ ] If touching outage detection: Chidi Eze signed off (ML model changes)
[ ] If touching dispatch service: Farah Okonkwo aware (active dispatch jobs must complete)
[ ] If infrastructure change: DR failover plan reviewed

TIMING
[ ] Deploy NOT scheduled during: weekday 07:00–09:00 UTC (morning peak)
[ ] Deploy NOT scheduled during: weekday 17:00–20:00 UTC (evening peak)
[ ] Deploy NOT scheduled during: customer-reported busy periods (check with CSM)
[ ] Deploy NOT scheduled during: on-call engineer's first day on shift

SIGN-OFF
[ ] Release Manager sign-off: ________________
[ ] (For major changes) Team lead sign-off: ________________
[ ] (For infrastructure changes) Rosa Lindqvist or SRE sign-off: ________________
```

> **Why this checklist exists:** The INC-2024-0924 incident happened because a release manager deployed a database migration that was not backward-compatible with the running version. The old pods were querying a column that the migration had renamed. 12 minutes of errors. This checklist would have caught it.

---

## 5. Service-Specific Deployment Notes

### helios-api (Node.js)

- Zero-downtime rolling deploy supported. Default `maxUnavailable: 0`, `maxSurge: 1`
- Has a 30-second `preStop` hook that allows in-flight requests to complete before pod terminates
- Health check: `GET /health` must return 200 before pod becomes live

### helios-portal (Next.js)

- Static assets are served from CloudFront CDN. After a deploy, CloudFront cache is invalidated automatically by the deploy pipeline.
- If you see users reporting the old version after a deploy, run the cache invalidation manually:

```bash
aws cloudfront create-invalidation \
  --distribution-id EXXXXXXX \
  --paths "/*"
```

### grid-event-processor (Go)

- Consumer group rebalancing on deploy causes ~10–30 second processing gap. This is normal.
- Never deploy more than 2 replicas simultaneously — Kafka rebalancing with too many simultaneous changes causes lag spikes.
- Check Kafka consumer lag before and after deploy.

### outage-detection-svc (Python/Go)

- Requires ML model to be loaded on startup — first pod takes ~45 seconds to become ready.
- `initialDelaySeconds: 60` in the readiness probe. Don't shorten this.
- If you change the ML model version, alert the Grid Intelligence team. Outage detection behavior may change.

### dispatch-service (Node.js 16 — LEGACY)

- See [Technical Debt TD-002](/05-engineering/technical-debt-register.md). This service runs Node.js 16 (EOL).
- Rolling restart occasionally causes in-progress dispatch jobs to lose state temporarily.
- **Never deploy dispatch service while there are active SEV-1 outage jobs in progress.** Check the dispatch dashboard first.
- Memory limit: 2Gi. If you see OOMKilled, increase to 2.5Gi (temporary fix only).

### forecasting-engine (Python/FastAPI)

- Model loading takes 30–60 seconds per pod.
- `readinessProbe.initialDelaySeconds: 90`
- After deploying a new model version, verify prediction quality in Grafana (`/d/forecast-quality`) before considering deploy complete.

---

## 6. Database Migrations

Database migrations are the highest-risk part of any deploy. Follow this procedure exactly.

### Zero-Downtime Migration Rules

Migrations must be safe to run while the previous version of the application is still running. This means:

| Operation | Safe? | Notes |
|-----------|-------|-------|
| Add a new nullable column | ✅ | Old code ignores it |
| Add a column with a default value | ✅ | Old code ignores it |
| Rename a column | ❌ | Old code queries old name; it breaks |
| Drop a column | ❌ | Old code queries old name; it breaks |
| Add a new table | ✅ | Old code doesn't know about it |
| Drop a table | ❌ | Only after old code is fully gone |
| Add NOT NULL to existing column | ⚠️ | Safe only if all rows have values |
| Change column type | ❌ | Almost always breaking |
| Add unique constraint | ⚠️ | Will fail if duplicates exist |
| Add index | ✅ (use `CONCURRENTLY`) | `CREATE INDEX CONCURRENTLY` |

### Migration Procedure

```bash
# 1. Test migration on staging (mandatory)
npm run db:migrate:up --env staging

# Verify application on staging behaves correctly with new schema
# Verify old pods (if any still running) haven't broken

# 2. Backup production (automated daily, but verify recency)
# Check most recent snapshot in RDS Console: should be <6 hours old

# 3. Run migration on production
# IMPORTANT: Run migration BEFORE deploying new application code
# The new schema must be backward-compatible with the old code version
npm run db:migrate:up --env production

# 4. Verify migration
psql -h rds-proxy.helios-prod.svc -U helios_app -d helios_production -c \
  "SELECT migration_name, applied_at FROM db_migrations ORDER BY applied_at DESC LIMIT 5"

# 5. Deploy new application code (now safe to use new schema)
# (via normal deploy pipeline)
```

### Multi-Step Migration Pattern (for breaking changes)

If you genuinely need a breaking schema change (column rename, type change), use three deploys:

1. **Deploy 1:** Add new column/table alongside old one. Write to both. Read from old.
2. **Deploy 2:** Migrate data from old to new. Verify. Switch reads to new.
3. **Deploy 3:** Remove old column/table.

Yes, this takes longer. It's the correct approach.

---

## 7. Feature Flag Rollout

LaunchDarkly feature flags are used for gradual rollout of significant features.

```typescript
// Checking a feature flag in the API
import { getLaunchDarklyClient } from '@lumina/feature-flags';

const client = getLaunchDarklyClient();

const context = {
  kind: 'customer',
  key: req.auth.customerId,
  customerTier: req.auth.customerTier,
};

const isNewForecastingUIEnabled = client.variation(
  'forecasting-ui-v2',
  context,
  false  // default — flag defaults to OFF
);
```

### Rollout Pattern

```
Deploy to production with flag OFF (default)
        │
        ▼
Enable for internal test account (Lumina internal customer)
Verify for 24 hours
        │
        ▼
Enable for 1 pilot customer (agreed in advance with CSM)
Verify for 48 hours
        │
        ▼
Progressive rollout: 10% → 25% → 50% → 100% of customers
Each step: 24-hour hold + monitoring
        │
        ▼
Full rollout confirmed → Remove flag from code (within 1 sprint)
```

**Don't leave feature flags in the code indefinitely.** After full rollout, remove the flag and its associated code branching within one sprint. Flags that persist indefinitely become maintenance debt.

---

## 8. Rollback Procedures

### Application Service Rollback (Fast — <5 minutes)

```bash
# Check rollout history
kubectl rollout history deployment/helios-api -n helios-prod

# Rollback to previous version
kubectl rollout undo deployment/helios-api -n helios-prod

# Rollback to a specific revision
kubectl rollout undo deployment/helios-api -n helios-prod --to-revision=3

# Watch the rollback progress
kubectl rollout status deployment/helios-api -n helios-prod

# Verify the correct image is now running
kubectl get deployment helios-api -n helios-prod -o jsonpath='{.spec.template.spec.containers[0].image}'
```

### Database Migration Rollback

Migrations should have `down` scripts. If a migration caused a problem:

```bash
# Roll back the most recent migration
npm run db:migrate:down --env production

# Check what rolled back
psql -h rds-proxy.helios-prod.svc -U helios_app -d helios_production -c \
  "SELECT migration_name, applied_at FROM db_migrations ORDER BY applied_at DESC LIMIT 10"
```

> **Warning:** Downward migrations can cause data loss if the migration added data or columns. Test the down migration on staging first. If the down migration is unsafe, treat this as a data incident and involve Rosa Lindqvist.

### Full Helm Chart Rollback

If a complex change affected multiple services:

```bash
# List recent releases
helm history helios -n helios-prod

# Rollback to previous release
helm rollback helios [REVISION_NUMBER] -n helios-prod --wait
```

---

## 9. Post-Deploy Verification

After every production deploy, verify these within 10 minutes:

```bash
# 1. Check all pods are Running
kubectl get pods -n helios-prod | grep -v Running | grep -v Completed
# Expected: no output (all Running or Completed)

# 2. Check error rate in Grafana
# Dashboard: /d/api-health
# Key metric: http_requests_total{status=~"5.."}
# Should be: <0.1% of total requests

# 3. Check Kafka consumer lag
kafka-consumer-groups.sh \
  --bootstrap-server kafka.helios-prod.svc:9092 \
  --describe --group grid-processor-consumer \
  | awk '{print $5}' | sort -n | tail -5
# Expected: all lags <1000

# 4. Quick API health check
curl -sS https://api.helios.lumina.energy/health | jq .
# Expected: {"status":"healthy","version":"v4.7.x","timestamp":"..."}

# 5. Synthetic transaction check (automated, check in Grafana)
# Dashboard: /d/synthetic-checks
# All synthetic transactions should pass within 2 minutes of deploy
```

If any of these fail, initiate rollback immediately and create an incident.

---

## 10. Emergency Hotfix Process

For critical production bugs requiring immediate fix outside the normal release cycle:

```bash
# 1. Create hotfix branch from main (not develop)
git checkout main
git pull origin main
git checkout -b hotfix/HELIOS-XXXX-brief-description

# 2. Make the minimal fix — no extra cleanup, no refactoring
# 3. Write a regression test
# 4. Push and create PR targeting main (not develop)

git push origin hotfix/HELIOS-XXXX-brief-description
# Create PR: base branch = main

# 5. Get expedited review (2 reviewers minimum, even for hotfixes)
# Tag @marcus.webb and the relevant service owner

# 6. Merge to main → triggers deploy pipeline
# 7. After production deploy, cherry-pick to develop to keep branches in sync
git checkout develop
git cherry-pick main..hotfix/HELIOS-XXXX-brief-description
```

**Hotfix rules:**
- Minimum 2 code reviewers (quality doesn't drop under pressure)
- SRE must be aware before merge
- Hotfix scope is strictly the minimum fix — no other changes
- Cherry-pick to `develop` within 24 hours to prevent branch divergence

---

## 11. Infrastructure Deployments (Terraform)

Terraform infrastructure changes have a separate and more cautious process.

```bash
# All Terraform changes go through the same PR process as application code
# Repo: lumina-energy/helios-infra

# Before raising a Terraform PR:
terraform fmt
terraform validate
terraform plan -out=tfplan 2>&1 | tee terraform-plan.txt

# The plan output must be included in the PR description
# For any destructive operations (destroy, replace): explicit approval from Rosa Lindqvist required

# Applying in production (done by Rosa or approved SRE only):
terraform apply tfplan

# NEVER run terraform apply without a reviewed plan file
# NEVER run terraform apply in production without SRE sign-off
```

### Terraform Rollback

Unlike Kubernetes deployments, Terraform doesn't have a simple `rollback` command. "Rollback" for infrastructure means:

1. Revert the Terraform code to the previous state in git
2. Run `terraform plan` to see what changes are needed to revert
3. Apply carefully

For destructive infrastructure changes (e.g., accidentally deleted a security group), you cannot automatically recover — this becomes an incident. Rosa Lindqvist should be paged immediately.

---

*Questions about deployments: `#deployments` Slack or Priya Nair. Infrastructure deployment questions: Rosa Lindqvist.*
*Emergency: if a deploy caused a production incident, go to the [Incident Response Runbook](/06-operations/incident-response-runbook.md) immediately.*
