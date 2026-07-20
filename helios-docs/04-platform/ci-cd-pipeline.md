# CI/CD Pipeline — Helios

> **Location:** Confluence → Helios Engineering Space → Platform → CI/CD Pipeline  
> **Owner:** Fatima Al-Rashid (Engineer, Platform) · @fatima.alrashid  
> **Last Updated:** 2024-10-14  
> **Status:** Current — GitHub Actions, Flux v2  
> **Related:** [Kubernetes Guide](/04-platform/kubernetes-guide.md) · [Git Workflow](/05-engineering/git-workflow.md) · [Deployment Guide](/supplemental/deployment-guide.md) · [Monitoring & Observability](/04-platform/monitoring-observability.md)

---

## Pipeline Philosophy

We follow a **"you build it, you ship it"** model. Each team owns the CI/CD for their services. The Platform team provides:
- Shared GitHub Actions reusable workflows (`lumina-energy/helios-actions`)
- The promotion mechanism from staging → production (Flux image automation)
- The release gate tooling

The pipeline is deliberately simple: **build → test → publish → deploy**. We do not have a separate QA environment or a manual sign-off gate (except for production promotions). The emphasis is on automated testing being good enough that manual gates are not needed.

---

## Repository CI Workflows

Every service repository has a `.github/workflows/` directory with three main workflows:

### 1. `ci.yaml` — Pull Request Checks

Runs on every PR. Must pass before merging.

```yaml
# .github/workflows/ci.yaml (helios-grid-monitor example)
name: CI

on:
  pull_request:
    branches: [main]

env:
  GO_VERSION: "1.22"
  IMAGE_NAME: helios/grid-monitor

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with: { go-version: "${{ env.GO_VERSION }}" }
      - name: golangci-lint
        uses: golangci/golangci-lint-action@v4
        with:
          version: v1.57
          args: --timeout=5m

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: timescale/timescaledb:latest-pg15
        env:
          POSTGRES_PASSWORD: testpassword
          POSTGRES_DB: helios_test
        ports: ["5432:5432"]
        options: --health-cmd pg_isready
      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with: { go-version: "${{ env.GO_VERSION }}" }
      - name: Run unit tests
        run: go test ./... -count=1 -timeout=300s -race
        env:
          TEST_DB_URL: postgres://postgres:testpassword@localhost:5432/helios_test
          TEST_REDIS_URL: redis://localhost:6379
      - name: Coverage report
        run: |
          go test ./... -coverprofile=coverage.out
          go tool cover -func=coverage.out | tail -1
          # Fail if coverage < 70%
          COVERAGE=$(go tool cover -func=coverage.out | tail -1 | awk '{print $3}' | tr -d '%')
          if (( $(echo "$COVERAGE < 70" | bc -l) )); then
            echo "Coverage $COVERAGE% is below the 70% threshold"
            exit 1
          fi

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Trivy vulnerability scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: fs
          scan-ref: .
          severity: CRITICAL,HIGH
          exit-code: 1   # Fail on CRITICAL or HIGH vulnerabilities

  integration-test:
    runs-on: ubuntu-latest
    needs: [lint, test]
    if: github.event.pull_request.draft == false
    steps:
      - uses: actions/checkout@v4
      - name: Run integration tests
        uses: lumina-energy/helios-actions/.github/workflows/integration-test.yaml@main
        with:
          service: grid-monitor
          environment: dev
        secrets: inherit
```

### 2. `build-push.yaml` — Image Build and Push

Runs on every push to `main` (after PR merge). Builds the Docker image, runs a final security scan, and pushes to ECR.

```yaml
# .github/workflows/build-push.yaml
name: Build and Push

on:
  push:
    branches: [main]

jobs:
  build-push:
    runs-on: ubuntu-latest
    permissions:
      id-token: write   # Required for OIDC → AWS auth
      contents: read

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::141592653589:role/helios-github-actions-push
          aws-region: us-east-1

      - name: Login to Amazon ECR
        id: ecr-login
        uses: aws-actions/amazon-ecr-login@v2

      - name: Set image metadata
        id: meta
        run: |
          SHORT_SHA=$(echo ${{ github.sha }} | cut -c1-8)
          echo "tag=${SHORT_SHA}" >> $GITHUB_OUTPUT
          echo "image=${{ steps.ecr-login.outputs.registry }}/helios/grid-monitor:${SHORT_SHA}" >> $GITHUB_OUTPUT

      - name: Build Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: false
          load: true
          tags: ${{ steps.meta.outputs.image }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            BUILD_VERSION=${{ github.sha }}
            BUILD_DATE=${{ github.event.head_commit.timestamp }}

      - name: Container image security scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ steps.meta.outputs.image }}
          severity: CRITICAL
          exit-code: 1  # Never push a CRITICAL vulnerability to ECR

      - name: Push to ECR
        run: docker push ${{ steps.meta.outputs.image }}

      - name: Tag as latest
        run: |
          docker tag ${{ steps.meta.outputs.image }} \
            ${{ steps.ecr-login.outputs.registry }}/helios/grid-monitor:latest
          docker push ${{ steps.ecr-login.outputs.registry }}/helios/grid-monitor:latest

      - name: Update Helm values for staging auto-deploy
        uses: lumina-energy/helios-actions/.github/workflows/update-image-tag.yaml@main
        with:
          service: grid-monitor
          environment: staging
          image-tag: ${{ steps.meta.outputs.tag }}
        secrets: inherit
```

### 3. `promote-to-prod.yaml` — Production Promotion

Run manually (workflow_dispatch) by the deploying engineer after staging validation.

```yaml
# .github/workflows/promote-to-prod.yaml
name: Promote to Production

on:
  workflow_dispatch:
    inputs:
      image-tag:
        description: 'Image tag to deploy (short SHA)'
        required: true
      release-notes:
        description: 'Brief release notes for this deployment'
        required: true

jobs:
  pre-flight:
    runs-on: ubuntu-latest
    steps:
      - name: Verify tag is deployed in staging
        uses: lumina-energy/helios-actions/.github/workflows/verify-staging.yaml@main
        with:
          service: grid-monitor
          image-tag: ${{ inputs.image-tag }}

      - name: Check for open Sev-1 incidents
        run: |
          # Fail if there is an open Sev-1 incident (do not deploy during active incidents)
          OPEN_INCIDENTS=$(curl -s -H "Authorization: Token ${{ secrets.PAGERDUTY_TOKEN }}" \
            "https://api.pagerduty.com/incidents?statuses[]=triggered&statuses[]=acknowledged&urgencies[]=high" \
            | jq '.total')
          if [ "$OPEN_INCIDENTS" -gt "0" ]; then
            echo "ERROR: $OPEN_INCIDENTS open high-urgency incidents. Do not deploy during active incidents."
            exit 1
          fi

  promote:
    needs: pre-flight
    runs-on: ubuntu-latest
    environment: production   # Requires GitHub environment approval from @platform-team
    steps:
      - name: Update production image tag in helios-infra
        uses: lumina-energy/helios-actions/.github/workflows/update-image-tag.yaml@main
        with:
          service: grid-monitor
          environment: prod
          image-tag: ${{ inputs.image-tag }}
          release-notes: ${{ inputs.release-notes }}
        secrets: inherit

      - name: Post deployment notification to Slack
        run: |
          curl -X POST ${{ secrets.SLACK_WEBHOOK_RELEASES }} \
            -H 'Content-type: application/json' \
            --data '{
              "text": "🚀 *grid-monitor* deployed to production\nVersion: `${{ inputs.image-tag }}`\nNotes: ${{ inputs.release-notes }}\nDeployed by: ${{ github.actor }}"
            }'
```

---

## Staging Auto-Deployment

After a PR merges to `main`, the image is built, scanned, pushed to ECR, and the `helios-infra` repo is automatically updated with the new image tag for staging. Flux then picks up the change and deploys it to staging within ~2 minutes.

```
PR merged to main
  → build-push.yaml runs
  → Image pushed to ECR with short SHA tag
  → helios-infra/k8s/overlays/staging/grid-monitor-values.yaml updated:
      image.tag: "a1b2c3d4"
  → Flux detects change in helios-infra
  → Applies updated HelmRelease to helios-staging-eks
  → Rolling update completes (~3-5 minutes)
```

Engineers can see their changes in staging at `https://staging.luminaenergy.com` typically within **8-12 minutes** of merging a PR.

---

## Dockerfile Standards

All service Dockerfiles follow these conventions:

```dockerfile
# Go service example (helios-grid-monitor/Dockerfile)

# ---- Build stage ----
FROM golang:1.22-alpine AS builder

# Install build tools
RUN apk add --no-cache git ca-certificates tzdata

WORKDIR /build

# Copy go.mod first for layer caching
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Build arguments for embedding version info
ARG BUILD_VERSION=dev
ARG BUILD_DATE=unknown

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
  -ldflags="-w -s -X main.Version=${BUILD_VERSION} -X main.BuildDate=${BUILD_DATE}" \
  -o /build/app ./cmd/gridmonitor/main.go

# ---- Final stage ----
FROM scratch  # Minimal image — no shell, no package manager

# Copy CA certs (needed for TLS calls to external services)
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo
COPY --from=builder /build/app /app

# Non-root user (UID 1000)
USER 1000:1000

EXPOSE 8080 9090

ENTRYPOINT ["/app"]
```

```dockerfile
# Node.js service example (helios-api-gateway/Dockerfile)

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN addgroup -S helios && adduser -S helios -G helios
COPY --from=builder --chown=helios:helios /app/dist ./dist
COPY --from=builder --chown=helios:helios /app/node_modules ./node_modules
USER helios
EXPOSE 4000
CMD ["node", "dist/server.js"]
```

---

## Release Process

A "release" in Helios is a collection of service deployments associated with a version tag. We do not release all services simultaneously — services are deployed independently. The version tag (`v4.7.1`) refers to the platform's overall product version, which is incremented when a significant set of features and fixes has been shipped.

**Release checklist** (maintained in `helios-docs/supplemental/deployment-guide.md`):

1. All services for this release are deployed to staging and green for 24+ hours
2. No open Sev-1 or Sev-2 incidents
3. Post-deployment smoke tests pass (automated E2E in staging)
4. Release notes drafted in `supplemental/release-notes.md`
5. Customer-impacting changes communicated to Customer Success (3 business days notice for breaking changes)
6. On-call engineer is online and available during the production deploy window

**Deploy window:** Production deployments happen Monday–Thursday, 10:00–15:00 CT. No Friday deployments. No deployments the week before or during a major customer demand response event or system upgrade.

---

## Security in CI/CD

- **OIDC for AWS auth:** GitHub Actions uses OIDC to assume AWS IAM roles. No long-lived AWS credentials stored in GitHub secrets.
- **Container scanning:** Every image is scanned with Trivy before pushing. CRITICAL vulnerabilities block the pipeline.
- **Dependency scanning:** Dependabot is enabled on all repos for automatic security PRs.
- **Secret scanning:** GitHub secret scanning is enabled. Commits containing API keys or passwords are blocked.
- **SAST:** Semgrep runs on every PR against the Go and TypeScript rulesets.
- **Supply chain:** All GitHub Actions are pinned to commit SHA (not version tags) to prevent supply-chain attacks.

---

## Common Pipeline Failures and Fixes

| Failure | Cause | Fix |
|---|---|---|
| `coverage below 70%` | New code without tests | Add unit tests; don't skip the coverage gate |
| `CRITICAL vulnerability found` | Outdated base image or dependency | Update base image: `golang:1.22-alpine` → latest patch; bump vulnerable dep |
| `staging image tag not found` | Build-push workflow failed | Check Actions tab for the failed build, re-run |
| `open incidents found` | Active Sev-1 incident | Do NOT deploy; resolve incident first |
| `ECR push: access denied` | OIDC role wrong or expired | Check the IRSA role trust policy in Terraform; re-run after fix |
| Flux not picking up changes | helios-infra PR not merged | Merge the image tag update PR in helios-infra, or force reconcile |

---

*Document maintained by @fatima.alrashid*  
*GitHub Actions reusable workflows → @fatima.alrashid*  
*Flux GitOps → @kenji.watanabe*  
*Related: [Kubernetes Guide](/04-platform/kubernetes-guide.md) · [Git Workflow](/05-engineering/git-workflow.md) · [Deployment Guide](/supplemental/deployment-guide.md)*
